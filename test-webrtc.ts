// Import dependencies
import { sessionService } from './server/services/session-service';
import { webRTCService } from './server/services/webrtc-service';
import { storage } from './server/storage';

async function testWebRTCSession() {
  try {
    console.log('Testing WebRTC session creation...');
    
    // Test parameters with real user IDs from the database
    const readerId = 24; // Lauren (reader)
    const clientId = 2;  // admin (client for this test)
    const type = 'video' as const;
    
    // Create a session
    const result = await webRTCService.createSession(readerId, clientId, type);
    
    console.log('Session creation result:', result);
    
    if (result && result.success) {
      console.log('WebRTC session created successfully with room ID:', result.roomId);
    } else {
      console.error('Failed to create WebRTC session');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testWebRTCSession();