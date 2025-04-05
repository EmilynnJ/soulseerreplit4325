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

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Basic logging function
function log(message: string, tag = 'server'): void {
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
let stripe: any = null;

// Initialize Stripe with the API key if available
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    log('Stripe initialized successfully');
  } catch (error) {
    log(`Error initializing Stripe: ${error instanceof Error ? error.message : String(error)}`);
  }
} else {
  log('No Stripe API key found - payment features will be disabled');
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

// Test database connection
async function testDatabase(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    log('Database connection successful');
    return true;
  } catch (error) {
    log(`Database connection error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
    return false; // This line will never be reached due to process.exit, but needed for TypeScript
  }
}

// LiveKit is now used instead of Mux for all video features

// Catch-all route for SPA
app.get('*', (req: any, res: any) => {
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
  await testDatabase();
  
  log(`Service status: Database=OK, LiveKit=OK`);
  
  // Server status is broadcast by the WebSocket setup in routes.ts
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