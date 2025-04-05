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

            if (user.role === 'reader') {
              await storage.updateUser(message.userId, { isOnline: true });
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
          if (user?.role === 'reader') {
            await storage.updateUser(client.userId, { isOnline: false });
            this.broadcastReaderActivity(client.userId, 'offline');
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
}

export function setupWebSocket(server: Server) {
  const wsManager = new WebSocketManager(server);
  (global as any).websocket = wsManager;
  return wsManager;
}