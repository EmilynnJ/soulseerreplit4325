import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { Client, Account } from 'appwrite';

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
  // Check if stored password has the expected format
  if (!stored || !stored.includes('.')) {
    console.error('Invalid password format (missing salt)');
    return false;
  }

  const [hashed, salt] = stored.split(".");
  
  // Verify that salt is present
  if (!salt) {
    console.error('Salt is missing from stored password');
    return false;
  }
  
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Initialize Appwrite Client
export const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '681831b30038fbc171cf');

export const appwriteAccount = new Account(appwriteClient);

// Function to handle Appwrite authentication 
export async function handleAppwriteAuth(userId: string, email: string, name: string, profileImage?: string) {
  try {
    // Create an Appwrite profile-like object for our existing functions
    const appwriteProfile = {
      id: userId,
      emails: [{ value: email }],
      displayName: name,
      picture: profileImage || ''
    };
    
    // Use our existing find or create function
    const user = await storage.findOrCreateUserFromAppwrite(appwriteProfile);
    
    return user;
  } catch (error) {
    console.error('Error processing Appwrite authentication:', error);
    throw error;
  }
}

// Function to verify Appwrite JWT token (to be implemented based on your needs)
export async function verifyAppwriteToken(sessionToken: string) {
  try {
    // You would typically validate the JWT token here
    // This is a simplified example - you'll need to implement proper JWT validation
    
    // For now, just check if the token exists
    if (!sessionToken) {
      return null;
    }
    
    // Here you would decode and verify the token
    // This depends on how you're implementing the token verification
    
    return true;
  } catch (error) {
    console.error('Error verifying Appwrite token:', error);
    return null;
  }
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

  // --- Appwrite Configuration ---
  const appwriteEndpoint = process.env.APPWRITE_API_ENDPOINT || process.env.VITE_APPWRITE_API_ENDPOINT;
  const appwriteProjectId = process.env.VITE_APPWRITE_PROJECT_ID;

  if (!appwriteEndpoint || !appwriteProjectId) {
    console.warn("Appwrite environment variables are not fully set. Appwrite login may not work properly.");
  } else {
    console.log("Appwrite configured.");
  }
  // ---------------------------

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
        
        // First check if user exists
        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }
        
        // Check if user has a password (could be Appwrite user)
        if (!user.password) {
          console.log(`User ${user.username} has no password - might be an Appwrite user`);
          return done(null, false, { message: "Please use Appwrite to log in" });
        }
        
        // Now check password
        try {
          if (!(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid credentials" });
          }
        } catch (passwordError) {
          console.error(`Password verification error for user ${user.username}:`, passwordError);
          // Update the user's password to a valid format
          const newHashedPassword = await hashPassword(password);
          await storage.updateUser(user.id, { password: newHashedPassword });
          console.log(`Updated password format for user ${user.username}`);
          return done(null, false, { message: "Password reset - please try logging in again" });
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
          // Handle verified field safely (ensuring it exists or defaulting to false)
          verified: userResponse.verified !== undefined ? userResponse.verified : false,
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

  // --- Appwrite User Processing ---
  app.post('/api/appwrite-user', async (req, res) => {
    try {
      const { userId, email, name, providerId } = req.body;
      
      if (!email) {
        return res.status(401).json({ message: "Unauthorized or missing Appwrite user data" });
      }
      
      // Check if user exists in our database
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Create a new user in our database
        const newUser = {
          username: name || email.split('@')[0],
          email: email,
          fullName: name || email,
          role: "client", // Default role
          bio: "",
          specialties: [],
          pricing: null,
          rating: null,
          verified: true, // Appwrite users are verified
          profileImage: "",
          appwrite_id: userId
        };
        
        user = await storage.createUser(newUser);
        console.log(`Created new user from Appwrite: ${user.username}`);
      } else {
        // Update existing user with Appwrite info
        await storage.updateUser(user.id, { 
          lastActive: new Date(),
          appwrite_id: userId,
          verified: true
        });
      }
      
      // Return user data without password
      const { password, ...userResponse } = user;
      
      // Log the user in
      req.login(user, (err) => {
        if (err) {
          console.error("Error logging in Appwrite user:", err);
          return res.status(500).json({ message: "Error during login" });
        }
        
        res.json({
          ...userResponse,
          isAuthenticated: true,
          authProvider: "appwrite"
        });
      });
    } catch (error) {
      console.error("Error processing Appwrite user:", error);
      res.status(500).json({ message: "Error processing Appwrite user" });
    }
  });
  
  // Protected route example using middleware
  app.get('/api/protected-example', (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json({ message: "This is a protected route", user: req.user });
  });
  // ----------------------------

  app.post("/api/logout", (req, res, next) => {
    req.logout((err: any) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    // Check for standard session authentication
    if (req.isAuthenticated()) {
      try {
        // Get user data safely
        const user = req.user as SelectUser;
        if (!user) {
          console.error('User is authenticated but user object is null/undefined');
          return res.sendStatus(401);
        }
        
        // Create a new object from user data without the password
        // Handle the case where password might be undefined
        const userResponse = { ...user };
        delete userResponse.password;
        
        return res.json({
          ...userResponse,
          // Ensure verified has a value
          verified: userResponse.verified ?? false
        });
      } catch (error) {
        console.error('Error processing user data:', error);
        return res.status(500).json({ message: 'Error processing user data' });
      }
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
