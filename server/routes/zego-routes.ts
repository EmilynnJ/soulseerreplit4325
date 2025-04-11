import { Express, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { zegoService } from '../services/zego-service';
import { sessionTrackerService, Session, SessionType } from '../services/session-tracker-service';
import { db, sql } from '../db';

// Authentication middleware
function authenticate(req: Request, res: Response, next: Function) {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

/**
 * Register all Zego WebRTC related routes
 */
export function registerZegoRoutes(app: Express) {
  
  /**
   * Generate token for a ZEGO session
   */
  app.post('/api/zego/token', authenticate, async (req: Request, res: Response) => {
    try {
      const { roomId, userId, sessionType = 'video' } = req.body;
      
      if (!roomId || !userId) {
        return res.status(400).json({ message: 'Room ID and user ID are required' });
      }
      
      let token: string;
      if (sessionType === 'video') {
        token = zegoService.generateToken(userId, roomId, 'video');
      } else if (sessionType === 'voice') {
        token = zegoService.generateToken(userId, roomId, 'voice');
      } else if (sessionType === 'chat') {
        token = zegoService.generateToken(userId, roomId, 'chat');
      } else if (sessionType === 'live') {
        token = zegoService.generateToken(userId, roomId, 'live');
      } else {
        return res.status(400).json({ message: 'Invalid session type' });
      }
      
      return res.status(200).json({ token });
    } catch (error) {
      console.error('Error generating token:', error);
      return res.status(500).json({ message: 'Failed to generate token' });
    }
  });
  
  /**
   * Start a video reading session
   */
  app.post('/api/readings/video/start', authenticate, async (req: Request, res: Response) => {
    try {
      const { readerId } = req.body;
      const clientId = req.session?.user?.id;
      
      if (!readerId || !clientId) {
        return res.status(400).json({ message: 'Reader ID and client ID are required' });
      }
      
      // Check if client has sufficient balance
      const clientResult = await db.execute(sql`
        SELECT balance FROM users WHERE id = ${clientId}
      `);
      
      const readerResult = await db.execute(sql`
        SELECT rate_per_minute FROM users WHERE id = ${readerId}
      `);
      
      if (!clientResult.rows.length || !readerResult.rows.length) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const clientBalance = parseFloat(clientResult.rows[0].balance);
      const ratePerMinute = parseFloat(readerResult.rows[0].rate_per_minute);
      
      // Check for minimum 5 minutes
      const minimumAmount = ratePerMinute * 5;
      
      if (clientBalance < minimumAmount) {
        return res.status(402).json({ 
          message: 'Insufficient balance', 
          required: minimumAmount,
          balance: clientBalance
        });
      }
      
      // Create a session
      const session = await sessionTrackerService.createSession(
        parseInt(readerId),
        clientId,
        'video'
      );
      
      const roomInfo = zegoService.createRoom({
        roomId: session.roomId,
        userId: clientId.toString(),
        userName: req.session?.user?.username,
        role: 'host'
      });
      
      return res.status(200).json({
        success: true,
        roomId: session.roomId,
        token: roomInfo.token,
        sessionType: 'video'
      });
    } catch (error) {
      console.error('Error starting video session:', error);
      return res.status(500).json({ message: 'Failed to start video session' });
    }
  });
  
  /**
   * Start a voice reading session
   */
  app.post('/api/readings/voice/start', authenticate, async (req: Request, res: Response) => {
    try {
      const { readerId } = req.body;
      const clientId = req.session?.user?.id;
      
      if (!readerId || !clientId) {
        return res.status(400).json({ message: 'Reader ID and client ID are required' });
      }
      
      // Check if client has sufficient balance
      const clientResult = await db.execute(sql`
        SELECT balance FROM users WHERE id = ${clientId}
      `);
      
      const readerResult = await db.execute(sql`
        SELECT rate_per_minute FROM users WHERE id = ${readerId}
      `);
      
      if (!clientResult.rows.length || !readerResult.rows.length) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const clientBalance = parseFloat(clientResult.rows[0].balance);
      const ratePerMinute = parseFloat(readerResult.rows[0].rate_per_minute);
      
      // Check for minimum 5 minutes
      const minimumAmount = ratePerMinute * 5;
      
      if (clientBalance < minimumAmount) {
        return res.status(402).json({ 
          message: 'Insufficient balance', 
          required: minimumAmount,
          balance: clientBalance
        });
      }
      
      // Create a session
      const session = await sessionTrackerService.createSession(
        parseInt(readerId),
        clientId,
        'voice'
      );
      
      const roomInfo = zegoService.createRoom({
        roomId: session.roomId,
        userId: clientId.toString(),
        userName: req.session?.user?.username,
        role: 'host'
      });
      
      return res.status(200).json({
        success: true,
        roomId: session.roomId,
        token: roomInfo.token,
        sessionType: 'voice'
      });
    } catch (error) {
      console.error('Error starting voice session:', error);
      return res.status(500).json({ message: 'Failed to start voice session' });
    }
  });
  
  /**
   * Start a chat reading session
   */
  app.post('/api/readings/chat/start', authenticate, async (req: Request, res: Response) => {
    try {
      const { readerId } = req.body;
      const clientId = req.session?.user?.id;
      
      if (!readerId || !clientId) {
        return res.status(400).json({ message: 'Reader ID and client ID are required' });
      }
      
      // Check if client has sufficient balance
      const clientResult = await db.execute(sql`
        SELECT balance FROM users WHERE id = ${clientId}
      `);
      
      const readerResult = await db.execute(sql`
        SELECT rate_per_minute FROM users WHERE id = ${readerId}
      `);
      
      if (!clientResult.rows.length || !readerResult.rows.length) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const clientBalance = parseFloat(clientResult.rows[0].balance);
      const ratePerMinute = parseFloat(readerResult.rows[0].rate_per_minute);
      
      // Check for minimum 5 minutes
      const minimumAmount = ratePerMinute * 5;
      
      if (clientBalance < minimumAmount) {
        return res.status(402).json({ 
          message: 'Insufficient balance', 
          required: minimumAmount,
          balance: clientBalance
        });
      }
      
      // Create a session
      const session = await sessionTrackerService.createSession(
        parseInt(readerId),
        clientId,
        'chat'
      );
      
      const token = zegoService.generateChatToken(
        clientId.toString(),
        session.roomId
      );
      
      return res.status(200).json({
        success: true,
        roomId: session.roomId,
        token,
        sessionType: 'chat'
      });
    } catch (error) {
      console.error('Error starting chat session:', error);
      return res.status(500).json({ message: 'Failed to start chat session' });
    }
  });
  
  /**
   * Join a reading session as a reader
   */
  app.post('/api/readings/join', authenticate, async (req: Request, res: Response) => {
    try {
      const { roomId, sessionType = 'video' } = req.body;
      const userId = req.session?.user?.id;
      
      if (!roomId || !userId) {
        return res.status(400).json({ message: 'Room ID and user ID are required' });
      }
      
      let token: string;
      
      // Generate appropriate token based on session type
      if (sessionType === 'video') {
        const roomInfo = zegoService.joinRoom({
          roomId,
          userId: userId.toString(),
          userName: req.session?.user?.username
        });
        token = roomInfo.token;
      } else if (sessionType === 'voice') {
        token = zegoService.generateVoiceToken(userId.toString(), roomId);
      } else if (sessionType === 'chat') {
        token = zegoService.generateChatToken(userId.toString(), roomId);
      } else {
        return res.status(400).json({ message: 'Invalid session type' });
      }
      
      // Start the session if it exists but hasn't been started yet
      await sessionTrackerService.startSession(roomId);
      
      return res.status(200).json({
        success: true,
        roomId,
        token,
        sessionType
      });
    } catch (error) {
      console.error('Error joining reading session:', error);
      return res.status(500).json({ message: 'Failed to join reading session' });
    }
  });
  
  /**
   * Get session token
   */
  app.post('/api/sessions/token', authenticate, async (req: Request, res: Response) => {
    try {
      const { roomId, sessionType = 'video' } = req.body;
      const userId = req.session?.user?.id.toString();
      
      if (!roomId || !userId) {
        return res.status(400).json({ message: 'Room ID and user ID are required' });
      }
      
      let token: string;
      
      // Generate token based on session type
      if (sessionType === 'video') {
        token = zegoService.generateToken(userId, roomId, 'video');
      } else if (sessionType === 'voice') {
        token = zegoService.generateToken(userId, roomId, 'voice');
      } else if (sessionType === 'chat') {
        token = zegoService.generateToken(userId, roomId, 'chat');
      } else if (sessionType === 'live') {
        token = zegoService.generateToken(userId, roomId, 'live');
      } else {
        return res.status(400).json({ message: 'Invalid session type' });
      }
      
      return res.status(200).json({
        success: true,
        roomId,
        token,
        userId
      });
    } catch (error) {
      console.error('Error getting session token:', error);
      return res.status(500).json({ message: 'Failed to get session token' });
    }
  });
  
  /**
   * Check session billing amount
   */
  app.post('/api/sessions/billing', authenticate, async (req: Request, res: Response) => {
    try {
      const { roomId } = req.body;
      
      if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
      }
      
      const amount = await sessionTrackerService.trackSessionBilling(roomId);
      
      return res.status(200).json({
        success: true,
        roomId,
        amount
      });
    } catch (error) {
      console.error('Error tracking session billing:', error);
      return res.status(500).json({ message: 'Failed to track session billing' });
    }
  });
  
  /**
   * End a session
   */
  app.post('/api/sessions/end', authenticate, async (req: Request, res: Response) => {
    try {
      const { roomId } = req.body;
      
      if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
      }
      
      // End the session
      const session = await sessionTrackerService.endSession(roomId);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      return res.status(200).json({
        success: true,
        roomId,
        duration: session.duration,
        totalAmount: session.totalAmount,
        status: session.status
      });
    } catch (error) {
      console.error('Error ending session:', error);
      return res.status(500).json({ message: 'Failed to end session' });
    }
  });
  
  /**
   * Get reader details for a session
   */
  app.get('/api/sessions/reader/:readerId', authenticate, async (req: Request, res: Response) => {
    try {
      const { readerId } = req.params;
      
      if (!readerId) {
        return res.status(400).json({ message: 'Reader ID is required' });
      }
      
      const readerResult = await db.execute(sql`
        SELECT id, username, full_name, profile_image, bio, specialties, rating, 
              rate_per_minute, review_count 
        FROM users 
        WHERE id = ${readerId} AND role = 'reader'
      `);
      
      if (!readerResult.rows.length) {
        return res.status(404).json({ message: 'Reader not found' });
      }
      
      return res.status(200).json(readerResult.rows[0]);
    } catch (error) {
      console.error('Error fetching reader details:', error);
      return res.status(500).json({ message: 'Failed to fetch reader details' });
    }
  });
  
  /**
   * Get client sessions
   */
  app.get('/api/sessions/client/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      
      if (!clientId) {
        return res.status(400).json({ message: 'Client ID is required' });
      }
      
      // Only allow clients to access their own sessions or admins to access any
      if (req.session?.user?.id.toString() !== clientId && req.session?.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      const sessions = await sessionTrackerService.getSessionHistory(parseInt(clientId), 'client');
      
      return res.status(200).json(sessions);
    } catch (error) {
      console.error('Error fetching client sessions:', error);
      return res.status(500).json({ message: 'Failed to fetch client sessions' });
    }
  });
  
  /**
   * Get session details
   */
  app.get('/api/sessions/details/:roomId', authenticate, async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      
      if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
      }
      
      const sessionResult = await db.execute(sql`
        SELECT * FROM session_logs WHERE room_id = ${roomId}
      `);
      
      if (!sessionResult.rows.length) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      const session = sessionResult.rows[0];
      
      // Only allow users who are part of the session or admins to access
      if (req.session?.user?.id !== session.reader_id && 
          req.session?.user?.id !== session.client_id && 
          req.session?.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      return res.status(200).json(session);
    } catch (error) {
      console.error('Error fetching session details:', error);
      return res.status(500).json({ message: 'Failed to fetch session details' });
    }
  });
  
  /**
   * Get reader balance and earnings
   */
  app.get('/api/reader-balance/:readerId', authenticate, async (req: Request, res: Response) => {
    try {
      const { readerId } = req.params;
      
      // Only allow readers to access their own balance or admins to access any
      if (req.session?.user?.id.toString() !== readerId && req.session?.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      const readerResult = await db.execute(sql`
        SELECT earnings, balance FROM users WHERE id = ${readerId} AND role = 'reader'
      `);
      
      if (!readerResult.rows.length) {
        return res.status(404).json({ message: 'Reader not found' });
      }
      
      // Get completed sessions
      const sessionsResult = await db.execute(sql`
        SELECT COUNT(*) as session_count, SUM(reader_earned) as total_earned 
        FROM session_logs 
        WHERE reader_id = ${readerId} AND status = 'ended'
      `);
      
      const result = {
        earnings: parseFloat(readerResult.rows[0].earnings) || 0,
        balance: parseFloat(readerResult.rows[0].balance) || 0,
        sessionCount: parseInt(sessionsResult.rows[0].session_count) || 0,
        totalEarned: parseFloat(sessionsResult.rows[0].total_earned) || 0
      };
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching reader balance:', error);
      return res.status(500).json({ message: 'Failed to fetch reader balance' });
    }
  });
}

export default registerZegoRoutes;