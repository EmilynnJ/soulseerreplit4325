/**
 * SessionTrackerService
 * This service manages the pay-per-minute reading sessions, including:
 * - Creating and tracking sessions
 * - Managing session state (waiting, active, ended)
 * - Calculating billing amounts based on duration
 * - Handling revenue sharing between platform and readers
 * - Recording session logs for reporting
 */

import { v4 as uuidv4 } from 'uuid';
import { db, sql } from '../db';

// Session status types
export type SessionStatus = 'waiting' | 'active' | 'ended';

// Session types
export type SessionType = 'video' | 'voice' | 'chat';

// Session model
export interface Session {
  id?: number;
  roomId: string;
  readerId: number;
  clientId: number;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  status: SessionStatus;
  totalAmount?: number;
  readerEarned?: number;
  platformEarned?: number;
  sessionType: SessionType;
  ratePerMinute?: number;
}

/**
 * Service for tracking and billing reading sessions
 */
export class SessionTrackerService {
  private static instance: SessionTrackerService;
  
  // Revenue split percentages
  private readerSharePercentage: number = 70; // 70% to reader
  private platformSharePercentage: number = 30; // 30% to platform
  
  // Active sessions map (roomId -> Session)
  private activeSessions: Map<string, Session> = new Map();
  
  // Minimum billing amount in minutes
  private minimumBillingTime: number = 5; // 5 minutes minimum
  
  private constructor() {
    console.log('SessionTrackerService initialized');
    
    // Schedule regular cleanup of stale sessions
    setInterval(this.cleanupStaleSessions.bind(this), 15 * 60 * 1000); // Every 15 min
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): SessionTrackerService {
    if (!SessionTrackerService.instance) {
      SessionTrackerService.instance = new SessionTrackerService();
    }
    return SessionTrackerService.instance;
  }
  
  /**
   * Clean up any stale sessions (sessions that have been inactive for more than 2 hours)
   */
  private async cleanupStaleSessions(): Promise<void> {
    try {
      console.log('Cleaning up stale sessions...');
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      // Find sessions with status 'waiting' or 'active' but created more than 2 hours ago
      for (const session of this.activeSessions.values()) {
        if (
          (session.status === 'waiting' || session.status === 'active') && 
          session.startTime && 
          session.startTime < twoHoursAgo
        ) {
          console.log(`Cleaning up stale session: ${session.roomId}`);
          await this.endSession(session.roomId);
        }
      }
    } catch (error) {
      console.error('Error cleaning up stale sessions:', error);
    }
  }
  
  /**
   * Create a new session
   */
  public async createSession(
    readerId: number,
    clientId: number,
    sessionType: SessionType
  ): Promise<Session> {
    try {
      // Generate a unique room ID
      const roomId = `session_${uuidv4().replace(/-/g, '')}`;
      
      // Get reader's rate per minute
      const readerResult = await db.execute(sql`
        SELECT rate_per_minute FROM users WHERE id = ${readerId}
      `);
      
      if (!readerResult || !readerResult.rows || readerResult.rows.length === 0) {
        throw new Error(`Reader not found: ${readerId}`);
      }
      
      const ratePerMinute = parseFloat(readerResult.rows[0].rate_per_minute);
      
      // Create the session object
      const session: Session = {
        roomId,
        readerId,
        clientId,
        status: 'waiting',
        sessionType,
        ratePerMinute,
        startTime: new Date()
      };
      
      // Store in the active sessions map
      this.activeSessions.set(roomId, session);
      
      // Store in the database
      await db.execute(sql`
        INSERT INTO session_logs (
          room_id, reader_id, client_id, start_time, status, 
          session_type, rate_per_minute
        ) VALUES (
          ${session.roomId}, ${session.readerId}, ${session.clientId}, 
          ${session.startTime}, ${session.status}, ${session.sessionType},
          ${session.ratePerMinute}
        )
      `);
      
      console.log(`Session created: ${roomId} (${sessionType})`);
      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }
  
  /**
   * Start a session (transition from waiting to active)
   */
  public async startSession(roomId: string): Promise<Session | null> {
    try {
      // Get session from memory or database
      let session = this.activeSessions.get(roomId);
      
      if (!session) {
        // Try to find in database
        const sessionResult = await db.execute(sql`
          SELECT * FROM session_logs WHERE room_id = ${roomId} AND status = 'waiting'
        `);
        
        if (!sessionResult || !sessionResult.rows || sessionResult.rows.length === 0) {
          console.error(`Session not found: ${roomId}`);
          return null;
        }
        
        const dbSession = sessionResult.rows[0];
        
        // Convert from DB format to Session object
        session = {
          roomId: dbSession.room_id,
          readerId: dbSession.reader_id,
          clientId: dbSession.client_id,
          startTime: dbSession.start_time ? new Date(dbSession.start_time) : new Date(),
          status: dbSession.status,
          sessionType: dbSession.session_type,
          ratePerMinute: parseFloat(dbSession.rate_per_minute)
        };
        
        // Add to active sessions
        this.activeSessions.set(roomId, session);
      }
      
      // Only start if it's in waiting status
      if (session.status === 'waiting') {
        // Update session status to active
        session.status = 'active';
        
        // Update database
        await db.execute(sql`
          UPDATE session_logs 
          SET status = 'active' 
          WHERE room_id = ${roomId}
        `);
        
        console.log(`Session started: ${roomId}`);
      }
      
      return session;
    } catch (error) {
      console.error('Error starting session:', error);
      return null;
    }
  }
  
  /**
   * Track the current billing amount for a session
   */
  public async trackSessionBilling(roomId: string): Promise<number> {
    try {
      // Get session from memory or database
      let session = this.activeSessions.get(roomId);
      
      if (!session) {
        // Try to find in database
        const sessionResult = await db.execute(sql`
          SELECT * FROM session_logs WHERE room_id = ${roomId}
        `);
        
        if (!sessionResult || !sessionResult.rows || sessionResult.rows.length === 0) {
          console.error(`Session not found: ${roomId}`);
          return 0;
        }
        
        const dbSession = sessionResult.rows[0];
        
        // If the session is already ended, return the recorded amount
        if (dbSession.status === 'ended') {
          return parseFloat(dbSession.total_amount) || 0;
        }
        
        // Convert from DB format to Session object
        session = {
          roomId: dbSession.room_id,
          readerId: dbSession.reader_id,
          clientId: dbSession.client_id,
          startTime: dbSession.start_time ? new Date(dbSession.start_time) : new Date(),
          status: dbSession.status as SessionStatus,
          sessionType: dbSession.session_type as SessionType,
          ratePerMinute: parseFloat(dbSession.rate_per_minute)
        };
        
        // Add to active sessions
        this.activeSessions.set(roomId, session);
      }
      
      // Calculate current duration in minutes
      const now = new Date();
      const startTime = session.startTime || now;
      const durationMs = now.getTime() - startTime.getTime();
      const durationMinutes = Math.max(this.minimumBillingTime, Math.ceil(durationMs / (60 * 1000)));
      
      // Calculate current billing amount
      const ratePerMinute = session.ratePerMinute || 0;
      const totalAmount = durationMinutes * ratePerMinute;
      
      return parseFloat(totalAmount.toFixed(2));
    } catch (error) {
      console.error('Error tracking session billing:', error);
      return 0;
    }
  }
  
  /**
   * End a session and calculate final billing
   */
  public async endSession(roomId: string): Promise<Session | null> {
    try {
      console.log(`Ending session: ${roomId}`);
      // Get session from memory or database
      let session = this.activeSessions.get(roomId);
      
      if (!session) {
        // Try to find in database
        const sessionResult = await db.execute(sql`
          SELECT * FROM session_logs WHERE room_id = ${roomId} AND status != 'ended'
        `);
        
        if (!sessionResult || !sessionResult.rows || sessionResult.rows.length === 0) {
          console.error(`Active session not found: ${roomId}`);
          return null;
        }
        
        const dbSession = sessionResult.rows[0];
        
        // Convert from DB format to Session object
        session = {
          roomId: dbSession.room_id,
          readerId: dbSession.reader_id,
          clientId: dbSession.client_id,
          startTime: dbSession.start_time ? new Date(dbSession.start_time) : new Date(),
          status: dbSession.status as SessionStatus,
          sessionType: dbSession.session_type as SessionType,
          ratePerMinute: parseFloat(dbSession.rate_per_minute)
        };
        
        // Add to active sessions
        this.activeSessions.set(roomId, session);
      }
      
      // Calculate final duration in minutes
      const now = new Date();
      const startTime = session.startTime || now;
      const durationMs = now.getTime() - startTime.getTime();
      const durationMinutes = Math.max(this.minimumBillingTime, Math.ceil(durationMs / (60 * 1000)));
      const durationSeconds = Math.ceil(durationMs / 1000);
      
      // Calculate final billing amount
      const ratePerMinute = session.ratePerMinute || 0;
      const totalAmount = parseFloat((durationMinutes * ratePerMinute).toFixed(2));
      
      // Calculate revenue split
      const readerEarned = parseFloat((totalAmount * (this.readerSharePercentage / 100)).toFixed(2));
      const platformEarned = parseFloat((totalAmount * (this.platformSharePercentage / 100)).toFixed(2));
      
      // Update session data
      session.status = 'ended';
      session.endTime = now;
      session.duration = durationSeconds;
      session.totalAmount = totalAmount;
      session.readerEarned = readerEarned;
      session.platformEarned = platformEarned;
      
      // Remove from active sessions
      this.activeSessions.delete(roomId);
      
      // Update client's balance
      await db.execute(sql`
        UPDATE users 
        SET balance = balance - ${totalAmount} 
        WHERE id = ${session.clientId}
      `);
      
      // Update reader's earnings
      await db.execute(sql`
        UPDATE users 
        SET earnings = earnings + ${readerEarned} 
        WHERE id = ${session.readerId}
      `);
      
      // Update session in database
      await db.execute(sql`
        UPDATE session_logs 
        SET 
          status = 'ended',
          end_time = ${now},
          duration = ${durationSeconds},
          total_amount = ${totalAmount},
          reader_earned = ${readerEarned},
          platform_earned = ${platformEarned}
        WHERE room_id = ${roomId}
      `);
      
      console.log(`Session ended: ${roomId}, Duration: ${durationMinutes} minutes, Amount: $${totalAmount}`);
      return session;
    } catch (error) {
      console.error('Error ending session:', error);
      return null;
    }
  }
  
  /**
   * Get all active sessions
   */
  public getActiveSessions(): Session[] {
    // Convert the Map values to an array
    return Array.from(this.activeSessions.values());
  }
  
  /**
   * Get active sessions count
   */
  public getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }
  
  /**
   * Check if a user is in an active session
   */
  public async isUserInActiveSession(userId: number): Promise<boolean> {
    // Check in memory first
    for (const session of this.activeSessions.values()) {
      if (session.readerId === userId || session.clientId === userId) {
        return true;
      }
    }
    
    // Then check database
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM session_logs 
        WHERE (reader_id = ${userId} OR client_id = ${userId}) 
        AND status != 'ended'
      `);
      
      return result.rows[0].count > 0;
    } catch (error) {
      console.error('Error checking if user is in active session:', error);
      return false;
    }
  }
  
  /**
   * Get user's active session
   */
  public async getUserActiveSession(userId: number): Promise<Session | null> {
    // Check in memory first
    for (const session of this.activeSessions.values()) {
      if (session.readerId === userId || session.clientId === userId) {
        return session;
      }
    }
    
    // Then check database
    try {
      const result = await db.execute(sql`
        SELECT * FROM session_logs 
        WHERE (reader_id = ${userId} OR client_id = ${userId}) 
        AND status != 'ended'
        ORDER BY start_time DESC
        LIMIT 1
      `);
      
      if (!result || !result.rows || result.rows.length === 0) {
        return null;
      }
      
      const dbSession = result.rows[0];
      
      // Convert from DB format to Session object
      const session: Session = {
        roomId: dbSession.room_id,
        readerId: dbSession.reader_id,
        clientId: dbSession.client_id,
        startTime: dbSession.start_time ? new Date(dbSession.start_time) : new Date(),
        status: dbSession.status,
        sessionType: dbSession.session_type,
        ratePerMinute: parseFloat(dbSession.rate_per_minute)
      };
      
      return session;
    } catch (error) {
      console.error('Error getting user active session:', error);
      return null;
    }
  }
  
  /**
   * Get session history for a user
   */
  public async getSessionHistory(userId: number, userType: 'reader' | 'client'): Promise<any[]> {
    try {
      let query;
      if (userType === 'reader') {
        query = sql`
          SELECT sl.*, 
            u.username as client_username
          FROM session_logs sl
          JOIN users u ON sl.client_id = u.id
          WHERE sl.reader_id = ${userId}
          ORDER BY sl.start_time DESC
        `;
      } else {
        query = sql`
          SELECT sl.*, 
            u.username as reader_username
          FROM session_logs sl
          JOIN users u ON sl.reader_id = u.id
          WHERE sl.client_id = ${userId}
          ORDER BY sl.start_time DESC
        `;
      }
      
      const result = await db.execute(query);
      
      return result.rows || [];
    } catch (error) {
      console.error('Error getting session history:', error);
      return [];
    }
  }
}

// Export singleton instance
export const sessionTrackerService = SessionTrackerService.getInstance();