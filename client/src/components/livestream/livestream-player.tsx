import { useEffect, useState, useRef } from 'react';
import { MonitorPlay, Video, VideoOff, Mic, MicOff, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Room, RoomEvent, VideoPresets, LocalParticipant, RemoteParticipant, Track, TrackPublication, Participant } from 'livekit-client';
import { CelestialButton } from '@/components/ui/celestial-button';

/**
 * LiveKit player component for livestreams
 * Connects to a LiveKit room and displays real-time video
 */
export function LiveKitPlayer({ roomName, token }: { roomName: string; token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  
  // Connect to LiveKit room
  useEffect(() => {
    let mounted = true;
    let room: Room | null = null;
    
    const connect = async () => {
      if (!roomName || !token) {
        setError('Missing room name or token');
        return;
      }
      
      setIsConnecting(true);
      
      try {
        // Create a room
        room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution,
          },
        });
        roomRef.current = room;
        
        // Set up event listeners
        room
          .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            console.log('Participant connected:', participant.identity);
            if (mounted) {
              setParticipants(prevParticipants => [...prevParticipants, participant]);
            }
          })
          .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
            console.log('Participant disconnected:', participant.identity);
            if (mounted) {
              setParticipants(prevParticipants => 
                prevParticipants.filter(p => p.sid !== participant.sid)
              );
            }
          })
          .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            // When a track is subscribed, attach it to the DOM
            if (mounted && videoContainerRef.current) {
              if (track.kind === Track.Kind.Video) {
                const element = track.attach();
                element.classList.add('rounded-lg', 'w-full', 'h-full', 'object-cover');
                
                // Clear the container first (for reconnects)
                const container = videoContainerRef.current;
                if (container.firstChild) {
                  container.innerHTML = '';
                }
                
                container.appendChild(element);
              }
            }
          });
        
        // Connect to the LiveKit server
        const url = process.env.VITE_LIVEKIT_WS_URL || 'wss://soulseer-kawitbf3.livekit.cloud';
        await room.connect(url, token);
        console.log('Connected to LiveKit room:', roomName);
        
        // Get initial participants
        if (mounted) {
          const remoteParticipants = Array.from(room.remoteParticipants.values()) as RemoteParticipant[];
          const allParticipants: Participant[] = [room.localParticipant, ...remoteParticipants];
          setParticipants(allParticipants);
          setIsConnected(true);
          setIsConnecting(false);
        }
      } catch (err) {
        console.error('Failed to connect to LiveKit room:', err);
        if (mounted) {
          setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
          setIsConnecting(false);
        }
      }
    };
    
    connect();
    
    // Cleanup function
    return () => {
      mounted = false;
      if (room) {
        console.log('Disconnecting from LiveKit room');
        room.disconnect();
      }
    };
  }, [roomName, token]);
  
  // If there's an error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg p-6">
        <MonitorPlay className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">LiveKit Connection Error</h3>
        <p className="text-center text-muted-foreground mb-4">{error}</p>
        <CelestialButton onClick={() => window.location.reload()} size="sm">
          Try Again
        </CelestialButton>
      </div>
    );
  }
  
  // If connecting
  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg p-6">
        <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mb-4"></div>
        <h3 className="text-xl font-semibold mb-2">Connecting to Livestream</h3>
        <p className="text-center text-muted-foreground">
          Connecting to the livestream server...
        </p>
      </div>
    );
  }
  
  return (
    <div className="w-full rounded-lg overflow-hidden bg-black relative">
      {/* Video container */}
      <div ref={videoContainerRef} className="w-full h-full min-h-[300px] bg-muted/20">
        {!isConnected && (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <MonitorPlay className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Livestream</h3>
            <p className="text-center text-muted-foreground">
              Waiting for the stream to begin...
            </p>
          </div>
        )}
      </div>
      
      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
              <MonitorPlay className="mr-1 h-3 w-3" />
              <span>LIVE</span>
            </div>
            <div className="text-white text-sm">
              {participants.length > 1 ? `${participants.length - 1} Viewers` : '0 Viewers'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * LiveKit recording player component for ended livestreams 
 */
export function LiveKitRecordingPlayer({ recordingUrl, thumbnail }: { recordingUrl?: string; thumbnail?: string }) {
  // Check if there's a recording URL
  const hasRecording = Boolean(recordingUrl);
  
  return (
    <div className="w-full rounded-lg overflow-hidden bg-black relative">
      {hasRecording ? (
        <div className="w-full min-h-[300px]">
          <video
            src={recordingUrl}
            controls
            poster={thumbnail || '/images/livestream-placeholder.jpg'}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[300px] bg-muted/30 p-6">
          <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Recording Unavailable</h3>
          <p className="text-center text-muted-foreground">
            This livestream recording is no longer available or has not been processed yet.
          </p>
        </div>
      )}
    </div>
  );
}