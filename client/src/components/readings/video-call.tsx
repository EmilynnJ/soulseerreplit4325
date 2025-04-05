import { useState, useEffect, useRef } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Room, 
  RoomEvent, 
  LocalParticipant, 
  RemoteParticipant, 
  Participant, 
  RemoteTrackPublication, 
  TrackPublication, 
  Track, 
  ConnectionState 
} from 'livekit-client';
import env from '@/lib/env';

interface VideoCallProps {
  token: string;
  readingId: number;
  readingType: 'video' | 'voice' | 'chat';
  onSessionEnd?: () => void;
}

/**
 * LiveKit video call component for readings
 * 
 * This component replaces the previous Mux implementation with a LiveKit-based solution.
 */
export function VideoCall({ token, readingId, readingType, onSessionEnd }: VideoCallProps) {
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(readingType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentCost, setCurrentCost] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  
  // Connect to LiveKit room on component mount
  useEffect(() => {
    const connectToRoom = async () => {
      try {
        // Create a new room
        const newRoom = new Room();
        
        // Set up event listeners
        newRoom
          .on(RoomEvent.ParticipantConnected, participantConnected)
          .on(RoomEvent.ParticipantDisconnected, participantDisconnected)
          .on(RoomEvent.ConnectionStateChanged, connectionStateChanged)
          .on(RoomEvent.Disconnected, handleDisconnect)
          .on('data', (data: Uint8Array, participant?: RemoteParticipant) => {
            try {
              const message = JSON.parse(new TextDecoder().decode(data));
              if (message.type === 'billing_update') {
                setElapsedTime(message.elapsedSeconds);
                setCurrentCost(message.currentCost / 100); // Convert cents to dollars
              }
            } catch (error) {
              console.error('Error parsing data message:', error);
            }
          });
        
        // Connect to the room
        await newRoom.connect(env.LIVEKIT_WS_URL, token);
        setRoom(newRoom);
        setConnected(true);
        
        // Publish local tracks based on reading type
        if (readingType === 'video' || readingType === 'voice') {
          await newRoom.localParticipant.enableAudio();
          
          if (readingType === 'video') {
            const videoTrack = await newRoom.localParticipant.enableVideo();
            if (videoTrack && localVideoRef.current) {
              videoTrack.attach(localVideoRef.current);
            }
          }
        }
        
        // Start the timer to show elapsed time
        timerRef.current = setInterval(() => {
          setElapsedTime(prev => prev + 1);
        }, 1000);
        
        // Toast a success message
        toast({
          title: 'Connected to session',
          description: `You are now connected to the ${readingType} session.`,
        });
        
      } catch (error) {
        console.error('Failed to connect to LiveKit room:', error);
        toast({
          variant: 'destructive',
          title: 'Connection Failed',
          description: 'Could not connect to the reading session. Please try again.',
        });
      }
    };
    
    connectToRoom();
    
    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (room) {
        room.disconnect();
      }
    };
  }, [token, readingType, toast, readingId]);
  
  // Handle participant connected event
  const participantConnected = (participant: RemoteParticipant) => {
    console.log('Participant connected:', participant.identity);
    setRemoteParticipants(prevParticipants => [...prevParticipants, participant]);
    
    // Set up listeners for this participant's track publications
    participant.on(RoomEvent.TrackSubscribed, (track, publication) => {
      attachTrack(track, participant);
    });
  };
  
  // Handle participant disconnected event
  const participantDisconnected = (participant: RemoteParticipant) => {
    console.log('Participant disconnected:', participant.identity);
    setRemoteParticipants(prevParticipants => 
      prevParticipants.filter(p => p.sid !== participant.sid)
    );
  };
  
  // Handle connection state changes
  const connectionStateChanged = (state: ConnectionState) => {
    console.log('Connection state changed:', state);
    if (state === ConnectionState.Connected) {
      setConnected(true);
    } else if (state === ConnectionState.Disconnected) {
      setConnected(false);
    }
  };
  
  // Handle room disconnect event
  const handleDisconnect = () => {
    setConnected(false);
    if (onSessionEnd) {
      onSessionEnd();
    }
  };
  
  // Attach a track to the appropriate element
  const attachTrack = (track: Track, participant: Participant) => {
    const participantDiv = document.getElementById(`participant-${participant.sid}`);
    if (!participantDiv) return;
    
    if (track.kind === Track.Kind.Video) {
      const videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = false;
      track.attach(videoElement);
      participantDiv.appendChild(videoElement);
    } else if (track.kind === Track.Kind.Audio) {
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;
      audioElement.controls = false;
      track.attach(audioElement);
      participantDiv.appendChild(audioElement);
    }
  };
  
  // Toggle local video
  const toggleVideo = async () => {
    if (!room) return;
    
    try {
      if (isVideoEnabled) {
        await room.localParticipant.disableVideo();
      } else {
        const videoTrack = await room.localParticipant.enableVideo();
        if (videoTrack && localVideoRef.current) {
          videoTrack.attach(localVideoRef.current);
        }
      }
      setIsVideoEnabled(!isVideoEnabled);
    } catch (error) {
      console.error('Error toggling video:', error);
      toast({
        variant: 'destructive',
        title: 'Video Error',
        description: 'Could not toggle video. Please check your camera permissions.',
      });
    }
  };
  
  // Toggle local audio
  const toggleAudio = async () => {
    if (!room) return;
    
    try {
      if (isAudioEnabled) {
        await room.localParticipant.disableAudio();
      } else {
        await room.localParticipant.enableAudio();
      }
      setIsAudioEnabled(!isAudioEnabled);
    } catch (error) {
      console.error('Error toggling audio:', error);
      toast({
        variant: 'destructive',
        title: 'Audio Error',
        description: 'Could not toggle audio. Please check your microphone permissions.',
      });
    }
  };
  
  // End the call
  const endCall = () => {
    if (room) {
      room.disconnect();
    }
    
    if (onSessionEnd) {
      onSessionEnd();
    }
  };
  
  // Format seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex flex-col h-full bg-background rounded-lg overflow-hidden">
      {/* Call status header */}
      <div className="bg-muted p-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={connected ? "bg-green-100 border-green-400 text-green-700" : "bg-red-100 border-red-400 text-red-700"}>
            {connected ? "Connected" : "Disconnected"}
          </Badge>
          <span className="text-sm font-medium">Duration: {formatTime(elapsedTime)}</span>
        </div>
        <div className="text-sm font-medium">
          Cost: ${currentCost.toFixed(2)}
        </div>
      </div>
      
      {/* Video area */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        {/* Local video */}
        <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
          {readingType === 'video' && (
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
            />
          )}
          {(!isVideoEnabled || readingType !== 'video') && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Video className="h-12 w-12 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground absolute bottom-4">
                {readingType !== 'video' ? 'Video disabled for this session type' : 'Your video is turned off'}
              </p>
            </div>
          )}
          <div className="absolute bottom-2 left-2 text-sm bg-black/50 text-white px-2 py-1 rounded">
            You
          </div>
        </div>
        
        {/* Remote participants */}
        {remoteParticipants.map(participant => (
          <div 
            key={participant.sid} 
            id={`participant-${participant.sid}`}
            className="relative bg-muted rounded-lg overflow-hidden aspect-video flex items-center justify-center"
          >
            {participant.audioTracks.size === 0 && participant.videoTracks.size === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Video className="h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground absolute bottom-4">
                  Participant's media is connecting...
                </p>
              </div>
            )}
            <div className="absolute bottom-2 left-2 text-sm bg-black/50 text-white px-2 py-1 rounded">
              {participant.name || participant.identity || 'Participant'}
            </div>
          </div>
        ))}
        
        {remoteParticipants.length === 0 && (
          <div className="flex items-center justify-center bg-muted rounded-lg aspect-video">
            <div className="text-center">
              <Video className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground">Waiting for the other participant to join...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="bg-muted p-4 flex justify-center space-x-4">
        {readingType === 'video' && (
          <Button
            variant="outline"
            size="icon"
            className={isVideoEnabled ? 'bg-primary/10' : 'bg-destructive/10'}
            onClick={toggleVideo}
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        )}
        
        <Button
          variant="outline"
          size="icon"
          className={isAudioEnabled ? 'bg-primary/10' : 'bg-destructive/10'}
          onClick={toggleAudio}
        >
          {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="destructive"
          size="icon"
          onClick={endCall}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Audio-only call component for readings
 * Reuses the VideoCall component with audio-only configuration
 */
export function VoiceCall(props: Omit<VideoCallProps, 'readingType'>) {
  return <VideoCall {...props} readingType="voice" />;
}