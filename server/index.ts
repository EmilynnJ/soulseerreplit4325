import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { initializeDatabase } from "./migrations/migration-manager.js";
import { config } from "dotenv";
import path from "path";
import cors from "cors";

// Load environment variables
config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure CORS based on environment
const corsOptions = {
  // Using '*' for development; should be restricted in production
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Log the CORS configuration
console.log("CORS configured for domains:", corsOptions.origin);

// Serve uploads directory directly in both development and production
const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
const imagesPath = path.join(process.cwd(), 'public', 'images');

// Serve uploads and images directories
app.use('/uploads', express.static(uploadsPath));
app.use('/images', express.static(imagesPath));

console.log(`Serving uploads from: ${uploadsPath} with fallback to default images`);

// Add health check endpoint for Render
app.get('/api/health', (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VITE_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000; // 5 seconds
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Initialize database before registering routes
      await initializeDatabase();
      log('Database initialized successfully', 'database');
      break;
    } catch (error) {
      log(`Database initialization attempt ${attempt} failed: ${error}`, 'database');
      
      if (attempt === MAX_RETRIES) {
        log('All database initialization attempts failed. Exiting.', 'database');
        process.exit(1);
      }
      
      log(`Retrying in ${RETRY_DELAY/1000} seconds...`, 'database');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  const server = await registerRoutes(app);

  // Initialize the daily reader payout scheduler
  try {
    const { readerBalanceService } = await import('./services/reader-balance-service');
    
    // Function to schedule payouts at midnight
    const scheduleDailyPayouts = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0); // Next midnight
      
      const timeUntilMidnight = midnight.getTime() - now.getTime();
      
      console.log(`[PAYOUT SCHEDULER] Next payout scheduled for ${midnight.toISOString()} (in ${Math.round(timeUntilMidnight / 60000)} minutes)`);
      
      // Schedule the payout
      setTimeout(async () => {
        try {
          console.log('[PAYOUT SCHEDULER] Running scheduled daily payouts');
          await readerBalanceService.scheduleDailyPayouts();
          
          // Schedule the next day's payout
          scheduleDailyPayouts();
        } catch (error) {
          console.error('[PAYOUT SCHEDULER] Error running scheduled payouts:', error);
          // Re-schedule even on error
          scheduleDailyPayouts();
        }
      }, timeUntilMidnight);
    };
    
    // Start the scheduler
    scheduleDailyPayouts();
    
    console.log('[PAYOUT SCHEDULER] Reader payout scheduler initialized');
  } catch (error) {
    console.error('[PAYOUT SCHEDULER] Failed to initialize payout scheduler:', error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);
    res.status(status).json({ message });
    // Don't rethrow the error, as it can crash the application
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  server.listen(Number(port), "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
