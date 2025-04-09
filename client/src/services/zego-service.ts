import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

// Define the service types
export type ZegoServiceType = 'video' | 'voice' | 'chat' | 'live';

// Define the event types
interface ZegoEvent {
  roomStateUpdate: (data: any) => void;
  userUpdate: (data: any) => void;
  streamUpdate: (data: any) => void;
  remoteStreamAdded: (data: any) => void;
  roomNetworkQuality: (data: any) => void;
  error: (data: any) => void;
}

/**
 * ZegoService - Client-side service for ZEGO WebRTC functionality
 */
export class ZegoService {
  private engine: ZegoExpressEngine | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private token: string | null = null;
  private serviceType: ZegoServiceType = 'video';
  private localStream: MediaStream | null = null;
  private remoteStreams: Record<string, MediaStream> = {};
  private eventListeners: Record<string, Function[]> = {};
  
  constructor() {
    // Initialize empty event listeners
    const eventTypes: (keyof ZegoEvent)[] = [
      'roomStateUpdate',
      'userUpdate',
      'streamUpdate',
      'remoteStreamAdded',
      'roomNetworkQuality',
      'error'
    ];
    
    eventTypes.forEach(eventType => {
      this.eventListeners[eventType] = [];
    });
  }
  
  /**
   * Initialize the ZEGO engine
   */
  async initialize(serviceType: ZegoServiceType = 'video'): Promise<void> {
    this.serviceType = serviceType;
    
    // Get the app ID based on service type
    const appID = this.getAppIDForService(serviceType);
    
    if (!appID) {
      throw new Error(`No app ID available for service type: ${serviceType}`);
    }
    
    // Create ZEGO engine instance
    this.engine = new ZegoExpressEngine(appID, 'production');
    
    // Set event handlers
    this.setupEventHandlers();
    
    console.log(`ZEGO service initialized for ${serviceType} with App ID: ${appID}`);
  }
  
  /**
   * Get the appropriate App ID based on the service type
   */
  private getAppIDForService(serviceType: ZegoServiceType): number {
    switch (serviceType) {
      case 'video':
        return Number(import.meta.env.VITE_ZEGO_VIDEO_APP_ID);
      case 'voice':
        return Number(import.meta.env.VITE_ZEGO_PHONE_APP_ID);
      case 'chat':
        return Number(import.meta.env.VITE_ZEGO_CHAT_APP_ID);
      case 'live':
        return Number(import.meta.env.VITE_ZEGO_LIVE_APP_ID);
      default:
        return Number(import.meta.env.VITE_ZEGO_VIDEO_APP_ID);
    }
  }
  
  /**
   * Set up ZEGO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.engine) return;
    
    this.engine.on('roomStateUpdate', (roomId, state, errorCode, extendedData) => {
      this.emitEvent('roomStateUpdate', { roomId, state, errorCode, extendedData });
    });
    
    this.engine.on('roomUserUpdate', (roomId, updateType, userList) => {
      this.emitEvent('userUpdate', { roomId, updateType, userList });
    });
    
    this.engine.on('roomStreamUpdate', (roomId, updateType, streamList) => {
      this.emitEvent('streamUpdate', { roomId, updateType, streamList });
      
      // Handle new streams
      if (updateType === 'ADD') {
        streamList.forEach((stream: any) => {
          this.engine?.startPlayingStream(stream.streamID, {
            audio: true,
            video: this.serviceType === 'video'
          }).then((remoteStream: MediaStream) => {
            this.remoteStreams[stream.streamID] = remoteStream;
            this.emitEvent('remoteStreamAdded', { 
              streamID: stream.streamID, 
              stream: remoteStream 
            });
          }).catch((error: Error) => {
            console.error('Failed to play remote stream:', error);
            this.emitEvent('error', {
              errorCode: 'PLAY_STREAM_FAILED',
              errorMessage: error.message
            });
          });
        });
      }
    });
    
    this.engine.on('roomNetworkQuality', (roomId, userID, upstreamQuality, downstreamQuality) => {
      this.emitEvent('roomNetworkQuality', {
        roomId,
        userID,
        upstreamQuality,
        downstreamQuality
      });
    });
    
    this.engine.on('error', (errorCode, errorMessage) => {
      console.error(`ZEGO error: ${errorCode} - ${errorMessage}`);
      this.emitEvent('error', { errorCode, errorMessage });
    });
  }
  
  /**
   * Join a room
   */
  async joinRoom(roomId: string, userId: string, token: string): Promise<void> {
    if (!this.engine) {
      throw new Error('ZEGO engine not initialized. Call initialize() first.');
    }
    
    this.roomId = roomId;
    this.userId = userId;
    this.token = token;
    
    try {
      await this.engine.loginRoom(roomId, token, {
        userID: userId,
        userName: userId
      });
      
      console.log(`Joined ZEGO room: ${roomId} with user ID: ${userId}`);
    } catch (error) {
      console.error('Failed to join ZEGO room:', error);
      throw error;
    }
  }
  
  /**
   * Start local stream
   */
  async startLocalStream(videoConfig: boolean | object = true, audioConfig: boolean | object = true): Promise<MediaStream> {
    if (!this.engine) {
      throw new Error('ZEGO engine not initialized. Call initialize() first.');
    }
    
    try {
      // Create stream
      const stream = await this.engine.createStream({
        camera: {
          audio: audioConfig,
          video: videoConfig
        }
      });
      
      this.localStream = stream;
      console.log('Local stream created successfully');
      return stream;
    } catch (error) {
      console.error('Failed to create local stream:', error);
      throw error;
    }
  }
  
  /**
   * Publish local stream
   */
  async publishStream(): Promise<void> {
    if (!this.engine || !this.localStream || !this.roomId) {
      throw new Error('Cannot publish stream: Engine not initialized, no local stream, or not in a room');
    }
    
    try {
      // Generate a stream ID based on roomId and userId
      const streamID = `${this.roomId}_${this.userId}_${Date.now()}`;
      
      // Publish the stream
      await this.engine.startPublishingStream(streamID, this.localStream);
      console.log(`Publishing stream with ID: ${streamID}`);
    } catch (error) {
      console.error('Failed to publish stream:', error);
      throw error;
    }
  }
  
  /**
   * Stop publishing and leave room
   */
  async leaveRoom(): Promise<void> {
    if (!this.engine) return;
    
    try {
      // Stop publishing if we have a local stream
      if (this.localStream) {
        await this.engine.stopPublishingStream();
        this.engine.destroyStream(this.localStream);
        this.localStream = null;
      }
      
      // Stop playing all remote streams
      Object.keys(this.remoteStreams).forEach(streamID => {
        this.engine?.stopPlayingStream(streamID);
      });
      this.remoteStreams = {};
      
      // Logout from room
      if (this.roomId) {
        await this.engine.logoutRoom(this.roomId);
        console.log(`Left ZEGO room: ${this.roomId}`);
      }
      
      this.roomId = null;
      this.userId = null;
      this.token = null;
    } catch (error) {
      console.error('Error leaving ZEGO room:', error);
      throw error;
    }
  }
  
  /**
   * Mute/unmute local audio
   */
  muteLocalAudio(mute: boolean): void {
    if (!this.engine || !this.localStream) return;
    
    if (mute) {
      this.engine.mutePublishStreamAudio(true);
    } else {
      this.engine.mutePublishStreamAudio(false);
    }
    console.log(`Local audio ${mute ? 'muted' : 'unmuted'}`);
  }
  
  /**
   * Enable/disable local video
   */
  enableLocalVideo(enable: boolean): void {
    if (!this.engine || !this.localStream) return;
    
    if (enable) {
      this.engine.mutePublishStreamVideo(false);
    } else {
      this.engine.mutePublishStreamVideo(true);
    }
    console.log(`Local video ${enable ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get connection stats
   */
  async getStats(): Promise<any> {
    if (!this.engine) {
      return { error: 'Engine not initialized' };
    }
    
    try {
      // These methods might not be directly available in the TypeScript definitions
      // but should be available in the actual implementation
      const publishStats = await this.engine.getPublishStreamStats();
      const playStats = await this.engine.getPlayStreamStats();
      
      return {
        publish: publishStats,
        play: playStats
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { error: String(error) };
    }
  }
  
  /**
   * Destroy the ZEGO engine
   */
  destroy(): void {
    if (this.engine) {
      // Make sure we're not in a room
      if (this.roomId) {
        this.leaveRoom().catch(err => {
          console.error('Error leaving room during destroy:', err);
        });
      }
      
      // Destroy the engine
      this.engine.destroy();
      this.engine = null;
      
      console.log('ZEGO engine destroyed');
    }
    
    // Clear event listeners
    Object.keys(this.eventListeners).forEach(key => {
      this.eventListeners[key] = [];
    });
  }
  
  /**
   * Add an event listener
   */
  addEventListener(event: string, listener: Function): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(listener);
    }
  }
  
  /**
   * Remove an event listener
   */
  removeEventListener(event: string, listener: Function): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(
        (l) => l !== listener
      );
    }
  }
  
  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: string, data: any): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }
}

// Create a singleton instance
export const zegoService = new ZegoService();