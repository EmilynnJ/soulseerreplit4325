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
  
  // Determine if we need special mobile-compatible session settings
  const isMobileCompatible = process.env.ENABLE_MOBILE_SESSION === 'true';
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true, // Changed to true to save all sessions
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      secure: isProduction, // Set to true in production only
      sameSite: "none", // Set to "none" to work across different sites (mobile webviews)
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
      const isMobileClient = /android|iphone|ipad|ipod|webos/i.test(userAgent);
      
      console.log(`Login request from ${isMobileClient ? 'mobile' : 'desktop'} client: ${userAgent}`);
      
      // For mobile clients, ensure cookie settings are compatible
      if (isMobileClient && req.session && req.session.cookie) {
        console.log("Setting mobile-friendly cookie parameters");
        req.session.cookie.sameSite = "none";
        req.session.cookie.secure = true; // For SameSite=None, Secure must be true
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
        
        // Return user data
        res.status(200).json({
          ...userResponse,
          // Include authentication status in the response
          isAuthenticated: true,
          // Include a timestamp to help debug sessions
          authenticatedAt: new Date().toISOString()
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Create a new object from user data without the password
    const { password: pwd, ...userResponse } = req.user as SelectUser;
    
    res.json(userResponse);
  });
}
