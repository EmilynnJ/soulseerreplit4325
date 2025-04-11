import { db, sql } from '../db';

// Gift types
export type GiftType = 'coins' | 'rose' | 'heart' | 'star' | 'diamond' | 'crown';

// Gift interface
export interface Gift {
  id?: number;
  senderId: number;
  recipientId: number;
  livestreamId: number;
  amount: number;
  giftType: GiftType;
  message?: string;
  readerAmount?: number;
  platformAmount?: number;
  processed?: boolean;
  processedAt?: Date;
  createdAt?: Date;
}

// Service for handling gifts during livestreams
export class GiftService {
  private static instance: GiftService;
  
  // Revenue split percentages
  private readerSharePercentage: number = 70; // 70% to reader
  private platformSharePercentage: number = 30; // 30% to platform
  
  // Socket.io server for real-time updates
  private io: any = null;
  
  // Gift values in platform currency
  private giftValues: Record<GiftType, number> = {
    'coins': 1,
    'rose': 5,
    'heart': 10,
    'star': 20,
    'diamond': 50,
    'crown': 100
  };
  
  private constructor() {
    console.log('GiftService initialized');
  }
  
  /**
   * Set the Socket.IO server for real-time gift notifications
   */
  public setSocketServer(io: any): void {
    this.io = io;
    console.log('Socket.IO server set for gift service');
  }
  
  public static getInstance(): GiftService {
    if (!GiftService.instance) {
      GiftService.instance = new GiftService();
    }
    return GiftService.instance;
  }
  
  /**
   * Get the currency value of a gift type
   */
  public getGiftValue(giftType: GiftType): number {
    return this.giftValues[giftType] || 0;
  }
  
  /**
   * Send a gift during a livestream
   */
  public async sendGift(
    senderId: number,
    recipientId: number,
    livestreamId: number,
    giftType: GiftType,
    message?: string
  ): Promise<Gift | null> {
    try {
      // Get the value of the gift
      const giftValue = this.getGiftValue(giftType);
      
      // Check if sender has enough balance
      const senderResult = await db.execute(sql`
        SELECT balance FROM users WHERE id = ${senderId}
      `);
      
      if (!senderResult || !senderResult.rows || senderResult.rows.length === 0) {
        console.error(`Sender not found: ${senderId}`);
        return null;
      }
      
      const senderBalance = parseFloat(senderResult.rows[0].balance);
      
      if (senderBalance < giftValue) {
        console.error(`Insufficient balance for gift. Required: ${giftValue}, Available: ${senderBalance}`);
        return null;
      }
      
      // Calculate shares
      const readerAmount = parseFloat((giftValue * (this.readerSharePercentage / 100)).toFixed(2));
      const platformAmount = parseFloat((giftValue * (this.platformSharePercentage / 100)).toFixed(2));
      
      // Create a new gift record
      const gift: Gift = {
        senderId,
        recipientId,
        livestreamId,
        amount: giftValue,
        giftType,
        message,
        readerAmount,
        platformAmount,
        processed: false,
        createdAt: new Date()
      };
      
      // Insert into database
      const result = await db.execute(sql`
        INSERT INTO gifts (
          sender_id, recipient_id, livestream_id, amount, gift_type, 
          message, reader_amount, platform_amount, processed, created_at
        ) VALUES (
          ${gift.senderId}, ${gift.recipientId}, ${gift.livestreamId}, 
          ${gift.amount}, ${gift.giftType}, ${gift.message || null}, 
          ${gift.readerAmount}, ${gift.platformAmount}, ${gift.processed}, ${gift.createdAt}
        )
        RETURNING id
      `);
      
      if (!result || !result.rows || result.rows.length === 0) {
        console.error('Failed to create gift record');
        return null;
      }
      
      gift.id = result.rows[0].id;
      
      // Deduct from sender's balance
      await db.execute(sql`
        UPDATE users 
        SET balance = balance - ${gift.amount} 
        WHERE id = ${gift.senderId}
      `);
      
      // Create a gift log entry
      await db.execute(sql`
        INSERT INTO gift_logs (
          sender_id, receiver_id, livestream_id, gift_type, amount, timestamp
        ) VALUES (
          ${gift.senderId}, ${gift.recipientId}, ${gift.livestreamId}, 
          ${gift.giftType}, ${gift.amount}, ${gift.createdAt}
        )
      `);
      
      console.log(`Gift sent: ${gift.id} - Type: ${gift.giftType}, Amount: ${gift.amount}`);
      
      // Process the gift immediately (credit to reader)
      await this.processGift(gift.id);
      
      return gift;
    } catch (error) {
      console.error('Error sending gift:', error);
      return null;
    }
  }
  
  /**
   * Process a gift (add to reader's earnings)
   */
  public async processGift(giftId: number): Promise<boolean> {
    try {
      // Get the gift record
      const giftResult = await db.execute(sql`
        SELECT * FROM gifts WHERE id = ${giftId} AND processed = false
      `);
      
      if (!giftResult || !giftResult.rows || giftResult.rows.length === 0) {
        console.error(`Gift not found or already processed: ${giftId}`);
        return false;
      }
      
      const gift = giftResult.rows[0];
      
      // Add to reader's earnings
      await db.execute(sql`
        UPDATE users 
        SET earnings = earnings + ${gift.reader_amount} 
        WHERE id = ${gift.recipient_id}
      `);
      
      // Mark gift as processed
      const now = new Date();
      await db.execute(sql`
        UPDATE gifts 
        SET processed = true, processed_at = ${now} 
        WHERE id = ${giftId}
      `);
      
      console.log(`Gift processed: ${giftId} - Reader earned: ${gift.reader_amount}`);
      return true;
    } catch (error) {
      console.error('Error processing gift:', error);
      return false;
    }
  }
  
  /**
   * Get gifts for a livestream
   */
  public async getLivestreamGifts(livestreamId: number): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT g.*, 
          u_sender.username as sender_username, 
          u_receiver.username as recipient_username
        FROM gifts g
        JOIN users u_sender ON g.sender_id = u_sender.id
        JOIN users u_receiver ON g.recipient_id = u_receiver.id
        WHERE g.livestream_id = ${livestreamId}
        ORDER BY g.created_at DESC
      `);
      
      return result.rows || [];
    } catch (error) {
      console.error('Error fetching livestream gifts:', error);
      return [];
    }
  }
  
  /**
   * Get top gift senders for a livestream
   */
  public async getTopGiftSenders(livestreamId: number, limit: number = 5): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          g.sender_id, 
          u.username as sender_username,
          SUM(g.amount) as total_amount,
          COUNT(*) as gift_count
        FROM gifts g
        JOIN users u ON g.sender_id = u.id
        WHERE g.livestream_id = ${livestreamId}
        GROUP BY g.sender_id, u.username
        ORDER BY total_amount DESC
        LIMIT ${limit}
      `);
      
      return result.rows || [];
    } catch (error) {
      console.error('Error fetching top gift senders:', error);
      return [];
    }
  }
  
  /**
   * Get recent gifts across all livestreams
   */
  public async getRecentGifts(limit: number = 10): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT g.*, 
          u_sender.username as sender_username, 
          u_receiver.username as recipient_username,
          l.title as livestream_title
        FROM gifts g
        JOIN users u_sender ON g.sender_id = u_sender.id
        JOIN users u_receiver ON g.recipient_id = u_receiver.id
        JOIN livestreams l ON g.livestream_id = l.id
        ORDER BY g.created_at DESC
        LIMIT ${limit}
      `);
      
      return result.rows || [];
    } catch (error) {
      console.error('Error fetching recent gifts:', error);
      return [];
    }
  }
  
  /**
   * Get unprocessed gifts for payout
   */
  public async getUnprocessedGifts(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM gifts WHERE processed = false
        ORDER BY created_at ASC
      `);
      
      return result.rows || [];
    } catch (error) {
      console.error('Error fetching unprocessed gifts:', error);
      return [];
    }
  }
  
  /**
   * Process all unprocessed gifts
   */
  public async processAllGifts(): Promise<number> {
    try {
      const unprocessedGifts = await this.getUnprocessedGifts();
      
      let processedCount = 0;
      for (const gift of unprocessedGifts) {
        const success = await this.processGift(gift.id);
        if (success) {
          processedCount++;
        }
      }
      
      console.log(`Processed ${processedCount} gifts`);
      return processedCount;
    } catch (error) {
      console.error('Error processing all gifts:', error);
      return 0;
    }
  }
}

// Export a singleton instance
export const giftService = GiftService.getInstance();