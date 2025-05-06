import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { registerRoutes } from './routes';
import path from 'path';
import http from 'http';

// Load environment variables
dotenv.config();

const app = express();

// Get the port from environment variables or use 3000 as default
const PORT = process.env.PORT || 3000;

// Setup middleware
app.use(express.json());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://soulseer.app', 'https://soulseer-frontend.onrender.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// Configure Stripe
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Start the server
async function startServer() {
  try {
    // Register routes and get HTTP server
    const httpServer = await registerRoutes(app);

    // Start listening
    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

