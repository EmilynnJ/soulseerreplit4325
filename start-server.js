require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { Server } = require('ws');

// Create express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5000',
    'https://localhost:5000',
    'https://soulseer.app',
    'https://www.soulseer.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Initialize WebSocket server for real-time communication
const server = require('http').createServer(app);
const wss = new Server({ server });

// Static directories
const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
const imagesPath = path.join(process.cwd(), 'public', 'images');
const publicPath = path.join(process.cwd(), 'dist', 'public');

// Serve static directories
app.use('/uploads', express.static(uploadsPath));
app.use('/images', express.static(imagesPath));
app.use(express.static(publicPath));

// Health check endpoint
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VITE_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', (message) => {
    try {
      console.log('Received:', message.toString());
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Start the API server
const startAPIServer = () => {
  return new Promise((resolve, reject) => {
    const apiProcess = spawn('tsx', ['server/routes.ts'], {
      stdio: 'inherit',
      env: process.env
    });
    
    apiProcess.on('error', (error) => {
      console.error('API server error:', error);
      reject(error);
    });
    
    // Give the API server some time to start
    setTimeout(() => {
      console.log('API server started');
      resolve();
    }, 2000);
  });
};

// Main function
const main = async () => {
  try {
    // Start the API server in the background
    await startAPIServer();
    
    // Start the main server
    const port = process.env.PORT || 5000;
    server.listen(port, '0.0.0.0', () => {
      console.log(`Server started on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start everything
main();