/**
 * LiveKit service for video/audio streaming
 * 
 * This service handles integration with the LiveKit platform for:
 * - Real-time video/audio calls for readings
 * - Livestream functionality
 */

import { AccessToken } from 'livekit-server-sdk';
import { User, Livestream } from '@shared/schema';
import { storage } from '../storage';

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
    streamerName: string,
    useReaderRoom: boolean = false
  ) => {
    // Create a room ID - either based on stream ID or reader ID
    const roomId = useReaderRoom 
      ? `livestream-${streamerId}` // Reader-specific room format
      : `livestream_${streamId}`;  // Stream-specific room format
    
    console.log(`Creating livestream token for room: ${roomId}`);
    
    // Generate token
    return livekitService.generateToken(streamerId, roomId, streamerName);
  },

  /**
   * Generate token for joining a reader's livestream room
   * 
   * @param userId The ID of the viewer
   * @param readerId The ID of the reader hosting the stream
   * @param userName The name of the viewer
   * @returns The generated token string
   */
  generateReaderLivestreamToken: (
    userId: number,
    readerId: number,
    userName: string
  ) => {
    // Create the reader-specific room ID
    const roomId = `livestream-${readerId}`;
    
    console.log(`Creating viewer token for reader livestream room: ${roomId}`);
    
    // Generate token
    return livekitService.generateToken(userId, roomId, userName);
  },
  
  /**
   * Start a livestream
   * 
   * @param livestreamId The ID of the livestream to start
   * @param useReaderRoom Whether to use reader-specific room format
   * @returns The updated livestream
   */
  startLivestream: async (
    livestreamId: number,
    useReaderRoom: boolean = false
  ): Promise<Livestream | undefined> => {
    try {
      // Get the livestream
      const livestream = await storage.getLivestream(livestreamId);
      if (!livestream) {
        console.error(`Livestream ${livestreamId} not found`);
        return undefined;
      }
      
      // Get the user who created the livestream
      const user = await storage.getUser(livestream.userId);
      if (!user) {
        console.error(`User ${livestream.userId} not found`);
        return undefined;
      }
      
      // Create a room name - either based on livestream ID or reader ID
      const roomName = useReaderRoom 
        ? `livestream-${user.id}` // Reader-specific room format
        : `livestream_${livestreamId}`; // Livestream ID format
        
      console.log(`Starting livestream ${livestreamId} with room name ${roomName}`);
      
      // Update the livestream record
      const updatedLivestream = await storage.updateLivestream(livestreamId, {
        status: 'live',
        startedAt: new Date(),
        livekitRoomName: roomName
      });
      
      return updatedLivestream;
    } catch (error) {
      console.error(`Error starting livestream ${livestreamId}:`, error);
      return undefined;
    }
  },
  
  /**
   * End a livestream
   * 
   * @param livestreamId The ID of the livestream to end
   * @returns The updated livestream
   */
  endLivestream: async (
    livestreamId: number
  ): Promise<Livestream | undefined> => {
    try {
      // Get the livestream
      const livestream = await storage.getLivestream(livestreamId);
      if (!livestream) {
        console.error(`Livestream ${livestreamId} not found`);
        return undefined;
      }
      
      // Calculate duration in seconds (if possible)
      let duration = undefined;
      if (livestream.startedAt) {
        const endTime = new Date();
        const startTime = new Date(livestream.startedAt);
        duration = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
      }
      
      // Update the livestream record
      const updatedLivestream = await storage.updateLivestream(livestreamId, {
        status: 'ended',
        endedAt: new Date(),
        duration
      });
      
      console.log(`Ended livestream ${livestreamId} with duration ${duration} seconds`);
      
      return updatedLivestream;
    } catch (error) {
      console.error(`Error ending livestream ${livestreamId}:`, error);
      return undefined;
    }
  }
};