// Server entry point that bypasses vite.config.ts issues
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const { Pool } = require('pg');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const WebSocket = require('ws');

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Basic logging function
function log(message, tag = 'server') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}] ${message}`);
}

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(session({
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  },
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET || 'soulseer-dev-secret',
  store: new MemoryStore({
    checkPeriod: 24 * 60 * 60 * 1000 // Prune expired entries every 24h
  })
}));

// Import Stripe for payments
const Stripe = require('stripe');
let stripe = null;

// Initialize Stripe with the API key if available
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    log(`Initializing Stripe with key length: ${stripeKey.length}`, 'stripe');
    stripe = new Stripe(stripeKey, {
      apiVersion: '2024-03-19',
      typescript: true
    });
    log('Stripe initialized successfully', 'stripe');
  } catch (error) {
    log(`Error initializing Stripe: ${error.message}`, 'stripe');
  }
}

// Serve static files if available
const publicDir = path.join(__dirname, 'dist/public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  log(`Serving static files from ${publicDir}`);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    time: new Date().toISOString(),
    services: {
      db: !!pool,
      stripe: !!stripe
    }
  });
});

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Track connected clients
const connectedClients = new Map();
let clientIdCounter = 1;

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientId = clientIdCounter++;
  log(`WebSocket client connected [id=${clientId}]`);
  
  // Store client connection
  connectedClients.set(clientId, { socket: ws });
  
  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'connected', 
    message: 'Connected to SoulSeer WebSocket Server',
    clientId,
    serverTime: Date.now()
  }));
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      log(`WebSocket message received from client ${clientId}: ${data.type}`);
      
      // Handle ping messages
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ 
          type: 'pong', 
          timestamp: data.timestamp,
          serverTime: Date.now()
        }));
      }
    } catch (error) {
      log(`Error processing WebSocket message: ${error.message}`);
    }
  });
  
  // Handle disconnections
  ws.on('close', () => {
    log(`WebSocket client ${clientId} disconnected`);
    connectedClients.delete(clientId);
  });
  
  ws.on('error', (error) => {
    log(`WebSocket error for client ${clientId}: ${error.message}`);
    connectedClients.delete(clientId);
  });
});

// Broadcast to all WebSocket clients
function broadcastToAll(message) {
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
  let sentCount = 0;
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
        sentCount++;
      } catch (error) {
        log(`Error sending message to client: ${error.message}`);
      }
    }
  });
  
  log(`Broadcast message sent to ${sentCount} clients`);
  return sentCount;
}

// Test database connection
async function testDatabase() {
  try {
    const result = await pool.query('SELECT NOW()');
    log(`Database connection successful: ${result.rows[0].now}`, 'db');
    return true;
  } catch (error) {
    log(`Database connection error: ${error.message}`, 'db');
    return false;
  }
}

// Initialize Mux
const Mux = require('@mux/mux-node');
let muxClient = null;

// Test Mux API connection
async function testMux() {
  try {
    // Get credentials from environment
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    
    if (!tokenId || !tokenSecret) {
      log(`Missing MUX credentials`, 'mux');
      return false;
    }
    
    log(`MUX_TOKEN_ID found (length: ${tokenId.length})`, 'mux');
    log(`MUX_TOKEN_SECRET found (length: ${tokenSecret.length})`, 'mux');
    
    // Initialize Mux client
    muxClient = new Mux({ tokenId, tokenSecret });
    log('Mux client initialized', 'mux');
    
    // Try to list livestreams
    const liveStreams = await muxClient.video.liveStreams.list();
    log(`Successfully retrieved ${liveStreams.data.length} live streams`, 'mux');
    
    return true;
  } catch (error) {
    log(`Error testing Mux: ${error.message}`, 'mux');
    return false;
  }
}

// Catch-all route for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  res.send(`
    <html>
      <head><title>SoulSeer - Server Mode</title></head>
      <body>
        <h1>SoulSeer - Server Mode</h1>
        <p>Server is running in API-only mode. Frontend is not available.</p>
        <p>API Health: <a href="/api/health">Check API Status</a></p>
      </body>
    </html>
  `);
});

// Error handler
app.use((err, req, res, next) => {
  log(`Error: ${err.message}`, 'error');
  res.status(err.status || 500).json({
    message: err.message,
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

// Start the server
server.listen(port, '0.0.0.0', async () => {
  log(`Server started on port ${port}`);
  
  // Test database connection
  const dbOk = await testDatabase();
  
  // Test Mux API
  const muxOk = await testMux();
  
  log(`Service status: Database=${dbOk ? 'OK' : 'ERROR'}, Mux=${muxOk ? 'OK' : 'ERROR'}`);
  
  // Broadcast server status on WebSocket
  broadcastToAll({
    type: 'server_status',
    status: 'online',
    services: {
      database: dbOk,
      mux: muxOk,
      stripe: !!stripe
    },
    timestamp: Date.now()
  });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('HTTP server closed');
    if (pool) pool.end();
    process.exit(0);
  });
});