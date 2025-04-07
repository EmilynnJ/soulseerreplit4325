import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupWebSocket } from "./websocket";
import { setupAuth } from "./auth";
import readingRouter from "./routes/readings";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import multer from "multer";
import path from "path";
import fs from "fs";
import { User, UserUpdate, Reading } from "../shared/schema";
import { WebSocket } from "ws";
import * as stripeClient from "./services/stripe-client";
import { sessionService } from "./services/session-service";
import { readerBalanceService } from "./services/reader-balance-service";

// Set up multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  next();
};

// Admin middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Unauthorized. Admin access required." });
  }

  next();
};

// Admin-only middleware (for routes that already use authenticate)
const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  // We can safely assume req.user exists because this middleware is used after authenticate
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Unauthorized. Admin access required." });
  }

  next();
};

// No longer using fileURLToPath and dirname

// Define the uploads path
const uploadsPath = path.join(process.cwd(), 'public', 'uploads');

// Password hashing function
const scryptAsync = promisify(scrypt);

async function scrypt_hash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Removed helper function for processing reading payments

export async function registerRoutes(app: Express): Promise<Server> {

  // Setup authentication routes
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server for live readings and real-time communication
  const wsManager = setupWebSocket(httpServer);
  (global as any).wsManager = wsManager;

  // LiveKit webhook endpoint (placeholder for future implementation)
  app.post('/api/webhooks/livekit', express.json(), async (req, res) => {
    console.log('LiveKit webhook endpoint - not yet implemented');
    res.status(501).json({ message: 'LiveKit integration coming soon' });
  });

  // Track all connected WebSocket clients
  const connectedClients = new Map();
  let clientIdCounter = 1;

  // Broadcast a message to all connected clients
  const broadcastToAll = (message: any) => {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    console.log(`Broadcasting message to all clients: ${messageStr}`);

    let sentCount = 0;
    wsManager.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error("Error sending message to client:", error);
        }
      }
    });

    console.log(`Successfully sent message to ${sentCount} clients`);
  };

  // Send a notification to a specific user if they're connected
  const notifyUser = (userId: number, notification: any) => {
    const userClients = Array.from(connectedClients.entries())
      .filter(([_, data]) => data.userId === userId)
      .map(([clientId]) => clientId);

    userClients.forEach(clientId => {
      const clientSocket = connectedClients.get(clientId)?.socket;
      if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify(notification));
      }
    });
  };

  // Broadcast activity to keep readings page updated in real-time
  const broadcastReaderActivity = async (readerId: number, status: string) => {
    try {
      const reader = await storage.getUser(readerId);
      if (!reader) return;

      // Update the reader status in the database to match what we're broadcasting
      // This ensures database and UI are always in sync
      await storage.updateUser(readerId, { isOnline: status === 'online' });

      // Get the fresh reader data with updated status
      const updatedReader = await storage.getUser(readerId);
      if (!updatedReader) return;

      // Extract safe reader data
      const { password, ...safeReader } = updatedReader;

      // Log the broadcast for debugging
      console.log(`Broadcasting reader ${readerId} (${safeReader.username}) status change to ${status}, isOnline=${safeReader.isOnline}`);

      // Broadcast to all clients
      broadcastToAll({
        type: 'reader_status_change',
        reader: safeReader,
        status,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error broadcasting reader activity:', error);
    }
  };

  wsManager.on('connection', (ws) => {
    const clientId = clientIdCounter++;
    let userId: number | null = null;
    console.log(`New WebSocket client connected with ID ${clientId}`);

    // Store client connection
    connectedClients.set(clientId, { socket: ws, userId });

    // Send initial welcome message with client ID
    ws.send(JSON.stringify({ 
      type: 'connected', 
      message: 'Connected to SoulSeer WebSocket Server',
      clientId,
      serverTime: Date.now()
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`WebSocket message received from client ${clientId}:`, data.type);

        // Handle ping messages
        if (data.type === 'ping') {
          console.log(`Received ping from client ${clientId}, sending pong`);
          ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: data.timestamp,
            serverTime: Date.now()
          }));
        }

        // Handle chat messages (direct client-to-client communication)
        else if (data.type === 'chat_message' && data.readingId) {
          console.log(`Received chat message for reading ${data.readingId} from client ${clientId}`);

          // Broadcast to all connected clients
          broadcastToAll({
            type: 'chat_message',
            readingId: data.readingId,
            senderId: data.senderId || userId,
            senderName: data.senderName,
            message: data.message,
            timestamp: Date.now()
          });
        }

        // Handle authentication
        else if (data.type === 'authenticate' && data.userId) {
          userId = data.userId;

          // Update the client data with user ID
          connectedClients.set(clientId, { socket: ws, userId });

          console.log(`Client ${clientId} authenticated as user ${userId}`);

          // If user is a reader, broadcast their online status
          if (userId !== null) {
            storage.getUser(userId).then(user => {
              if (user && user.role === 'reader') {
                const update: UserUpdate = { isOnline: true };
                storage.updateUser(userId as number, update);
                broadcastReaderActivity(userId as number, 'online');
              }
            }).catch(err => {
              console.error('Error updating reader status:', err);
            });
          }

          // Confirm authentication success
          ws.send(JSON.stringify({
            type: 'authentication_success',
            userId,
            timestamp: Date.now()
          }));
        }

        // Handle subscribing to specific channels
        else if (data.type === 'subscribe' && data.channel) {
          console.log(`Client ${clientId} subscribed to ${data.channel}`);

          // Store subscription data with the client
          const clientData = connectedClients.get(clientId);
          if (clientData) {
            connectedClients.set(clientId, {
              ...clientData,
              subscriptions: [...(clientData.subscriptions || []), data.channel]
            });
          }

          ws.send(JSON.stringify({
            type: 'subscription_success',
            channel: data.channel,
            timestamp: Date.now()
          }));
        }

        // Handle WebRTC signaling messages
        else if (['offer', 'answer', 'ice_candidate', 'call_ended', 'join_reading', 'call_connected'].includes(data.type) && data.readingId) {
          console.log(`WebRTC signaling: ${data.type} for reading ${data.readingId}`);

          // If this is a join message, broadcast it to everyone to notify them
          if (data.type === 'join_reading') {
            broadcastToAll(data);
          }
          // If this message has a specific recipient, forward it only to them
          else if (data.recipientId) {
            notifyUser(data.recipientId, data);
          }
          // Otherwise broadcast it to all clients associated with this reading
          else {
            broadcastToAll(data);
          }
        }
      } catch (error) {
        console.error(`Error processing WebSocket message from client ${clientId}:`, error);

        // Send error notification back to client
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
          timestamp: Date.now()
        }));
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket client ${clientId} disconnected. Code: ${code}, Reason: ${reason}`);

      // If user is a reader, update their status and broadcast offline status
      if (userId !== null) {
        storage.getUser(userId).then(user => {
          if (user && user.role === 'reader') {
            const update: UserUpdate = { isOnline: false };
            storage.updateUser(userId as number, update);
            broadcastReaderActivity(userId as number, 'offline');
          }
        }).catch(err => {
          console.error('Error updating reader status on disconnect:', err);
        });
      }

      // Remove client from connected clients
      connectedClients.delete(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      connectedClients.delete(clientId);
    });
  });

  // Add WebSocket related utilities to global scope for use in API routes
  (global as any).websocket = {
    broadcastToAll,
    notifyUser,
    broadcastReaderActivity
  };

  // Serve uploads directory in all environments
  app.use('/uploads', express.static(uploadsPath));
  console.log(`Serving uploads from: ${uploadsPath}`);

  // Add debug endpoint to check available files in uploads
  app.get('/api/debug/uploads', async (req, res) => {
    try {
      // Get all files in uploads directory
      const files = fs.readdirSync(uploadsPath);
      return res.json({ 
        path: uploadsPath,
        files: files,
        count: files.length
      });
    } catch (error) {
      console.error("Error listing uploads directory:", error);
      return res.status(500).json({ 
        message: "Failed to list uploads directory", 
        error: String(error) 
      });
    }
  });

  // API Routes

  // Readers
  app.get("/api/readers", async (req, res) => {
    try {
      const readers = await storage.getReaders();
      // Remove sensitive data
      const sanitizedReaders = readers.map(reader => {
        const { password, ...safeReader } = reader;
        // NOTE: Temporarily disabled default profile image assignment
        // This functionality will be restored in a future update
        /*
        if (!safeReader.profileImage) {
          safeReader.profileImage = '/uploads/1743742031707-EMILYNN.png';
        }
        */
        return safeReader;
      });
      res.json(sanitizedReaders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch readers" });
    }
  });

  app.get("/api/readers/online", async (req, res) => {
    try {
      const readers = await storage.getOnlineReaders();
      // Remove sensitive data
      const sanitizedReaders = readers.map(reader => {
        const { password, ...safeReader } = reader;
        // NOTE: Temporarily disabled default profile image assignment
        // This functionality will be restored in a future update
        /*
        if (!safeReader.profileImage) {
          safeReader.profileImage = '/uploads/1743742031707-EMILYNN.png';
        }
        */
        return safeReader;
      });
      res.json(sanitizedReaders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch online readers" });
    }
  });

  app.get("/api/readers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reader ID" });
      }

      const reader = await storage.getUser(id);
      if (!reader || reader.role !== "reader") {
        return res.status(404).json({ message: "Reader not found" });
      }

      // Remove sensitive data
      const { password, ...safeReader } = reader;

      // NOTE: Temporarily disabled default profile image assignment
      // This functionality will be restored in a future update
      /*
      if (!safeReader.profileImage) {
        safeReader.profileImage = '/uploads/1743742031707-EMILYNN.png';
      }
      */

      res.json(safeReader);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reader" });
    }
  });

  // Update reader status (online/offline)
  app.patch("/api/readers/status", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "reader") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const { isOnline } = req.body;

      if (isOnline === undefined) {
        return res.status(400).json({ message: "isOnline status is required" });
      }

      // Get current user to check if status is actually changing
      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Log existing and requested status for debugging
      console.log(`Reader ${req.user.id} (${currentUser.username}) status change request: Current=${currentUser.isOnline ? 'online' : 'offline'}, Requested=${isOnline ? 'online' : 'offline'}`);

      // Only update if status is actually changing
      if (currentUser.isOnline === isOnline) {
        console.log(`Reader ${req.user.id} (${currentUser.username}) status is already ${isOnline ? 'online' : 'offline'}, skipping update`);
        return res.json({ 
          success: true, 
          user: currentUser,
          message: "Status already set to " + (isOnline ? "online" : "offline")
        });
      }

      // Update user in database
      const updatedUser = await storage.updateUser(req.user.id, {
        isOnline,
        lastActive: new Date()
      });

      console.log(`Reader ${req.user.id} (${currentUser.username}) status updated to: ${isOnline ? 'online' : 'offline'}`);

      // Broadcast status change to all connected clients using the WebSocket manager
      // This also ensures the database status is consistent with what's being broadcast
      if (global.websocket && global.websocket.broadcastReaderActivity) {
        global.websocket.broadcastReaderActivity(req.user.id, isOnline ? 'online' : 'offline');
      } else {
        console.warn('WebSocket manager not available for broadcast');
        // Fallback to direct broadcast function if available
        if (typeof broadcastReaderActivity === 'function') {
          broadcastReaderActivity(req.user.id, isOnline ? 'online' : 'offline');
        }
      }

      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("Failed to update reader status:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // Update reader profile (including profile image)
  app.patch("/api/readers/profile", authenticate, upload.single('profileImage'), async (req: any, res: any) => {
    if (!req.user || req.user.role !== "reader") {
      return res.status(403).json({ message: "Not authorized. Reader access required." });
    }

    try {
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
      }

      const { fullName, bio, specialties } = req.body;
      
      // Parse specialties if it's a JSON string
      let parsedSpecialties = [];
      try {
        parsedSpecialties = JSON.parse(specialties || '[]');
      } catch (e) {
        parsedSpecialties = specialties || [];
      }

      // Handle profile image if uploaded
      let profileImageUrl = req.user.profileImage;
      if (req.file) {
        console.log(`Processing new profile image upload for reader ${req.user.id}`);
        const filename = `${Date.now()}-${req.file.originalname}`;
        const filepath = path.join(uploadsPath, filename);
        fs.writeFileSync(filepath, req.file.buffer);
        profileImageUrl = `/uploads/${filename}`;
        console.log(`New profile image saved at: ${profileImageUrl}`);
      }

      // Update reader profile
      const updateData = {
        fullName: fullName || req.user.fullName,
        bio: bio || req.user.bio,
        specialties: parsedSpecialties,
        profileImage: profileImageUrl
      };
      
      console.log(`Updating reader ${req.user.id} profile with:`, updateData);
      
      const updatedReader = await storage.updateUser(req.user.id, updateData);

      // Remove sensitive information
      const safeReader = updatedReader ? { ...updatedReader } : null;
      if (safeReader && 'password' in safeReader) {
        delete (safeReader as any).password;
      }
      
      res.json(safeReader);
    } catch (error) {
      console.error("Error updating reader profile:", error);
      res.status(500).json({ message: "Failed to update reader profile" });
    }
  });

  // Update reader pricing
  app.patch("/api/readers/pricing", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "reader") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const { 
        // Legacy per-minute pricing
        pricingChat, 
        pricingVoice, 
        pricingVideo,

        // Fixed-price scheduled reading pricing
        scheduledChatPrice15,
        scheduledChatPrice30,
        scheduledChatPrice60,
        scheduledVoicePrice15,
        scheduledVoicePrice30,
        scheduledVoicePrice60,
        scheduledVideoPrice15,
        scheduledVideoPrice30,
        scheduledVideoPrice60 
      } = req.body;

      // Check if any pricing fields are provided
      const hasPerMinutePricing = pricingChat !== undefined || pricingVoice !== undefined || pricingVideo !== undefined;
      const hasScheduledPricing = 
        scheduledChatPrice15 !== undefined || scheduledChatPrice30 !== undefined || scheduledChatPrice60 !== undefined ||
        scheduledVoicePrice15 !== undefined || scheduledVoicePrice30 !== undefined || scheduledVoicePrice60 !== undefined ||
        scheduledVideoPrice15 !== undefined || scheduledVideoPrice30 !== undefined || scheduledVideoPrice60 !== undefined;

      if (!hasPerMinutePricing && !hasScheduledPricing) {
        return res.status(400).json({ message: "At least one pricing field is required" });
      }

      // Validate pricing values
      const update: UserUpdate = {};

      // Validate per-minute pricing
      if (pricingChat !== undefined) {
        if (isNaN(pricingChat) || pricingChat < 0) {
          return res.status(400).json({ message: "Chat pricing must be a positive number" });
        }
        update.pricingChat = pricingChat;
      }

      if (pricingVoice !== undefined) {
        if (isNaN(pricingVoice) || pricingVoice < 0) {
          return res.status(400).json({ message: "Voice pricing must be a positive number" });
        }
        update.pricingVoice = pricingVoice;
      }

      if (pricingVideo !== undefined) {
        if (isNaN(pricingVideo) || pricingVideo < 0) {
          return res.status(400).json({ message: "Video pricing must be a positive number" });
        }
        update.pricingVideo = pricingVideo;
      }

      // Validate scheduled chat pricing
      if (scheduledChatPrice15 !== undefined) {
        if (isNaN(scheduledChatPrice15) || scheduledChatPrice15 < 0) {
          return res.status(400).json({ message: "15-minute chat pricing must be a positive number" });
        }
        update.scheduledChatPrice15 = scheduledChatPrice15;
      }

      if (scheduledChatPrice30 !== undefined) {
        if (isNaN(scheduledChatPrice30) || scheduledChatPrice30 < 0) {
          return res.status(400).json({ message: "30-minute chat pricing must be a positive number" });
        }
        update.scheduledChatPrice30 = scheduledChatPrice30;
      }

      if (scheduledChatPrice60 !== undefined) {
        if (isNaN(scheduledChatPrice60) || scheduledChatPrice60 < 0) {
          return res.status(400).json({ message: "60-minute chat pricing must be a positive number" });
        }
        update.scheduledChatPrice60 = scheduledChatPrice60;
      }

      // Validate scheduled voice pricing
      if (scheduledVoicePrice15 !== undefined) {
        if (isNaN(scheduledVoicePrice15) || scheduledVoicePrice15 < 0) {
          return res.status(400).json({ message: "15-minute voice pricing must be a positive number" });
        }
        update.scheduledVoicePrice15 = scheduledVoicePrice15;
      }

      if (scheduledVoicePrice30 !== undefined) {
        if (isNaN(scheduledVoicePrice30) || scheduledVoicePrice30 < 0) {
          return res.status(400).json({ message: "30-minute voice pricing must be a positive number" });
        }
        update.scheduledVoicePrice30 = scheduledVoicePrice30;
      }

      if (scheduledVoicePrice60 !== undefined) {
        if (isNaN(scheduledVoicePrice60) || scheduledVoicePrice60 < 0) {
          return res.status(400).json({ message: "60-minute voice pricing must be a positive number" });
        }
        update.scheduledVoicePrice60 = scheduledVoicePrice60;
      }

      // Validate scheduled video pricing
      if (scheduledVideoPrice15 !== undefined) {
        if (isNaN(scheduledVideoPrice15) || scheduledVideoPrice15 < 0) {
          return res.status(400).json({ message: "15-minute video pricing must be a positive number" });
        }
        update.scheduledVideoPrice15 = scheduledVideoPrice15;
      }

      if (scheduledVideoPrice30 !== undefined) {
        if (isNaN(scheduledVideoPrice30) || scheduledVideoPrice30 < 0) {
          return res.status(400).json({ message: "30-minute video pricing must be a positive number" });
        }
        update.scheduledVideoPrice30 = scheduledVideoPrice30;
      }

      if (scheduledVideoPrice60 !== undefined) {
        if (isNaN(scheduledVideoPrice60) || scheduledVideoPrice60 < 0) {
          return res.status(400).json({ message: "60-minute video pricing must be a positive number" });
        }
        update.scheduledVideoPrice60 = scheduledVideoPrice60;
      }

      // Update the pricing
      const updatedUser = await storage.updateUser(req.user.id, update);

      // Remove sensitive data before returning
      const safeUser = updatedUser ? { ...updatedUser } : null;
      if (safeUser && 'password' in safeUser) {
        delete (safeUser as any).password;
      }

      res.json({ success: true, user: safeUser });
    } catch (error) {
      console.error("Failed to update reader pricing:", error);
      res.status(500).json({ message: "Failed to update pricing" });
    }
  });

  // Reading scheduling system

  // Schedule a reading (both on-demand and future scheduled readings)
  app.post("/api/readings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "You must be logged in to book a reading" });
    }

    try {
      const { readerId, type, scheduledFor, notes } = req.body;

      // Validate request
      if (!readerId) {
        return res.status(400).json({ message: "Reader ID is required" });
      }

      if (!type || !["chat", "video", "voice"].includes(type)) {
        return res.status(400).json({ message: "Valid reading type is required (chat, video, or voice)" });
      }

      // Make sure the reader exists and is a reader
      const reader = await storage.getUser(readerId);
      if (!reader || reader.role !== "reader") {
        return res.status(404).json({ message: "Reader not found" });
      }

      // Determine pricing based on reading type
      let pricePerMinute;
      if (type === "chat") {
        pricePerMinute = reader.pricingChat || reader.pricing || 0;
      } else if (type === "voice") {
        pricePerMinute = reader.pricingVoice || (reader.pricing ? reader.pricing + 100 : 0);
      } else if (type === "video") {
        pricePerMinute = reader.pricingVideo || (reader.pricing ? reader.pricing + 200 : 0);
      } else {
        pricePerMinute = reader.pricing || 0;
      }

      if (pricePerMinute <= 0) {
        return res.status(400).json({ message: "Reader has not set pricing for this reading type" });
      }

      // Determine reading mode (scheduled or on-demand)
      const readingMode = scheduledFor ? "scheduled" : "on_demand";

      // Standard duration for now (can be changed later)
      const duration = 30; // 30 minutes

      // Calculate price
      const totalPrice = pricePerMinute * duration;

      // Create the reading
      const reading = await storage.createReading({
        readerId,
        clientId: req.user.id,
        type,
        readingMode,
        status: readingMode === "scheduled" ? "scheduled" : "waiting_payment",
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        duration,
        price: pricePerMinute, // Legacy field (using price per minute)
        pricePerMinute,
        totalPrice,
        notes
      });

      // Return appropriate response based on reading mode
      if (readingMode === "scheduled") {
        return res.status(201).json({ 
          message: "Reading scheduled successfully",
          reading
        });
      } else {
        // For on-demand readings, we'd normally generate a payment link,
        // but since we're simplifying to just scheduling, return the reading directly
        return res.status(201).json({ 
          message: "Reading created successfully",
          reading
        });
      }
    } catch (error) {
      console.error("Error creating reading:", error);
      res.status(500).json({ message: "Failed to create reading" });
    }
  });

  // Get client's readings
  app.get("/api/readings/client", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "You must be logged in to view your readings" });
    }

    try {
      const readings = await storage.getReadingsByClient(req.user.id);
      res.json(readings);
    } catch (error) {
      console.error("Error fetching client readings:", error);
      res.status(500).json({ message: "Failed to fetch readings" });
    }
  });

  // Get reader's readings
  app.get("/api/readings/reader", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "reader") {
      return res.status(403).json({ message: "You must be a reader to view your readings" });
    }

    try {
      const readings = await storage.getReadingsByReader(req.user.id);
      res.json(readings);
    } catch (error) {
      console.error("Error fetching reader readings:", error);
      res.status(500).json({ message: "Failed to fetch readings" });
    }
  });

  // Get a specific reading
  app.get("/api/readings/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "You must be logged in to view readings" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }

      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }

      // Check if user is authorized (client, reader, or admin)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to view this reading" });
      }

      res.json(reading);
    } catch (error) {
      console.error("Error fetching reading:", error);
      res.status(500).json({ message: "Failed to fetch reading" });
    }
  });

  // Update reading status
  app.patch("/api/readings/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "You must be logged in to update a reading" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }

      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }

      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }

      // Check if user is authorized (client, reader, or admin)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to update this reading" });
      }

      // Only allow certain transitions based on user role and current status
      const validTransitions: Record<string, string[]> = {
        scheduled: ["cancelled", "in_progress"],
        waiting_payment: ["cancelled", "payment_completed"],
        payment_completed: ["in_progress", "cancelled"],
        in_progress: ["completed", "cancelled"],
        completed: [], // No transitions from completed
        cancelled: [] // No transitions from cancelled
      };

      if (!validTransitions[reading.status].includes(status)) {
        return res.status(400).json({ 
          message: `Cannot transition from ${reading.status} to ${status}`,
          validTransitions: validTransitions[reading.status]
        });
      }

      // Additional validations based on role
      if (req.user.role === "client" && !["cancelled"].includes(status)) {
        return res.status(403).json({ message: "Clients can only cancel readings" });
      }

      // Process the status update
      const update: Partial<Reading> = { status } as any;

      // Add timestamps based on status
      if (status === "in_progress") {
        update.startedAt = new Date();
      } else if (status === "completed") {
        update.completedAt = new Date();
      }

      const updatedReading = await storage.updateReading(id, update);

      res.json({ 
        message: "Reading status updated successfully",
        reading: updatedReading
      });
    } catch (error) {
      console.error("Error updating reading status:", error);
      res.status(500).json({ message: "Failed to update reading status" });
    }
  });

  // Endpoints for adding notes to a reading
  app.post("/api/readings/:id/notes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "You must be logged in to add notes" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }

      const { notes } = req.body;
      if (!notes) {
        return res.status(400).json({ message: "Notes content is required" });
      }

      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }

      // Only the client and reader involved in the reading can add notes
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized to add notes to this reading" });
      }

      const updatedReading = await storage.updateReading(id, { notes } as Partial<Reading>);

      res.json({ 
        message: "Notes added successfully", 
        reading: updatedReading 
      });
    } catch (error) {
      console.error("Error adding notes:", error);
      res.status(500).json({ message: "Failed to add notes" });
    }
  });

  // Add review to a completed reading
  app.post("/api/readings/:id/review", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "You must be logged in to add a review" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }

      const { rating, review } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Valid rating (1-5) is required" });
      }

      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }

      // Only the client can review a reading
      if (req.user.id !== reading.clientId) {
        return res.status(403).json({ message: "Only the client can review a reading" });
      }

      // Only completed readings can be reviewed
      if (reading.status !== "completed") {
        return res.status(400).json({ message: "Only completed readings can be reviewed" });
      }

      // Update the reading with review data
      const updatedReading = await storage.updateReading(id, { 
        rating, 
        review: review || "" 
      } as Partial<Reading>);

      // Update the reader's rating
      const reader = await storage.getUser(reading.readerId);
      if (reader) {
        const readings = await storage.getReadingsByReader(reading.readerId);
        const completedReadings = readings.filter(r => r.status === "completed" && r.rating);

        // Calculate new average rating
        const totalRating = completedReadings.reduce((sum, r) => sum + (r.rating || 0), 0);
        const newRating = Math.round(totalRating / completedReadings.length);

        // Update reader with new average rating and increment review count
        await storage.updateUser(reading.readerId, {
          rating: newRating,
          reviewCount: (reader.reviewCount || 0) + 1
        });
      }

      res.json({ 
        message: "Review added successfully", 
        reading: updatedReading 
      });
    } catch (error) {
      console.error("Error adding review:", error);
      res.status(500).json({ message: "Failed to add review" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      console.log("Getting products from database...");
      const products = await storage.getProducts();
      console.log(`Found ${products.length} products`);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/featured", async (req, res) => {
    try {
      console.log("Getting featured products from database...");
      const products = await storage.getFeaturedProducts();
      console.log(`Found ${products.length} featured products`);
      res.json(products);
    } catch (error) {
      console.error("Error fetching featured products:", error);
      res.status(500).json({ message: "Failed to fetch featured products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Stripe payment intent creation for shop checkout
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount } = req.body;

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      const { clientSecret, paymentIntentId } = await stripeClient.createPaymentIntent({
        amount,
        currency: "usd",
        metadata: {
          integration_check: 'accept_a_payment',
          source: 'shop_checkout'
        },
      });

      res.json({ clientSecret, paymentIntentId });
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin-only routes for product management
  app.post("/api/products", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const productData = req.body;
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const updatedProduct = await storage.updateProduct(id, req.body);
      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // Sync all products with Stripe
  app.post("/api/products/sync-with-stripe", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      // 1. Get all products from database
      const dbProducts = await storage.getProducts();

      // 2. Sync each product with Stripe
      const results = await Promise.all(
        dbProducts.map(async (product) => {
          try {
            const { stripeProductId, stripePriceId } = await stripeClient.syncProductWithStripe(product);

            // 3. Update product in database with Stripe IDs
            await storage.updateProduct(product.id, { 
              stripeProductId, 
              stripePriceId 
            });

            return { 
              id: product.id, 
              name: product.name, 
              success: true,
              stripeProductId,
              stripePriceId
            };
          } catch (error: any) {
            return { 
              id: product.id, 
              name: product.name, 
              success: false, 
              error: error.message 
            };
          }
        })
      );

      // 4. Return results
      res.json({
        totalProducts: dbProducts.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results
      });
    } catch (error: any) {
      console.error("Error syncing products with Stripe:", error);
      res.status(500).json({ message: "Failed to sync products with Stripe" });
    }
  });

  // Import products from Stripe
  app.post("/api/products/import-from-stripe", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      // 1. Get products from Stripe
      const stripeProducts = await stripeClient.fetchStripeProducts();

      // 2. Get existing products from DB to check for duplicates
      const dbProducts = await storage.getProducts();
      const existingStripeProductIds = new Set(
        dbProducts
          .filter(p => p.stripeProductId)
          .map(p => p.stripeProductId)
      );

      // 3. Filter out products that already exist in the database
      const newProducts = stripeProducts.filter(
        p => !existingStripeProductIds.has(p.stripeProductId)
      );

      // 4. Import new products into database
      const importResults = await Promise.all(
        newProducts.map(async (product) => {
          try {
            const newProduct = await storage.createProduct({
              name: product.name,
              description: product.description,
              price: product.price,
              imageUrl: product.imageUrl,
              category: product.category,
              stock: product.stock,
              featured: product.featured,
              stripeProductId: product.stripeProductId,
              stripePriceId: product.stripePriceId
            });

            return { 
              id: newProduct.id, 
              name: newProduct.name, 
              success: true 
            };
          } catch (error: any) {
            return { 
              name: product.name, 
              success: false, 
              error: error.message 
            };
          }
        })
      );

      // 5. Return results
      res.json({
        totalImported: newProducts.length,
        successCount: importResults.filter(r => r.success).length,
        failureCount: importResults.filter(r => !r.success).length,
        results: importResults
      });
    } catch (error: any) {
      console.error("Error importing products from Stripe:", error);
      res.status(500).json({ message: "Failed to import products from Stripe" });
    }
  });

  // Orders
  app.post("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const orderData = req.body;

      // Create order
      const order = await storage.createOrder({
        userId: req.user.id,
        status: "pending",
        total: orderData.total,
        shippingAddress: orderData.shippingAddress
      });

      // Create order items
      for (const item of orderData.items) {
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        });
      }

      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const orders = await storage.getOrdersByUser(req.user.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user is authorized
      if (req.user.id !== order.userId && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Get order items
      const orderItems = await storage.getOrderItems(id);

      res.json({ ...order, items: orderItems });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Livestreams
  app.get("/api/livestreams", async (req, res) => {
    try {
      const livestreams = await storage.getLivestreams();

      // Return an empty array if no livestreams found
      if (!livestreams || livestreams.length === 0) {
        return res.json([]);
      }

      res.json(livestreams);
    } catch (error) {
      console.error("Error fetching livestreams:", error);
      // Return empty array instead of error to avoid breaking the UI
      res.json([]);
    }
  });

  app.post("/api/livestreams", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "reader") {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      const livestreamData = req.body;

      // Create the livestream with LiveKit integration (placeholder)
      const livestream = await livekitService.createLivestream(
        req.user,
        livestreamData.title,
        livestreamData.description
      );

      // Add additional data from the request
      await storage.updateLivestream(livestream.id, {
        thumbnailUrl: livestreamData.thumbnailUrl || null,
        scheduledFor: livestreamData.scheduledFor ? new Date(livestreamData.scheduledFor) : null,
        category: livestreamData.category || "General"
      });

      // Return the livestream 
      res.status(201).json(livestream);
    } catch (error) {
      console.error("Failed to create livestream:", error);
      res.status(500).json({ message: "Failed to create livestream" });
    }
  });

  app.patch("/api/livestreams/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid livestream ID" });
      }

      const livestream = await storage.getLivestream(id);
      if (!livestream) {
        return res.status(404).json({ message: "Livestream not found" });
      }

      // Check if user is authorized
      if (req.user.id !== livestream.userId && req.user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { status } = req.body;

      let updatedLivestream;

      if (status === "live") {
        // Start the livestream with LiveKit
        updatedLivestream = await livekitService.startLivestream(id);

        // Broadcast to all connected clients that a new livestream is starting
        (global as any).websocket?.broadcastToAll?.({
          type: 'livestream_started',
          livestreamId: id,
          user: {
            id: req.user.id,
            username: req.user.username,
            fullName: req.user.fullName,
            profileImage: req.user.profileImage
          },
          timestamp: Date.now()
        });
      } else if (status === "ended") {
        // End the livestream with LiveKit
        updatedLivestream = await livekitService.endLivestream(id);

        // Broadcast to all connected clients that the livestream has ended
        (global as any).websocket?.broadcastToAll?.({
          type: 'livestream_ended',
          livestreamId: id,
          timestamp: Date.now()
        });
      } else {
        // For other status updates, just update in our database
        updatedLivestream = await storage.updateLivestream(id, { status });
      }

      res.json(updatedLivestream);
    } catch (error) {
      console.error("Failed to update livestream status:", error);
      res.status(500).json({ message: "Failed to update livestream status" });
    }
  });

  // Gifting system for livestreams
  app.post("/api/gifts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const giftData = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!giftData.recipientId || !giftData.amount || !giftData.giftType) {
        return res.status(400).json({ message: "Missing required gift data" });
      }

      // Standardize gift amounts to the defined denominations ($1, $5, $10 in cents)
      const validAmounts = [100, 500, 1000]; // $1, $5, $10 in cents
      const amount = parseInt(giftData.amount);
      
      if (!validAmounts.includes(amount)) {
        return res.status(400).json({ 
          message: "Invalid gift amount. Please choose from $1, $5, or $10",
          validAmounts: validAmounts.map(a => a / 100) // Convert to dollars for display
        });
      }

      // Check if recipient exists
      const recipient = await storage.getUser(giftData.recipientId);
      if (!recipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }

      // Check if user has enough balance
      const sender = await storage.getUser(userId);
      if (!sender || (sender.accountBalance || 0) < amount) {
        return res.status(400).json({ 
          message: "Insufficient account balance",
          balance: sender ? sender.accountBalance || 0 : 0,
          required: amount
        });
      }

      // If there's a livestream, check if it's active
      let livestream = null;
      if (giftData.livestreamId) {
        livestream = await storage.getLivestream(giftData.livestreamId);
        if (!livestream) {
          return res.status(404).json({ message: "Livestream not found" });
        }
        if (livestream.status !== 'live') {
          return res.status(400).json({ message: "Livestream is not active" });
        }
      }

      // Calculate reader amount (70%) and platform amount (30%)
      const readerAmount = Math.floor(amount * 0.7); // 70% to reader
      const platformAmount = amount - readerAmount; // Remainder to platform

      // Create the gift
      const gift = await storage.createGift({
        senderId: userId,
        recipientId: giftData.recipientId,
        livestreamId: giftData.livestreamId || null,
        amount: amount,
        giftType: giftData.giftType,
        readerAmount: readerAmount,
        platformAmount: platformAmount,
        message: giftData.message || null
      });

      // Deduct from sender's balance
      await storage.updateUser(userId, {
        accountBalance: (sender.accountBalance || 0) - amount
      });

      // Add to recipient's balance (70% of the gift amount)
      await storage.updateUser(giftData.recipientId, {
        accountBalance: (recipient.accountBalance || 0) + readerAmount
      });

      // Prepare the gift notification with user information
      const giftNotification = {
        type: 'new_gift',
        gift,
        senderUsername: sender.username,
        senderName: sender.fullName || sender.username,
        recipientUsername: recipient.username,
        recipientName: recipient.fullName || recipient.username,
        giftType: giftData.giftType,
        giftAmount: amount / 100, // Convert cents to dollars for display
        message: giftData.message || null,
        timestamp: new Date().toISOString()
      };

      // If there's a livestream, notify all users in the livestream
      if (giftData.livestreamId && livestream) {
        try {
          // Create a room name for the livestream
          const roomName = `livestream-${recipient.id}`;
          
          // Broadcast the gift to all users in the livestream room
          broadcastToAll(giftNotification);
          
          console.log(`Broadcasted gift notification to all users for room: ${roomName}`);
        } catch (broadcastError) {
          console.error("Failed to broadcast gift:", broadcastError);
          // Don't fail the request if broadcasting fails
        }
      }

      res.status(201).json({
        gift,
        notification: giftNotification
      });
    } catch (error) {
      console.error("Failed to create gift:", error);
      res.status(500).json({ message: "Failed to create gift. Please try again." });
    }
  });

  app.get("/api/gifts/livestream/:livestreamId", async (req, res) => {
    try {
      const { livestreamId } = req.params;

      if (!livestreamId || isNaN(parseInt(livestreamId))) {
        return res.json([]);
      }

      const gifts = await storage.getGiftsByLivestream(parseInt(livestreamId));

      // Return empty array if no gifts found
      if (!gifts || gifts.length === 0) {
        return res.json([]);
      }

      res.json(gifts);
    } catch (error) {
      console.error("Error fetching gifts for livestream:", error);
      // Return empty array instead of error to avoid breaking the UI
      res.json([]);
    }
  });

  app.get("/api/gifts/received", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const gifts = await storage.getGiftsByRecipient(req.user.id);

      // Return empty array if no gifts found
      if (!gifts || gifts.length === 0) {
        return res.json([]);
      }

      res.json(gifts);
    } catch (error) {
      console.error("Error fetching received gifts:", error);
      // Return empty array instead of error to avoid breaking the UI
      res.json([]);
    }
  });

  app.get("/api/gifts/sent", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const gifts = await storage.getGiftsBySender(req.user.id);

      // Return empty array if no gifts found
      if (!gifts || gifts.length === 0) {
        return res.json([]);
      }

      res.json(gifts);
    } catch (error) {
      console.error("Error fetching sent gifts:", error);
      // Return empty array instead of error to avoid breaking the UI
      res.json([]);
    }
  });

  // Admin endpoint to get unprocessed gifts
  app.get("/api/admin/gifts/unprocessed", requireAdmin, async (req, res) => {
    try {
      // Get all unprocessed gifts
      const unprocessedGifts = await storage.getUnprocessedGifts();

      // Include user information for the gifts
      const giftsWithUserInfo = await Promise.all(unprocessedGifts.map(async (gift) => {
        const sender = await storage.getUser(gift.senderId);
        const recipient = await storage.getUser(gift.recipientId);

        return {
          ...gift,
          senderUsername: sender?.username || `User #${gift.senderId}`,
          recipientUsername: recipient?.username || `User #${gift.recipientId}`
        };
      }));

      res.json(giftsWithUserInfo);
    } catch (error) {
      console.error("Failed to fetch unprocessed gifts:", error);
      res.status(500).json({ 
        message: "Failed to fetch unprocessed gifts",
        error: error.message || "Unknown error" 
      });
    }
  });

  // Admin endpoint to get all gifts
  app.get("/api/admin/gifts", requireAdmin, async (req, res) => {
    try {
      // Get all gifts with optional limit
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      let allGifts = await db.select().from(gifts).orderBy(desc(gifts.createdAt));

      if (limit && !isNaN(limit)) {
        allGifts = allGifts.slice(0, limit);
      }

      // Include user information for the gifts
      const giftsWithUserInfo = await Promise.all(allGifts.map(async (gift) => {
        const sender = await storage.getUser(gift.senderId);
        const recipient = await storage.getUser(gift.recipientId);

        return {
          ...gift,
          senderUsername: sender?.username || `User #${gift.senderId}`,
          recipientUsername: recipient?.username || `User #${gift.recipientId}`
        };
      }));

      res.json(giftsWithUserInfo);
    } catch (error) {
      console.error("Failed to fetch gifts:", error);
      res.status(500).json({ 
        message: "Failed to fetch gifts",
        error: error.message || "Unknown error" 
      });
    }
  });

  // Admin endpoint to process gifts 
  app.post("/api/admin/gifts/process", requireAdmin, async (req, res) => {
    try {
      // Get all unprocessed gifts
      const unprocessedGifts = await storage.getUnprocessedGifts();

      // If no unprocessed gifts found, return early
      if (!unprocessedGifts || unprocessedGifts.length === 0) {
        return res.json({ 
          processedCount: 0,
          gifts: [],
          message: "No unprocessed gifts found"
        });
      }

      const processedGifts = [];
      const failedGifts = [];

      // Mark each gift as processed
      for (const gift of unprocessedGifts) {
        try {
          const processedGift = await storage.markGiftAsProcessed(gift.id);
          if (processedGift) {
            processedGifts.push(processedGift);
          } else {
            failedGifts.push(gift.id);
          }
        } catch (giftError) {
          console.error(`Failed to process gift ${gift.id}:`, giftError);
          failedGifts.push(gift.id);
        }
      }

      res.json({ 
        processedCount: processedGifts.length,
        gifts: processedGifts,
        failedCount: failedGifts.length,
        failedGiftIds: failedGifts,
        success: processedGifts.length > 0
      });
    } catch (error) {
      console.error("Failed to process gifts:", error);
      res.status(500).json({ 
        message: "Failed to process gifts",
        error: error.message || "Unknown error" 
      });
    }
  });

  // Forum
  app.get("/api/forum/posts", async (req, res) => {
    try {
      const posts = await storage.getForumPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch forum posts" });
    }
  });

  app.post("/api/forum/posts", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const postData = req.body;

      const post = await storage.createForumPost({
        userId: req.user.id,
        title: postData.title,
        content: postData.content,
        category: postData.category
      });

      res.status(201).json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to create forum post" });
    }
  });

  app.get("/api/forum/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getForumPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Increment view count
      const updatedPost = await storage.updateForumPost(id, {
        views: post.views + 1
      });

      res.json(updatedPost);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  app.post("/api/forum/posts/:id/like", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getForumPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Increment likes
      const updatedPost = await storage.updateForumPost(id, {
        likes: post.likes + 1
      });

      res.json(updatedPost);
    } catch (error) {
      res.status(500).json({ message: "Failed to like post" });
    }
  });

  app.get("/api/forum/comments", async (req, res) => {
    try {
      const postId = req.query.postId ? parseInt(req.query.postId as string) : undefined;

      if (postId) {
        const comments = await storage.getForumCommentsByPost(postId);
        return res.json(comments);
      }

      res.status(400).json({ message: "Post ID is required" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.get("/api/forum/posts/:id/comments", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const comments = await storage.getForumCommentsByPost(id);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/forum/posts/:id/comments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      const post = await storage.getForumPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const commentData = req.body;

      const comment = await storage.createForumComment({
        userId: req.user.id,
        postId: id,
        content: commentData.content
      });

      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Messages
  app.get("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const messages = await storage.getMessagesByUsers(req.user.id, userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const messageData = req.body;

      const message = await storage.createMessage({
        senderId: req.user.id,
        receiverId: messageData.receiverId,
        content: messageData.content,
        isPaid: messageData.isPaid || false,
        price: messageData.price || null
      });

      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.patch("/api/messages/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }

      const updatedMessage = await storage.markMessageAsRead(id);
      if (!updatedMessage) {
        return res.status(404).json({ message: "Message not found" });
      }

      res.json(updatedMessage);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  app.get("/api/messages/unread/count", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const count = await storage.getUnreadMessageCount(req.user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to get unread message count" });
    }
  });

  // On-demand reading endpoints (pay per minute)

  // Payment API endpoints
  app.get("/api/stripe/config", (req, res) => {
    res.json({
      publishableKey: process.env.VITE_STRIPE_PUBLIC_KEY
    });
  });

  // Endpoint to create a new livestream
  app.post('/api/livestreams', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Only readers can create livestreams
      if (req.user.role !== 'reader') {
        return res.status(403).json({ message: "Only readers can create livestreams" });
      }

      const { title, description, category } = req.body;

      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }

      // Create livestream via our LiveKit-based solution
      const liveKitService = require('./services/livekit-service');
      const livestream = await liveKitService.createLivestream(req.user, title, description);

      // Add additional metadata
      if (category) {
        await storage.updateLivestream(livestream.id, { category });
      }

      res.status(201).json(livestream);
    } catch (error) {
      console.error('Error creating livestream:', error);
      res.status(500).json({ 
        message: "Failed to create livestream",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get all active/live livestreams
  app.get('/api/livestreams', async (req: Request, res: Response) => {
    try {
      // Check for userId query param to filter by reader/creator
      const userId = req.query.userId ? parseInt(req.query.userId as string) : null;

      // Make sure LiveKit service is available
      const liveKitService = require('./services/livekit-service');

      let livestreams;
      if (userId) {
        // Get livestreams for a specific user
        livestreams = await liveKitService.getLivestreamsForUser(userId);
      } else {
        // Get all public livestreams (status='live')
        livestreams = await liveKitService.getPublicLivestreams();
      }

      // Add reader info to each livestream
      const livestreamsWithReaders = await Promise.all(
        livestreams.map(async (stream) => {
          const reader = await storage.getUser(stream.userId);
          if (!reader) return stream;

          // Remove sensitive reader info
          const { password, email, stripeCustomerId, stripeAccountId, ...safeReader } = reader;

          return {
            ...stream,
            reader: safeReader
          };
        })
      );

      res.json(livestreamsWithReaders);
    } catch (error) {
      console.error('Error fetching livestreams:', error);
      res.status(500).json({ message: "Failed to fetch livestreams" });
    }
  });

  // Get a single livestream by ID
  app.get('/api/livestreams/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid livestream ID" });
      }

      // Get the livestream details using LiveKit
      const liveKitService = require('./services/livekit-service');
      const livestream = await liveKitService.getLivestreamDetails(id);

      if (!livestream) {
        return res.status(404).json({ message: "Livestream not found" });
      }

      // Get reader info
      const reader = await storage.getUser(livestream.userId);

      // Prepare response with reader info (excluding sensitive data)
      let response = { ...livestream };

      if (reader) {
        const { password, email, stripeCustomerId, stripeAccountId, ...safeReader } = reader;
        response.reader = safeReader;
      }

      res.json(response);
    } catch (error) {
      console.error(`Error fetching livestream ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to fetch livestream details" });
    }
  });

  // Start a livestream - removed duplicate route

  // End a livestream - removed duplicate route

  // Stripe Connect endpoint to generate an account link for readers
  app.get('/api/stripe/connect', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Only readers can connect to Stripe
      if (req.user.role !== 'reader') {
        return res.status(403).json({ message: "Only readers can connect to Stripe" });
      }

      // Initialize Stripe account for the reader if they don't have one
      let stripeAccountId = req.user.stripeAccountId;

      if (!stripeAccountId) {
        // Create a new Stripe Connect account
        const account = await stripeClient.accounts.create({
          type: 'express',
          country: 'US',
          email: req.user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
          business_profile: {
            name: req.user.fullName || req.user.username,
            url: `${req.protocol}://${req.get('host')}/readers/${req.user.id}`
          }
        });

        stripeAccountId = account.id;

        // Update the user with their Stripe account ID
        await storage.updateUser(req.user.id, {
          stripeAccountId: stripeAccountId
        });
      }

      // Generate an account link for onboarding
      const accountLink = await stripeClient.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${req.protocol}://${req.get('host')}/dashboard`,
        return_url: `${req.protocol}://${req.get('host')}/dashboard?stripe_success=true`,
        type: 'account_onboarding',
      });

      res.json({ url: accountLink.url });
    } catch (error) {
      console.error('Error creating Stripe Connect account link:', error);
      res.status(500).json({ message: "Failed to create Stripe Connect account link" });
    }
  });

  // Create a payment intent for on-demand readings
  app.post("/api/stripe/create-payment-intent", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { amount, readingId, metadata = {} } = req.body;

      if (!amount || isNaN(amount)) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      // Use Stripe customer ID if available, or create a new one later
      const customerId = req.user.stripeCustomerId;

      const result = await stripeClient.createPaymentIntent({
        amount,
        ...(customerId ? { customerId } : {}),
        metadata: {
          readingId: readingId?.toString() || '',
          userId: req.user.id.toString(),
          ...metadata
        }
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update an existing payment intent (for pay-per-minute)
  app.post("/api/stripe/update-payment-intent", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { paymentIntentId, amount, metadata = {} } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }

      if (!amount || isNaN(amount)) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      const result = await stripeClient.updatePaymentIntent(paymentIntentId, {
        amount,
        metadata: {
          ...metadata,
          updatedAt: new Date().toISOString()
        }
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error updating payment intent:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Capture a payment intent (for finalized pay-per-minute sessions)
  app.post("/api/stripe/capture-payment-intent", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }

      const result = await stripeClient.capturePaymentIntent(paymentIntentId);
      res.json(result);
    } catch (error: any) {
      console.error("Error capturing payment intent:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create an on-demand reading session
  app.post("/api/readings/on-demand", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { readerId, type } = req.body;

      if (!readerId || !type || !["chat", "video", "voice"].includes(type)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Get the reader
      const reader = await storage.getUser(readerId);
      if (!reader || reader.role !== "reader") {
        return res.status(404).json({ message: "Reader not found" });
      }

      // Check if reader is online
      if (!reader.isOnline) {
        return res.status(400).json({ message: "Reader is not online" });
      }

      // Check if client has sufficient balance (minimum $5 or 500 cents)
      const client = await storage.getUser(req.user.id);
      const minimumBalance = 500; // $5 in cents
      if (!client || (client.accountBalance || 0) < minimumBalance) {
        return res.status(400).json({ 
          message: "Insufficient account balance. Minimum of $5 is required to start a reading.",
          balance: client ? client.accountBalance || 0 : 0,
          minimumRequired: minimumBalance
        });
      }

      // Determine the appropriate price based on reading type
      let pricePerMinute = 100; // Default $1/min

      if (type === 'chat') {
        pricePerMinute = reader.pricingChat || reader.pricing || 100;
      } else if (type === 'voice') {
        pricePerMinute = reader.pricingVoice || reader.pricing || 200;
      } else if (type === 'video') {
        pricePerMinute = reader.pricingVideo || reader.pricing || 300;
      }

      // Create a new reading record
      // Set a minimum price for the reading (pricePerMinute * 5 minutes minimum)
      const minimumPrice = pricePerMinute * 5;

      const reading = await storage.createReading({
        readerId,
        clientId: req.user.id,
        status: "waiting_payment",
        type,
        readingMode: "on_demand", // Fix the enum value
        pricePerMinute: pricePerMinute,
        duration: 5, // Start with 5 minute minimum
        price: minimumPrice, // Required non-zero price
        totalPrice: 0, // Will be calculated based on actual duration after reading is completed
        notes: null
      });

      // Create payment link using Stripe
      const paymentResult = await stripeClient.createOnDemandReadingPayment(
        pricePerMinute, // in cents
        req.user.id,
        req.user.fullName,
        readerId,
        reading.id,
        type
      );

      if (!paymentResult.success) {
        // If payment creation fails, update the reading status to cancelled
        await storage.updateReading(reading.id, { status: "cancelled" });
        return res.status(500).json({ message: "Failed to create payment" });
      }

      // Update reading with payment link
      const updatedReading = await storage.updateReading(reading.id, {
        paymentLinkUrl: paymentResult.paymentLinkUrl
      });

      // Notify the reader
      (global as any).websocket.notifyUser(readerId, {
        type: 'new_reading_request',
        reading: updatedReading,
        client: {
          id: req.user.id,
          fullName: req.user.fullName,
          username: req.user.username
        },
        timestamp: Date.now()
      });

      res.json({
        success: true,
        reading: updatedReading,
        paymentLink: paymentResult.paymentLinkUrl
      });
    } catch (error) {
      console.error('Error creating on-demand reading:', error);
      res.status(500).json({ message: "Failed to create on-demand reading" });
    }
  });

  // Schedule a reading (fixed price one-time payment)
  app.post("/api/readings/schedule", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { readerId, type, duration, scheduledFor, notes } = req.body;

      if (!readerId || !type || !["chat", "video", "voice"].includes(type)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }

      // Validate required fields
      if (!duration || isNaN(duration) || ![30, 60].includes(Number(duration))) {
        return res.status(400).json({ message: "Duration must be either 30 or 60 minutes" });
      }

      if (!scheduledFor) {
        return res.status(400).json({ message: "Scheduled date and time is required" });
      }

      // Get the reader
      const reader = await storage.getUser(readerId);
      if (!reader || reader.role !== "reader") {
        return res.status(404).json({ message: "Reader not found" });
      }

      // Determine the price based on reading type and duration
      let totalPrice = 0;

      if (type === "chat") {
        if (duration === 30) {
          totalPrice = reader.scheduledChatPrice30 || 0;
        } else if (duration === 60) {
          totalPrice = reader.scheduledChatPrice60 || 0;
        }
      } else if (type === "voice") {
        if (duration === 30) {
          totalPrice = reader.scheduledVoicePrice30 || 0;
        } else if (duration === 60) {
          totalPrice = reader.scheduledVoicePrice60 || 0;
        }
      } else if (type === "video") {
        if (duration === 30) {
          totalPrice = reader.scheduledVideoPrice30 || 0;
        } else if (duration === 60) {
          totalPrice = reader.scheduledVideoPrice60 || 0;
        }
      }

      if (totalPrice <= 0) {
        return res.status(400).json({ 
          message: `Reader has not set pricing for ${duration}-minute ${type} readings`
        });
      }

      // Validate scheduled date (must be in the future)
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        return res.status(400).json({ message: "Scheduled date must be in the future" });
      }

      const clientId = req.user.id;

      // Create a Stripe payment intent for the full amount
      try {
        const stripeCustomerId = req.user.stripeCustomerId;
        let customerId = stripeCustomerId;

        // Create a new Stripe customer if the user doesn't have one
        if (!customerId) {
          const customer = await stripeClient.customers.create({
            email: req.user.email,
            name: req.user.fullName || req.user.username,
          });
          customerId = customer.id;

          // Update user with Stripe customer ID
          await storage.updateUser(clientId, {
            stripeCustomerId: customerId
          });
        }

        // Create a payment intent for the full reading cost
        const paymentIntent = await stripeClient.paymentIntents.create({
          amount: totalPrice, // Use totalPrice (determined from fixed-price scheduled reading price)
          currency: 'usd',
          customer: customerId,
          payment_method_types: ['card'],
          metadata: {
            readingType: 'scheduled',
            clientId: clientId.toString(),
            readerId: readerId.toString(),
            type,
            duration: duration.toString(),
            scheduledFor: scheduledDate.toISOString(),
          },
        });

        // Calculate an equivalent price per minute for tracking purposes
        const pricePerMinute = Math.round(totalPrice / duration);

        // Create the reading in "waiting_payment" status
        const reading = await storage.createReading({
          readerId,
          clientId,
          type,
          status: "waiting_payment",
          price: totalPrice, // Store the total price as the main price field (required field)
          pricePerMinute: pricePerMinute, // Store calculated per-minute rate for compatibility
          duration,
          totalPrice, // Also store in totalPrice field
          scheduledFor: scheduledDate,
          notes: notes || null,
          readingMode: "scheduled",
          paymentId: paymentIntent.id // Use paymentId instead of stripePaymentIntentId to match schema
        });

        // Notify the reader
        (global as any).websocket.notifyUser(readerId, {
          type: 'new_scheduled_reading',
          reading,
          client: {
            id: req.user.id,
            fullName: req.user.fullName,
            username: req.user.username
          },
          timestamp: Date.now()
        });

        // Return the client secret for the payment intent
        return res.status(201).json({ 
          reading,
          clientSecret: paymentIntent.client_secret,
          paymentLink: `/checkout?clientSecret=${paymentIntent.client_secret}&readingId=${reading.id}`
        });

      } catch (stripeError) {
        console.error("Stripe error creating payment intent:", stripeError);
        return res.status(400).json({ 
          message: "Payment processing error",
          error: stripeError.message 
        });
      }

    } catch (error) {
      console.error("Error scheduling reading:", error);
      return res.status(500).json({ message: "Failed to schedule reading" });
    }
  });

  // Start an on-demand reading session (after payment)
  app.post("/api/readings/:id/start", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }

      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }

      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Check if reading is in the right status
      if (reading.status !== "waiting_payment" && reading.status !== "payment_completed") {
        return res.status(400).json({ 
          message: "Reading can't be started. Current status: " + reading.status 
        });
      }

      // Check if client has enough funds for at least 1 minute
      const client = await storage.getUser(reading.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Calculate cost for 1 minute
      const oneMinuteCost = reading.pricePerMinute;
      
      // Check if client has sufficient balance
      const currentBalance = client.accountBalance || 0;
      if (currentBalance < oneMinuteCost) {
        console.log(`Client ${client.id} has insufficient balance: ${currentBalance} < ${oneMinuteCost}`);
        return res.status(400).json({ 
          message: "Insufficient account balance. Client needs at least enough funds for 1 minute.",
          balance: currentBalance,
          required: oneMinuteCost,
          status: "insufficient_funds"
        });
      }
      
      console.log(`Client ${client.id} has sufficient balance: ${currentBalance} >= ${oneMinuteCost} for reading ${id}`);

      // Update reading status and start time
      const updatedReading = await storage.updateReading(id, {
        status: "in_progress",
        startedAt: new Date()
      });

      // Notify both participants
      (global as any).websocket.notifyUser(reading.clientId, {
        type: 'reading_started',
        reading: updatedReading,
        timestamp: Date.now()
      });

      (global as any).websocket.notifyUser(reading.readerId, {
        type: 'reading_started',
        reading: updatedReading,
        timestamp: Date.now()
      });

      res.json(updatedReading);
    } catch (error) {
      console.error("Failed to start reading:", error);
      res.status(500).json({ message: "Failed to start reading" });
    }
  });

  // Complete an on-demand reading session and process payment from account balance
  app.post("/api/readings/:id/end", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }

      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }

      // Check if user is authorized (client or reader of this reading)
      if (req.user.id !== reading.clientId && req.user.id !== reading.readerId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Check if reading is in progress
      if (reading.status !== "in_progress") {
        return res.status(400).json({ message: "Reading is not in progress" });
      }

      const { duration, totalPrice } = req.body;

      if (!duration || duration <= 0) {
        return res.status(400).json({ message: "Invalid duration" });
      }

      if (!totalPrice || totalPrice <= 0) {
        return res.status(400).json({ message: "Invalid total price" });
      }

      // Calculate and verify the price based on duration and pricePerMinute
      const calculatedPrice = reading.pricePerMinute * duration;
      if (Math.abs(calculatedPrice - totalPrice) > (reading.pricePerMinute / 2)) {
        console.warn(`Price discrepancy detected: calculated ${calculatedPrice} vs. received ${totalPrice}`);
      }

      // Process payment from client's account balance
      const client = await storage.getUser(reading.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Check if client has sufficient balance
      const currentBalance = client.accountBalance || 0;
      if (currentBalance < totalPrice) {
        return res.status(400).json({ 
          message: "Insufficient account balance. Please add funds to continue.",
          balance: currentBalance,
          required: totalPrice
        });
      }

      // Deduct from client's balance
      const updatedClient = await storage.updateUser(client.id, {
        accountBalance: currentBalance - totalPrice
      });

      // Add to reader's balance (if not already admin)
      const reader = await storage.getUser(reading.readerId);
      if (reader && reader.role === "reader") {
        // Readers get 70% of the payment, platform takes 30%
        const readerShare = Math.floor(totalPrice * 0.7);
        const platformShare = totalPrice - readerShare; // 30% to platform

        console.log(`Processing completed reading payment: Total $${totalPrice/100}, Reader $${readerShare/100} (70%), Platform $${platformShare/100} (30%)`);

        await storage.updateUser(reader.id, {
          accountBalance: (reader.accountBalance || 0) + readerShare
        });
      }

      // Update reading with completion details
      const now = new Date();
      const updatedReading = await storage.updateReading(id, {
        status: "completed",
        completedAt: now,
        duration,
        totalPrice,
        paymentStatus: "paid",
        paymentId: `internal-${Date.now()}`
      });

      // Notify both participants
      (global as any).websocket.notifyUser(reading.clientId, {
        type: 'reading_completed',
        reading: updatedReading,
        timestamp: Date.now(),
        totalAmount: totalPrice,
        durationMinutes: duration
      });

      (global as any).websocket.notifyUser(reading.readerId, {
        type: 'reading_completed',
        reading: updatedReading,
        timestamp: Date.now(),
        totalAmount: totalPrice,
        durationMinutes: duration
      });

      res.json({
        success: true,
        reading: updatedReading
      });
    } catch (error) {
      console.error('Error completing reading:', error);
      res.status(500).json({ message: "Failed to complete reading" });
    }
  });

  // Rate a completed reading
  app.post("/api/readings/:id/rate", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reading ID" });
      }

      const reading = await storage.getReading(id);
      if (!reading) {
        return res.status(404).json({ message: "Reading not found" });
      }

      // Only the client can rate a reading
      if (req.user.id !== reading.clientId) {
        return res.status(403).json({ message: "Only the client can rate a reading" });
      }

      // Check if reading is completed
      if (reading.status !== "completed") {
        return res.status(400).json({ message: "Reading must be completed before rating" });
      }

      const { rating, review } = req.body;

      if (rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      // Update reading with rating and review
      const updatedReading = await storage.updateReading(id, { rating, review });

      // Update reader's review count
      const reader = await storage.getUser(reading.readerId);
      if (reader) {
        await storage.updateUser(reading.readerId, { 
          reviewCount: (reader.reviewCount || 0) + 1 
        });
      }

      // Notify reader about the new review
      (global as any).websocket.notifyUser(reading.readerId, {
        type: 'new_review',
        reading: updatedReading,
        rating,
        review,
        timestamp: Date.now()
      });

      res.json(updatedReading);
    } catch (error) {
      res.status(500).json({ message: "Failed to rate reading" });
    }
  });

  // Account Balance Management
  app.get('/api/user/balance', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        balance: user.accountBalance || 0,
        formatted: `$${((user.accountBalance || 0) / 100).toFixed(2)}`
      });
    } catch (error: any) {
      console.error("Error fetching user balance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's reading history
  app.get('/api/users/:id/readings', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Users can only access their own readings
    if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      let readings;

      if (req.user.role === 'client') {
        readings = await storage.getReadingsByClient(req.user.id);
      } else if (req.user.role === 'reader') {
        readings = await storage.getReadingsByReader(req.user.id);
      } else {
        // Admin can view all completed readings
        const allReadings = await storage.getReadings();
        readings = allReadings.filter((r: Reading) => r.status === 'completed');
      }

      // Add reader names to the readings
      const readingsWithNames = await Promise.all(readings.map(async (reading: Reading) => {
        const reader = await storage.getUser(reading.readerId);
        return {
          ...reading,
          readerName: reader ? reader.fullName : 'Unknown Reader'
        };
      }));

      res.json(readingsWithNames.filter((r: Reading & { readerName: string }) => r.status === 'completed'));
    } catch (error: any) {
      console.error("Error fetching readings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's upcoming readings
  app.get('/api/users/:id/readings/upcoming', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Users can only access their own upcoming readings
    if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized" });
    }

    try {
      let readings;

      if (req.user.role === 'client') {
        readings = await storage.getReadingsByClient(req.user.id);
      } else if (req.user.role === 'reader') {
        readings = await storage.getReadingsByReader(req.user.id);
      } else {
        // Admin can view all scheduled readings
        const allReadings = await storage.getReadings();
        readings = allReadings.filter(r => 
          r.status === 'scheduled' || 
          r.status === 'waiting_payment' || 
          r.status === 'payment_completed' ||
          r.status === 'in_progress'
        );
      }

      // Add reader names to the readings
      const readingsWithNames = await Promise.all(readings.map(async (reading) => {
        const reader = await storage.getUser(reading.readerId);
        return {
          ...reading,
          readerName: reader ? reader.fullName : 'Unknown Reader'
        };
      }));

      // Filter for upcoming readings
      const upcomingReadings = readingsWithNames.filter(r => 
        r.status === 'scheduled' || 
        r.status === 'waiting_payment' || 
        r.status === 'payment_completed' ||
        r.status === 'in_progress'
      );

      res.json(upcomingReadings);
    } catch (error: any) {
      console.error("Error fetching upcoming readings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add funds to account balance 
  app.post('/api/user/add-funds', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    try {
      // Create a Stripe payment intent to add funds
      const result = await stripeClient.createPaymentIntent({
        amount,
        metadata: {
          userId: req.user.id.toString(),
          purpose: 'account_funding'
        }
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error creating payment intent for adding funds:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a payment intent for checkout (store purchases)
  app.post('/api/create-payment-intent', async (req, res) => {
    try {
      const { amount } = req.body;

      console.log('Received create-payment-intent request:', { amount, isAuthenticated: req.isAuthenticated() });

      if (!amount || isNaN(amount)) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      // If user is logged in, associate the payment with them
      const metadata: Record<string, string> = {
        purpose: 'store_purchase'
      };

      if (req.isAuthenticated()) {
        metadata.userId = req.user.id.toString();
      } else {
        // For development/testing, allow guest checkout
        // In production environment, this would be restricted
        console.log('Creating payment intent for guest (unauthenticated) user');
      }

      const result = await stripeClient.createPaymentIntent({
        amount,
        metadata
      });

      console.log('Payment intent created successfully:', { 
        paymentIntentId: result.paymentIntentId,
        hasClientSecret: !!result.clientSecret
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error creating payment intent for store purchase:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get user balance
  app.get('/api/user/balance', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.user.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const balance = user.accountBalance || 0;

      res.json({
        balance,
        formatted: `$${(balance / 100).toFixed(2)}`
      });
    } catch (error: any) {
      console.error("Error fetching user balance:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Confirm added funds (after payment is completed)
  app.post('/api/user/confirm-funds', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "Payment intent ID is required" });
    }

    try {
      // Check if payment intent exists and is valid
      const paymentIntent = await stripeClient.retrievePaymentIntent(paymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({ message: "Payment not completed" });
      }

      if (paymentIntent.metadata.userId !== req.user.id.toString()) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Add funds to user's account balance
      const amountToAdd = paymentIntent.amount;
      const user = await storage.getUser(req.user.id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentBalance = user.accountBalance || 0;
      const updatedUser = await storage.updateUser(user.id, {
        accountBalance: currentBalance + amountToAdd
      });

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update account balance" });
      }

      res.json({ 
        success: true, 
        newBalance: updatedUser.accountBalance || 0,
        formatted: `$${((updatedUser.accountBalance || 0) / 100).toFixed(2)}` 
      });
    } catch (error: any) {
      console.error("Error confirming added funds:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin API routes

  // Get all readings (admin only)
  app.get("/api/admin/readings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized. Admin access required." });
    }

    try {
      const readings = await storage.getReadings();
      const readingsWithNames = await Promise.all(readings.map(async (reading) => {
        const client = await storage.getUser(reading.clientId);
        const reader = reading.readerId ? await storage.getUser(reading.readerId) : null;

        return {
          ...reading,
          clientName: client ? client.username : "Unknown",
          readerName: reader ? reader.username : "Unassigned"
        };
      }));

      return res.json(readingsWithNames);
    } catch (error) {
      console.error("Error fetching all readings:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all readers (admin only)
  app.get("/api/admin/readers", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized. Admin access required." });
    }

    try {
      const readers = await storage.getReaders();
      return res.json(readers);
    } catch (error) {
      console.error("Error fetching all readers:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all users (admin only)

  // Configure multer for memory storage with enhanced options
  const upload2 = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // limit to 5MB
    },
    fileFilter: (req: any, file: any, cb: any) => {
      // Accept images only
      if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
      }
      cb(null, true);
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      // We need to get all users - adapted storage method might be needed
      const users = await storage.getAllUsers();

      // Return without password information
      const sanitizedUsers = users.map(user => {
        const userWithoutPassword = { ...user };
        if ('password' in userWithoutPassword) {
          delete (userWithoutPassword as any).password;
        }
        return userWithoutPassword;
      });

      return res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching all users:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin endpoint to update readers
  app.patch("/api/admin/readers/:id", requireAdmin, upload2.single('profileImage'), async (req: any, res: any) => {
    try {
      const readerId = parseInt(req.params.id);
      if (isNaN(readerId)) {
        return res.status(400).json({ message: "Invalid reader ID" });
      }

      const reader = await storage.getUser(readerId);
      if (!reader || reader.role !== 'reader') {
        return res.status(404).json({ message: "Reader not found" });
      }

      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const { fullName, bio, specialties, pricing, pricingChat, pricingVoice, pricingVideo, scheduledChatPrice15, scheduledChatPrice30, scheduledChatPrice60, scheduledVoicePrice15, scheduledVoicePrice30, scheduledVoicePrice60, scheduledVideoPrice15, scheduledVideoPrice30, scheduledVideoPrice60, verified, isOnline } = req.body;


      // Parse specialties if it's a JSON string
      let parsedSpecialties = [];
      try {
        parsedSpecialties = JSON.parse(specialties);
      } catch (e) {
        parsedSpecialties = specialties || [];
      }

      // Handle profile image if uploaded
      let profileImageUrl = reader.profileImage;
      if (req.file) {
        const filename = `${Date.now()}-${req.file.originalname}`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, req.file.buffer);
        profileImageUrl = `/uploads/${filename}`;
      }

      // Update the reader
      const updatedReader = await storage.updateUser(readerId, {
        fullName,
        bio,
        specialties: parsedSpecialties,
        profileImage: profileImageUrl,
        pricing,
        pricingChat,
        pricingVoice,
        pricingVideo,
        scheduledChatPrice15,
        scheduledChatPrice30,
        scheduledChatPrice60,
        scheduledVoicePrice15,
        scheduledVoicePrice30,
        scheduledVoicePrice60,
        scheduledVideoPrice15,
        scheduledVideoPrice30,
        scheduledVideoPrice60,
        verified,
        isOnline
      });

      // Remove sensitive information
      const safeReader = updatedReader ? { ...updatedReader } : null;
      if (safeReader && 'password' in safeReader) {
        delete (safeReader as any).password;
      }
      res.json(safeReader);
    } catch (error) {
      console.error("Error updating reader:", error);
      res.status(500).json({ message: "Failed to update reader profile" });
    }
  });

  // Admin endpoint to add new readers with profile image
  app.post("/api/admin/readers", requireAdmin, upload2.single('profileImage'), async (req: any, res: any) => {
    try {
      console.log("Reader form submission received:", req.body);
      const { username, password, email, fullName, bio, ratePerMinute, specialties } = req.body;

      if (!username || !password || !email || !fullName) {
        return res.status(400).json({ message: "Required fields missing" });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Parse specialties if it's a JSON string
      let parsedSpecialties = [];
      try {
        parsedSpecialties = JSON.parse(specialties);
      } catch (e) {
        // If parsing fails, use as is or empty array
        parsedSpecialties = specialties || [];
      }

      // Process boolean fields (checkboxes)
      const chatReadingEnabled = req.body.chatReading === 'true';
      const phoneReadingEnabled = req.body.phoneReading === 'true';
      const videoReadingEnabled = req.body.videoReading === 'true';

      // Generate a hash for the password
      const hashedPassword = await scrypt_hash(password);

      // Handle profile image if uploaded
      let profileImageUrl = null;
      if (req.file) {
        // Generate a unique filename
        const filename = `${Date.now()}-${req.file.originalname}`;
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        const filepath = path.join(uploadsDir, filename);

        // Ensure uploads directory exists
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Write file to disk
        fs.writeFileSync(filepath, req.file.buffer);

        // Set the URL for the profile image
        profileImageUrl = `/uploads/${filename}`;
      }

      // Parse rate per minute to a number
      const rate = Math.max(0, parseInt(ratePerMinute, 10) || 0);

      // Create the reader account
      const newReader = await storage.createUser({
        username: fullName, // Use fullName as username
        password: hashedPassword,
        email,
        fullName: username, // Use username field as fullName
        role: 'reader',
        bio: bio || '',
        profileImage: profileImageUrl,
        specialties: parsedSpecialties,
        pricing: rate,
        pricingChat: rate,
        pricingVoice: rate,
        pricingVideo: rate,
        isOnline: false,
        accountBalance: 0,
        verified: true,
        rating: 5,
        reviewCount: 0
      });

      // Log success
      console.log("Successfully created reader:", newReader.id);

      // Remove sensitive information from the response
      const safeReader = { ...newReader };
      if ('password' in safeReader) {
        delete (safeReader as any).password;
      }

      res.status(201).json(safeReader);
    } catch (error) {
      console.error("Error creating reader:", error);
      res.status(500).json({ message: "Failed to create reader account" });
    }
  });

  // Reading livestream API placeholder
  app.post("/api/readings/:id/livestream", async (req, res) => {
    // Reading system has been removed - return 501 Not Implemented
    res.status(501).json({ message: "Reading system has been removed" });
  });

  // API endpoint to start a LiveKit livestream
  app.post("/api/livestreams/:id/start", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const livestreamId = parseInt(req.params.id);
      if (isNaN(livestreamId)) {
        return res.status(400).json({ message: "Invalid livestream ID" });
      }

      const livestream = await storage.getLivestream(livestreamId);
      if (!livestream) {
        return res.status(404).json({ message: "Livestream not found" });
      }

      // Only the creator can start a livestream
      if (livestream.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedLivestream = await livekitService.startLivestream(livestreamId);

      res.status(200).json(updatedLivestream);
    } catch (error) {
      console.error("Failed to start livestream:", error);
      res.status(500).json({ message: "Failed to start livestream" });
    }
  });

  // API endpoint to end a LiveKit livestream
  app.post("/api/livestreams/:id/end", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const livestreamId = parseInt(req.params.id);
      if (isNaN(livestreamId)) {
        return res.status(400).json({ message: "Invalid livestream ID" });
      }

      const livestream = await storage.getLivestream(livestreamId);
      if (!livestream) {
        return res.status(404).json({ message: "Livestream not found" });
      }

      // Both the creator and admin can end a livestream
      if (livestream.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }


      res.status(200).json(updatedLivestream);
    } catch (error) {
      console.error("Failed to end livestream:", error);
      res.status(500).json({ message: "Failed to end livestream" });
    }
  });
  
  // API endpoint to start a reader-specific livestream
  app.post("/api/reader-livestream/start", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "reader") {
      return res.status(403).json({ message: "Not authorized. Only readers can start livestreams." });
    }

    try {
      const readerId = req.user.id;
      const { title, description, category } = req.body;
      
      // Validate required fields
      if (!title || !description || !category) {
        return res.status(400).json({ message: "Missing required livestream data" });
      }
      
      // Check if the reader already has an active livestream
      const existingLivestreams = await storage.getLivestreamsByUser(readerId);
      const activeLivestream = existingLivestreams.find(stream => stream.status === 'live');
      
      if (activeLivestream) {
        return res.status(400).json({ 
          message: "You already have an active livestream", 
          livestream: activeLivestream 
        });
      }
      
      // Create a new livestream
      const livestream = await storage.createLivestream({
        userId: readerId,
        title,
        description,
        category,
        status: 'created',
        thumbnailUrl: req.body.thumbnailUrl || null,
        scheduledFor: null
      });
      
      if (!livestream) {
        return res.status(500).json({ message: "Failed to create livestream" });
      }
      
      // Start the livestream immediately using reader-specific room format
      const startedLivestream = await livekitService.startLivestream(livestream.id, true);
      
      if (!startedLivestream) {
        return res.status(500).json({ message: "Failed to start livestream" });
      }
      
      // Generate a token for the reader to join their own room
      const token = livekitService.generateLivestreamToken(
        readerId,
        startedLivestream.id.toString(),
        req.user.fullName || req.user.username,
        true  // Use reader-specific room format
      );
      
      // Return livestream info along with the token
      res.status(201).json({
        livestream: startedLivestream,
        token,
        roomName: `livestream-${readerId}`
      });
    } catch (error) {
      console.error("Error starting reader livestream:", error);
      res.status(500).json({ message: "Failed to start livestream. Please try again." });
    }
  });
  
  // API endpoint to join a reader's livestream as a viewer
  app.post("/api/reader-livestream/:readerId/join", async (req, res) => {
    try {
      const readerId = parseInt(req.params.readerId);
      if (isNaN(readerId)) {
        return res.status(400).json({ message: "Invalid reader ID" });
      }
      
      // Check if the reader exists
      const reader = await storage.getUser(readerId);
      if (!reader || reader.role !== "reader") {
        return res.status(404).json({ message: "Reader not found" });
      }
      
      // Check if the reader has an active livestream
      const readerLivestreams = await storage.getLivestreamsByUser(readerId);
      const activeLivestream = readerLivestreams.find(stream => stream.status === 'live');
      
      if (!activeLivestream) {
        return res.status(404).json({ message: "No active livestream found for this reader" });
      }
      
      // Get viewer info
      let viewerId = 0;
      let viewerName = "Guest";
      
      if (req.isAuthenticated()) {
        viewerId = req.user.id;
        viewerName = req.user.fullName || req.user.username;
      } else if (req.body.guestName) {
        // Allow guests to join with a name
        viewerName = req.body.guestName;
      }
      
      // Generate token for the viewer
      const token = livekitService.generateReaderLivestreamToken(
        viewerId,
        readerId,
        viewerName
      );
      
      res.status(200).json({
        token,
        livestream: activeLivestream,
        roomName: `livestream-${readerId}`
      });
    } catch (error) {
      console.error("Error joining reader livestream:", error);
      res.status(500).json({ message: "Failed to join livestream" });
    }
  });

  // Endpoint for new reading system service token generation
  app.post('/api/livekit/token', authenticate, async (req: Request, res: Response) => {
    try {
      // Extract user information from request
      const { userId, roomId, room, userName, readingType } = req.body;
      const user = req.user as User;
      
      if (!user) {
        return res.status(400).json({ error: 'Missing required user information' });
      }
      
      // Use provided values or fallback to user object
      const actualUserId = userId || user.id;
      const actualRoomId = roomId || room || `default_room_${Date.now()}`;
      const actualUserName = userName || user.fullName || user.username;
      
      // TODO: Implement the new token generation system
      console.log('Token request received: ', {
        userId: actualUserId, 
        roomId: actualRoomId, 
        userName: actualUserName,
        readingType: readingType
      });
      
      // For now, return a temporary response
      res.status(503).json({ 
        error: 'Reading system is being rebuilt. Please try again later.',
        message: 'The reading system is currently being migrated to a new provider.'
      });
    } catch (error) {
      console.error('Error in token endpoint:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  });

  // Token generation endpoint for new reading system
  app.post('/api/generate-token', authenticate, async (req: Request, res: Response) => {
    try {
      const { 
        readingType = 'video', 
        userId: providedUserId, 
        roomId, 
        environment = 'development',
        origin = ''
      } = req.body;
      
      // Get the current user
      const user = req.user as User;
      
      // Use provided userId or fall back to the current user's ID
      const userId = providedUserId || user.id.toString();
      
      if (!roomId) {
        return res.status(400).json({ error: 'Missing required parameter: roomId' });
      }
      
      // Log request details including environment information
      console.log(`Generating token for ${readingType} session in room ${roomId} for user ${userId}`);
      console.log(`Environment: ${environment}, Origin: ${origin}`);
      
      // Determine if this is a production deployment
      const isProduction = environment === 'production' || 
                         origin.includes('soulseer.app') || 
                         origin.includes('.onrender.com');
      
      console.log(`Request identified as ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

      // TODO: Implement new token generation system
      console.log('Token request received for new reading system: ', {
        userId, 
        roomId,
        readingType,
        userName: user.fullName || user.username,
        environment: isProduction ? 'production' : 'development' 
      });
      
      // For now, return a temporary response
      res.status(503).json({ 
        error: 'Reading system is being rebuilt. Please try again later.',
        message: 'The reading system is currently being migrated to a new provider.'
      });
    } catch (error) {
      console.error('Error generating token:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  });

  // Livestream token endpoint for new reading system
  app.post('/api/livekit/livestream-token', authenticate, async (req: Request, res: Response) => {
    try {
      const { name, room, useReaderRoom } = req.body;
      
      if (!name || !room) {
        return res.status(400).json({ error: 'Missing name or room' });
      }
      
      // Get user information
      const user = req.user as User;
      
      // Determine if this is a production environment
      const isProduction = req.hostname === 'soulseer.app' || 
                       req.hostname.includes('.onrender.com');
                       
      console.log(`Generating livestream token: hostname=${req.hostname}, isProduction=${isProduction}`);
      
      // TODO: Implement new livestream token generation
      console.log('Livestream token request received: ', {
        userId: user.id.toString(), 
        roomId: room,
        userName: name || user.fullName || user.username
      });
      
      // For now, return a temporary response
      res.status(503).json({ 
        error: 'Livestream system is being rebuilt. Please try again later.',
        message: 'The livestream system is currently being migrated to a new provider.'
      });
    } catch (error) {
      console.error('Error generating livestream token:', error);
      res.status(500).json({ error: 'Failed to generate livestream token' });
    }
  });
  
  // Reader-specific livestream token endpoint for new reading system
  app.post('/api/livekit/reader-livestream-token', authenticate, async (req: Request, res: Response) => {
    try {
      const { readerId } = req.body;
      
      if (!readerId) {
        return res.status(400).json({ error: 'Missing readerId' });
      }
      const reader = await storage.getUser(readerId);
      if (!reader || reader.role !== 'reader') {
        return res.status(404).json({ error: 'Reader not found' });
      }
      
      // Get user information
      const user = req.user as User;
      
      // Create a unique room name for this reader's livestream
      const roomId = `livestream-reader-${readerId}`;
      
      // Determine if this is a production environment
      const isProduction = req.hostname === 'soulseer.app' || 
                         req.hostname.includes('.onrender.com');
                         
      console.log(`Generating reader livestream token: hostname=${req.hostname}, isProduction=${isProduction}, readerId=${readerId}`);
      
      // If the user requesting the token is the reader, they are the host
      const isHost = user.id.toString() === readerId.toString();
      
      // TODO: Implement new livestream token generation
      console.log('Reader livestream token request received: ', {
        userId: user.id.toString(), 
        roomId,
        isHost,
        userName: user.fullName || user.username
      });
      
      // For now, return a temporary response
      res.status(503).json({ 
        error: 'Livestream system is being rebuilt. Please try again later.',
        message: 'The livestream system is currently being migrated to a new provider.'
      });
    } catch (error) {
      console.error('Error generating reader livestream token:', error);
      res.status(500).json({ error: 'Failed to generate reader livestream token' });
    }
  });

  // Check if a reader is currently livestreaming
  app.get('/api/livestream/reader/:readerId', async (req: Request, res: Response) => {
    try {
      const readerId = parseInt(req.params.readerId);
      
      if (isNaN(readerId)) {
        return res.status(400).json({ error: 'Invalid reader ID' });
      }
      
      // Check if the reader exists
      const reader = await storage.getUser(readerId);
      if (!reader || reader.role !== 'reader') {
        return res.status(404).json({ error: 'Reader not found' });
      }
      
      // Get all active livestreams for this reader
      const livestreams = await storage.getLivestreamsByUser(readerId);
      const activeLivestreams = livestreams.filter(stream => stream.status === 'live');
      
      // If there are active livestreams, return information about them
      if (activeLivestreams.length > 0) {
        return res.json({
          isLive: true,
          livestreams: activeLivestreams,
          roomName: `livestream-${readerId}`,
          readerName: reader.fullName || reader.username
        });
      }
      
      // No active livestreams found
      res.json({
        isLive: false
      });
    } catch (error) {
      console.error('Error checking reader livestream status:', error);
      res.status(500).json({ error: 'Failed to check reader livestream status' });
    }
  });
  
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'online' });
  });
  
  // Start video reading session using WebRTC
  app.post('/start-reading/video', authenticate, async (req: Request, res: Response) => {
    try {
      const { clientId, readerId } = req.body;
      
      if (!clientId || !readerId) {
        return res.status(400).json({ error: 'Missing required parameters: clientId, readerId' });
      }
      
      // Import at run-time to prevent circular dependencies
      const { webRTCService } = require('./services/webrtc-service');
      
      // Use WebRTC service to create a session
      const sessionResult = await webRTCService.createSession(
        parseInt(readerId.toString()),
        parseInt(clientId.toString()),
        'video'
      );
      
      if (!sessionResult.success) {
        return res.status(400).json({ 
          error: sessionResult.error || 'Failed to create session',
          status: 'error'
        });
      }
      
      const { roomId } = sessionResult;
      
      // Determine if request is from production environment
      const origin = req.headers.origin || '';
      const isProduction = origin.includes('soulseer.app') || 
                          origin.includes('.onrender.com');
      console.log(`Video session request from origin: ${origin}, isProduction: ${isProduction}`);
      
      // Return session information
      res.json({
        roomId,
        clientId: parseInt(clientId.toString()),
        readerId: parseInt(readerId.toString()),
        sessionType: 'video',
        status: 'created'
      });
    } catch (error) {
      console.error('Error starting video session:', error);
      res.status(500).json({ error: 'Failed to start video session' });
    }
  });
  
  // Start voice reading session using WebRTC
  app.post('/start-reading/voice', authenticate, async (req: Request, res: Response) => {
    try {
      const { clientId, readerId } = req.body;
      
      if (!clientId || !readerId) {
        return res.status(400).json({ error: 'Missing required parameters: clientId, readerId' });
      }
      
      // Import at run-time to prevent circular dependencies
      const { webRTCService } = require('./services/webrtc-service');
      
      // Use WebRTC service to create a session
      const sessionResult = await webRTCService.createSession(
        parseInt(readerId.toString()),
        parseInt(clientId.toString()),
        'voice'
      );
      
      if (!sessionResult.success) {
        return res.status(400).json({ 
          error: sessionResult.error || 'Failed to create session',
          status: 'error'
        });
      }
      
      const { roomId } = sessionResult;
      
      // Determine if request is from production environment
      const origin = req.headers.origin || '';
      const isProduction = origin.includes('soulseer.app') || 
                          origin.includes('.onrender.com');
      console.log(`Voice session request from origin: ${origin}, isProduction: ${isProduction}`);
      
      // Return session information
      res.json({
        roomId,
        clientId: parseInt(clientId.toString()),
        readerId: parseInt(readerId.toString()),
        sessionType: 'voice',
        status: 'created'
      });
    } catch (error) {
      console.error('Error starting voice session:', error);
      res.status(500).json({ error: 'Failed to start voice session' });
    }
  });
  
  // Start chat reading session using WebRTC
  app.post('/start-reading/chat', authenticate, async (req: Request, res: Response) => {
    try {
      const { clientId, readerId } = req.body;
      
      if (!clientId || !readerId) {
        return res.status(400).json({ error: 'Missing required parameters: clientId, readerId' });
      }
      
      // Import at run-time to prevent circular dependencies
      const { webRTCService } = require('./services/webrtc-service');
      
      // Use WebRTC service to create a session
      const sessionResult = await webRTCService.createSession(
        parseInt(readerId.toString()),
        parseInt(clientId.toString()),
        'chat'
      );
      
      if (!sessionResult.success) {
        return res.status(400).json({ 
          error: sessionResult.error || 'Failed to create session',
          status: 'error'
        });
      }
      
      const { roomId } = sessionResult;
      
      // Determine if request is from production environment
      const origin = req.headers.origin || '';
      const isProduction = origin.includes('soulseer.app') || 
                          origin.includes('.onrender.com');
      console.log(`Chat session request from origin: ${origin}, isProduction: ${isProduction}`);
      
      // Return session information
      res.json({
        roomId,
        clientId: parseInt(clientId.toString()),
        readerId: parseInt(readerId.toString()),
        sessionType: 'chat',
        status: 'created'
      });
    } catch (error) {
      console.error('Error starting chat session:', error);
      res.status(500).json({ error: 'Failed to start chat session' });
    }
  });
  
  // Legacy endpoint for backward compatibility
  app.post('/start-reading', authenticate, async (req: Request, res: Response) => {
    try {
      const { clientId, readerId, readingType } = req.body;
      
      if (!clientId || !readerId || !readingType) {
        return res.status(400).json({ error: 'Missing required parameters: clientId, readerId, readingType' });
      }
      
      // Validate reading type
      if (!['chat', 'voice', 'video'].includes(readingType)) {
        return res.status(400).json({ error: 'Invalid reading type. Must be chat, voice, or video.' });
      }
      
      // Forward to specific endpoint
      let forwardUrl = `/start-reading/${readingType}`;
      
      // Forward the request internally
      req.url = forwardUrl;
      app._router.handle(req, res);
      
    } catch (error) {
      console.error('Error in legacy start reading endpoint:', error);
      res.status(500).json({ error: 'Failed to start reading session' });
    }
  });

  // Recording token endpoint for admins - new implementation
  app.post('/api/livekit/recording-token', authenticate, adminOnly, async (req: Request, res: Response) => {
    try {
      const { room } = req.body;
      
      if (!room) {
        return res.status(400).json({ error: 'Missing room name' });
      }
      
      // Get admin user info (already checked by adminOnly middleware)
      const user = req.user as User;
      
      // Determine if this is a production environment
      const isProduction = req.hostname === 'soulseer.app' || 
                         req.hostname.includes('.onrender.com');
                         
      console.log(`Generating recording token: hostname=${req.hostname}, isProduction=${isProduction}`);
      
      // TODO: Implement new recording token generation for admin
      console.log('Admin recording token request received: ', {
        userId: user.id.toString(), 
        roomId: room,
        userName: user.fullName || user.username
      });
      
      // For now, return a temporary response
      res.status(503).json({ 
        error: 'Recording system is being rebuilt. Please try again later.',
        message: 'The recording system is currently being migrated to a new provider.'
      });
    } catch (error) {
      console.error('Error generating recording token:', error);
      res.status(500).json({ error: 'Failed to generate recording token' });
    }
  });

  // Session management routes using WebRTC service
  app.post('/api/sessions/token', authenticate, async (req: Request, res: Response) => {
    try {
      const { userId, userName, readerId, readerName, roomName, readingType } = req.body;
      
      if (!userId || !readerId || !roomName || !userName || !readerName) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      console.log('Session token request received: ', {
        userId, 
        userName,
        readerId,
        readerName,
        roomName,
        readingType
      });
      
      // Create session record if this is a new session
      const existingSession = sessionService.getSessionByRoomName(roomName);
      
      if (!existingSession) {
        sessionService.createSession(
          parseInt(readerId.toString()),
          parseInt(userId.toString()),
          roomName,
          readerName,
          userName,
          readingType || 'video' // Make sure to pass the reading type, default to video
        );
        
        console.log(`Created new session record for room: ${roomName}`);
      }
      
      // Return a success response with the session details
      // The WebRTC signaling will be handled through Socket.IO connections
      res.json({
        success: true,
        roomName,
        userId: parseInt(userId.toString()),
        readerId: parseInt(readerId.toString()),
        readingType: readingType || 'video',
        message: 'Session created. Use WebRTC signaling for connection.'
      });
    } catch (error) {
      console.error('Error generating session token:', error);
      res.status(500).json({ error: 'Failed to generate session token' });
    }
  });
  
  app.post('/api/sessions/billing', authenticate, async (req: Request, res: Response) => {
    try {
      
      const { roomName, duration, userId, userRole } = req.body;
      
      if (!roomName || !duration || !userId || !userRole) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Get session
      const session = sessionService.getSessionByRoomName(roomName);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Only clients can be billed
      if (userRole !== 'client') {
        return res.status(200).json({ 
          message: 'No billing for readers', 
          session 
        });
      }
      
      // Record billing
      const updatedSession = await sessionService.recordBilling(
        roomName,
        duration,
        userId,
        session.readerId
      );
      
      if (!updatedSession) {
        return res.status(500).json({ error: 'Failed to record billing' });
      }
      
      res.status(200).json({
        message: `Billing recorded: $${(duration * 1).toFixed(2)} for ${duration} minutes`,
        session: updatedSession
      });
    } catch (error) {
      console.error('Error recording billing:', error);
      res.status(500).json({ error: 'Failed to record billing' });
    }
  });
  
  app.post('/api/sessions/end', authenticate, async (req: Request, res: Response) => {
    try {
      
      const { roomName, totalDuration, userId, userRole } = req.body;
      
      if (!roomName || !totalDuration) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // End session
      const updatedSession = sessionService.endSession(roomName, totalDuration);
      
      if (!updatedSession) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.status(200).json({
        message: `Session ended: ${totalDuration} minutes total`,
        session: updatedSession
      });
    } catch (error) {
      console.error('Error ending session:', error);
      res.status(500).json({ error: 'Failed to end session' });
    }
  });
  
  app.get('/api/sessions/reader/:readerId', authenticate, async (req: Request, res: Response) => {
    try {
      
      const readerId = parseInt(req.params.readerId);
      
      if (isNaN(readerId)) {
        return res.status(400).json({ error: 'Invalid reader ID' });
      }
      
      // Get reader sessions
      const sessions = sessionService.getReaderSessions(readerId);
      
      res.status(200).json(sessions);
    } catch (error) {
      console.error('Error fetching reader sessions:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });
  
  app.get('/api/sessions/client/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      
      const clientId = parseInt(req.params.clientId);
      
      if (isNaN(clientId)) {
        return res.status(400).json({ error: 'Invalid client ID' });
      }
      
      // Get client sessions
      const sessions = sessionService.getClientSessions(clientId);
      
      res.status(200).json(sessions);
    } catch (error) {
      console.error('Error fetching client sessions:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });
  
  // LiveKit token routes are now in place above
  
  // Reader Balance API Routes
  
  // Get a reader's balance
  app.get('/api/reader-balance/:readerId', authenticate, async (req: Request, res: Response) => {
    try {
      // Only allow a reader to view their own balance, or admin to view any balance
      const readerId = parseInt(req.params.readerId);
      if (isNaN(readerId)) {
        return res.status(400).json({ error: 'Invalid reader ID' });
      }

      const user = req.user as User;
      if (user.role !== 'admin' && user.id !== readerId) {
        return res.status(403).json({ error: 'Unauthorized. You can only view your own balance.' });
      }

      const balance = readerBalanceService.getReaderBalance(readerId);
      if (!balance) {
        return res.status(404).json({ error: 'Reader balance not found' });
      }

      res.json(balance);
    } catch (error) {
      console.error('Error fetching reader balance:', error);
      res.status(500).json({ error: 'Failed to fetch reader balance' });
    }
  });

  // Get all reader balances (admin only)
  app.get('/api/reader-balances', authenticate, adminOnly, async (req: Request, res: Response) => {
    try {
      const balances = readerBalanceService.getAllReaderBalances();
      res.json(balances);
    } catch (error) {
      console.error('Error fetching all reader balances:', error);
      res.status(500).json({ error: 'Failed to fetch reader balances' });
    }
  });

  // Get payouts for a reader
  app.get('/api/reader-payouts/:readerId', authenticate, async (req: Request, res: Response) => {
    try {
      const readerId = parseInt(req.params.readerId);
      if (isNaN(readerId)) {
        return res.status(400).json({ error: 'Invalid reader ID' });
      }

      const user = req.user as User;
      if (user.role !== 'admin' && user.id !== readerId) {
        return res.status(403).json({ error: 'Unauthorized. You can only view your own payouts.' });
      }

      const payouts = readerBalanceService.getReaderPayouts(readerId);
      res.json(payouts);
    } catch (error) {
      console.error('Error fetching reader payouts:', error);
      res.status(500).json({ error: 'Failed to fetch reader payouts' });
    }
  });

  // Process payouts for eligible readers (admin only)
  app.post('/api/process-payouts', authenticate, adminOnly, async (req: Request, res: Response) => {
    try {
      const payouts = await readerBalanceService.processEligiblePayouts();
      res.json({
        message: `Processed ${payouts.length} payout(s)`,
        payouts: payouts
      });
    } catch (error) {
      console.error('Error processing payouts:', error);
      res.status(500).json({ error: 'Failed to process payouts' });
    }
  });

  return httpServer;
}