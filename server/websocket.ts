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

        if (client?.userId) {
          const user = await storage.getUser(client.userId);
          
          // Check if this is the last connection for this user
          let hasOtherConnections = false;
          for (const [otherClientId, otherClient] of this.connectedClients.entries()) {
            if (otherClientId !== clientId && otherClient.userId === client.userId) {
              console.log(`User ${client.userId} has another active connection: ${otherClientId}`);
              hasOtherConnections = true;
              break;
            }
          }
          
          // Only update status if this is the last connection
          if (!hasOtherConnections) {
            console.log(`User ${client.userId} has no other connections, marking as offline`);
            await storage.updateUser(client.userId, { isOnline: false });
            
            // For readers, broadcast offline status
            if (user?.role === 'reader') {
              console.log(`Reader ${client.userId} (${user.username}) disconnected and set offline`);
              this.broadcastReaderActivity(client.userId, 'offline');
            }
          } else {
            console.log(`User ${client.userId} still has active connections, keeping online`);
          }
        }

        this.connectedClients.delete(clientId);
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
    // Get the reader details to include in the broadcast
    const reader = await storage.getUser(readerId);
    if (!reader) {
      console.error(`Cannot broadcast status for non-existent reader ID: ${readerId}`);
      return;
    }

    // Remove sensitive data
    const { password, ...safeReader } = reader;
    
    for (const [_, client] of this.connectedClients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          // Send consistent message structure with both 'readerId' and 'reader' fields
          // This ensures compatibility with all client components
          client.socket.send(JSON.stringify({
            type: 'reader_status_change',
            readerId,
            status,
            reader: safeReader, // Include full reader object
            timestamp: Date.now()
          }));
          console.log(`Broadcasting ${status} status for reader ${readerId} (${reader.username})`);
        } catch (error) {
          console.error(`Error broadcasting reader ${readerId} status:`, error);
        }
      }
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
  (global as any).websocket = wsManager;
  return wsManager;
}