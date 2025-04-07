/**
 * Video/audio streaming utilities for LiveKit
 * 
 * Integration with LiveKit for video/audio sessions
 */

/**
 * Generate a token for LiveKit video/audio sessions
 * 
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
    console.log('Requesting LiveKit token with', { userType, userId, fullName, roomId });

    // Call the LiveKit token endpoint
    const response = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        roomId,
        userName: fullName
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate LiveKit token');
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
 * 
 * @param readerId The ID of the reader
 * @param clientId The ID of the client
 * @param readingId The ID of the reading
 * @param readerName The name of the reader
 * @returns Promise resolving to the token string
 */
export async function generateReadingToken(
  readerId: number,
  clientId: number,
  readingId: number,
  readerName: string
): Promise<string> {
  console.log('Generating reading token with LiveKit', { readerId, clientId, readingId, readerName });
  
  // Create a unique room ID for this reading
  const roomId = `reading_${readingId}`;
  
  // Generate token for the reader
  return generateLiveKitToken('reader', readerId, readerName, roomId);
}