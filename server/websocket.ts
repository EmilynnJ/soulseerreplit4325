import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

interface ConnectedClient {
  socket: WebSocket;
  userId?: number;
  subscriptions?: string[];
}

class WebSocketManager {
  private wss: WebSocketServer;
  private connectedClients: Map<string, ConnectedClient>;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.connectedClients = new Map();

    // Setup WebSocket server directly in constructor
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = Math.random().toString(36).substring(7);
      console.log(`New WebSocket client connected: ${clientId}`);

      this.connectedClients.set(clientId, { socket: ws });

      ws.on('message', async (data: string) => {
        try {
          const message = JSON.parse(data);
          console.log(`Received message from client ${clientId}:`, message);

          if (message.type === 'authenticate' && message.userId) {
            const user = await storage.getUser(message.userId);
            if (!user) {
              console.warn(`Authentication failed - user ${message.userId} not found`);
              return;
            }

            this.connectedClients.set(clientId, { 
              socket: ws, 
              userId: message.userId,
              subscriptions: []
            });

            ws.send(JSON.stringify({
              type: 'authentication_success',
              userId: message.userId,
              timestamp: Date.now()
            }));

            // Update online status for all users, especially readers
            await storage.updateUser(message.userId, { isOnline: true });
            
            // For readers, broadcast their status to all clients
            if (user.role === 'reader') {
              console.log(`Reader ${message.userId} (${user.username}) authenticated and set online`);
              this.broadcastReaderActivity(message.userId, 'online');
            }
          }

          else if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }

        } catch (error) {
          console.error(`Error processing WebSocket message from client ${clientId}:`, error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process message',
            timestamp: Date.now()
          }));
        }
      });

      ws.on('close', async () => {
        console.log(`WebSocket client ${clientId} disconnected`);
        const client = this.connectedClients.get(clientId);

        // First delete this client from the connection map to ensure proper connection counting
        this.connectedClients.delete(clientId);
        
        if (client?.userId) {
          const user = await storage.getUser(client.userId);
          if (!user) return; // Skip if user no longer exists
          
          // Count active connections for this user AFTER removing this connection
          // This ensures accurate connection counting
          let activeConnections = 0;
          for (const [, otherClient] of this.connectedClients.entries()) {
            if (otherClient.userId === client.userId && 
                otherClient.socket.readyState === WebSocket.OPEN) {
              activeConnections++;
            }
          }
          
          console.log(`User ${client.userId} (${user.username}) has ${activeConnections} remaining active connections`);
          
          // Check if status needs to be updated
          if (activeConnections === 0) {
            console.log(`User ${client.userId} (${user.username}) has no remaining connections, setting to offline`);
            
            try {
              // Use setTimeout to ensure we're truly disconnected before setting offline
              setTimeout(async () => {
                // Recheck connection count in case a reconnect happened during the timeout
                let finalConnectionCount = 0;
                for (const [, checkClient] of this.connectedClients.entries()) {
                  if (checkClient.userId === client.userId && 
                      checkClient.socket.readyState === WebSocket.OPEN) {
                    finalConnectionCount++;
                  }
                }
                
                // If still no connections after the delay, set to offline
                if (finalConnectionCount === 0) {
                  console.log(`Confirming user ${client.userId} (${user.username}) has no active connections after delay`);
                  
                  // Update user in database
                  await storage.updateUser(client.userId, { 
                    isOnline: false,
                    lastActive: new Date()
                  });
                  
                  // Only broadcast for readers
                  if (user.role === 'reader') {
                    console.log(`Broadcasting offline status for reader ${client.userId} (${user.username})`);
                    // Fetch fresh user data after the update
                    const updatedUser = await storage.getUser(client.userId);
                    if (updatedUser) {
                      this.broadcastReaderActivity(client.userId, 'offline');
                    }
                  }
                } else {
                  console.log(`User ${client.userId} reconnected during timeout, keeping online`);
                }
              }, 2000); // 2 second delay to handle reconnection scenarios
            } catch (error) {
              console.error(`Error setting user ${client.userId} offline:`, error);
            }
          } else if (activeConnections > 0) {
            console.log(`User ${client.userId} (${user.username}) still has active connections, keeping online`);
          } else if (user.isOnline === false) {
            console.log(`User ${client.userId} (${user.username}) is already offline in database`);
          }
        }
      });
    });
  }

  public notifyUser(userId: number, message: any) {
    for (const [_, client] of this.connectedClients) {
      if (client.userId === userId) {
        try {
          client.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Error sending message to user ${userId}:`, error);
        }
      }
    }
  }

  private broadcastToReading(readingId: number, message: any) {
    for (const [_, client] of this.connectedClients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Error broadcasting to reading ${readingId}:`, error);
        }
      }
    }
  }

  private async broadcastReaderActivity(readerId: number, status: 'online' | 'offline') {
    try {
      // First, ensure the reader's status in the database is consistent with what we're broadcasting
      // This is crucial to prevent race conditions between UI and database state
      await storage.updateUser(readerId, { 
        isOnline: status === 'online',
        lastActive: new Date()
      });
      
      // Now get the updated reader details to include in the broadcast
      const reader = await storage.getUser(readerId);
      if (!reader) {
        console.error(`Cannot broadcast status for non-existent reader ID: ${readerId}`);
        return;
      }
      
      console.log(`Broadcasting ${status} status for reader ${readerId} (${reader.username}), DB isOnline=${reader.isOnline}`);
      
      // Validate that database and status parameter are in sync
      if ((status === 'online' && !reader.isOnline) || (status === 'offline' && reader.isOnline)) {
        console.warn(`Status mismatch detected: broadcast status=${status}, DB status=${reader.isOnline ? 'online' : 'offline'}`);
        // Force alignment between what we're broadcasting and what's in the DB
        await storage.updateUser(readerId, { isOnline: status === 'online' });
      }

      // Remove sensitive data
      const { password, ...safeReader } = reader;
      
      // Count how many clients we send to for logging
      let sentCount = 0;
      
      for (const [_, client] of this.connectedClients) {
        if (client.socket.readyState === WebSocket.OPEN) {
          try {
            // Send consistent message structure with both 'readerId' and 'reader' fields
            // This ensures compatibility with all client components
            client.socket.send(JSON.stringify({
              type: 'reader_status_change',
              readerId,
              status,
              reader: {
                ...safeReader,
                isOnline: status === 'online' // Enforce consistency between status and reader.isOnline
              },
              timestamp: Date.now()
            }));
            sentCount++;
          } catch (error) {
            console.error(`Error broadcasting reader ${readerId} status:`, error);
          }
        }
      }
      
      console.log(`Successfully broadcast ${status} status for reader ${readerId} to ${sentCount} clients`);
    } catch (error) {
      console.error(`Error in broadcastReaderActivity for reader ${readerId}:`, error);
    }
  }

  public broadcastToAll(message: any) {
    for (const [_, client] of this.connectedClients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error broadcasting message:', error);
        }
      }
    }
  }

  public get clients() {
    return Array.from(this.connectedClients.values()).map(client => client.socket);
  }
  
  // Method to handle custom connection logic, used in routes.ts
  public onConnection(callback: (ws: WebSocket) => void) {
    this.wss.on('connection', callback);
  }
  
  // Method to handle custom events
  public on(event: string, callback: (ws: WebSocket, ...args: any[]) => void) {
    if (event === 'connection') {
      this.wss.on('connection', callback);
    }
  }
}

export function setupWebSocket(server: Server) {
  const wsManager = new WebSocketManager(server);
  
  // Expose the WebSocketManager instance and its methods globally
  (global as any).websocket = {
    ...wsManager,
    // Explicitly expose the methods that routes.ts calls directly
    broadcastToAll: wsManager.broadcastToAll.bind(wsManager),
    notifyUser: wsManager.notifyUser.bind(wsManager),
    broadcastReaderActivity: wsManager.broadcastReaderActivity.bind(wsManager)
  };
  
  console.log('WebSocket manager setup complete with enhanced methods');
  return wsManager;
}