/**
 * Livestream service for managing livestreams with WebRTC
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import { User } from '../../shared/schema';
import stripeClient from './stripe-client';

// Define interfaces for livestream management
interface LivestreamViewer {
  userId: number;
  socketId: string;
  username: string;
  joinTime: Date;
}

interface LivestreamParticipant {
  userId: number;
  userType: 'host' | 'viewer';
  socketId: string;
}

interface ActiveLivestream {
  id: number;
  roomId: string;
  hostId: number;
  title: string;
  description: string;
  startTime: Date;
  viewers: LivestreamViewer[];
  status: 'waiting' | 'live' | 'ended';
  category?: string;
  thumbnailUrl?: string;
}

interface LivestreamGift {
  id: string;
  senderId: number;
  senderName: string;
  amount: number;
  message?: string;
  type: 'applause' | 'energy' | 'cosmic' | 'enlightenment' | 'custom';
  timestamp: Date;
}

class LivestreamService {
  private io: SocketIOServer | null = null;
  private connectedParticipants: Map<number, LivestreamParticipant> = new Map();
  private activeLivestreams: Map<string, ActiveLivestream> = new Map();
  private storage = storage;
  
  /**
   * Create a new livestream
   * @param user The user creating the livestream
   * @param title The livestream title
   * @param description The livestream description
   * @returns The created livestream data
   */
  async createLivestream(
    user: User,
    title: string,
    description: string
  ): Promise<any> {
    try {
      // Validate user is a reader
      if (user.role !== 'reader') {
        throw new Error('Only readers can create livestreams');
      }
      
      // Create a unique room ID for this livestream
      const roomId = `livestream-${user.id}-${Date.now()}`;
      
      // Create the livestream in database
      const newLivestream = await this.storage.createLivestream({
        userId: user.id,
        title,
        description,
        status: 'scheduled',
        roomId: roomId,
        createdAt: new Date(),
        category: 'general' // Adding required category field
      });
      
      console.log(`Created livestream: ${newLivestream.id} for user=${user.id}, roomId=${roomId}`);
      
      return newLivestream;
    } catch (error) {
      console.error('Failed to create livestream:', error);
      throw error;
    }
  }

  /**
   * Start a livestream
   * @param livestreamId The ID of the livestream to start
   * @param reinstantiate Whether to reinstantiate an already started livestream
   * @returns The updated livestream data
   */
  async startLivestream(
    livestreamId: number,
    reinstantiate: boolean = false
  ): Promise<any> {
    try {
      // Get the livestream from storage
      const livestream = await this.storage.getLivestream(livestreamId);
      if (!livestream) {
        throw new Error(`Livestream not found: ${livestreamId}`);
      }
      
      // If already started and not reinstantiating, return as is
      if (livestream.status === 'live' && !reinstantiate) {
        return livestream;
      }
      
      // Update the livestream in storage
      const updatedLivestream = await this.storage.updateLivestream(livestreamId, {
        status: 'live',
        startedAt: new Date()
      });
      
      // Create an active livestream in memory if not exists
      if (!this.activeLivestreams.has(livestream.roomId)) {
        this.activeLivestreams.set(livestream.roomId, {
          id: livestreamId,
          roomId: livestream.roomId,
          hostId: livestream.userId,
          title: livestream.title,
          description: livestream.description,
          startTime: new Date(),
          viewers: [],
          status: 'live',
          category: livestream.category,
          thumbnailUrl: livestream.thumbnailUrl
        });
      } else {
        // Update existing active livestream
        const existingLivestream = this.activeLivestreams.get(livestream.roomId);
        if (existingLivestream) {
          existingLivestream.status = 'live';
          this.activeLivestreams.set(livestream.roomId, existingLivestream);
        }
      }
      
      console.log(`Started livestream: ${livestreamId}, roomId=${livestream.roomId}`);
      
      return updatedLivestream;
    } catch (error) {
      console.error('Failed to start livestream:', error);
      throw error;
    }
  }

  /**
   * End a livestream
   * @param livestreamId The ID of the livestream to end
   * @returns The updated livestream data
   */
  async endLivestream(livestreamId: number): Promise<any> {
    try {
      // Get the livestream from storage
      const livestream = await this.storage.getLivestream(livestreamId);
      if (!livestream) {
        throw new Error(`Livestream not found: ${livestreamId}`);
      }
      
      // Update the livestream in storage
      const updatedLivestream = await this.storage.updateLivestream(livestreamId, {
        status: 'ended',
        endedAt: new Date()
      });
      
      // Update active livestream in memory
      if (this.activeLivestreams.has(livestream.roomId)) {
        const activeLivestream = this.activeLivestreams.get(livestream.roomId);
        if (activeLivestream) {
          activeLivestream.status = 'ended';
          this.activeLivestreams.set(livestream.roomId, activeLivestream);
          
          // Notify all viewers that the livestream has ended
          if (this.io) {
            this.io.to(livestream.roomId).emit('livestream-ended', {
              livestreamId,
              hostId: livestream.userId,
              timestamp: new Date()
            });
          }
        }
      }
      
      console.log(`Ended livestream: ${livestreamId}`);
      
      return updatedLivestream;
    } catch (error) {
      console.error('Failed to end livestream:', error);
      throw error;
    }
  }
  
  /**
   * Get details of a livestream
   * @param livestreamId The ID of the livestream
   * @returns The livestream details
   */
  async getLivestreamDetails(livestreamId: number): Promise<any> {
    try {
      // Get the livestream from storage
      const livestream = await this.storage.getLivestream(livestreamId);
      if (!livestream) {
        throw new Error(`Livestream not found: ${livestreamId}`);
      }
      
      // Get active livestream info if available
      const activeLivestream = this.activeLivestreams.get(livestream.roomId);
      
      // Combine database and active information
      return {
        ...livestream,
        viewerCount: activeLivestream ? activeLivestream.viewers.length : 0,
        isActive: activeLivestream ? activeLivestream.status === 'live' : false
      };
    } catch (error) {
      console.error('Failed to get livestream details:', error);
      throw error;
    }
  }
  
  /**
   * Generate token for joining a livestream
   * @param userId The user ID
   * @param roomName The room name
   * @param displayName The display name
   * @returns The token
   */
  generateLivestreamToken(
    userId: number,
    roomName: string,
    displayName: string
  ): {token: string, roomId: string} {
    return {
      token: `webrtc-livestream-${roomName}-${userId}-${Date.now()}`,
      roomId: roomName
    };
  }
  
  /**
   * Generate token for a reader to host a livestream
   * @param userId The user ID
   * @param roomName The room name
   * @param displayName The display name
   * @returns The token
   */
  generateReaderLivestreamToken(
    userId: number,
    roomName: string,
    displayName: string
  ): {token: string, roomId: string} {
    return {
      token: `webrtc-livestream-host-${roomName}-${userId}-${Date.now()}`,
      roomId: roomName
    };
  }
  
  /**
   * Initialize the WebRTC livestream service
   * @param server HTTP server
   */
  initialize(server: HTTPServer) {
    if (this.io) {
      console.log('Livestream service already initialized');
      return;
    }
    
    // Use the existing socket.io instance from webRTCService if available
    try {
      // Import dynamically instead of using require
      import('./webrtc-service').then(module => {
        const webRTCService = module.webRTCService;
        if (webRTCService && webRTCService.getIO()) {
          this.io = webRTCService.getIO();
          console.log('Livestream service using existing Socket.IO instance from WebRTC service');
          this.setupSocketHandlers();
        } else {
          // Create a new Socket.IO server as fallback with a different namespace
          this.io = new SocketIOServer(server, {
            path: '/livestream-socket',
            cors: {
              origin: '*',
              methods: ['GET', 'POST']
            }
          });
          console.log('Livestream service created new Socket.IO instance with custom path');
          this.setupSocketHandlers();
        }
      }).catch(err => {
        console.error('Error importing WebRTC service:', err);
        // Create a new Socket.IO server with a different path
        this.io = new SocketIOServer(server, {
          path: '/livestream-socket',
          cors: {
            origin: '*',
            methods: ['GET', 'POST']
          }
        });
        this.setupSocketHandlers();
      });
      
      // Return here as socket setup will happen asynchronously
      return;
    } catch (error) {
      console.error('Error getting WebRTC service IO, creating new instance:', error);
      // Create a new Socket.IO server with a different path
      this.io = new SocketIOServer(server, {
        path: '/livestream-socket',
        cors: {
          origin: '*',
          methods: ['GET', 'POST']
        }
      });
      // Setup socket handlers in this case
      this.setupSocketHandlers();
    }
    
    console.log('Livestream service initialized');
  }

  /**
   * Set up socket event handlers for livestreams
   */
  private setupSocketHandlers() {
    if (!this.io) {
      console.error('Cannot setup livestream socket handlers: io is null');
      return;
    }

    this.io.on('connection', (socket) => {
      console.log(`Livestream socket connected: ${socket.id}`);

      // Handle user registration for livestream
      socket.on('register-livestream', async (data: { userId: number; userType: 'host' | 'viewer'; displayName: string }) => {
        try {
          const { userId, userType, displayName } = data;
          
          if (!userId || !userType) {
            socket.emit('livestream-registered', { success: false, error: 'Missing user information' });
            return;
          }

          // Verify user exists
          const user = await this.storage.getUser(userId);
          if (!user) {
            socket.emit('livestream-registered', { success: false, error: 'User not found' });
            return;
          }

          // Register the participant
          this.connectedParticipants.set(userId, {
            userId,
            userType,
            socketId: socket.id
          });

          socket.emit('livestream-registered', { success: true });
          console.log(`Livestream participant registered: ${userId} (${userType})`);
        } catch (error) {
          console.error('Error registering livestream participant:', error);
          socket.emit('livestream-registered', { success: false, error: 'Registration failed' });
        }
      });

      // Handle joining a livestream
      socket.on('join-livestream', async (data: { roomId: string; userId: number; userType: 'host' | 'viewer' }) => {
        try {
          const { roomId, userId, userType } = data;
          
          if (!roomId || !userId || !userType) {
            socket.emit('error', { message: 'Missing livestream information' });
            return;
          }

          // Get livestream by room ID
          const livestreams = await this.storage.getLivestreams();
          const livestream = livestreams.find(ls => ls.roomId === roomId);
          
          if (!livestream) {
            socket.emit('error', { message: 'Livestream not found' });
            return;
          }

          // Verify livestream is active
          if (livestream.status !== 'live') {
            socket.emit('error', { message: 'Livestream is not live' });
            return;
          }

          // Verify user if host
          if (userType === 'host' && livestream.userId !== userId) {
            socket.emit('error', { message: 'Only the creator can host this livestream' });
            return;
          }

          // Join the room
          socket.join(roomId);
          
          // Get user info
          const user = await this.storage.getUser(userId);
          
          // Add to active livestream if not exists
          if (!this.activeLivestreams.has(roomId)) {
            this.activeLivestreams.set(roomId, {
              id: livestream.id,
              roomId,
              hostId: livestream.userId,
              title: livestream.title,
              description: livestream.description,
              startTime: new Date(),
              viewers: [],
              status: 'live',
              category: livestream.category,
              thumbnailUrl: livestream.thumbnailUrl
            });
          }
          
          const activeLivestream = this.activeLivestreams.get(roomId);
          
          if (activeLivestream) {
            // If viewer, add to viewers list
            if (userType === 'viewer') {
              const existingViewerIndex = activeLivestream.viewers.findIndex(v => v.userId === userId);
              
              if (existingViewerIndex >= 0) {
                // Update existing viewer
                activeLivestream.viewers[existingViewerIndex].socketId = socket.id;
                activeLivestream.viewers[existingViewerIndex].joinTime = new Date();
              } else {
                // Add new viewer
                activeLivestream.viewers.push({
                  userId,
                  socketId: socket.id,
                  username: user ? (user.fullName || user.username || 'Anonymous') : 'Anonymous',
                  joinTime: new Date()
                });
              }
              
              // Update active livestream
              this.activeLivestreams.set(roomId, activeLivestream);
              
              // Notify host of new viewer
              this.io.to(roomId).emit('viewer-joined', {
                userId,
                username: user ? (user.fullName || user.username || 'Anonymous') : 'Anonymous',
                timestamp: new Date(),
                viewerCount: activeLivestream.viewers.length
              });
            }
            
            // Notify user they've joined
            socket.emit('joined-livestream', {
              roomId,
              livestreamId: livestream.id,
              hostId: livestream.userId,
              viewerCount: activeLivestream.viewers.length,
              timestamp: new Date()
            });
          }
          
          console.log(`User ${userId} joined livestream ${roomId} as ${userType}`);
        } catch (error) {
          console.error('Error joining livestream:', error);
          socket.emit('error', { message: 'Failed to join livestream' });
        }
      });

      // Handle WebRTC signaling for livestream
      socket.on('livestream-offer', (data) => {
        const { roomId, sender, sdp } = data;
        
        // Broadcast to all in the room except sender
        socket.to(roomId).emit('livestream-offer', {
          sender,
          sdp,
          roomId
        });
      });

      socket.on('livestream-answer', (data) => {
        const { roomId, sender, sdp } = data;
        
        // Broadcast to all in the room except sender
        socket.to(roomId).emit('livestream-answer', {
          sender,
          sdp,
          roomId
        });
      });

      socket.on('livestream-ice-candidate', (data) => {
        const { roomId, sender, candidate } = data;
        
        // Broadcast to all in the room except sender
        socket.to(roomId).emit('livestream-ice-candidate', {
          sender,
          candidate,
          roomId
        });
      });

      // Handle chat messages in livestream
      socket.on('livestream-chat', (data) => {
        const { roomId, sender, senderName, message } = data;
        
        // Broadcast message to everyone in the room
        this.io?.to(roomId).emit('livestream-chat', {
          sender,
          senderName,
          message,
          timestamp: new Date()
        });
      });

      // Handle gifts in livestream
      socket.on('livestream-gift', async (data: { 
        roomId: string;
        senderId: number; 
        hostId: number;
        amount: number;
        giftType: string;
        message?: string;
      }) => {
        try {
          const { roomId, senderId, hostId, amount, giftType, message } = data;
          
          // Verify sender
          const sender = await this.storage.getUser(senderId);
          if (!sender) {
            socket.emit('error', { message: 'Sender not found' });
            return;
          }
          
          // Process gift payment
          // This would typically involve a Stripe payment or balance deduction
          // For now, we'll just record the gift
          
          const gift: LivestreamGift = {
            id: uuidv4(),
            senderId,
            senderName: sender.fullName || sender.username || 'Anonymous',
            amount,
            type: giftType as any,
            message,
            timestamp: new Date()
          };
          
          // Store the gift in database
          await this.storage.createGift({
            senderId,
            recipientId: hostId,
            amount,
            type: giftType,
            message: message || '',
            status: 'pending',
            livestreamId: this.activeLivestreams.get(roomId)?.id,
            createdAt: new Date()
          });
          
          // Broadcast gift to everyone in the room
          this.io?.to(roomId).emit('livestream-gift', {
            ...gift,
            timestamp: new Date()
          });
          
          console.log(`Gift sent in livestream ${roomId}: $${amount/100} from ${senderId} to ${hostId}`);
        } catch (error) {
          console.error('Error processing livestream gift:', error);
          socket.emit('error', { message: 'Failed to process gift' });
        }
      });

      // Handle leaving a livestream
      socket.on('leave-livestream', (data: { roomId: string; userId: number; userType: string }) => {
        try {
          const { roomId, userId, userType } = data;
          
          // Remove from room
          socket.leave(roomId);
          
          // Update active livestream
          const activeLivestream = this.activeLivestreams.get(roomId);
          if (activeLivestream && userType === 'viewer') {
            // Remove from viewers list
            activeLivestream.viewers = activeLivestream.viewers.filter(v => v.userId !== userId);
            this.activeLivestreams.set(roomId, activeLivestream);
            
            // Notify host
            this.io?.to(roomId).emit('viewer-left', {
              userId,
              timestamp: new Date(),
              viewerCount: activeLivestream.viewers.length
            });
          }
          
          console.log(`User ${userId} left livestream ${roomId}`);
        } catch (error) {
          console.error('Error leaving livestream:', error);
        }
      });

      // Handle socket disconnection
      socket.on('disconnect', async () => {
        try {
          // Find participant by socket ID
          let disconnectedParticipantId: number | null = null;
          
          for (const [userId, participant] of this.connectedParticipants.entries()) {
            if (participant.socketId === socket.id) {
              disconnectedParticipantId = userId;
              break;
            }
          }
          
          if (disconnectedParticipantId) {
            // Remove from connected participants
            const participant = this.connectedParticipants.get(disconnectedParticipantId);
            this.connectedParticipants.delete(disconnectedParticipantId);
            
            // Update active livestreams
            for (const [roomId, livestream] of this.activeLivestreams.entries()) {
              // If host disconnected, end the livestream
              if (livestream.hostId === disconnectedParticipantId) {
                livestream.status = 'ended';
                this.activeLivestreams.set(roomId, livestream);
                
                // Notify all viewers
                this.io?.to(roomId).emit('livestream-ended', {
                  livestreamId: livestream.id,
                  hostId: livestream.hostId,
                  reason: 'host_disconnected',
                  timestamp: new Date()
                });
                
                // Update database
                await this.storage.updateLivestream(livestream.id, {
                  status: 'ended',
                  endedAt: new Date()
                });
              } else {
                // Remove from viewers list if viewer
                const viewerIndex = livestream.viewers.findIndex(v => v.userId === disconnectedParticipantId);
                if (viewerIndex >= 0) {
                  livestream.viewers.splice(viewerIndex, 1);
                  this.activeLivestreams.set(roomId, livestream);
                  
                  // Notify host
                  this.io?.to(roomId).emit('viewer-left', {
                    userId: disconnectedParticipantId,
                    timestamp: new Date(),
                    viewerCount: livestream.viewers.length
                  });
                }
              }
            }
          }
          
          console.log(`Livestream socket disconnected: ${socket.id}`);
        } catch (error) {
          console.error('Error handling socket disconnection:', error);
        }
      });
    });
  }
  
  /**
   * Get active livestreams
   * @returns List of active livestreams
   */
  getActiveLivestreams(): any[] {
    const activeLivestreams = [];
    
    for (const [roomId, livestream] of this.activeLivestreams.entries()) {
      if (livestream.status === 'live') {
        activeLivestreams.push({
          id: livestream.id,
          roomId,
          hostId: livestream.hostId,
          title: livestream.title,
          description: livestream.description,
          viewerCount: livestream.viewers.length,
          startTime: livestream.startTime,
          category: livestream.category,
          thumbnailUrl: livestream.thumbnailUrl
        });
      }
    }
    
    return activeLivestreams;
  }
}

// Export a singleton instance
export const livestreamService = new LivestreamService();