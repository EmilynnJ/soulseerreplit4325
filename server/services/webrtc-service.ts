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
          
          for (const [userId, user] of this.connectedUsers.entries()) {
            if (user.socketId === socket.id) {
              disconnectedUserId = userId;
              break;
            }
          }
          
          if (disconnectedUserId) {
            // Get user details
            const user = this.connectedUsers.get(disconnectedUserId);
            
            if (user && user.inSession && user.sessionId) {
              // Handle active session
              const session = this.activeSessions.get(user.sessionId);
              
              if (session) {
                // Automatically end session if client disconnects
                // For reader, wait a bit to allow for reconnection
                if (user.userType === 'client' || (user.userType === 'reader' && session.status === 'waiting')) {
                  // End session
                  session.status = 'ended';
                  this.activeSessions.set(user.sessionId, session);
                  
                  // Notify remaining users
                  this.io?.to(user.sessionId).emit('session-ended', {
                    roomId: user.sessionId,
                    timestamp: new Date(),
                    duration: session.duration,
                    reason: 'user_disconnected'
                  });
                  
                  // Update database session
                  sessionService.updateSession(user.sessionId, {
                    status: 'completed',
                    duration: session.duration,
                    price: session.billingDetails?.totalAmount || 0,
                    completedAt: new Date()
                  });
                  
                  // Remove session from active sessions
                  this.activeSessions.delete(user.sessionId);
                  
                  console.log(`Session ${user.sessionId} ended due to user ${disconnectedUserId} disconnection`);
                } else if (user.userType === 'reader' && session.status === 'connected') {
                  // For reader, set a timer to end session if they don't reconnect
                  setTimeout(() => {
                    // Check if user has reconnected
                    const reconnectedUser = this.connectedUsers.get(disconnectedUserId as number);
                    
                    if (!reconnectedUser || (reconnectedUser.socketId !== socket.id && reconnectedUser.inSession && reconnectedUser.sessionId === user.sessionId)) {
                      // User has reconnected
                      return;
                    }
                    
                    // User has not reconnected, end session
                    const sessionToEnd = this.activeSessions.get(user.sessionId as string);
                    
                    if (sessionToEnd && sessionToEnd.status !== 'ended') {
                      // End session
                      sessionToEnd.status = 'ended';
                      this.activeSessions.set(user.sessionId as string, sessionToEnd);
                      
                      // Notify remaining users
                      this.io?.to(user.sessionId as string).emit('session-ended', {
                        roomId: user.sessionId,
                        timestamp: new Date(),
                        duration: sessionToEnd.duration,
                        reason: 'reader_disconnect_timeout'
                      });
                      
                      // Update database session
                      sessionService.updateSession(user.sessionId as string, {
                        status: 'completed',
                        duration: sessionToEnd.duration,
                        price: sessionToEnd.billingDetails?.totalAmount || 0,
                        completedAt: new Date()
                      });
                      
                      // Remove session from active sessions
                      this.activeSessions.delete(user.sessionId as string);
                      
                      console.log(`Session ${user.sessionId} ended due to reader disconnect timeout`);
                    }
                  }, 30000); // 30 seconds timeout for reconnection
                }
              }
            }
            
            // Remove user from connected users
            this.connectedUsers.delete(disconnectedUserId);
            
            // Update online status in database after a short delay
            // This prevents flashing online/offline during page refresh
            setTimeout(async () => {
              // Check if user has reconnected
              if (!this.connectedUsers.has(disconnectedUserId as number)) {
                // Update status to offline
                await this.storage.updateUser(disconnectedUserId as number, { isOnline: false });
                
                // Broadcast online status change
                this.broadcastOnlineStatus(disconnectedUserId as number, false);
                
                console.log(`User ${disconnectedUserId} marked as offline`);
              }
            }, 5000); // 5 seconds delay
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
    if (!this.io) {
      return;
    }
    
    this.io.emit('user-status-change', {
      userId,
      isOnline,
      timestamp: new Date()
    });
  }

  /**
   * Create a new WebRTC session
   * @param readerId Reader ID
   * @param clientId Client ID
   * @param readingType Reading type
   * @returns Session details
   */
  async createSession(readerId: number, clientId: number, readingType: 'video' | 'voice' | 'chat'): Promise<{
    roomId: string;
    readerId: number;
    clientId: number;
    type: string;
  }> {
    // Generate a unique room ID
    const roomId = uuidv4();
    
    // Get reader and client names
    const reader = await this.storage.getUser(readerId);
    const client = await this.storage.getUser(clientId);
    
    if (!reader || !client) {
      throw new Error('Reader or client not found');
    }
    
    // Create session in database using existing session service
    const dbSession = sessionService.createSession(
      readerId,
      clientId,
      roomId,
      reader.fullName || reader.username,
      client.fullName || client.username,
      readingType
    );
    
    // Create session in memory
    this.activeSessions.set(roomId, {
      roomId,
      readerId,
      clientId,
      readerName: reader.fullName || reader.username,
      clientName: client.fullName || client.username,
      type: readingType,
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
    
    return {
      roomId,
      readerId,
      clientId,
      type: readingType
    };
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
}

export const webRTCService = new WebRTCService();
