/**
 * LiveKit service for video/audio streaming
 * 
 * This service handles integration with the LiveKit platform for:
 * - Real-time video/audio calls for readings
 * - Livestream functionality
 */

import { AccessToken } from 'livekit-server-sdk';
import { User } from '@shared/schema';

// Default configuration with environment variable fallbacks
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || '';

/**
 * LiveKit service for handling video/audio streaming functionality
 */
export const livekitService = {
  /**
   * Generate token for LiveKit sessions
   * 
   * @param userId The user ID (should be unique per user)
   * @param roomId The room ID to join
   * @param userName The display name of the user
   * @param expirationSeconds Token validity period in seconds (default: 3600 = 1 hour)
   * @returns The generated token string
   */
  generateToken: (
    userId: string | number,
    roomId: string,
    userName: string,
    expirationSeconds: number = 3600
  ) => {
    try {
      // Convert user ID to string if it's a number
      const userIdStr = userId.toString();
      
      if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        throw new Error('LiveKit API credentials are not configured.');
      }
      
      // Create AccessToken
      const at = new AccessToken(
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET,
        {
          identity: userIdStr,
          name: userName,
          ttl: expirationSeconds
        }
      );
      
      // Add room access permissions
      at.addGrant({ 
        roomJoin: true, 
        room: roomId,
        canPublish: true,
        canSubscribe: true
      });
      
      // Generate and return the token
      const token = at.toJwt();
      console.log('Generated LiveKit token for', { userId: userIdStr, roomId, userName });
      return token;
    } catch (error) {
      console.error('Error generating LiveKit token:', error);
      throw new Error('Failed to generate LiveKit token');
    }
  },
  
  /**
   * Generate token specifically for a reading session
   * 
   * @param readerId The ID of the reader
   * @param clientId The ID of the client
   * @param readingId The ID of the reading
   * @param readerName The name of the reader
   * @param clientName The name of the client
   * @returns The generated token string
   */
  generateReadingToken: (
    readerId: number,
    clientId: number,
    readingId: number,
    readerName: string,
    clientName: string
  ) => {
    // Create a unique room ID for this reading
    const roomId = `reading_${readingId}`;
    
    // Generate token
    return livekitService.generateToken(readerId, roomId, readerName);
  },
  
  /**
   * Generate token for a livestream
   * 
   * @param streamerId The ID of the streamer
   * @param streamId The ID of the stream
   * @param streamerName The name of the streamer
   * @returns The generated token string
   */
  generateLivestreamToken: (
    streamerId: number,
    streamId: string,
    streamerName: string
  ) => {
    // Create a unique room ID for this livestream
    const roomId = `livestream_${streamId}`;
    
    // Generate token
    return livekitService.generateToken(streamerId, roomId, streamerName);
  }
};