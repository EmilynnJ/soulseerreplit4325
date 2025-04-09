import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import { sessionTrackerService } from './session-tracker-service';

// ZEGO App credentials - different app IDs for different services
const ZEGO_LIVE_APP_ID = process.env.VITE_ZEGO_LIVE_APP_ID;
const ZEGO_LIVE_SERVER_SECRET = process.env.VITE_ZEGO_LIVE_SERVER_SECRET;

const ZEGO_VIDEO_APP_ID = process.env.VITE_ZEGO_VIDEO_APP_ID;
const ZEGO_VIDEO_SERVER_SECRET = process.env.VITE_ZEGO_VIDEO_SERVER_SECRET;

const ZEGO_PHONE_APP_ID = process.env.VITE_ZEGO_PHONE_APP_ID;
const ZEGO_PHONE_SERVER_SECRET = process.env.VITE_ZEGO_PHONE_SERVER_SECRET;

const ZEGO_CHAT_APP_ID = process.env.VITE_ZEGO_CHAT_APP_ID;
const ZEGO_CHAT_SERVER_SECRET = process.env.VITE_ZEGO_CHAT_SERVER_SECRET;

// Fallback for backward compatibility
const ZEGO_APP_ID = process.env.ZEGO_APP_ID;
const ZEGO_SERVER_SECRET = process.env.ZEGO_SERVER_SECRET;

if (!ZEGO_LIVE_APP_ID || !ZEGO_LIVE_SERVER_SECRET ||
    !ZEGO_VIDEO_APP_ID || !ZEGO_VIDEO_SERVER_SECRET ||
    !ZEGO_PHONE_APP_ID || !ZEGO_PHONE_SERVER_SECRET ||
    !ZEGO_CHAT_APP_ID || !ZEGO_CHAT_SERVER_SECRET) {
  console.warn('One or more ZEGO service credentials not configured in environment variables!');
}

/**
 * Service for managing ZEGO video/voice sessions and livestreams
 */
class ZegoService {
  /**
   * Create a new reading session room
   */
  async createSession(
    readerId: number,
    clientId: number,
    sessionType: 'video' | 'voice' | 'chat',
    paymentMethodId: string
  ) {
    // Generate a unique room ID
    const roomId = `reading_${uuidv4()}`;

    // Create the session in the session tracker service
    const sessionLog = await sessionTrackerService.createSession(
      roomId,
      readerId,
      clientId,
      sessionType,
      paymentMethodId
    );

    // Generate tokens for reader and client using the appropriate service type
    const tokens = this.generateSessionTokens(roomId, readerId, clientId, sessionType);

    return {
      roomId,
      readerToken: tokens.readerToken,
      clientToken: tokens.clientToken,
      sessionId: sessionLog.id
    };
  }

  /**
   * Generate client tokens for a session
   */
  generateSessionTokens(roomId: string, readerId: number, clientId: number, sessionType: 'video' | 'voice' | 'chat' = 'video') {
    // Generate unique user IDs for ZEGO
    const zegoReaderUserId = `reader_${readerId}`;
    const zegoClientUserId = `client_${clientId}`;

    // Map session type to service type
    const serviceType = sessionType === 'voice' ? 'voice' : 
                        sessionType === 'chat' ? 'chat' : 'video';

    // Get user information for display names
    const readerToken = this.generateToken(
      zegoReaderUserId,
      roomId,
      1800, // 30 minutes
      15, // full privileges
      serviceType
    );

    const clientToken = this.generateToken(
      zegoClientUserId,
      roomId,
      1800, // 30 minutes
      15, // full privileges
      serviceType
    );

    return {
      readerToken,
      clientToken
    };
  }

  /**
   * Generate a token for livestreaming
   */
  generateLivestreamToken(userId: number, roomId: string, isHost: boolean = false) {
    const zegoUserId = `user_${userId}`;
    const privileges = isHost ? 15 : 1; // Full privileges for host, view-only for audience
    
    return this.generateToken(
      zegoUserId,
      roomId,
      7200, // 2 hours validity
      privileges,
      'live' // Use the live streaming service type
    );
  }

  /**
   * Generate a ZEGO token for authentication
   */
  private generateToken(
    userId: string,
    roomId: string,
    effectiveTimeInSeconds: number,
    privilege: number = 15, // Default to full privileges (1: LoginRoom, 2: PublishStream, 4: WebRTCPlay, 8: WebRTCPublish)
    serviceType: 'video' | 'voice' | 'chat' | 'live' = 'video'
  ): string {
    // Select the appropriate credentials based on service type
    let appId: string | undefined;
    let serverSecret: string | undefined;
    
    switch (serviceType) {
      case 'video':
        appId = ZEGO_VIDEO_APP_ID;
        serverSecret = ZEGO_VIDEO_SERVER_SECRET;
        break;
      case 'voice':
        appId = ZEGO_PHONE_APP_ID;
        serverSecret = ZEGO_PHONE_SERVER_SECRET;
        break;
      case 'chat':
        appId = ZEGO_CHAT_APP_ID;
        serverSecret = ZEGO_CHAT_SERVER_SECRET;
        break;
      case 'live':
        appId = ZEGO_LIVE_APP_ID;
        serverSecret = ZEGO_LIVE_SERVER_SECRET;
        break;
      default:
        // Fallback to general credentials
        appId = ZEGO_APP_ID;
        serverSecret = ZEGO_SERVER_SECRET;
    }

    if (!appId || !serverSecret) {
      throw new Error(`ZEGO credentials for ${serviceType} service not configured`);
    }

    // Current timestamp in seconds
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Token expiration time
    const expire = timestamp + effectiveTimeInSeconds;
    
    // Random nonce
    const nonce = Math.floor(Math.random() * 2147483647);
    
    // Payload to sign
    const payload = {
      app_id: parseInt(appId, 10),
      user_id: userId,
      nonce,
      ctime: timestamp,
      expire,
      room_id: roomId,
      privilege: { 1: privilege, 2: privilege }
    };
    
    // Convert payload to string
    const payloadString = JSON.stringify(payload);
    
    // Create signature (HMAC-SHA256)
    const hmac = crypto.createHmac('sha256', serverSecret);
    hmac.update(payloadString);
    const signature = hmac.digest('base64');
    
    // Create final token (version.base64Encode(signature + payload))
    const version = '04';
    const signatureAndPayload = Buffer.concat([
      Buffer.from(signature),
      Buffer.from(payloadString)
    ]);
    const token = version + Buffer.from(signatureAndPayload).toString('base64');
    
    return token;
  }

  /**
   * Start a livestream session 
   */
  async startLivestream(
    hostId: number,
    title: string,
    description: string,
    category: string,
    thumbnailUrl?: string
  ) {
    // Validate host
    const host = await storage.getUser(hostId);
    if (!host) {
      throw new Error('Host user not found');
    }
    
    if (host.role !== 'reader') {
      throw new Error('Only readers can start livestreams');
    }
    
    // Generate room ID
    const roomId = `live_${uuidv4()}`;
    
    // Create the livestream in database
    const livestream = await storage.createLivestream({
      userId: hostId,
      title,
      description,
      category,
      thumbnailUrl: thumbnailUrl || null,
      status: 'created',
      roomId
    });
    
    // Generate token for the host
    const hostToken = this.generateLivestreamToken(hostId, roomId, true);
    
    // Update livestream with started status
    await storage.updateLivestream(livestream.id, {
      status: 'live',
      startedAt: new Date()
    });
    
    return {
      livestreamId: livestream.id,
      roomId,
      hostToken
    };
  }

  /**
   * Update livestream status
   */
  async updateLivestreamStatus(livestreamId: number, status: 'created' | 'live' | 'ended') {
    const livestream = await storage.getLivestream(livestreamId);
    if (!livestream) {
      throw new Error('Livestream not found');
    }
    
    const updates: any = { status };
    
    if (status === 'live' && !livestream.startedAt) {
      updates.startedAt = new Date();
    } else if (status === 'ended' && !livestream.endedAt) {
      updates.endedAt = new Date();
      
      // Calculate duration if possible
      if (livestream.startedAt) {
        const durationMs = Date.now() - livestream.startedAt.getTime();
        updates.duration = Math.floor(durationMs / 1000 / 60); // Duration in minutes
      }
    }
    
    return await storage.updateLivestream(livestreamId, updates);
  }

  /**
   * Join a livestream as a viewer
   */
  async joinLivestream(userId: number, livestreamId: number) {
    // Validate user
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Get livestream
    const livestream = await storage.getLivestream(livestreamId);
    if (!livestream) {
      throw new Error('Livestream not found');
    }
    
    if (livestream.status !== 'live') {
      throw new Error('Livestream is not currently live');
    }
    
    if (!livestream.roomId) {
      throw new Error('Livestream has no room ID');
    }
    
    // Generate token for the viewer
    const viewerToken = this.generateLivestreamToken(userId, livestream.roomId, false);
    
    // Increment viewer count
    await storage.updateLivestream(livestreamId, {
      viewerCount: (livestream.viewerCount || 0) + 1
    });
    
    return {
      roomId: livestream.roomId,
      hostId: livestream.userId,
      viewerToken
    };
  }

  /**
   * Send a tip to a livestream host
   */
  async sendTip(
    senderId: number,
    livestreamId: number,
    amount: number,
    giftType: 'applause' | 'heart' | 'star' | 'diamond' | 'custom',
    message?: string
  ) {
    // Get the livestream
    const livestream = await storage.getLivestream(livestreamId);
    if (!livestream) {
      throw new Error('Livestream not found');
    }
    
    if (livestream.status !== 'live') {
      throw new Error('Livestream is not currently live');
    }
    
    // Calculate earnings (platform takes 30%)
    const readerAmount = amount * 0.7; // 70% to reader
    const platformAmount = amount * 0.3; // 30% to platform

    // Create a gift through the existing gift system
    const giftData = {
      senderId,
      recipientId: livestream.userId,
      livestreamId,
      amount,
      giftType,
      message: message || null,
      readerAmount,
      platformAmount
    };
    
    return await storage.createGift(giftData);
  }
}

export const zegoService = new ZegoService();