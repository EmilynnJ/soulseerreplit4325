/**
 * Session service for managing reading sessions and billing
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import stripeClient from './stripe-client';

// Revenue split configuration
const READER_SHARE_PERCENTAGE = 0.7; // 70% goes to the reader
const PLATFORM_SHARE_PERCENTAGE = 0.3; // 30% goes to the platform owner

// Define session types
interface SessionBillingRecord {
  id: string;
  roomName: string;
  readerId: number;
  clientId: number;
  startTime: string;
  minutesBilled: number;
  amountBilled: number;
  readerAmount: number;
  platformAmount: number;
  timestamp: string;
}

interface SessionRecord {
  id: string;
  roomName: string;
  readerId: number;
  clientId: number;
  readerName: string;
  clientName: string;
  startTime: string;
  endTime: string;
  totalDuration: number;
  totalAmount: number;
  billingRecords: SessionBillingRecord[];
  readingType?: 'chat' | 'voice' | 'video';
  type?: 'chat' | 'voice' | 'video';
  status?: 'scheduled' | 'waiting_payment' | 'payment_completed' | 'in_progress' | 'completed' | 'cancelled';
  price?: number;
  pricePerMinute?: number;
  duration?: number;
  completedAt?: string;
}

// Path to the sessions JSON file
const SESSIONS_FILE_PATH = path.join(process.cwd(), 'data', 'sessions.json');

// Ensure data directory exists
function ensureDataDirExists() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(SESSIONS_FILE_PATH)) {
    fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify([], null, 2));
  }
}

/**
 * Session service for managing reading sessions and billing
 */
export const sessionService = {
  /**
   * Record a new session
   * 
   * @param readerId The ID of the reader
   * @param clientId The ID of the client
   * @param roomName The name of the room
   * @param readerName The name of the reader
   * @param clientName The name of the client
   * @param readingType The type of reading (optional)
   * @returns The created session record
   */
  createSession: (
    readerId: number,
    clientId: number,
    roomName: string,
    readerName: string,
    clientName: string,
    readingType?: 'chat' | 'voice' | 'video'
  ): SessionRecord => {
    ensureDataDirExists();
    
    // Load existing sessions
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE_PATH, 'utf-8')) as SessionRecord[];
    
    // Create new session
    const newSession: SessionRecord = {
      id: uuidv4(),
      roomName,
      readerId,
      clientId,
      readerName,
      clientName,
      startTime: new Date().toISOString(),
      endTime: '',
      totalDuration: 0,
      totalAmount: 0,
      billingRecords: [],
      readingType
    };
    
    // Save to file
    sessions.push(newSession);
    fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(sessions, null, 2));
    
    return newSession;
  },
  
  /**
   * Get a session by room name
   * 
   * @param roomName The name of the room
   * @returns The session record, or null if not found
   */
  getSessionByRoomName: (roomName: string): SessionRecord | null => {
    ensureDataDirExists();
    
    // Load sessions
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE_PATH, 'utf-8')) as SessionRecord[];
    
    // Find session
    const session = sessions.find(s => s.roomName === roomName);
    return session || null;
  },
  
  /**
   * Record billing for a session
   * 
   * @param roomName The name of the room
   * @param minutes The number of minutes to bill
   * @param stripeCustomerId The Stripe customer ID to charge
   * @returns The updated session record
   */
  recordBilling: async (
    roomName: string,
    minutes: number,
    clientId: number,
    readerId: number
  ): Promise<SessionRecord | null> => {
    ensureDataDirExists();
    
    // Load sessions
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE_PATH, 'utf-8')) as SessionRecord[];
    
    // Find session
    const sessionIndex = sessions.findIndex(s => s.roomName === roomName);
    if (sessionIndex === -1) return null;
    
    const session = sessions[sessionIndex];
    
    // Calculate billing amount (default: $1 per minute)
    const amountBilled = minutes * 100; // $1 per minute in cents
    
    // Calculate revenue split (70% reader, 30% platform)
    const readerAmount = Math.round(amountBilled * READER_SHARE_PERCENTAGE);
    const platformAmount = amountBilled - readerAmount; // To avoid rounding errors
    
    // Create billing record
    const billingRecord: SessionBillingRecord = {
      id: uuidv4(),
      roomName,
      readerId,
      clientId,
      startTime: session.startTime,
      minutesBilled: minutes,
      amountBilled,
      readerAmount,
      platformAmount,
      timestamp: new Date().toISOString()
    };
    
    try {
      // In a real implementation, you would charge the client here via Stripe
      // For now, we're just recording the billing without actual charging
      console.log(`[BILLING] Charged client ${clientId} $${amountBilled / 100} for ${minutes} minutes with reader ${readerId}`);
      console.log(`[REVENUE-SPLIT] Reader amount: $${readerAmount / 100} (70%), Platform amount: $${platformAmount / 100} (30%)`);
      
      // Add billing record to session
      session.billingRecords.push(billingRecord);
      session.totalAmount += amountBilled;
      
      // Update sessions file
      sessions[sessionIndex] = session;
      fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(sessions, null, 2));
      
      // Update reader balance
      try {
        const { readerBalanceService } = await import('./reader-balance-service');
        
        // Get reader name from session
        const readerName = session.readerName;
        
        // Add earnings to reader balance
        const updatedBalance = readerBalanceService.addReaderEarnings(
          readerId,
          readerName,
          readerAmount
        );
        
        console.log(`[BALANCE] Updated reader ${readerId} (${readerName}) balance: $${updatedBalance.pendingBalance / 100}`);
        
        // Check if eligible for payout
        if (updatedBalance.pendingBalance >= 1500) { // $15.00 in cents
          console.log(`[BALANCE] Reader ${readerId} eligible for payout with balance $${updatedBalance.pendingBalance / 100}`);
        }
        
      } catch (balanceError) {
        console.error('Error updating reader balance:', balanceError);
        // Continue with the session recording even if balance update fails
      }
      
      return session;
    } catch (error) {
      console.error('Error recording billing:', error);
      return null;
    }
  },
  
  /**
   * End a session
   * 
   * @param roomName The name of the room
   * @param totalDuration The total duration in minutes
   * @returns The updated session record
   */
  endSession: (
    roomName: string,
    totalDuration: number
  ): SessionRecord | null => {
    ensureDataDirExists();
    
    // Load sessions
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE_PATH, 'utf-8')) as SessionRecord[];
    
    // Find session
    const sessionIndex = sessions.findIndex(s => s.roomName === roomName);
    if (sessionIndex === -1) return null;
    
    // Update session
    sessions[sessionIndex].endTime = new Date().toISOString();
    sessions[sessionIndex].totalDuration = totalDuration;
    
    // Save updated sessions
    fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(sessions, null, 2));
    
    return sessions[sessionIndex];
  },
  
  /**
   * Get all sessions for a reader
   * 
   * @param readerId The ID of the reader
   * @returns Array of session records
   */
  getReaderSessions: (readerId: number): SessionRecord[] => {
    ensureDataDirExists();
    
    // Load sessions
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE_PATH, 'utf-8')) as SessionRecord[];
    
    // Filter by reader ID
    return sessions.filter(s => s.readerId === readerId);
  },
  
  /**
   * Get all sessions for a client
   * 
   * @param clientId The ID of the client
   * @returns Array of session records
   */
  getClientSessions: (clientId: number): SessionRecord[] => {
    ensureDataDirExists();
    
    // Load sessions
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE_PATH, 'utf-8')) as SessionRecord[];
    
    // Filter by client ID
    return sessions.filter(s => s.clientId === clientId);
  },
  
  /**
   * Add earnings to a reader's balance from a session
   * 
   * @param readerId The ID of the reader
   * @param amount The amount to add (in USD)
   * @returns True if successful
   */
  addReaderEarnings: async (readerId: number, amount: number): Promise<boolean> => {
    try {
      // Import reader balance service
      const { readerBalanceService } = await import('./reader-balance-service');
      
      // Get reader sessions to find name
      const readerSessions = sessionService.getReaderSessions(readerId);
      const readerName = readerSessions.length > 0 ? readerSessions[0].readerName : 'Unknown Reader';
      
      // Add to balance
      readerBalanceService.addReaderEarnings(readerId, readerName, amount * 100); // Convert to cents
      return true;
    } catch (error) {
      console.error('Error adding reader earnings:', error);
      return false;
    }
  },
  
  /**
   * Update a session with new information
   * 
   * @param roomName The name of the room
   * @param updates The updates to apply
   * @returns The updated session record
   */
  updateSession: (
    roomName: string,
    updates: {
      status?: 'scheduled' | 'waiting_payment' | 'payment_completed' | 'in_progress' | 'completed' | 'cancelled';
      duration?: number;
      price?: number;
      completedAt?: Date;
      type?: 'chat' | 'voice' | 'video';
    }
  ): SessionRecord | null => {
    ensureDataDirExists();
    
    // Load sessions
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE_PATH, 'utf-8')) as SessionRecord[];
    
    // Find session
    const sessionIndex = sessions.findIndex(s => s.roomName === roomName);
    if (sessionIndex === -1) return null;
    
    // Apply updates
    if (updates.status) {
      sessions[sessionIndex].status = updates.status;
    }
    
    if (updates.duration) {
      sessions[sessionIndex].duration = updates.duration;
      sessions[sessionIndex].totalDuration = updates.duration;
    }
    
    if (updates.price) {
      sessions[sessionIndex].price = updates.price;
      sessions[sessionIndex].totalAmount = updates.price * 100; // Convert to cents for internal storage
    }
    
    if (updates.completedAt) {
      sessions[sessionIndex].completedAt = updates.completedAt.toISOString();
      sessions[sessionIndex].endTime = updates.completedAt.toISOString();
    }
    
    if (updates.type) {
      sessions[sessionIndex].type = updates.type;
      sessions[sessionIndex].readingType = updates.type;
    }
    
    // Save updated sessions
    fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(sessions, null, 2));
    
    return sessions[sessionIndex];
  }
};