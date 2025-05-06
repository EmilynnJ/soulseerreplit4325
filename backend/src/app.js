const express = require('express');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config({ path: '../../.env' }); // Adjust path if .env is elsewhere

const authRoutes = require('./routes/authRoutes');
// Import other routes here
// const userRoutes = require('./routes/userRoutes');
// const readerRoutes = require('./routes/readerRoutes');
// ... and so on for all routes

const { handleWebSocketConnection } = require('./websockets/chatHandler'); // Example

const app = express();

app.use(express.json());

// CORS Middleware (basic example, configure properly for production)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Allow requests from your frontend
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

app.get('/', (req, res) => {
    res.send('SoulSeer Backend is running!');
});

// API Routes
app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// ... and so on

// Error Handling Middleware (placeholder)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app;