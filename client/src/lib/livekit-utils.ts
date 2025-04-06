/**
 * Video/audio streaming utilities for Zego Cloud
 * 
 * Integration with Zego Cloud for video/audio sessions
 */

/**
 * Generate a token for Zego Cloud video/audio sessions
 * 
 * @param userType The type of user ('reader' or 'client')
 * @param userId The ID of the user
 * @param fullName The full name of the user (to display in the UI)
 * @param roomId The ID of the room to join
 * @returns Promise resolving to the token string
 */
export async function generateZegoToken(
  userType: 'reader' | 'client',
  userId: number,
  fullName: string,
  roomId: string
): Promise<string> {
  try {
    console.log('Requesting Zego Cloud token with', { userType, userId, fullName, roomId });
    
    // Calculate role based on user type (1 for publisher, 0 for audience)
    const role = userType === 'reader' ? 1 : 1; // For now, give everyone publishing rights

    // Call the Zego Cloud token endpoint
    const response = await fetch('/api/zego/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        roomId,
        userName: fullName,
        role
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate Zego Cloud token');
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error generating Zego Cloud token:', error);
    throw error;
  }
}

/**
 * For LiveKit compatibility - calls generateZegoToken instead
 * 
 * @deprecated Use generateZegoToken directly
 */
export async function generateLiveKitToken(
  userType: 'reader' | 'client',
  userId: number,
  fullName: string,
  roomId: string
): Promise<string> {
  console.log('LiveKit replaced with Zego Cloud: redirecting token request');
  return generateZegoToken(userType, userId, fullName, roomId);
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
  console.log('Generating reading token with Zego Cloud', { readerId, clientId, readingId, readerName });
  
  // Create a unique room ID for this reading
  const roomId = `reading_${readingId}`;
  
  // Generate token for the reader
  return generateZegoToken('reader', readerId, readerName, roomId);
}