import { 
  Room, 
  RoomEvent, 
  LocalParticipant, 
  RemoteParticipant,
  RoomOptions,
  ConnectionState,
  Track,
  TrackPublication,
  LocalTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  VideoCaptureOptions,
  AudioCaptureOptions,
  DataPacket_Kind
} from 'livekit-client';

import {
  AccessToken, 
  RoomServiceClient
} from 'livekit-server-sdk';

// Session types supported by the service
export enum SessionType {
  CHAT = 'chat',
  VOICE = 'voice',
  VIDEO = 'video',
  LIVESTREAM = 'livestream'
}

// Gift interface for livestream gifting
export interface Gift {
  id: string;
  senderId: string;
  recipientId: string;
  amount: number;
  message?: string;
  timestamp: number;
}

// Billing information for pay-per-minute sessions
export interface BillingInfo {
  ratePerMinute: number;
  currency: string;
  minimumDuration: number;
}

// Timer update information for billing updates
export interface TimerUpdateInfo {
  elapsedSeconds: number;
  remainingSeconds: number | null;
  currentCost: number;
}

// Session checker result
interface SessionCheckerResult {
  shouldEnd: boolean;
  reason?: string;
}

// Session checker function type
type SessionCheckerFunction = () => Promise<SessionCheckerResult>;

/**
 * LiveKit Session Manager
 * Handles connecting to LiveKit rooms, managing tracks, and cleaning up sessions
 * Includes support for both pay-per-minute readings and livestreaming with gifts
 */
export class LiveKitSessionManager {
  // LiveKit connection essentials
  private room: Room | null = null;
  private localParticipant: LocalParticipant | null = null;
  private serviceClient: RoomServiceClient | null = null;
  
  // Session configuration
  private sessionType: SessionType = SessionType.VIDEO;
  private sessionStartTime: number = 0;
  private sessionTimerId: NodeJS.Timeout | null = null;
  private sessionTimerInterval: NodeJS.Timeout | null = null;
  private tracks: Track[] = [];
  private sessionCheckerInterval: NodeJS.Timeout | null = null;
  
  // Billing configuration
  private billingInfo: BillingInfo | null = null;
  private maxDuration: number | null = null;
  private billingUpdateInterval: NodeJS.Timeout | null = null;
  
  // Livestream gifting
  private gifts: Gift[] = [];
  
  // Event handlers
  private onSessionEndHandlers: Array<() => void> = [];
  private onBillingUpdateHandlers: Array<(info: TimerUpdateInfo) => void> = [];
  private onGiftReceivedHandlers: Array<(gift: Gift) => void> = [];
  
  constructor() {
    // Initialize the RoomServiceClient if API keys are available
    this.initServiceClient();
  }
  
  private initServiceClient(): void {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.VITE_LIVEKIT_WS_URL || '';
    
    if (apiKey && apiSecret && wsUrl) {
      this.serviceClient = new RoomServiceClient(wsUrl, apiKey, apiSecret);
    } else {
      console.warn('LiveKit credentials missing, some functionality will be limited');
    }
  }

  /**
   * Create a LiveKit access token for a user
   * @param roomName - The name of the room to connect to
   * @param participantIdentity - Unique participant identifier
   * @param participantName - Display name of the participant
   * @param ttl - Time-to-live in seconds (default: 1 hour)
   * @returns The generated token as a string
   */
  public createToken(
    roomName: string,
    participantIdentity: string,
    participantName: string,
    options?: any,
    ttl: number = 3600
  ): string {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new Error('LiveKit API credentials not configured');
    }
    
    try {
      const at = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity,
        name: participantName,
        ttl
      });
      
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });
      
      return at.toJwt();
    } catch (error) {
      console.error('Failed to create LiveKit access token:', error);
      throw error;
    }
  }

  /**
   * Connect to a LiveKit room with the given token
   * @param token - LiveKit access token
   * @param options - Room connection options
   * @returns Promise resolving to the room and local participant
   */
  public async connect(token: string, options?: RoomOptions): Promise<{ 
    room: Room,
    participant: LocalParticipant 
  }> {
    try {
      // Create a new room if one doesn't exist already
      if (!this.room) {
        this.room = new Room(options);
        this.setupRoomListeners();
      }
      
      // Connect to the room
      await this.room.connect(process.env.VITE_LIVEKIT_WS_URL as string, token);
      this.localParticipant = this.room.localParticipant;
      
      // Set session start time
      this.sessionStartTime = Date.now();
      
      return {
        room: this.room,
        participant: this.localParticipant
      };
    } catch (error) {
      console.error('Failed to connect to LiveKit room:', error);
      throw error;
    }
  }

  /**
   * Create and publish local audio and video tracks
   * @param options - Options for creating tracks
   * @returns Promise resolving to the created tracks
   */
  public async publishTracks(options: {
    audio?: boolean,
    video?: boolean,
    audioOptions?: AudioCaptureOptions,
    videoOptions?: VideoCaptureOptions
  }): Promise<Track[]> {
    if (!this.room || !this.localParticipant) {
      throw new Error('Not connected to a room');
    }
    
    try {
      const newTracks: Track[] = [];
      
      // Create and publish audio track if requested
      if (options.audio) {
        const audioTrack = await LocalAudioTrack.create(options.audioOptions);
        await this.localParticipant.publishTrack(audioTrack);
        newTracks.push(audioTrack);
        this.tracks.push(audioTrack);
      }
      
      // Create and publish video track if requested
      if (options.video) {
        const videoTrack = await LocalVideoTrack.create(options.videoOptions);
        await this.localParticipant.publishTrack(videoTrack);
        newTracks.push(videoTrack);
        this.tracks.push(videoTrack);
      }
      
      return newTracks;
    } catch (error) {
      console.error('Failed to publish tracks:', error);
      throw error;
    }
  }

  /**
   * Set a timer to automatically end the session after a given duration
   * @param durationInSeconds - Duration of the session in seconds
   */
  public startSessionTimer(durationInSeconds: number): void {
    if (this.sessionTimerId) {
      clearTimeout(this.sessionTimerId);
    }
    
    this.sessionTimerId = setTimeout(() => {
      this.endSession('Session time limit reached');
    }, durationInSeconds * 1000);
    
    // Also start a timer to update elapsed time
    if (this.sessionTimerInterval) {
      clearInterval(this.sessionTimerInterval);
    }
    
    this.sessionTimerInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      console.log(`Session in progress: ${elapsedSeconds} seconds elapsed`);
    }, 30000); // Log every 30 seconds
  }

  /**
   * Register a function to check if the session should end (e.g., balance check)
   * This function will be called periodically to determine if the session should end
   * @param checkFunction - Function that returns a Promise<boolean> (true if session should end)
   * @param intervalInSeconds - How often to check (default: 30 seconds)
   */
  public registerSessionChecker(
    checkFunction: SessionCheckerFunction,
    intervalInSeconds: number = 30
  ): void {
    if (this.sessionCheckerInterval) {
      clearInterval(this.sessionCheckerInterval);
    }
    
    this.sessionCheckerInterval = setInterval(async () => {
      try {
        const result = await checkFunction();
        if (result.shouldEnd) {
          this.endSession(result.reason || 'Session ended by checker');
        }
      } catch (error) {
        console.error('Error in session checker:', error);
      }
    }, intervalInSeconds * 1000);
  }

  /**
   * Add a handler to be called when the session ends
   * @param handler - Function to call when session ends
   */
  public onSessionEnd(handler: () => void): void {
    this.onSessionEndHandlers.push(handler);
  }

  /**
   * End the session, disconnect from the room, and clean up resources
   * @param reason - Reason for ending the session
   */
  public async endSession(reason: string = 'Session ended'): Promise<void> {
    console.log(`Ending session: ${reason}`);
    
    // Stop all timers
    if (this.sessionTimerId) {
      clearTimeout(this.sessionTimerId);
      this.sessionTimerId = null;
    }
    
    if (this.sessionTimerInterval) {
      clearInterval(this.sessionTimerInterval);
      this.sessionTimerInterval = null;
    }
    
    if (this.sessionCheckerInterval) {
      clearInterval(this.sessionCheckerInterval);
      this.sessionCheckerInterval = null;
    }
    
    if (this.billingUpdateInterval) {
      clearInterval(this.billingUpdateInterval);
      this.billingUpdateInterval = null;
    }
    
    // Unpublish all tracks
    if (this.localParticipant) {
      for (const track of this.tracks) {
        try {
          if (track instanceof LocalTrack) {
            await this.localParticipant.unpublishTrack(track);
            await track.stop();
          }
        } catch (error) {
          console.error('Error unpublishing track:', error);
        }
      }
    }
    
    // Disconnect from the room
    if (this.room) {
      try {
        await this.room.disconnect(true);
      } catch (error) {
        console.error('Error disconnecting from room:', error);
      }
    }
    
    // Reset state
    this.room = null;
    this.localParticipant = null;
    this.tracks = [];
    
    // Call session end handlers
    for (const handler of this.onSessionEndHandlers) {
      try {
        handler();
      } catch (error) {
        console.error('Error in session end handler:', error);
      }
    }
    
    console.log('Session cleanup completed');
  }

  /**
   * Check if currently connected to a room
   * @returns Boolean indicating if connected
   */
  public isConnected(): boolean {
    return this.room !== null && this.room.state === ConnectionState.Connected;
  }

  /**
   * Get the current room
   * @returns The current Room instance or null
   */
  public getRoom(): Room | null {
    return this.room;
  }

  /**
   * Get the local participant
   * @returns The local participant or null
   */
  public getLocalParticipant(): LocalParticipant | null {
    return this.localParticipant;
  }

  /**
   * Get remote participants in the room
   * @returns Map of participant identities to RemoteParticipant objects
   */
  public getRemoteParticipants(): Map<string, RemoteParticipant> | null {
    return this.room?.participants || null;
  }

  /**
   * Set up event listeners for the room
   * @private
   */
  private setupRoomListeners(): void {
    if (!this.room) return;
    
    this.room
      .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log('Participant connected:', participant.identity);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log('Participant disconnected:', participant.identity);
      })
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        console.log('Room connection state changed:', state);
        
        if (state === ConnectionState.Disconnected) {
          // Call session end handlers if not already done
          if (this.room) {
            this.endSession('Room disconnected');
          }
        }
      })
      .on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
          // Try to parse the data as a gift
          const dataString = new TextDecoder().decode(payload);
          const data = JSON.parse(dataString);
          
          if (data.type === 'gift') {
            const gift: Gift = data.gift;
            this.handleGiftReceived(gift, participant);
          }
        } catch (error) {
          console.error('Error processing received data:', error);
        }
      });
  }

  /**
   * Start a pay-per-minute reading session
   * @param sessionType - Type of reading (chat, voice, video)
   * @param billingInfo - Billing information for the session
   * @param maxDurationMinutes - Maximum duration in minutes (optional)
   */
  public startPayPerMinuteSession(
    sessionType: SessionType,
    billingInfo: BillingInfo,
    maxDurationMinutes?: number
  ): void {
    this.sessionType = sessionType;
    this.billingInfo = billingInfo;
    
    // Set maximum duration if provided
    if (maxDurationMinutes) {
      this.maxDuration = maxDurationMinutes * 60; // Convert to seconds
      this.startSessionTimer(this.maxDuration);
    }
    
    // Start billing updates
    this.startBillingUpdates();
    
    console.log(`Pay-per-minute session started: ${sessionType} at ${billingInfo.ratePerMinute}/${billingInfo.currency} per minute`);
  }

  /**
   * Start sending billing updates
   * @private
   */
  private startBillingUpdates(updateIntervalSeconds: number = 15): void {
    if (!this.billingInfo) {
      console.error('Cannot start billing updates without billing info');
      return;
    }
    
    if (this.billingUpdateInterval) {
      clearInterval(this.billingUpdateInterval);
    }
    
    this.billingUpdateInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      const elapsedMinutes = elapsedSeconds / 60;
      
      // Calculate current cost
      const currentCost = Math.max(
        this.billingInfo!.minimumDuration * this.billingInfo!.ratePerMinute,
        elapsedMinutes * this.billingInfo!.ratePerMinute
      );
      
      // Calculate remaining time if max duration is set
      let remainingSeconds: number | null = null;
      if (this.maxDuration) {
        remainingSeconds = Math.max(0, this.maxDuration - elapsedSeconds);
      }
      
      // Create update info
      const updateInfo: TimerUpdateInfo = {
        elapsedSeconds,
        remainingSeconds,
        currentCost
      };
      
      // Call billing update handlers
      for (const handler of this.onBillingUpdateHandlers) {
        try {
          handler(updateInfo);
        } catch (error) {
          console.error('Error in billing update handler:', error);
        }
      }
    }, updateIntervalSeconds * 1000);
  }

  /**
   * Register a handler for billing updates
   * @param handler - Function to call with billing updates
   */
  public onBillingUpdate(handler: (info: TimerUpdateInfo) => void): void {
    this.onBillingUpdateHandlers.push(handler);
  }

  /**
   * Register a handler for gift received events
   * @param handler - Function to call when a gift is received
   */
  public onGiftReceived(handler: (gift: Gift) => void): void {
    this.onGiftReceivedHandlers.push(handler);
  }

  /**
   * Send a gift in a livestream
   * @param gift - Gift information
   */
  public async sendGift(gift: Omit<Gift, 'id' | 'timestamp'>): Promise<Gift> {
    if (!this.room || !this.localParticipant) {
      throw new Error('Not connected to a room');
    }
    
    // Create a complete gift object
    const completeGift: Gift = {
      ...gift,
      id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now()
    };
    
    // Store the gift
    this.gifts.push(completeGift);
    
    // Send the gift to all participants
    const giftData = {
      type: 'gift',
      gift: completeGift
    };
    
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(giftData));
    
    await this.room.localParticipant.publishData(data, DataPacket_Kind.RELIABLE);
    
    return completeGift;
  }

  /**
   * Handle gift received event
   * @private
   */
  private handleGiftReceived(gift: Gift, sender?: RemoteParticipant): void {
    // Store the gift
    this.gifts.push(gift);
    
    // Call gift received handlers
    for (const handler of this.onGiftReceivedHandlers) {
      try {
        handler(gift);
      } catch (error) {
        console.error('Error in gift received handler:', error);
      }
    }
  }

  /**
   * Get all gifts for the current session
   * @returns Array of gifts
   */
  public getGifts(): Gift[] {
    return [...this.gifts];
  }

  /**
   * Get total gift amount for the current session
   * @param recipientId - Optional recipient ID to filter gifts
   * @returns Total gift amount
   */
  public getTotalGiftAmount(recipientId?: string): number {
    if (recipientId) {
      return this.gifts
        .filter(gift => gift.recipientId === recipientId)
        .reduce((total, gift) => total + gift.amount, 0);
    }
    
    return this.gifts.reduce((total, gift) => total + gift.amount, 0);
  }

  /**
   * Start a livestream session
   * @param roomName - Name of the livestream room
   */
  public startLivestreamSession(roomName: string): void {
    this.sessionType = SessionType.LIVESTREAM;
    console.log(`Livestream session started: ${roomName}`);
  }
  
  /**
   * Start a specific livestream by ID
   * @param id - Livestream ID
   */
  public async startLivestream(id: number): Promise<any> {
    console.log(`Starting livestream with ID: ${id}`);
    // This is basic functionality - just returning the ID since the DB operations are handled in routes.ts
    return { id, status: 'live', updatedAt: new Date() };
  }

  /**
   * End a specific livestream by ID
   * @param id - Livestream ID
   */
  public async endLivestream(id: number): Promise<any> {
    console.log(`Ending livestream with ID: ${id}`);
    // This is basic functionality - just returning the ID since the DB operations are handled in routes.ts
    return { id, status: 'ended', updatedAt: new Date() };
  }
}

// Create a singleton instance
export const livekitService = new LiveKitSessionManager();