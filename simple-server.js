// Minimal server for testing the Mux integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 4000;

// Create database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Middleware
app.use(cors());
app.use(express.json());

// Log function
function log(message, tag = 'server') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}] ${message}`);
}

// Import Mux
const Mux = require('@mux/mux-node');

// Test Mux connection
async function testMuxConnection() {
  try {
    // Get credentials
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    
    if (!tokenId || !tokenSecret) {
      log("ERROR: MUX credentials not found!", "mux-test");
      return false;
    }
    
    log(`MUX token ID found (length: ${tokenId.length})`, "mux-test");
    log(`MUX token secret found (length: ${tokenSecret.length})`, "mux-test");
    
    // Initialize client (using the right approach for v10.1.0)
    const muxClient = new Mux({ tokenId, tokenSecret });
    log("Mux client created", "mux-test");
    
    // Log properties available for debugging
    log(`Available Mux properties: ${Object.keys(Mux).join(', ')}`, "mux-test");
    log(`Mux client type: ${typeof muxClient}`, "mux-test");
    log(`Mux client properties: ${Object.keys(muxClient).join(', ')}`, "mux-test");
    
    // Try to fetch a list of live streams (check which approach works with v10.1.0)
    const response = await muxClient.video.liveStreams.list();
    
    log(`MUX connection successful! Found ${response.data.length} live streams.`, "mux-test");
    return true;
  } catch (error) {
    log(`MUX connection error: ${error.message}`, "mux-test");
    log(`Error stack: ${error.stack}`, "mux-test");
    
    // Check for specific errors
    if (error.message.includes('auth')) {
      log("Authentication error - check your MUX credentials!", "mux-test");
    } else if (error.message.includes('network')) {
      log("Network error - check your internet connection!", "mux-test");
    }
    
    return false;
  }
}

// Test database connection
async function testDatabaseConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    log(`Database connection successful! Server time: ${result.rows[0].now}`, "db-test");
    return true;
  } catch (error) {
    log(`Database connection error: ${error.message}`, "db-test");
    return false;
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = await testDatabaseConnection();
  const muxStatus = await testMuxConnection();
  
  res.json({
    status: 'online',
    time: new Date().toISOString(),
    database: dbStatus ? 'connected' : 'error',
    mux: muxStatus ? 'connected' : 'error'
  });
});

// Start server
const server = app.listen(port, '0.0.0.0', async () => {
  log(`Simple server started on http://0.0.0.0:${port}`);
  
  // Run tests on startup
  await testDatabaseConnection();
  await testMuxConnection();
});

// Handle shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down');
  server.close(() => {
    pool.end();
    process.exit(0);
  });
});