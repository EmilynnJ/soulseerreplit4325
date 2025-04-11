/**
 * ZEGO Cloud WebRTC Service
 * This service handles WebRTC functionality for different types of readings:
 * - Video calls
 * - Voice calls
 * - Chat sessions
 * - Livestreaming
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Service types
export type ServiceType = 'video' | 'voice' | 'chat' | 'live';

// Room creation options
export interface RoomOptions {
  roomId: string;
  userId: string;
  userName: string;
  role?: 'host' | 'participant';
}

// Room information
export interface RoomInfo {
  roomId: string;
  token: string;
  userId: string;
}

/**
 * ZEGO service for WebRTC functionality
 */
export class ZegoService {
  private static instance: ZegoService;
  
  // App IDs and server secrets for each service type
  private VIDEO_APP_ID: number;
  private VIDEO_SERVER_SECRET: string;
  
  private VOICE_APP_ID: number;
  private VOICE_SERVER_SECRET: string;
  
  private CHAT_APP_ID: number;
  private CHAT_SERVER_SECRET: string;
  
  private LIVE_APP_ID: number;
  private LIVE_SERVER_SECRET: string;
  
  private environment: 'production' | 'test';
  
  private constructor() {
    // Initialize from environment variables
    this.VIDEO_APP_ID = parseInt(process.env.VITE_ZEGO_VIDEO_APP_ID || '0');
    this.VIDEO_SERVER_SECRET = process.env.VITE_ZEGO_VIDEO_SERVER_SECRET || '';
    
    this.VOICE_APP_ID = parseInt(process.env.VITE_ZEGO_PHONE_APP_ID || '0');
    this.VOICE_SERVER_SECRET = process.env.VITE_ZEGO_PHONE_SERVER_SECRET || '';
    
    this.CHAT_APP_ID = parseInt(process.env.VITE_ZEGO_CHAT_APP_ID || '0');
    this.CHAT_SERVER_SECRET = process.env.VITE_ZEGO_CHAT_SERVER_SECRET || '';
    
    this.LIVE_APP_ID = parseInt(process.env.VITE_ZEGO_LIVE_APP_ID || '0');
    this.LIVE_SERVER_SECRET = process.env.VITE_ZEGO_LIVE_SERVER_SECRET || '';
    
    this.environment = process.env.NODE_ENV === 'production' ? 'production' : 'test';
    
    console.log('ZegoService initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): ZegoService {
    if (!ZegoService.instance) {
      ZegoService.instance = new ZegoService();
    }
    return ZegoService.instance;
  }
  
  /**
   * Generate a ZEGO token for the specified service type
   */
  public generateToken(userId: string, roomId: string, serviceType: ServiceType): string {
    try {
      let appId: number;
      let serverSecret: string;
      
      // Get the appropriate credentials based on service type
      switch (serviceType) {
        case 'video':
          appId = this.VIDEO_APP_ID;
          serverSecret = this.VIDEO_SERVER_SECRET;
          break;
        case 'voice':
          appId = this.VOICE_APP_ID;
          serverSecret = this.VOICE_SERVER_SECRET;
          break;
        case 'chat':
          appId = this.CHAT_APP_ID;
          serverSecret = this.CHAT_SERVER_SECRET;
          break;
        case 'live':
          appId = this.LIVE_APP_ID;
          serverSecret = this.LIVE_SERVER_SECRET;
          break;
        default:
          throw new Error(`Invalid service type: ${serviceType}`);
      }
      
      if (!appId || !serverSecret) {
        throw new Error(`Missing credentials for service type: ${serviceType}`);
      }
      
      // Generate a token with 24-hour validity
      const effectiveTimeInSeconds = 24 * 60 * 60; // 24 hours
      const payload = {
        app_id: appId,
        user_id: userId,
        room_id: roomId,
        privilege: {
          1: 1, // Login room
          2: 1  // Publish stream
        },
        stream_id_list: null
      };
      
      // Current timestamp in seconds
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const nonce = Math.floor(Math.random() * 2147483647);
      
      // Create signature string
      const plaintext = JSON.stringify(payload);
      const signatureString = appId + serverSecret + plaintext + currentTimestamp + nonce;
      
      // Generate HMAC-SHA256 signature
      const signature = crypto.createHmac('sha256', serverSecret)
        .update(signatureString)
        .digest('hex');
      
      // Construct the token
      const tokenInfo = {
        ver: 1,
        expire_time: currentTimestamp + effectiveTimeInSeconds,
        nonce,
        app_id: appId,
        payload: plaintext,
        hash: signature
      };
      
      const token = Buffer.from(JSON.stringify(tokenInfo)).toString('base64');
      return token;
    } catch (error) {
      console.error('Error generating ZEGO token:', error);
      throw error;
    }
  }
  
  /**
   * Generate a token for video sessions
   */
  public generateVideoToken(userId: string, roomId: string): string {
    return this.generateToken(userId, roomId, 'video');
  }
  
  /**
   * Generate a token for voice sessions
   */
  public generateVoiceToken(userId: string, roomId: string): string {
    return this.generateToken(userId, roomId, 'voice');
  }
  
  /**
   * Generate a token for chat sessions
   */
  public generateChatToken(userId: string, roomId: string): string {
    return this.generateToken(userId, roomId, 'chat');
  }
  
  /**
   * Generate a token for livestreaming
   */
  public generateLiveToken(userId: string, roomId: string): string {
    return this.generateToken(userId, roomId, 'live');
  }
  
  /**
   * Create a room for a specific service
   */
  public createRoom(options: RoomOptions): RoomInfo {
    const { roomId, userId, userName, role = 'host' } = options;
    
    // For now, all rooms are considered video rooms
    // This could be extended to handle different room types
    const token = this.generateVideoToken(userId, roomId);
    
    return {
      roomId,
      token,
      userId
    };
  }
  
  /**
   * Join an existing room
   */
  public joinRoom(options: RoomOptions): RoomInfo {
    const { roomId, userId, userName } = options;
    
    // Generate token for joining the room
    const token = this.generateVideoToken(userId, roomId);
    
    return {
      roomId,
      token,
      userId
    };
  }
  
  /**
   * Generate a random room ID
   */
  public generateRoomId(prefix: string = 'room'): string {
    return `${prefix}_${uuidv4().replace(/-/g, '')}`;
  }
}

// Export singleton instance
export const zegoService = ZegoService.getInstance();