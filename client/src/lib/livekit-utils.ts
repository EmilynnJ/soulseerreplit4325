/**
 * LiveKit utilities for token generation and room access
 */

import env from '@/lib/env';

/**
 * Generate a LiveKit room token for a user
 * @param userType The type of user ('reader' or 'client')
 * @param userId The ID of the user
 * @param fullName The full name of the user (to display in the UI)
 * @param roomId The ID of the room to join
 * @returns Promise resolving to the token string
 */
export async function generateLiveKitToken(
  userType: 'reader' | 'client',
  userId: number,
  fullName: string,
  roomId: string
): Promise<string> {
  try {
    const response = await fetch('/api/generate-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userType,
        userId,
        fullName,
        roomId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate token');
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    throw error;
  }
}

/**
 * Generate a token for a reading session
 * @param readerId The ID of the reader
 * @param clientId The ID of the client
 * @param readingId The ID of the reading
 * @returns Promise resolving to the token string
 */
export async function generateReadingToken(
  readerId: number,
  clientId: number,
  readingId: number,
  readerName: string
): Promise<string> {
  // Create a unique room ID for this reading
  const roomId = `reading_${readingId}`;
  
  // For simplicity, we're using 'reader' as the userType here
  // In a real application, this could depend on who is requesting the token
  return generateLiveKitToken('reader', readerId, readerName, roomId);
}