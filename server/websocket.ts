import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage.js';

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
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = Math.random().toString(36).substring(7);
      console.log(`New WebSocket client connected: ${clientId}`);

      // Store client data
      this.connectedClients.set(clientId, { socket: ws });

      // Handle incoming messages
      ws.on('message', async (data: string) => {
        try {
          const message = JSON.parse(data);
          console.log(`Received message from client ${clientId}:`, message);

          // Handle authentication
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

            // Send authentication success
            ws.send(JSON.stringify({
              type: 'authentication_success',
              userId: message.userId,
              timestamp: Date.now()
            }));

            // Update reader status if applicable
            if (user.role === 'reader') {
              await storage.updateUser(message.userId, { isOnline: true });
              this.broadcastReaderActivity(message.userId, 'online');
            }
          }

          // Handle chat messages
          else if (message.type === 'chat_message' && message.readingId) {
            const reading = await storage.getReading(message.readingId);
            if (!reading) {
              console.warn(`Chat message for non-existent reading ${message.readingId}`);
              return;
            }

            // Broadcast to all clients in the reading
            this.broadcastToReading(message.readingId, {
              type: 'chat_message',
              readingId: message.readingId,
              senderId: message.senderId,
              senderName: message.senderName,
              message: message.message,
              timestamp: Date.now()
            });
          }

          // Handle WebRTC signaling
          else if (['offer', 'answer', 'ice_candidate', 'call_ended', 'join_reading', 'call_connected'].includes(message.type)) {
            if (message.recipientId) {
              this.notifyUser(message.recipientId, message);
            } else {
              this.broadcastToReading(message.readingId, message);
            }
          }

          // Handle ping messages
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

      // Handle client disconnection
      ws.on('close', async () => {
        console.log(`WebSocket client ${clientId} disconnected`);
        const client = this.connectedClients.get(clientId);
        
        if (client?.userId) {
          const user = await storage.getUser(client.userId);
          if (user?.role === 'reader') {
            await storage.updateUser(client.userId, { isOnline: false });
            this.broadcastReaderActivity(client.userId, 'offline');
          }
        }

        this.connectedClients.delete(clientId);
      });
    });
  }

  // Notify a specific user
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

  // Broadcast to all clients in a reading session
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

  // Broadcast reader activity (online/offline status)
  private broadcastReaderActivity(readerId: number, status: 'online' | 'offline') {
    for (const [_, client] of this.connectedClients) {
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(JSON.stringify({
            type: 'reader_status',
            readerId,
            status,
            timestamp: Date.now()
          }));
        } catch (error) {
          console.error(`Error broadcasting reader ${readerId} status:`, error);
        }
      }
    }
  }

  // Broadcast to all connected clients
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

  // Get all connected clients
  public get clients() {
    return Array.from(this.connectedClients.values()).map(client => client.socket);
  }
}

export function setupWebSocket(server: Server) {
  const wsManager = new WebSocketManager(server);
  (global as any).websocket = wsManager;
  return wsManager;
}
