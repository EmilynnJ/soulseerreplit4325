import { InsertGift, InsertGiftLog, Gift, GiftLog } from "@shared/schema";
import { storage } from "../storage";
import stripeClient, { stripe } from "./stripe-client";

/**
 * GiftService
 * Handles gift/tip functionality in livestreams
 */
class GiftService {
  private io: any;

  /**
   * Set Socket.io server for real-time notifications
   */
  setSocketServer(socketIo: any) {
    this.io = socketIo;
  }
  /**
   * Send a gift/tip in a livestream
   */
  async sendGift(
    senderId: number,
    receiverId: number,
    livestreamId: number,
    amount: number,
    giftType: "applause" | "heart" | "star" | "diamond" | "custom",
    message?: string
  ): Promise<{ gift: Gift, log: GiftLog }> {
    // Get sender information
    const sender = await storage.getUser(senderId);
    if (!sender) {
      throw new Error("Sender not found");
    }

    // Get receiver information
    const receiver = await storage.getUser(receiverId);
    if (!receiver) {
      throw new Error("Receiver not found");
    }

    // Get livestream information
    const livestream = await storage.getLivestream(livestreamId);
    if (!livestream) {
      throw new Error("Livestream not found");
    }

    // Verify the livestream belongs to the receiver
    if (livestream.userId !== receiverId) {
      throw new Error("Receiver is not the owner of this livestream");
    }

    // Make sure the amount is valid
    if (amount <= 0) {
      throw new Error("Gift amount must be greater than 0");
    }

    // Calculate earnings (platform takes 30%)
    const readerAmount = amount * 0.7; // 70% to reader
    const platformAmount = amount * 0.3; // 30% to platform

    // Create the gift in the database
    const giftData: InsertGift = {
      senderId,
      recipientId: receiverId,
      livestreamId,
      amount,
      giftType,
      message: message || null,
      readerAmount,
      platformAmount
    };

    const gift = await storage.createGift(giftData);

    // Create a gift log
    const giftLogData: InsertGiftLog = {
      senderId,
      receiverId,
      livestreamId,
      giftType,
      giftValue: amount,
      receiverEarned: readerAmount,
      platformEarned: platformAmount,
      timestamp: new Date()
    };

    const giftLog = await storage.createGiftLog(giftLogData);

    // Update receiver's earnings
    await storage.updateUser(receiverId, {
      earnings: (receiver.earnings || 0) + readerAmount
    });

    // Return both the gift and log
    return { gift, log: giftLog };
  }

  /**
   * Process payment for a gift/tip
   */
  async processGiftPayment(
    giftId: number,
    paymentMethodId: string
  ): Promise<Gift> {
    const gift = await storage.getGift(giftId);
    if (!gift) {
      throw new Error("Gift not found");
    }

    if (gift.processed) {
      throw new Error("Gift has already been processed");
    }

    // Get sender and recipient info
    const sender = await storage.getUser(gift.senderId);
    if (!sender) {
      throw new Error("Sender not found");
    }

    const recipient = await storage.getUser(gift.recipientId);
    if (!recipient) {
      throw new Error("Recipient not found");
    }

    try {
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(gift.amount * 100), // convert to cents
        currency: "usd",
        customer: sender.stripeCustomerId!, // assuming sender has a Stripe customer ID
        payment_method: paymentMethodId,
        description: `SoulSeer gift: ${gift.giftType} to ${recipient.fullName}`,
        confirm: true,
        metadata: {
          giftId: giftId.toString(),
          giftType: gift.giftType,
          senderId: gift.senderId.toString(),
          recipientId: gift.recipientId.toString(),
          livestreamId: gift.livestreamId?.toString() || "none"
        }
      });

      // Mark gift as processed
      const processedGift = await storage.markGiftAsProcessed(giftId);
      
      return processedGift!;
    } catch (error) {
      console.error("Failed to process gift payment:", error);
      throw new Error("Payment processing failed");
    }
  }

  /**
   * Get all gifts for a livestream
   */
  async getGiftsForLivestream(livestreamId: number): Promise<Gift[]> {
    return await storage.getGiftsByLivestream(livestreamId);
  }

  /**
   * Get all gifts sent by a user
   */
  async getGiftsSentByUser(userId: number): Promise<Gift[]> {
    return await storage.getGiftsBySender(userId);
  }

  /**
   * Get all gifts received by a user
   */
  async getGiftsReceivedByUser(userId: number): Promise<Gift[]> {
    return await storage.getGiftsByRecipient(userId);
  }

  /**
   * Get gift logs for a livestream
   */
  async getGiftLogsForLivestream(livestreamId: number): Promise<GiftLog[]> {
    return await storage.getGiftLogsByLivestream(livestreamId);
  }

  /**
   * Get total value of gifts for a livestream
   */
  async getTotalGiftValueForLivestream(livestreamId: number): Promise<number> {
    const gifts = await storage.getGiftsByLivestream(livestreamId);
    return gifts.reduce((total, gift) => total + gift.amount, 0);
  }

  /**
   * Process unprocessed gifts (called by a background job)
   */
  async processUnprocessedGifts(): Promise<number> {
    const unprocessedGifts = await storage.getUnprocessedGifts();
    let processedCount = 0;

    for (const gift of unprocessedGifts) {
      try {
        await storage.markGiftAsProcessed(gift.id);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process gift ID ${gift.id}:`, error);
      }
    }

    return processedCount;
  }
}

export const giftService = new GiftService();