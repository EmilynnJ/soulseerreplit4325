const { sessionService } = require('./server/services/session-service');
const { webRTCService } = require('./server/services/webrtc-service');

async function testWebRTCSession() {
  try {
    console.log('Testing WebRTC session creation...');
    
    // Test parameters
    const readerId = 1;
    const clientId = 2;
    const type = 'video';
    
    // Create a session
    const result = await webRTCService.createSession(readerId, clientId, type);
    
    console.log('Session creation result:', result);
    
    if (result.success) {
      console.log('WebRTC session created successfully with room ID:', result.roomId);
    } else {
      console.error('Failed to create WebRTC session');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testWebRTCSession();