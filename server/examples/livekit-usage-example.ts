import { livekitService, SessionType, BillingInfo, Gift } from '../services/livekit-service';

/**
 * Example 1: Setting up a pay-per-minute reading session
 * This demonstrates how to connect a client to a reading session
 * with per-minute billing and automatic time tracking
 */
async function startPayPerMinuteReadingSession(): Promise<void> {
  try {
    // 1. First, create a unique room name for the session
    const readingId = '123456';
    const roomName = `reading-${readingId}`;
    
    // 2. Generate tokens for both participants
    const readerIdentity = 'reader-789';
    const readerName = 'Jane Psychic';
    const readerToken = await livekitService.createToken(roomName, readerIdentity, readerName);
    
    const clientIdentity = 'client-456';
    const clientName = 'John Seeker';
    const clientToken = await livekitService.createToken(roomName, clientIdentity, clientName);
    
    // 3. For the reader: Connect to the room and publish tracks
    const { room, participant } = await livekitService.connect(readerToken);
    
    // 4. Publish audio and video (for reader)
    await livekitService.publishTracks({
      audio: true,
      video: true,
      audioOptions: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      videoOptions: {
        resolution: {
          width: 1280,
          height: 720,
          frameRate: 30
        }
      }
    });
    
    // 5. Set up billing for the session
    const billingInfo: BillingInfo = {
      ratePerMinute: 3.99,
      currency: 'USD',
      minimumDuration: 3 // minimum 3 minutes
    };
    
    // 6. Start the pay-per-minute session with a 30-minute maximum
    livekitService.startPayPerMinuteSession(SessionType.VIDEO, billingInfo, 30);
    
    // 7. Set up balance checking every 30 seconds
    livekitService.registerSessionChecker(async () => {
      // Replace with actual balance checking logic
      const clientBalance = await checkClientBalance(clientIdentity);
      
      return {
        shouldEnd: clientBalance < billingInfo.ratePerMinute, // End if client can't afford another minute
        reason: clientBalance < billingInfo.ratePerMinute ? 'Insufficient funds' : ''
      };
    }, 30);
    
    // 8. Set up billing update handler
    livekitService.onBillingUpdate((info) => {
      console.log(`Session in progress: ${info.elapsedSeconds} seconds elapsed, $${info.currentCost.toFixed(2)} billed`);
      
      if (info.remainingSeconds !== null) {
        console.log(`${Math.floor(info.remainingSeconds / 60)} minutes ${info.remainingSeconds % 60} seconds remaining`);
      }
      
      // Send billing update to an external service or database
      updateBillingRecord(readingId, info);
    });
    
    // 9. Set up session end handler
    livekitService.onSessionEnd(() => {
      console.log('Reading session ended');
      // Perform cleanup, save final billing, etc.
      finalizeReading(readingId);
    });
    
    // 10. Send the client token back to the client-side application
    return clientToken;
    
  } catch (error) {
    console.error('Failed to start reading session:', error);
    throw error;
  }
}

/**
 * Example 2: Setting up a livestream session with gifting
 * This demonstrates how to set up a livestream where viewers can send gifts
 */
async function startLivestreamSession(): Promise<void> {
  try {
    // 1. Create a unique room name for the livestream
    const streamerId = '789';
    const roomName = `livestream-${streamerId}`;
    
    // 2. Generate token for the streamer
    const streamerIdentity = `streamer-${streamerId}`;
    const streamerName = 'Mystic Emma';
    const streamerToken = await livekitService.createToken(roomName, streamerIdentity, streamerName);
    
    // 3. For the streamer: Connect to the room and publish tracks
    const { room, participant } = await livekitService.connect(streamerToken);
    
    // 4. Publish audio and video (for streamer)
    await livekitService.publishTracks({
      audio: true,
      video: true,
      audioOptions: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      videoOptions: {
        resolution: {
          width: 1920,
          height: 1080,
          frameRate: 30
        }
      }
    });
    
    // 5. Start the livestream session
    livekitService.startLivestreamSession(roomName);
    
    // 6. Set up gift received handler
    livekitService.onGiftReceived((gift: Gift) => {
      console.log(`Gift received: $${gift.amount} from ${gift.senderId} to ${gift.recipientId}`);
      
      // Send notification to streamer's UI
      notifyStreamerOfGift(gift);
      
      // Record gift in database
      recordGiftTransaction(gift);
    });
    
    // 7. Generate viewer tokens (for each viewer)
    function generateViewerToken(viewerId: string, viewerName: string): Promise<string> {
      const viewerIdentity = `viewer-${viewerId}`;
      return livekitService.createToken(roomName, viewerIdentity, viewerName);
    }
    
    // 8. For a viewer to send a gift
    async function sendGiftFromViewer(viewerId: string, amount: number, message?: string): Promise<void> {
      // This would be called from the viewer's client side
      const gift = await livekitService.sendGift({
        senderId: `viewer-${viewerId}`,
        recipientId: streamerIdentity,
        amount,
        message
      });
      
      console.log(`Gift sent: ${gift.id}`);
    }
    
    // 9. End the livestream after 2 hours
    setTimeout(() => {
      livekitService.endSession('Scheduled end time reached');
      
      // Send final summary
      const totalGifts = livekitService.getGifts();
      const totalAmount = livekitService.getTotalGiftAmount(streamerIdentity);
      
      console.log(`Livestream ended with ${totalGifts.length} gifts totaling $${totalAmount}`);
      finalizeStreamerPayout(streamerId, totalAmount);
    }, 2 * 60 * 60 * 1000);
    
    // Return the streamer token
    return streamerToken;
    
  } catch (error) {
    console.error('Failed to start livestream session:', error);
    throw error;
  }
}

// Mock functions that would be implemented in a real application
async function checkClientBalance(clientId: string): Promise<number> {
  // Query the database for the client's balance
  return 50.00; // Mock balance
}

function updateBillingRecord(readingId: string, billingInfo: any): void {
  // Update the reading's billing record in the database
  console.log(`Updated billing record for reading ${readingId}`);
}

function finalizeReading(readingId: string): void {
  // Mark the reading as completed and finalize billing
  console.log(`Finalized reading ${readingId}`);
}

function notifyStreamerOfGift(gift: Gift): void {
  // Send a notification to the streamer's UI
  console.log(`Notified streamer of gift: ${gift.id}`);
}

function recordGiftTransaction(gift: Gift): void {
  // Record the gift transaction in the database
  console.log(`Recorded gift transaction: ${gift.id}`);
}

function finalizeStreamerPayout(streamerId: string, amount: number): void {
  // Create a payout record for the streamer
  console.log(`Created payout of $${amount} for streamer ${streamerId}`);
}

export {
  startPayPerMinuteReadingSession,
  startLivestreamSession
};