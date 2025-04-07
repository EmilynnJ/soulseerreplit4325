import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { User } from '@shared/schema';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sessionService } from './session-service';

// User connection tracking
interface ConnectedUser {
  userId: number;
  userType: 'reader' | 'client';
  socketId: string;
  inSession: boolean;
  sessionId?: string;
}

class WebRTCService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<number, ConnectedUser> = new Map();
  private activeSessions: Map<string, {
    roomId: string;
    readerId: number;
    clientId: number;
    startTime: number;
    lastBillingTime: number;
    isBillingActive: boolean;
  }> = new Map();

  initialize(server: Server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupSocketHandlers();
    console.log('WebRTC service initialized');
  }

  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('New socket connection:', socket.id);

      // Authentication and user registration
      socket.on('register', async (data: { 
        userId: number; 
        userType: 'reader' | 'client';
        token?: string;
      }) => {
        try {
          // In a real implementation, verify the token here
          // For now, we trust the client-sent userId
          const { userId, userType } = data;
          
          // Store the connection
          this.connectedUsers.set(userId, {
            userId,
            userType,
            socketId: socket.id,
            inSession: false
          });

          // Notify client of successful registration
          socket.emit('registered', { 
            success: true, 
            userId, 
            userType
          });

          // If this is a reader, update their online status
          if (userType === 'reader') {
            try {
              await db.update(users)
                .set({ isOnline: true })
                .where(eq(users.id, userId));
              console.log(`Reader ${userId} is now online`);
            } catch (error) {
              console.error(`Failed to update online status for reader ${userId}:`, error);
            }
          }
          
          console.log(`User registered: ${userId} (${userType})`);
        } catch (error) {
          console.error('Error in socket registration:', error);
          socket.emit('registered', { 
            success: false, 
            error: 'Registration failed' 
          });
        }
      });

      // WebRTC signaling
      socket.on('offer', (data) => {
        const { target, offer, roomId, sender } = data;
        console.log(`Forwarding offer from ${sender} to ${target} in room ${roomId}`);
        
        // Find the target socket
        const targetUser = Array.from(this.connectedUsers.values())
          .find(user => user.userId === target);
        
        if (targetUser) {
          // Forward the offer to the target
          this.io?.to(targetUser.socketId).emit('offer', {
            offer,
            sender,
            roomId
          });
        } else {
          // Target user not found
          socket.emit('signal_error', {
            error: 'Target user not connected',
            roomId
          });
        }
      });

      socket.on('answer', (data) => {
        const { target, answer, roomId, sender } = data;
        console.log(`Forwarding answer from ${sender} to ${target} in room ${roomId}`);
        
        // Find the target socket
        const targetUser = Array.from(this.connectedUsers.values())
          .find(user => user.userId === target);
        
        if (targetUser) {
          // Forward the answer to the target
          this.io?.to(targetUser.socketId).emit('answer', {
            answer,
            sender,
            roomId
          });
        } else {
          // Target user not found
          socket.emit('signal_error', {
            error: 'Target user not connected',
            roomId
          });
        }
      });

      socket.on('ice-candidate', (data) => {
        const { target, candidate, roomId, sender } = data;
        
        // Find the target socket
        const targetUser = Array.from(this.connectedUsers.values())
          .find(user => user.userId === target);
        
        if (targetUser) {
          // Forward the ICE candidate to the target
          this.io?.to(targetUser.socketId).emit('ice-candidate', {
            candidate,
            sender,
            roomId
          });
        }
      });

      // Session management
      socket.on('join-session', (data: {
        roomId: string;
        userId: number;
        userType: 'reader' | 'client';
      }) => {
        const { roomId, userId, userType } = data;
        
        // Update user status
        const user = this.connectedUsers.get(userId);
        if (user) {
          user.inSession = true;
          user.sessionId = roomId;
          this.connectedUsers.set(userId, user);
        }

        // Notify everyone in the room that a user has joined
        socket.join(roomId);
        this.io?.to(roomId).emit('user-joined', {
          userId,
          userType,
          roomId
        });

        console.log(`User ${userId} (${userType}) joined session ${roomId}`);
      });

      socket.on('start-session', async (data: {
        roomId: string;
        readerId: number;
        clientId: number;
      }) => {
        const { roomId, readerId, clientId } = data;
        
        // Check if both users are connected
        const reader = this.connectedUsers.get(readerId);
        const client = this.connectedUsers.get(clientId);
        
        if (!reader || !client) {
          socket.emit('session-error', {
            error: 'Both reader and client must be connected to start a session',
            roomId
          });
          return;
        }

        // Start the session
        const now = Date.now();
        this.activeSessions.set(roomId, {
          roomId,
          readerId,
          clientId,
          startTime: now,
          lastBillingTime: now,
          isBillingActive: true
        });

        // Notify both users that the session has started
        this.io?.to(roomId).emit('session-started', {
          roomId,
          startTime: now
        });

        console.log(`Session started: ${roomId} between reader ${readerId} and client ${clientId}`);
      });

      socket.on('pause-billing', (data: { roomId: string }) => {
        const { roomId } = data;
        const session = this.activeSessions.get(roomId);
        
        if (session) {
          session.isBillingActive = false;
          this.activeSessions.set(roomId, session);
          
          this.io?.to(roomId).emit('billing-paused', {
            roomId,
            pauseTime: Date.now()
          });
          
          console.log(`Billing paused for session ${roomId}`);
        }
      });

      socket.on('resume-billing', (data: { roomId: string }) => {
        const { roomId } = data;
        const session = this.activeSessions.get(roomId);
        
        if (session) {
          session.lastBillingTime = Date.now();
          session.isBillingActive = true;
          this.activeSessions.set(roomId, session);
          
          this.io?.to(roomId).emit('billing-resumed', {
            roomId,
            resumeTime: Date.now()
          });
          
          console.log(`Billing resumed for session ${roomId}`);
        }
      });

      socket.on('end-session', async (data: { 
        roomId: string;
        totalDuration?: number;
      }) => {
        const { roomId, totalDuration } = data;
        const session = this.activeSessions.get(roomId);
        
        if (session) {
          // Calculate final duration if not provided
          const finalDuration = totalDuration || 
            Math.ceil((Date.now() - session.startTime) / 60000); // in minutes
          
          // End the session in our session service
          try {
            const updatedSession = await sessionService.endSession(roomId, finalDuration);
            
            // Notify both users that the session has ended
            this.io?.to(roomId).emit('session-ended', {
              roomId,
              duration: finalDuration,
              sessionDetails: updatedSession
            });
            
            console.log(`Session ended: ${roomId}, duration: ${finalDuration} minutes`);
          } catch (error) {
            console.error(`Error ending session ${roomId}:`, error);
            socket.emit('session-error', {
              error: 'Failed to end session properly',
              roomId
            });
          }
          
          // Remove the session
          this.activeSessions.delete(roomId);
          
          // Find the reader and client and update their status
          const reader = this.connectedUsers.get(session.readerId);
          const client = this.connectedUsers.get(session.clientId);
          
          if (reader) {
            reader.inSession = false;
            reader.sessionId = undefined;
            this.connectedUsers.set(session.readerId, reader);
          }
          
          if (client) {
            client.inSession = false;
            client.sessionId = undefined;
            this.connectedUsers.set(session.clientId, client);
          }
        }
      });

      // Process minute-by-minute billing
      socket.on('process-billing', async (data: {
        roomId: string;
        duration: number; // duration in minutes since last billing
        userId: number;
        userRole: 'client' | 'reader';
      }) => {
        const { roomId, duration, userId, userRole } = data;
        const session = this.activeSessions.get(roomId);
        
        if (!session || !session.isBillingActive) {
          return;
        }

        // Only clients can trigger billing
        if (userRole !== 'client') {
          return;
        }

        try {
          // Record billing through our session service
          const updatedSession = await sessionService.recordBilling(
            roomId,
            duration,
            userId,
            session.readerId
          );
          
          if (updatedSession) {
            // Update the last billing time
            session.lastBillingTime = Date.now();
            this.activeSessions.set(roomId, session);
            
            // Notify both users about the billing
            this.io?.to(roomId).emit('billing-processed', {
              roomId,
              duration,
              billingDetails: updatedSession
            });
            
            console.log(`Billing processed for session ${roomId}: ${duration} minutes`);
          }
        } catch (error) {
          console.error(`Error processing billing for session ${roomId}:`, error);
          socket.emit('billing-error', {
            error: 'Failed to process billing',
            roomId
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log('Socket disconnected:', socket.id);
        
        // Find the user by socket ID
        let disconnectedUser: ConnectedUser | undefined;
        let userId: number | undefined;
        
        for (const [id, user] of this.connectedUsers.entries()) {
          if (user.socketId === socket.id) {
            disconnectedUser = user;
            userId = id;
            break;
          }
        }
        
        if (disconnectedUser && userId) {
          console.log(`User disconnected: ${userId} (${disconnectedUser.userType})`);
          
          // If the user was in a session, handle that
          if (disconnectedUser.inSession && disconnectedUser.sessionId) {
            const roomId = disconnectedUser.sessionId;
            const session = this.activeSessions.get(roomId);
            
            if (session) {
              // Calculate the final duration
              const finalDuration = Math.ceil((Date.now() - session.startTime) / 60000); // in minutes
              
              // End the session in our session service
              try {
                const updatedSession = await sessionService.endSession(roomId, finalDuration);
                
                // Notify the other user that the session has ended due to disconnection
                this.io?.to(roomId).emit('session-ended', {
                  roomId,
                  duration: finalDuration,
                  sessionDetails: updatedSession,
                  reason: 'user_disconnected'
                });
                
                console.log(`Session ended due to user disconnect: ${roomId}, duration: ${finalDuration} minutes`);
              } catch (error) {
                console.error(`Error ending session ${roomId} due to disconnect:`, error);
              }
              
              // Remove the session
              this.activeSessions.delete(roomId);
            }
          }
          
          // If this is a reader, update their online status
          if (disconnectedUser.userType === 'reader') {
            try {
              await db.update(users)
                .set({ isOnline: false })
                .where(eq(users.id, userId));
              console.log(`Reader ${userId} is now offline`);
            } catch (error) {
              console.error(`Failed to update offline status for reader ${userId}:`, error);
            }
          }
          
          // Remove the user from our connected users
          this.connectedUsers.delete(userId);
        }
      });
    });
  }

  // Helper method to create a reading session
  async createSession(readerId: number, clientId: number, readingType: 'video' | 'voice' | 'chat'): Promise<{
    roomId: string;
    success: boolean;
    error?: string;
  }> {
    try {
      // Check if both users are online
      const reader = this.connectedUsers.get(readerId);
      const client = this.connectedUsers.get(clientId);
      
      if (!reader) {
        return {
          roomId: '',
          success: false,
          error: 'Reader is not online'
        };
      }
      
      if (!client) {
        return {
          roomId: '',
          success: false,
          error: 'Client is not online'
        };
      }
      
      // Check if either user is already in a session
      if (reader.inSession) {
        return {
          roomId: '',
          success: false,
          error: 'Reader is already in a session'
        };
      }
      
      if (client.inSession) {
        return {
          roomId: '',
          success: false,
          error: 'Client is already in a session'
        };
      }
      
      // Generate a room ID
      const timestamp = Date.now();
      const roomId = `${readingType}_${readerId}_${clientId}_${timestamp}`;
      
      // Create a session record
      sessionService.createSession(
        readerId,
        clientId,
        roomId,
        'Reader', // Will be updated with actual names
        'Client',  // Will be updated with actual names
        readingType
      );
      
      console.log(`Created new ${readingType} session: ${roomId}`);
      
      return {
        roomId,
        success: true
      };
    } catch (error) {
      console.error(`Error creating session:`, error);
      return {
        roomId: '',
        success: false,
        error: 'Failed to create session'
      };
    }
  }

  // Check if a user is online
  isUserOnline(userId: number): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get a list of all online readers
  getOnlineReaders(): number[] {
    const onlineReaders: number[] = [];
    
    for (const [userId, user] of this.connectedUsers.entries()) {
      if (user.userType === 'reader' && !user.inSession) {
        onlineReaders.push(userId);
      }
    }
    
    return onlineReaders;
  }
}

export const webRTCService = new WebRTCService();