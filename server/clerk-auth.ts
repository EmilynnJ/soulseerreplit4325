import { Express, Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/backend';

// Clerk auth middleware
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the session token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No valid token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify and decode the token
    try {
      const session = await clerkClient.sessions.verifyToken({ token });
      
      if (!session) {
        return res.status(401).json({ message: 'Unauthorized - Invalid token' });
      }
      
      // Add the user data to the request object
      (req as any).auth = session;
      
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Unauthorized - Authentication error' });
  }
};

// Setup Clerk authentication routes
export const setupClerkAuth = (app: Express) => {
  // Handle Clerk webhooks
  app.post('/api/clerk-webhooks', async (req, res) => {
    // Verify the webhook signature
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;
    
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: 'Missing Svix headers' });
    }
    
    // Process the webhook based on type
    try {
      const payload = req.body;
      const eventType = payload.type;
      
      console.log(`Received Clerk webhook: ${eventType}`);
      
      switch (eventType) {
        case 'user.created':
          // Handle user creation
          console.log('User created:', payload.data.id);
          break;
          
        case 'user.updated':
          // Handle user update
          console.log('User updated:', payload.data.id);
          break;
          
        case 'user.deleted':
          // Handle user deletion
          console.log('User deleted:', payload.data.id);
          break;
          
        // Add more event types as needed
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error processing Clerk webhook:', error);
      res.status(400).json({ error: 'Invalid webhook payload' });
    }
  });
  
  // Test endpoint that requires authentication
  app.get('/api/protected', requireAuth, (req, res) => {
    res.json({ message: 'This is a protected endpoint', user: (req as any).auth });
  });
}; 