import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket server for live readings and real-time communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track all connected WebSocket clients
  const connectedClients = new Map();
  let clientIdCounter = 1;
  
  // Broadcast a message to all connected clients
  const broadcastToAll = (message: any) => {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
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
      
      // Extract safe reader data
      const { password, ...safeReader } = reader;
      
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
  
  wss.on('connection', (ws, req) => {
    const clientId = clientIdCounter++;
    let userId: number | null = null;
    
    console.log(`WebSocket client connected [id=${clientId}]`);
    
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
          ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: data.timestamp,
            serverTime: Date.now()
          }));
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
                storage.updateUser(userId as number, { isOnline: true });
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
      if (userId) {
        storage.getUser(userId).then(user => {
          if (user && user.role === 'reader') {
            storage.updateUser(userId, { isOnline: false });
            broadcastReaderActivity(userId, 'offline');
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
  
  // API Routes
  
  // Readers
  app.get("/api/readers", async (req, res) => {
    try {
      const readers = await storage.getReaders();
      // Remove sensitive data
      const sanitizedReaders = readers.map(reader => {
        const { password, ...safeReader } = reader;
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
      res.json(safeReader);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reader" });
    }
  });
  
  // Readings
  app.post("/api/readings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const readingData = req.body;
      
      const reading = await storage.createReading({
        readerId: readingData.readerId,
        clientId: req.user.id,
        status: "scheduled",
        type: readingData.type,
        scheduledFor: readingData.scheduledFor ? new Date(readingData.scheduledFor) : null,
        duration: readingData.duration,
        price: readingData.price,
        notes: readingData.notes || ""
      });
      
      res.status(201).json(reading);
    } catch (error) {
      res.status(500).json({ message: "Failed to create reading" });
    }
  });
  
  app.get("/api/readings/client", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const readings = await storage.getReadingsByClient(req.user.id);
      res.json(readings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch readings" });
    }
  });
  
  app.get("/api/readings/reader", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "reader") {
      return res.status(401).json({ message: "Not authenticated as reader" });
    }
    
    try {
      const readings = await storage.getReadingsByReader(req.user.id);
      res.json(readings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch readings" });
    }
  });
  
  app.patch("/api/readings/:id/status", async (req, res) => {
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
      
      const { status } = req.body;
      
      // Update reading status
      const updatedReading = await storage.updateReading(id, { status });
      
      res.json(updatedReading);
    } catch (error) {
      res.status(500).json({ message: "Failed to update reading status" });
    }
  });
  
  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });
  
  app.get("/api/products/featured", async (req, res) => {
    try {
      const products = await storage.getFeaturedProducts();
      res.json(products);
    } catch (error) {
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
      res.json(livestreams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch livestreams" });
    }
  });
  
  app.post("/api/livestreams", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "reader") {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    try {
      const livestreamData = req.body;
      
      const livestream = await storage.createLivestream({
        userId: req.user.id,
        title: livestreamData.title,
        description: livestreamData.description,
        thumbnailUrl: livestreamData.thumbnailUrl,
        status: "scheduled",
        scheduledFor: livestreamData.scheduledFor ? new Date(livestreamData.scheduledFor) : null,
        category: livestreamData.category
      });
      
      res.status(201).json(livestream);
    } catch (error) {
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
      
      // Update additional fields based on status
      let updateData: any = { status };
      
      if (status === "live") {
        updateData.startedAt = new Date();
      } else if (status === "ended") {
        updateData.endedAt = new Date();
      }
      
      const updatedLivestream = await storage.updateLivestream(id, updateData);
      
      res.json(updatedLivestream);
    } catch (error) {
      res.status(500).json({ message: "Failed to update livestream status" });
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

  return httpServer;
}
