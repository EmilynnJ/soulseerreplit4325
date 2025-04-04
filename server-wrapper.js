// Server wrapper script that bypasses vite.config.ts issues
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { Pool } = require('pg');

// Create Express app for monitoring
const app = express();
const port = process.env.PORT || 3000;
let serverProcess = null;

// Basic logging function
function log(message, tag = 'wrapper') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}] ${message}`);
}

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    time: new Date().toISOString(),
    server: serverProcess ? 'running' : 'not_started'
  });
});

// Start the server
app.listen(port + 1, '0.0.0.0', async () => {
  log(`Wrapper server started on port ${port + 1}`);
  
  // Test database connection first
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query('SELECT NOW()');
    log(`Database connection successful: ${result.rows[0].now}`);
    await pool.end();
  } catch (error) {
    log(`Database connection error: ${error.message}`);
  }
  
  // Test Mux connection
  try {
    const Mux = require('@mux/mux-node');
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    
    if (tokenId && tokenSecret) {
      const muxClient = new Mux({ tokenId, tokenSecret });
      log('Mux client created successfully');
      
      const response = await muxClient.video.liveStreams.list();
      log(`Mux connection successful, found ${response.data.length} live streams`);
    } else {
      log('Mux credentials not found');
    }
  } catch (error) {
    log(`Mux test error: ${error.message}`);
  }
  
  // Start the actual application server
  startServer();
});

// Function to start the main server
function startServer() {
  // Use the bypass server for now
  const serverScript = 'server-vite-bypass.js';
  log(`Starting server with: ${serverScript}`);
  
  serverProcess = exec(`node ${serverScript}`, (error, stdout, stderr) => {
    if (error) {
      log(`Server error: ${error.message}`);
      return;
    }
    
    if (stderr) {
      log(`Server stderr: ${stderr}`);
    }
  });
  
  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  serverProcess.on('close', (code) => {
    log(`Server process exited with code ${code}`);
    
    // Restart server after a delay
    setTimeout(() => {
      log('Automatically restarting server...');
      startServer();
    }, 5000);
  });
}

// Handle shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down');
  
  if (serverProcess) {
    serverProcess.kill();
  }
  
  process.exit(0);
});