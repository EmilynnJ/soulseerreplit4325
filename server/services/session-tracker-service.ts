import { InsertSessionLog, SessionLog } from "@shared/schema";
import { storage } from "../storage";
import { User } from "@shared/schema";
import stripeClient, { stripe } from "./stripe-client";

/**
 * SessionTrackerService
 * Tracks active reading sessions and handles billing
 */
class SessionTrackerService {
  private activeSessions: Map<string, {
    readerId: number;
    clientId: number;
    startTime: Date;
    lastBillingTime: Date;
    sessionType: "video" | "voice" | "chat";
    status: "waiting" | "connected" | "ended";
    paymentIntentId?: string;
    paymentMethodId?: string;
    ratePerMinute: number;
    billingIntervalMs: number; // how often to bill the client (in ms)
    sessionLogId?: number;
  }>;

  private sessionTimeouts: Map<string, NodeJS.Timeout>;

  constructor() {
    this.activeSessions = new Map();
    this.sessionTimeouts = new Map();
  }

  /**
   * Create a new reading session
   */
  async createSession(
    roomId: string,
    readerId: number,
    clientId: number,
    sessionType: "video" | "voice" | "chat",
    paymentMethodId: string
  ): Promise<SessionLog> {
    // Get reader information to determine rate
    const reader = await storage.getUser(readerId);
    if (!reader) {
      throw new Error("Reader not found");
    }

    // Get client information
    const client = await storage.getUser(clientId);
    if (!client) {
      throw new Error("Client not found");
    }

    // Make sure reader has a rate set
    if (!reader.ratePerMinute) {
      throw new Error("Reader does not have a rate configured");
    }

    const startTime = new Date();

    // Create initial session log
    const sessionLog: InsertSessionLog = {
      roomId,
      readerId,
      clientId,
      sessionType,
      startTime,
      status: "waiting", // Initially waiting until both join
    };

    const createdLog = await storage.createSessionLog(sessionLog);

    // Create payment intent for authorization
    const authorizationAmount = Number(reader.ratePerMinute) * 5; // 5 minutes upfront
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(authorizationAmount * 100), // convert to cents
      currency: "usd",
      customer: client.stripeCustomerId!, // assuming client has a Stripe customer ID
      payment_method: paymentMethodId,
      description: `SoulSeer ${sessionType} reading with ${reader.fullName}`,
      confirm: true,
      capture_method: "manual", // just authorize, we'll capture later
      metadata: {
        roomId,
        readerId: readerId.toString(),
        clientId: clientId.toString(),
        sessionType
      }
    });

    // Store session information
    this.activeSessions.set(roomId, {
      readerId,
      clientId,
      startTime,
      lastBillingTime: startTime,
      sessionType,
      status: "waiting",
      paymentIntentId: paymentIntent.id,
      paymentMethodId,
      ratePerMinute: Number(reader.ratePerMinute),
      billingIntervalMs: 1000 * 60 * 5, // bill every 5 minutes
      sessionLogId: createdLog.id
    });

    return createdLog;
  }

  /**
   * Mark session as connected (both parties joined)
   */
  async sessionConnected(roomId: string): Promise<void> {
    const session = this.activeSessions.get(roomId);
    if (!session) {
      throw new Error("Session not found");
    }

    session.status = "connected";
    session.lastBillingTime = new Date(); // Reset billing time to when connection established

    // Update session log
    if (session.sessionLogId) {
      await storage.updateSessionLog(session.sessionLogId, {
        status: "connected"
      });
    }

    // Schedule first billing
    this.scheduleNextBilling(roomId);
  }

  /**
   * Schedule next billing cycle
   */
  private scheduleNextBilling(roomId: string): void {
    const session = this.activeSessions.get(roomId);
    if (!session || session.status === "ended") return;

    // Clear any existing timeout
    const existingTimeout = this.sessionTimeouts.get(roomId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule next billing
    const timeout = setTimeout(async () => {
      await this.processBilling(roomId);
      
      // Schedule next billing if session is still active
      if (this.activeSessions.has(roomId) && this.activeSessions.get(roomId)!.status === "connected") {
        this.scheduleNextBilling(roomId);
      }
    }, session.billingIntervalMs);

    this.sessionTimeouts.set(roomId, timeout);
  }

  /**
   * Process billing for a session
   */
  private async processBilling(roomId: string): Promise<void> {
    const session = this.activeSessions.get(roomId);
    if (!session || session.status !== "connected") return;

    const now = new Date();
    const minutesElapsed = (now.getTime() - session.lastBillingTime.getTime()) / (1000 * 60);
    
    if (minutesElapsed < 1) return; // Don't bill for less than a minute

    // Calculate amount to bill
    const amountToCharge = session.ratePerMinute * minutesElapsed;
    const readerShare = amountToCharge * 0.7; // 70% to reader
    const platformShare = amountToCharge * 0.3; // 30% to platform

    try {
      // Capture payment from the authorized payment intent
      await stripe.paymentIntents.capture(session.paymentIntentId!, {
        amount_to_capture: Math.round(amountToCharge * 100) // convert to cents
      });

      // Update reader balance
      const reader = await storage.getUser(session.readerId);
      if (reader) {
        await storage.updateUser(session.readerId, {
          earnings: (reader.earnings || 0) + readerShare
        });
      }

      // Update session log with billing information
      if (session.sessionLogId) {
        const sessionLog = await storage.getSessionLog(session.sessionLogId);
        if (sessionLog) {
          const totalDuration = Math.round(
            (now.getTime() - session.startTime.getTime()) / (1000 * 60)
          );
          
          const totalAmount = sessionLog.totalAmount 
            ? Number(sessionLog.totalAmount) + amountToCharge 
            : amountToCharge;
            
          const readerEarned = sessionLog.readerEarned 
            ? Number(sessionLog.readerEarned) + readerShare 
            : readerShare;
            
          const platformEarned = sessionLog.platformEarned 
            ? Number(sessionLog.platformEarned) + platformShare 
            : platformShare;

          await storage.updateSessionLog(session.sessionLogId, {
            duration: totalDuration,
            totalAmount,
            readerEarned,
            platformEarned
          });
        }
      }

      // Create a new payment intent for the next interval
      const nextAuthAmount = session.ratePerMinute * 5; // Another 5 minutes
      const nextPaymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(nextAuthAmount * 100), // convert to cents
        currency: "usd",
        customer: (await storage.getUser(session.clientId))?.stripeCustomerId!,
        payment_method: session.paymentMethodId,
        description: `SoulSeer ${session.sessionType} reading continued`,
        confirm: true,
        capture_method: "manual", // just authorize, we'll capture later
        metadata: {
          roomId,
          readerId: session.readerId.toString(),
          clientId: session.clientId.toString(),
          sessionType: session.sessionType
        }
      });

      // Update session with new payment intent
      session.paymentIntentId = nextPaymentIntent.id;
      session.lastBillingTime = now;
      
      console.log(`Billed for session ${roomId}: $${amountToCharge.toFixed(2)} for ${minutesElapsed.toFixed(1)} minutes`);
    } catch (error) {
      console.error(`Failed to process billing for session ${roomId}:`, error);
      // End session on payment failure
      this.endSession(roomId, "payment_failed");
    }
  }

  /**
   * End a reading session
   */
  async endSession(roomId: string, reason: string = "completed"): Promise<SessionLog | undefined> {
    const session = this.activeSessions.get(roomId);
    if (!session) return undefined;

    // Process final billing
    if (session.status === "connected") {
      await this.processBilling(roomId);
    }

    // Cancel any pending timeouts
    const timeout = this.sessionTimeouts.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(roomId);
    }

    // Mark session as ended
    session.status = "ended";

    // Update session log
    let finalLog: SessionLog | undefined;
    if (session.sessionLogId) {
      const now = new Date();
      const totalDuration = Math.round(
        (now.getTime() - session.startTime.getTime()) / (1000 * 60)
      );

      finalLog = await storage.updateSessionLog(session.sessionLogId, {
        status: "ended",
        endTime: now,
        duration: totalDuration,
        endReason: reason
      });
    }

    // Remove from active sessions
    this.activeSessions.delete(roomId);

    return finalLog;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): { roomId: string, session: any }[] {
    const sessions: { roomId: string, session: any }[] = [];
    
    for (const [roomId, session] of this.activeSessions.entries()) {
      sessions.push({
        roomId,
        session: {
          ...session,
          // Don't include sensitive payment information
          paymentIntentId: undefined,
          paymentMethodId: undefined
        }
      });
    }
    
    return sessions;
  }

  /**
   * Get details of a specific session
   */
  getSessionDetails(roomId: string): any | undefined {
    const session = this.activeSessions.get(roomId);
    if (!session) return undefined;
    
    return {
      ...session,
      // Don't include sensitive payment information
      paymentIntentId: undefined, 
      paymentMethodId: undefined
    };
  }

  /**
   * Check if a session exists and is active
   */
  isSessionActive(roomId: string): boolean {
    const session = this.activeSessions.get(roomId);
    return !!session && session.status === "connected";
  }

  /**
   * Get all sessions for a reader
   */
  async getReaderSessions(readerId: number): Promise<SessionLog[]> {
    return await storage.getSessionLogsByReader(readerId);
  }

  /**
   * Get all sessions for a client
   */
  async getClientSessions(clientId: number): Promise<SessionLog[]> {
    return await storage.getSessionLogsByClient(clientId);
  }
}

export const sessionTrackerService = new SessionTrackerService();