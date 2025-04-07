import crypto from 'crypto';

// Different environment variables for different Zego products
interface ZegoCredentials {
  appId: string;
  serverSecret: string;
}

// Get appropriate Zego credentials based on the communication type
export function getZegoCredentials(type: 'chat' | 'phone' | 'video' | 'live'): ZegoCredentials {
  switch (type) {
    case 'chat':
      return {
        appId: process.env.ZEGO_CHAT_APP_ID || '',
        serverSecret: process.env.ZEGO_CHAT_SERVER_SECRET || ''
      };
    case 'phone':
      return {
        appId: process.env.ZEGO_PHONE_APP_ID || '',
        serverSecret: process.env.ZEGO_PHONE_SERVER_SECRET || ''
      };
    case 'video':
      return {
        appId: process.env.ZEGO_VIDEO_APP_ID || '',
        serverSecret: process.env.ZEGO_VIDEO_SERVER_SECRET || ''
      };
    case 'live':
      return {
        appId: process.env.ZEGO_LIVE_APP_ID || '',
        serverSecret: process.env.ZEGO_LIVE_SERVER_SECRET || ''
      };
    default:
      throw new Error(`Unknown Zego type: ${type}`);
  }
}

interface GenerateTokenOptions {
  userId: string;
  roomId: string;
  userName?: string;
  privilege?: {
    canPublishStream?: 1 | 0;
    canJoinRoom?: 1 | 0;
  };
  expirationSeconds?: number; // Token expiration in seconds
}

/**
 * Generate a Zego token for authentication
 * Based on Zego's official token generation algorithm
 * @see https://docs.zegocloud.com/article/13935
 */
export function generateZegoToken(
  type: 'chat' | 'phone' | 'video' | 'live',
  options: GenerateTokenOptions
): string {
  const { appId, serverSecret } = getZegoCredentials(type);
  
  if (!appId || !serverSecret) {
    throw new Error(`Missing Zego ${type} credentials. Please check your environment variables.`);
  }

  const { 
    userId, 
    roomId, 
    userName = userId, 
    privilege = { canPublishStream: 1, canJoinRoom: 1 },
    expirationSeconds = 3600 // Default: 1 hour
  } = options;

  // Current timestamp in seconds
  const createTime = Math.floor(Date.now() / 1000);
  // Token expiration time
  const expireTime = createTime + expirationSeconds;

  // Construct the payload
  const payload = {
    ver: 1,
    hash: 'md5',
    app_id: appId,
    user_id: userId,
    room_id: roomId,
    privilege: privilege,
    create_time: createTime,
    expire_time: expireTime,
    nonce: Math.floor(Math.random() * 2147483647)
  };

  // Convert payload to string
  const payloadString = JSON.stringify(payload);
  
  // Generate signature using HMAC-MD5
  const signature = crypto
    .createHmac('md5', serverSecret)
    .update(payloadString)
    .digest('hex')
    .toUpperCase();
  
  // Encode payload
  const base64Payload = Buffer.from(payloadString).toString('base64');
  
  // Format: signature.base64Payload
  return `${signature}.${base64Payload}`;
}

/**
 * Generate Zego configuration object for client-side usage
 */
export function getZegoConfig(type: 'chat' | 'phone' | 'video' | 'live', isHost: boolean = true) {
  const role = isHost ? 'Host' : 'Audience';
  
  switch (type) {
    case 'chat':
      return {
        turnOnMicrophoneWhenJoining: false,
        turnOnCameraWhenJoining: false,
        showMyCameraToggleButton: false,
        showMyMicrophoneToggleButton: false,
        showAudioVideoSettingsButton: false,
        showScreenSharingButton: false,
        showTextChat: true,
        showUserList: true,
        maxUsers: 2,
        layout: "Auto",
        showLayoutButton: false,
        scenario: {
          mode: "OneONoneCall",
          config: {
            role,
          },
        },
      };
    
    case 'phone':
      return {
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: false,
        showMyCameraToggleButton: false,
        showMyMicrophoneToggleButton: true,
        showAudioVideoSettingsButton: false,
        showScreenSharingButton: false,
        showTextChat: true,
        showUserList: true,
        maxUsers: 2,
        layout: "Auto",
        showLayoutButton: false,
        scenario: {
          mode: "VideoConference",
          config: {
            role,
          },
        },
      };
      
    case 'video':
      return {
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: true,
        showMyCameraToggleButton: true,
        showMyMicrophoneToggleButton: true,
        showAudioVideoSettingsButton: true,
        showScreenSharingButton: true,
        showTextChat: true,
        showUserList: true,
        maxUsers: 2,
        layout: "Auto",
        showLayoutButton: false,
        scenario: {
          mode: "OneONoneCall",
          config: {
            role,
          },
        },
      };
      
    case 'live':
      return {
        turnOnCameraWhenJoining: true,
        showMyCameraToggleButton: true,
        showAudioVideoSettingsButton: true,
        showScreenSharingButton: true,
        showTextChat: true,
        showUserList: true,
        scenario: {
          mode: "LiveStreaming",
          config: {
            role,
          },
        },
      };
      
    default:
      throw new Error(`Unknown Zego type: ${type}`);
  }
}