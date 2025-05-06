// Server-only entry point that doesn't depend on vite.config.ts
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const path = require('path');
const fs = require('fs');

// Create our Express app
const app = express();
const port = process.env.PORT || 3000;

// Logging
function log(message, tag = 'server') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}] ${message}`);
}

// Setup middleware
app.use(cors());
app.use(express.json());

// Configure sessions
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

// Setup authentication
require('./auth').setupAuth(app);

// Serve static files if available
if (fs.existsSync(path.join(__dirname, '../dist/public'))) {
  app.use(express.static(path.join(__dirname, '../dist/public')));
  log('Serving static files from dist/public');
}

// Register API routes
require('./routes').registerRoutes(app)
  .then(server => {
    log(`Server started successfully`);
  })
  .catch(err => {
    log(`Error starting server: ${err}`);
    process.exit(1);
  });

// Health check API endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date().toISOString() });
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: "API endpoint not found" });
    return;
  }
  
  // Serve index.html for client-side routes if it exists
  const indexPath = path.join(__dirname, '../dist/public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
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
  }
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
const server = app.listen(port, '0.0.0.0', () => {
  log(`Server listening on http://0.0.0.0:${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('Server closed');
    pool.end();
    process.exit(0);
  });
});
