// Server startup script that avoids vite.config.ts issues
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Pool } = require('pg');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const session = require('express-session');
const Mux = require('@mux/mux-node');
const path = require('path');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const MemoryStore = require('memorystore')(session);
const fs = require('fs');

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Basic logging function
function log(message, tag = 'server') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}] ${message}`);
}

// Test database connection
async function checkDbConnection() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query('SELECT NOW()');
    log(`Database connection successful: ${result.rows[0].now}`, 'db');
    await pool.end();
    return true;
  } catch (error) {
    log(`Database connection error: ${error.message}`, 'db');
    return false;
  }
}

// Test MUX connection
async function testMuxConnection() {
  try {
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    
    if (!tokenId || !tokenSecret) {
      log('Missing MUX credentials', 'mux');
      return false;
    }
    
    const muxClient = new Mux({ tokenId, tokenSecret });
    log('MUX client created', 'mux');
    
    const response = await muxClient.video.liveStreams.list();
    log(`MUX connection successful, found ${response.data.length} livestreams`, 'mux');
    return true;
  } catch (error) {
    log(`MUX connection error: ${error.message}`, 'mux');
    return false;
  }
}

// Start the server
async function startServer() {
  // Check database connection
  const dbOk = await checkDbConnection();
  if (!dbOk) {
    log('Database connection failed. Exiting.', 'fatal');
    return;
  }
  
  // Test MUX connection
  const muxOk = await testMuxConnection();
  log(`MUX API ${muxOk ? 'connected successfully' : 'connection failed'}`, 'mux');
  
  // Setup auth session
  app.use(session({
    cookie: { 
      maxAge: 24 * 60 * 60 * 1000, 
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
  
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Create HTTP server
  const server = createServer(app);
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  // Track connected clients
  const connectedClients = new Map();
  
  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    const clientId = Date.now();
    log(`WebSocket client connected: ${clientId}`, 'ws');
    
    connectedClients.set(clientId, { socket: ws });
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        log(`Received message from client ${clientId}: ${data.type}`, 'ws');
      } catch (error) {
        log(`Error parsing message from client ${clientId}: ${error.message}`, 'ws');
      }
    });
    
    ws.on('close', () => {
      log(`WebSocket client disconnected: ${clientId}`, 'ws');
      connectedClients.delete(clientId);
    });
  });
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      time: new Date().toISOString(),
      services: {
        database: dbOk,
        mux: muxOk
      }
    });
  });
  
  // Start the server
  server.listen(port, '0.0.0.0', () => {
    log(`Server listening on port ${port}`);
  });
}

// Start the server
startServer();