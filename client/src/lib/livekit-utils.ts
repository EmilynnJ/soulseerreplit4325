/**
 * Video/audio streaming utilities
 * 
 * LiveKit functionality has been removed and will be replaced with Zego Cloud
 */

/**
 * Generate a token for video/audio sessions
 * 
 * This is a placeholder function that will be replaced with Zego Cloud implementation
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
    console.log('LiveKit removed: generateLiveKitToken called with', { userType, userId, fullName, roomId });
    
    // Call the placeholder endpoint
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
    console.error('Error generating token:', error);
    throw error;
  }
}

/**
 * Generate a token for a reading session
 * 
 * This is a placeholder function that will be replaced with Zego Cloud implementation
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
  console.log('LiveKit removed: generateReadingToken called with', { readerId, clientId, readingId, readerName });
  
  // Create a unique room ID for this reading
  const roomId = `reading_${readingId}`;
  
  // For simplicity, we're using 'reader' as the userType here
  // In a real application, this could depend on who is requesting the token
  return generateLiveKitToken('reader', readerId, readerName, roomId);
}