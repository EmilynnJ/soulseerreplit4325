import { AccessToken } from 'livekit-server-sdk';
import { 
  Room, 
  RoomEvent, 
  LocalParticipant, 
  RemoteParticipant, 
  createLocalTracks,
  Track,
  RoomOptions,
  ConnectionState
} from 'livekit-client';

// Configuration
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'wss://your-livekit-domain.livekit.cloud';

/**
 * LiveKit Session Manager
 * Handles connecting to LiveKit rooms, managing tracks, and cleaning up sessions
 */
export class LiveKitSessionManager {
  private room: Room | null = null;
  private localParticipant: LocalParticipant | null = null;
  private sessionTimerId: NodeJS.Timeout | null = null;
  private tracks: Track[] = [];
  private onSessionEndHandlers: Array<() => void> = [];

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
    ttl: number = 3600
  ): string {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      throw new Error('Missing LiveKit API key or secret. Please check your environment variables.');
    }

    // Create a new access token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      ttl
    });

    // Grant permissions to the room
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true
    });

    return at.toJwt();
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
      // Create a new room instance
      this.room = new Room(options);

      // Set up event listeners for the room
      this.setupRoomListeners();

      // Connect to the room with the token
      await this.room.connect(LIVEKIT_WS_URL, token);
      
      // Store the local participant reference
      this.localParticipant = this.room.localParticipant;
      
      console.log(`Connected to room: ${this.room.name} as ${this.localParticipant.identity}`);
      
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
    audio: boolean;
    video: boolean;
    videoOptions?: {
      resolution?: {
        width: number;
        height: number;
        frameRate?: number;
      };
    };
    audioOptions?: {
      echoCancellation?: boolean;
      noiseSuppression?: boolean;
      autoGainControl?: boolean;
    };
  }): Promise<Track[]> {
    if (!this.room || !this.localParticipant) {
      throw new Error('Not connected to a room. Call connect() first.');
    }

    try {
      // Create local tracks based on the provided options
      const tracks = await createLocalTracks({
        audio: options.audio ? options.audioOptions || true : false,
        video: options.video ? options.videoOptions || true : false,
      });

      // Publish each track
      for (const track of tracks) {
        await this.localParticipant.publishTrack(track);
      }

      // Store tracks for later cleanup
      this.tracks = [...this.tracks, ...tracks];
      
      console.log(`Published ${tracks.length} tracks`);
      return tracks;
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
      console.log(`Session timer expired after ${durationInSeconds} seconds`);
      this.endSession('Session time limit reached');
    }, durationInSeconds * 1000);

    console.log(`Session timer started for ${durationInSeconds} seconds`);
  }

  /**
   * Register a function to check if the session should end (e.g., balance check)
   * This function will be called periodically to determine if the session should end
   * @param checkFunction - Function that returns a Promise<boolean> (true if session should end)
   * @param intervalInSeconds - How often to check (default: 30 seconds)
   */
  public registerSessionChecker(
    checkFunction: () => Promise<{ shouldEnd: boolean; reason?: string }>,
    intervalInSeconds: number = 30
  ): NodeJS.Timeout {
    const interval = setInterval(async () => {
      try {
        const { shouldEnd, reason } = await checkFunction();
        if (shouldEnd) {
          console.log(`Session ended by external check: ${reason || 'No reason provided'}`);
          this.endSession(reason || 'External check requested end');
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Error in session check function:', error);
      }
    }, intervalInSeconds * 1000);

    return interval;
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

    // Stop all tracks
    for (const track of this.tracks) {
      track.stop();
    }
    this.tracks = [];

    // Disconnect from the room
    if (this.room) {
      await this.room.disconnect(true);
      this.room = null;
    }

    // Clear any timers
    if (this.sessionTimerId) {
      clearTimeout(this.sessionTimerId);
      this.sessionTimerId = null;
    }

    // Reset local participant
    this.localParticipant = null;

    // Call all session end handlers
    for (const handler of this.onSessionEndHandlers) {
      try {
        handler();
      } catch (error) {
        console.error('Error in session end handler:', error);
      }
    }

    console.log('Session ended and resources cleaned up');
  }

  /**
   * Check if currently connected to a room
   * @returns Boolean indicating if connected
   */
  public isConnected(): boolean {
    return this.room?.state === ConnectionState.Connected;
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
    return this.room?.remoteParticipants || null;
  }

  /**
   * Set up event listeners for the room
   * @private
   */
  private setupRoomListeners(): void {
    if (!this.room) return;

    this.room
      .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log(`Participant connected: ${participant.identity}`);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log(`Participant disconnected: ${participant.identity}`);
      })
      .on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from room');
      })
      .on(RoomEvent.Reconnecting, () => {
        console.log('Reconnecting to room...');
      })
      .on(RoomEvent.Reconnected, () => {
        console.log('Reconnected to room');
      })
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        console.log(`Connection state changed: ${state}`);
      });
  }
}

// Export a singleton instance for convenience
export const livekitService = new LiveKitSessionManager();

// Example usage:
/*
// Create a token
const token = livekitService.createToken('room-name', 'user-123', 'Jane Doe');

// Connect to room
await livekitService.connect(token);

// Publish tracks
await livekitService.publishTracks({ audio: true, video: true });

// Set session timer (60 minutes)
livekitService.startSessionTimer(60 * 60);

// Or use a balance checker
livekitService.registerSessionChecker(async () => {
  // Check user balance or other conditions
  const userHasBalance = await checkUserBalance(userId);
  return { 
    shouldEnd: !userHasBalance,
    reason: userHasBalance ? '' : 'Insufficient balance'
  };
});

// Clean up when done
await livekitService.endSession();
*/

export default livekitService;