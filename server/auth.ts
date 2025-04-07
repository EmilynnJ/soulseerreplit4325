import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "soul-seer-secret-key-change-in-production";
  
  // Determine if we're in production based on the NODE_ENV
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`Setting up auth in ${isProduction ? 'production' : 'development'} mode`);
  
  // Always enable mobile-compatible session by default
  const isMobileCompatible = true;
  
  // For mobile app compatibility, we need special cookie settings
  // SameSite=None is required for cookies to work in WebViews, but this requires Secure=true
  // For non-production environments accessing through mobile apps, we need this combination
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true, // Changed to true to save all sessions
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // Longer expiration (30 days) for better UX
      secure: false, // We'll set this based on request in the middleware
      sameSite: "lax", // Default setting that works for most browsers
      domain: undefined, // No domain specification for now
      httpOnly: true // Ensure cookie is only accessible by the server
    }
  };
  
  // Log the session configuration for debugging
  console.log("Session settings:", {
    secure: sessionSettings.cookie?.secure,
    sameSite: sessionSettings.cookie?.sameSite,
    domain: sessionSettings.cookie?.domain,
    httpOnly: sessionSettings.cookie?.httpOnly
  });

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Check if input is email or username
        const isEmail = username.includes('@');
        let user;
        
        if (isEmail) {
          user = await storage.getUserByEmail(username.toLowerCase());
        } else {
          // Make username comparison case-insensitive
          const allUsers = await storage.getAllUsers();
          user = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
        }
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid credentials" });
        }
        
        // Update last active time
        await storage.updateUser(user.id, { lastActive: new Date() });
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // If user is not found, return null without error
        // This prevents session errors when a user has been deleted
        return done(null, null);
      }
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      done(null, null); // Return null instead of error to prevent breaking the application
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, email, password, fullName, role } = req.body;
      
      // Force role to be client regardless of what was sent
      // This ensures only clients can self-register
      if (role !== "client") {
        return res.status(403).json({ 
          message: "Only client accounts can be registered. Please contact administration for reader accounts." 
        });
      }
      
      // Check if username exists
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Check if email exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Create user with hashed password (always as client)
      const user = await storage.createUser({
        username,
        email,
        password: await hashPassword(password),
        fullName,
        role: "client", // Force role to client
        bio: "",
        specialties: [],
        pricing: null,
        rating: null,
        verified: false,
        profileImage: ""
      });
      
      // Create a new object without the password
      const { password: pwd, ...userResponse } = user;

      req.login(user, (err: any) => {
        if (err) return next(err);
        res.status(201).json(userResponse);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message?: string } | undefined) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Authentication failed" });
      
      // Check if the request is from a mobile client via User-Agent
      const userAgent = req.headers['user-agent'] || '';
      const isMobileClient = /android|iphone|ipad|ipod|webos|mobile/i.test(userAgent);
      
      console.log(`Login request from ${isMobileClient ? 'mobile' : 'desktop'} client: ${userAgent}`);

      // Special cookie handling for mobile clients
      if (isMobileClient && req.session && req.session.cookie) {
        console.log("Setting mobile-friendly cookie parameters");
        
        // Check if the connection is HTTPS
        const origin = req.headers.origin || '';
        const isHttps = origin.startsWith('https:') || req.secure;
        
        if (isHttps) {
          // If HTTPS, set SameSite=None with Secure=true for cross-site functionality
          // This works best with WebViews and cross-origin requests
          req.session.cookie.sameSite = "none";
          req.session.cookie.secure = true; // Required for SameSite=None
        } else {
          // For HTTP development environment, use a more permissive approach
          // This won't be as secure, but works better for development testing
          req.session.cookie.sameSite = "lax";
          req.session.cookie.secure = false;
        }
        
        // Extended session timeout for mobile users
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days for mobile
        
        // Log the cookie settings applied
        console.log(`Cookie settings for mobile: sameSite=${req.session.cookie.sameSite}, secure=${req.session.cookie.secure}, maxAge=${req.session.cookie.maxAge}, isHttps=${isHttps}`);
      }
      
      req.login(user, (err: any) => {
        if (err) return next(err);
        
        // Create a new object from user data without the password
        const { password: pwd, ...userResponse } = user;
        
        // Add cache headers to prevent client-side caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        
        // Set additional connection reuse headers for mobile apps
        if (isMobileClient) {
          res.setHeader('Connection', 'keep-alive');
          
          // Set a session ID in response header that the mobile app can save and reuse
          // Mobile app should include this in subsequent requests in Authorization header
          const sessionID = req.sessionID;
          res.setHeader('X-Session-ID', sessionID);
          
          console.log(`Set X-Session-ID header: ${sessionID}`);
        }
        
        // Return user data
        res.status(200).json({
          ...userResponse,
          // Include authentication status in the response
          isAuthenticated: true,
          // Include a timestamp to help debug sessions
          authenticatedAt: new Date().toISOString(),
          // Include session info for mobile devices
          ...(isMobileClient && { 
            sessionID: req.sessionID,
            isMobileSession: true 
          })
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err: any) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    // Check for standard session authentication
    if (req.isAuthenticated()) {
      // Create a new object from user data without the password
      const { password: pwd, ...userResponse } = req.user as SelectUser;
      return res.json(userResponse);
    }
    
    // Check for mobile session authentication via header
    const sessionId = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (sessionId) {
      console.log(`Attempting to restore session from X-Session-ID: ${sessionId}`);
      
      // Try to restore the session from store
      storage.sessionStore.get(sessionId as string, async (err, session) => {
        if (err || !session || !session.passport || !session.passport.user) {
          console.log('Invalid or expired session ID');
          return res.sendStatus(401);
        }
        
        try {
          // Get the user from the session's passport data
          const userId = session.passport.user;
          const user = await storage.getUser(userId);
          
          if (!user) {
            console.log('User not found from session ID');
            return res.sendStatus(401);
          }
          
          // Restore the session
          req.session.passport = session.passport;
          req.session.save();
          
          // Create a new object from user data without the password
          const { password: pwd, ...userResponse } = user;
          console.log(`Successfully restored session for user ${user.username}`);
          
          return res.json({
            ...userResponse,
            sessionRestored: true
          });
        } catch (error) {
          console.error('Error restoring session:', error);
          return res.sendStatus(401);
        }
      });
      
      return; // Important to prevent the function from continuing
    }
    
    // No valid authentication found
    return res.sendStatus(401);
  });
}
