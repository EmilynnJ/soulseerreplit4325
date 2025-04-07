/**
 * API utilities for interacting with the reading session services
 */

import { apiRequest } from './queryClient';

/**
 * Start a new reading session between a client and reader
 * 
 * @param clientId - The ID of the client
 * @param readerId - The ID of the reader
 * @param readingType - The type of reading (chat, voice, video)
 * @returns Response with room information and tokens
 */
export async function startReading(
  clientId: number, 
  readerId: number, 
  readingType: 'chat' | 'voice' | 'video'
) {
  try {
    // Use type-specific endpoint
    const endpoint = `/start-reading/${readingType}`;
    
    const response = await apiRequest('POST', endpoint, {
      clientId,
      readerId
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to start reading session');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error starting reading session:', error);
    throw error;
  }
}

/**
 * Start a video reading session
 */
export async function startVideoReading(clientId: number, readerId: number) {
  return startReading(clientId, readerId, 'video');
}

/**
 * Start a voice reading session
 */
export async function startVoiceReading(clientId: number, readerId: number) {
  return startReading(clientId, readerId, 'voice');
}

/**
 * Start a chat reading session
 */
export async function startChatReading(clientId: number, readerId: number) {
  return startReading(clientId, readerId, 'chat');
}

/**
 * Record billing for a reading session
 * 
 * @param roomName - The unique room name
 * @param duration - Duration in minutes
 * @param userId - User ID of the client being billed
 * @param userRole - Role of the user ('client' or 'reader')
 * @returns Billing information
 */
export async function recordBilling(
  roomName: string,
  duration: number,
  userId: number,
  userRole: 'client' | 'reader'
) {
  try {
    const response = await apiRequest('POST', '/api/sessions/billing', {
      roomName,
      duration,
      userId,
      userRole
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to record billing');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error recording billing:', error);
    throw error;
  }
}

/**
 * End a reading session
 * 
 * @param roomName - The unique room name
 * @param totalDuration - Total duration in minutes
 * @param userId - User ID
 * @param userRole - Role of the user ('client' or 'reader')
 * @returns Session end confirmation
 */
export async function endSession(
  roomName: string,
  totalDuration: number,
  userId: number,
  userRole: 'client' | 'reader'
) {
  try {
    const response = await apiRequest('POST', '/api/sessions/end', {
      roomName,
      totalDuration,
      userId,
      userRole
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to end session');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error ending session:', error);
    throw error;
  }
}

/**
 * Health check endpoint to verify server status
 * 
 * @returns Server health status
 */
export async function checkHealth() {
  try {
    const response = await fetch('/health');
    
    if (!response.ok) {
      throw new Error('Server health check failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
}