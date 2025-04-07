import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { sessionService } from './session-service';
import { storage } from '../storage';
import stripeClient from './stripe-client';

interface ConnectedUser {
  userId: number;
  userType: 'reader' | 'client';
  socketId: string;
  inSession: boolean;
  sessionId?: string;
}

interface ActiveSession {
  roomId: string;
  readerId: number;
  clientId: number;
  readerName: string;
  clientName: string;
  type: 'video' | 'voice' | 'chat';
  startTime: Date;
  lastBillingTime: Date;
  duration: number; // in minutes
  status: 'waiting' | 'connected' | 'ended';
  billingDetails?: {
    totalAmount: number;
    clientBilled: number;
    readerEarned: number;
    duration: number;
  };
}

class WebRTCService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<number, ConnectedUser> = new Map();
  private activeSessions: Map<string, ActiveSession> = new Map();
  private storage = storage;
  
  /**
   * Create a new WebRTC session for a reading
   * @param readerId The reader's user ID
   * @param clientId The client's user ID
   * @param type The type of session (video, voice, chat)
   * @returns The created session data
   */
  async createSession(
    readerId: number,
    clientId: number,
    type: 'video' | 'voice' | 'chat'
  ): Promise<{success: boolean, roomId: string}> {
    try {
      // Get user information
      const reader = await this.storage.getUser(readerId);
      const client = await this.storage.getUser(clientId);
      
      if (!reader || !client) {
        throw new Error(`Failed to find users: reader=${!!reader}, client=${!!client}`);
      }
      
      // Create a unique room ID for this session
      const roomId = `reading-${reader.id}-${client.id}-${Date.now()}`;
      
      // Create session in session service for historical records
      sessionService.createSession(
        readerId, 
        clientId, 
        roomId, 
        reader.fullName || reader.username || 'Reader',
        client.fullName || client.username || 'Client',
        type
      );
      
      // Store session in memory
      this.activeSessions.set(roomId, {
        roomId,
        readerId,
        clientId,
        readerName: reader.fullName || reader.username || 'Reader',
        clientName: client.fullName || client.username || 'Client',
        type,
        startTime: new Date(),
        lastBillingTime: new Date(),
        duration: 0,
        status: 'waiting',
        billingDetails: {
          totalAmount: 0,
          clientBilled: 0,
          readerEarned: 0,
          duration: 0
        }
      });
      
      console.log(`Created WebRTC session: ${roomId} for reader=${readerId}, client=${clientId}, type=${type}`);
      
      return {
        success: true,
        roomId
      };
    } catch (error) {
      console.error('Failed to create WebRTC session:', error);
      throw error;
    }
  }

  /**
   * Initialize WebRTC service with HTTP server
   * @param server HTTP server instance
   */
  initialize(server: HTTPServer) {
    if (this.io) {
      console.log('WebRTC service already initialized');
      return;
    }

    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupSocketHandlers();
    console.log('WebRTC service initialized');
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketHandlers() {
    if (!this.io) {
      console.error('Cannot setup socket handlers: io is null');
      return;
    }

    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Handle user registration
      socket.on('register', async (data: { userId: number; userType: 'reader' | 'client' }) => {
        try {
          const { userId, userType } = data;
          
          if (!userId || !userType) {
            socket.emit('registered', { success: false, error: 'Missing user information' });
            return;
          }

          // Get user from database to verify existence
          const user = await this.storage.getUser(userId);
          if (!user) {
            socket.emit('registered', { success: false, error: 'User not found' });
            return;
          }

          // Register the user
          this.connectedUsers.set(userId, {
            userId,
            userType,
            socketId: socket.id,
            inSession: false
          });

          // Update online status in database
          await this.storage.updateUser(userId, { isOnline: true });

          socket.emit('registered', { success: true });
          
          // Broadcast online status change to all clients
          this.broadcastOnlineStatus(userId, true);
          
          console.log(`User registered: ${userId} (${userType})`);
        } catch (error) {
          console.error('Error registering user:', error);
          socket.emit('registered', { success: false, error: 'Registration failed' });
        }
      });

      // Handle join session
      socket.on('join-session', async (data: { roomId: string; userId: number; userType: 'reader' | 'client' }) => {
        try {
          const { roomId, userId, userType } = data;
          
          if (!roomId || !userId || !userType) {
            socket.emit('error', { message: 'Missing session information' });
            return;
          }

          // Get session details
          const session = this.activeSessions.get(roomId);
          
          if (!session) {
            // Session not found in memory, try to retrieve from database
            const dbSession = sessionService.getSessionByRoomName(roomId);
            
            if (!dbSession) {
              socket.emit('error', { message: 'Session not found' });
              return;
            }
            
            // Create session in memory
            this.activeSessions.set(roomId, {
              roomId,
              readerId: dbSession.readerId,
              clientId: dbSession.clientId,
              readerName: dbSession.readerName || 'Reader',
              clientName: dbSession.clientName || 'Client',
              type: dbSession.type as 'video' | 'voice' | 'chat',
              startTime: new Date(),
              lastBillingTime: new Date(),
              duration: 0,
              status: 'waiting',
              billingDetails: {
                totalAmount: 0,
                clientBilled: 0,
                readerEarned: 0,
                duration: 0
              }
            });
          }

          // Update user session status
          const user = this.connectedUsers.get(userId);
          if (user) {
            user.inSession = true;
            user.sessionId = roomId;
            this.connectedUsers.set(userId, user);
          }

          // Join the room
          socket.join(roomId);
          
          // Notify all clients in the room
          this.io.to(roomId).emit('user-joined', {
            userId,
            userType,
            timestamp: new Date()
          });
          
          // Update session status
          const updatedSession = this.activeSessions.get(roomId);
          if (updatedSession && updatedSession.status === 'waiting') {
            updatedSession.status = 'connected';
            updatedSession.startTime = new Date();
            updatedSession.lastBillingTime = new Date();
            this.activeSessions.set(roomId, updatedSession);
            
            // Notify all clients that session has started
            this.io.to(roomId).emit('session-started', {
              roomId,
              timestamp: new Date()
            });
          }
          
          console.log(`User ${userId} joined session ${roomId}`);
        } catch (error) {
          console.error('Error joining session:', error);
          socket.emit('error', { message: 'Failed to join session' });
        }
      });

      // Handle WebRTC signaling
      socket.on('offer', (data) => {
        const { roomId, sender, target, offer } = data;
        
        // Find target socket ID
        const targetUser = this.connectedUsers.get(target);
        if (targetUser) {
          // Forward offer to target
          socket.to(targetUser.socketId).emit('offer', {
            sender,
            offer,
            roomId
          });
        }
      });

      socket.on('answer', (data) => {
        const { roomId, sender, target, answer } = data;
        
        // Find target socket ID
        const targetUser = this.connectedUsers.get(target);
        if (targetUser) {
          // Forward answer to target
          socket.to(targetUser.socketId).emit('answer', {
            sender,
            answer,
            roomId
          });
        }
      });

      socket.on('ice-candidate', (data) => {
        const { roomId, sender, target, candidate } = data;
        
        // Find target socket ID
        const targetUser = this.connectedUsers.get(target);
        if (targetUser) {
          // Forward ICE candidate to target
          socket.to(targetUser.socketId).emit('ice-candidate', {
            sender,
            candidate,
            roomId
          });
        }
      });

      // Handle chat messages
      socket.on('chat-message', (data) => {
        const { roomId, sender, senderName, message, target } = data;
        
        // Broadcast message to everyone in the room
        this.io?.to(roomId).emit('chat-message', {
          sender,
          senderName,
          message,
          timestamp: new Date()
        });
      });

      // Handle billing
      socket.on('process-billing', async (data: { roomId: string; duration: number; userId: number; userRole: string }) => {
        try {
          const { roomId, duration, userId, userRole } = data;
          
          if (userRole !== 'client') {
            // Only clients can trigger billing
            return;
          }
          
          const session = this.activeSessions.get(roomId);
          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }
          
          // Get session from database
          const dbSession = sessionService.getSessionByRoomName(roomId);
          if (!dbSession) {
            socket.emit('error', { message: 'Session not found in database' });
            return;
          }
          
          // Get client information
          const client = await this.storage.getUser(session.clientId);
          if (!client) {
            socket.emit('error', { message: 'Client not found' });
            return;
          }
          
          // Check if client has payment method
          if (!client.stripeCustomerId) {
            socket.emit('error', { message: 'Client does not have payment method' });
            return;
          }
          
          // Get reader information
          const reader = await this.storage.getUser(session.readerId);
          if (!reader) {
            socket.emit('error', { message: 'Reader not found' });
            return;
          }
          
          // Calculate amount to charge
          const pricePerMinute = dbSession.pricePerMinute || 1.99; // Default price
          const amountToCharge = duration * pricePerMinute;
          
          // Process payment via Stripe
          try {
            // Create a payment intent
            const paymentIntent = await stripeClient.paymentIntents.create({
              amount: Math.round(amountToCharge * 100), // Convert to cents
              currency: 'usd',
              customer: client.stripeCustomerId,
              description: `Reading session with ${reader.fullName || reader.username} for ${duration} minute(s)`,
              metadata: {
                readerId: session.readerId.toString(),
                clientId: session.clientId.toString(),
                sessionId: roomId,
                duration: duration.toString()
              },
              confirm: true,
              off_session: true
            });
            
            // Check if payment was successful
            if (paymentIntent.status === 'succeeded') {
              // Update session information
              session.duration += duration;
              session.lastBillingTime = new Date();
              
              // Calculate reader earnings (70%)
              const readerEarnings = amountToCharge * 0.7;
              
              // Update billing details
              if (!session.billingDetails) {
                session.billingDetails = {
                  totalAmount: amountToCharge,
                  clientBilled: amountToCharge,
                  readerEarned: readerEarnings,
                  duration: session.duration
                };
              } else {
                session.billingDetails.totalAmount += amountToCharge;
                session.billingDetails.clientBilled += amountToCharge;
                session.billingDetails.readerEarned += readerEarnings;
                session.billingDetails.duration = session.duration;
              }
              
              this.activeSessions.set(roomId, session);
              
              // Update reader balance
              await sessionService.addReaderEarnings(session.readerId, readerEarnings);
              
              // Update database session
              sessionService.updateSession(roomId, {
                duration: session.duration,
                price: session.billingDetails.totalAmount
              });
              
              // Notify clients of successful billing
              this.io?.to(roomId).emit('billing-processed', {
                success: true,
                duration,
                amount: amountToCharge,
                timestamp: new Date(),
                billingDetails: session.billingDetails
              });
              
              console.log(`Billing processed for session ${roomId}: $${amountToCharge} for ${duration} minute(s)`);
            } else {
              // Payment failed
              socket.emit('billing-error', {
                message: 'Payment processing failed',
                status: paymentIntent.status
              });
            }
          } catch (stripeError) {
            console.error('Stripe error:', stripeError);
            socket.emit('billing-error', {
              message: 'Payment processing failed',
              error: (stripeError as any).message
            });
          }
        } catch (error) {
          console.error('Error processing billing:', error);
          socket.emit('error', { message: 'Failed to process billing' });
        }
      });

      // Handle session end
      socket.on('end-session', async (data: { roomId: string; totalDuration: number }) => {
        try {
          const { roomId, totalDuration } = data;
          
          const session = this.activeSessions.get(roomId);
          if (!session) {
            socket.emit('error', { message: 'Session not found' });
            return;
          }
          
          // Update session status
          session.status = 'ended';
          this.activeSessions.set(roomId, session);
          
          // Notify all clients in the room
          this.io?.to(roomId).emit('session-ended', {
            roomId,
            timestamp: new Date(),
            duration: totalDuration
          });
          
          // Update database session
          sessionService.updateSession(roomId, {
            status: 'completed',
            duration: totalDuration,
            price: session.billingDetails?.totalAmount || 0,
            completedAt: new Date()
          });
          
          // Update connected users
          for (const [userId, user] of this.connectedUsers.entries()) {
            if (user.sessionId === roomId) {
              user.inSession = false;
              user.sessionId = undefined;
              this.connectedUsers.set(userId, user);
            }
          }
          
          // Remove session from active sessions
          this.activeSessions.delete(roomId);
          
          console.log(`Session ${roomId} ended after ${totalDuration} minute(s)`);
        } catch (error) {
          console.error('Error ending session:', error);
          socket.emit('error', { message: 'Failed to end session' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        try {
          console.log(`Socket disconnected: ${socket.id}`);
          
          // Find disconnected user
          let disconnectedUserId: number | null = null;
          let disconnectedUser: ConnectedUser | null = null;
          
          for (const [userId, user] of this.connectedUsers.entries()) {
            if (user.socketId === socket.id) {
              disconnectedUserId = userId;
              disconnectedUser = user;
              break;
            }
          }
          
          if (disconnectedUserId && disconnectedUser) {
            console.log(`User ${disconnectedUserId} disconnected`);
            
            // Update online status in database
            await this.storage.updateUser(disconnectedUserId, { isOnline: false });
            
            // Broadcast offline status to all clients
            this.broadcastOnlineStatus(disconnectedUserId, false);
            
            // Check if user was in a session
            if (disconnectedUser.inSession && disconnectedUser.sessionId) {
              // Get session details
              const session = this.activeSessions.get(disconnectedUser.sessionId);
              
              if (session) {
                // Notify other participants
                this.io?.to(disconnectedUser.sessionId).emit('user-left', {
                  userId: disconnectedUserId,
                  userType: disconnectedUser.userType,
                  timestamp: new Date()
                });
                
                // Wait a bit before ending the session to allow for reconnection
                setTimeout(async () => {
                  // Check if user reconnected
                  const reconnectedUser = this.connectedUsers.get(disconnectedUserId!);
                  if (!reconnectedUser || !reconnectedUser.inSession) {
                    // User did not reconnect, end the session
                    if (disconnectedUser!.sessionId) {
                      console.log(`Ending session ${disconnectedUser!.sessionId} due to user ${disconnectedUserId} disconnection`);
                      
                      // Update session status in database
                      sessionService.updateSession(disconnectedUser!.sessionId as string, {
                        status: 'completed',
                        completedAt: new Date()
                      });
                      
                      // Notify remaining participants
                      this.io?.to(disconnectedUser!.sessionId).emit('session-ended', {
                        roomId: disconnectedUser!.sessionId,
                        reason: 'user_disconnected',
                        userId: disconnectedUserId,
                        userType: disconnectedUser!.userType,
                        timestamp: new Date()
                      });
                      
                      // Remove session from active sessions
                      this.activeSessions.delete(disconnectedUser!.sessionId);
                    }
                  }
                }, 60000); // Wait 60 seconds for reconnection
              }
            }
            
            // Remove user from connected users
            this.connectedUsers.delete(disconnectedUserId);
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });
    });
  }

  /**
   * Broadcast online status change to all clients
   * @param userId User ID
   * @param isOnline Online status
   */
  private broadcastOnlineStatus(userId: number, isOnline: boolean) {
    if (!this.io) return;
    
    this.io.emit('user-status-change', {
      userId,
      isOnline,
      timestamp: new Date()
    });
  }

  /**
   * Check if a user is online
   * @param userId User ID
   * @returns True if user is online
   */
  isUserOnline(userId: number): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get a list of online readers
   * @returns Array of reader IDs
   */
  getOnlineReaders(): number[] {
    const onlineReaders: number[] = [];
    
    for (const [userId, user] of this.connectedUsers.entries()) {
      if (user.userType === 'reader' && !user.inSession) {
        onlineReaders.push(userId);
      }
    }
    
    return onlineReaders;
  }
  
  /**
   * Check if a user is in session
   * @param userId User ID
   * @returns True if user is in session
   */
  isUserInSession(userId: number): boolean {
    const user = this.connectedUsers.get(userId);
    return user ? user.inSession : false;
  }
  
  /**
   * Get active session for a user
   * @param userId User ID
   * @returns Session ID or null
   */
  getUserSession(userId: number): string | null {
    const user = this.connectedUsers.get(userId);
    return user && user.inSession && user.sessionId ? user.sessionId : null;
  }
  
  /**
   * Get the Socket.IO server instance
   * @returns The Socket.IO server instance or null
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}

export const webRTCService = new WebRTCService();