// A simplified server starter for SoulSeer
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { pool } = require('./server/db');

// Check PostgreSQL connection
async function checkDbConnection() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL');
    client.release();
    return true;
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    return false;
  }
}

// Test MUX connection
async function testMuxConnection() {
  try {
    const Mux = require('@mux/mux-node');
    
    if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
      console.log("MUX credentials not found. MUX features will be disabled.");
      return false;
    }
    
    console.log(`MUX_TOKEN_ID exists with length: ${process.env.MUX_TOKEN_ID.length}`);
    console.log(`MUX_TOKEN_SECRET exists with length: ${process.env.MUX_TOKEN_SECRET.length}`);
    
    const { Video } = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    });
    
    console.log('MUX SDK initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing MUX SDK:', error.message);
    return false;
  }
}

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Configure middleware
app.use(cors());
app.use(express.json());

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Only load critical routes for testing
app.get('/api/livestreams', async (req, res) => {
  try {
    const Mux = require('@mux/mux-node');
    const { Video } = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    });
    
    const liveStreams = await Video.LiveStreams.list();
    res.json({ liveStreams });
  } catch (error) {
    console.error('Error fetching livestreams:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Error handling
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
async function startServer() {
  console.log('Starting SoulSeer server in diagnostic mode...');
  
  // Run tests
  await checkDbConnection();
  await testMuxConnection();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/api/health`);
    console.log(`Livestreams API available at: http://localhost:${PORT}/api/livestreams`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});