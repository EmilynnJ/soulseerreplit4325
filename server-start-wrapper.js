#!/usr/bin/env node

// This script is a wrapper that ensures the server starts correctly
// by using the vite-bypass approach which avoids the top-level await issues

const { spawn } = require('child_process');
const path = require('path');

// Log helper
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [wrapper] ${message}`);
}

// Start the server
function startServer() {
  log('Starting server via vite-bypass approach...');
  
  // Use the bypass script that works around vite.config.ts issues
  const server = spawn('node', ['server-vite-bypass.js'], {
    stdio: 'inherit',
    env: process.env
  });

  server.on('close', (code) => {
    log(`Server process exited with code ${code}`);
    // If server crashes, wait before restarting
    if (code !== 0) {
      log('Server crashed, restarting in 3 seconds...');
      setTimeout(startServer, 3000);
    }
  });

  server.on('error', (err) => {
    log(`Failed to start server: ${err.message}`);
    // If starting the server fails, wait before retrying
    log('Retrying in 3 seconds...');
    setTimeout(startServer, 3000);
  });
}

// Handle signals for graceful shutdown
process.on('SIGINT', () => {
  log('SIGINT received, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down...');
  process.exit(0);
});

// Start the server
startServer();