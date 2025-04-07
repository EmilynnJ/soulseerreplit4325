import { useEffect, useState } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
  createLocalVideoTrack,
  createLocalAudioTrack,
  RemoteTrack,
  RemoteTrackPublication,
  LocalTrackPublication
} from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface RoomUIProps {
  token: string;
  roomName: string;
  userId: number;
  userName: string;
  userRole: 'reader' | 'client';
  onEndSession: () => void;
}

export function RoomUI({ token, roomName, userId, userName, userRole, onEndSession }: RoomUIProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [participants, setParticipants] = useState<(LocalParticipant | RemoteParticipant)[]>([]);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isOtherParticipantConnected, setIsOtherParticipantConnected] = useState(false);
  const [billingActive, setBillingActive] = useState(false);
  
  // Initialize room connection
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    let billingTimerId: NodeJS.Timeout;
    
    async function connectToRoom() {
      try {
        if (!token) return;
        
        const newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        
        setRoom(newRoom);
        
        // Connect to the room
        await newRoom.connect(
          import.meta.env.VITE_LIVEKIT_SERVER_URL || 'wss://your-livekit-server',
          token
        );
        
        console.log(`Connected to room: ${roomName} as ${userName} (${userRole})`);
        
        // Initialize local tracks
        if (isCameraEnabled) {
          const videoTrack = await createLocalVideoTrack();
          await newRoom.localParticipant.publishTrack(videoTrack);
        }
        
        if (isMicEnabled) {
          const audioTrack = await createLocalAudioTrack();
          await newRoom.localParticipant.publishTrack(audioTrack);
        }
        
        // Update participant list
        const initialParticipants = [newRoom.localParticipant, ...Array.from(newRoom.participants.values())];
        setParticipants(initialParticipants);
        
        if (newRoom.participants.size > 0) {
          setIsOtherParticipantConnected(true);
          startSession();
        }
        
        // Set up participant joined handler
        newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('Participant connected:', participant.identity);
          setParticipants((prevParticipants) => [...prevParticipants, participant]);
          
          if (!isOtherParticipantConnected) {
            setIsOtherParticipantConnected(true);
            startSession();
          }
        });
        
        // Set up participant left handler
        newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('Participant disconnected:', participant.identity);
          setParticipants((prevParticipants) => 
            prevParticipants.filter((p) => p.identity !== participant.identity)
          );
          
          // End session if other participant leaves
          if (newRoom.participants.size === 0) {
            setIsOtherParticipantConnected(false);
            endSession();
            toast({
              title: 'Session Ended',
              description: 'The other participant has left the session.',
              variant: 'destructive'
            });
          }
        });
        
        // Listen for disconnect
        newRoom.on(RoomEvent.Disconnected, () => {
          console.log('Disconnected from room');
          endSession();
        });
        
      } catch (error) {
        console.error('Failed to connect to room:', error);
        toast({
          title: 'Connection Failed',
          description: 'Failed to connect to the video room. Please try again.',
          variant: 'destructive'
        });
      }
    }
    
    function startSession() {
      // Start the session
      setSessionStartTime(new Date());
      setBillingActive(true);
      
      toast({
        title: 'Session Started',
        description: 'Both participants are connected. Your session has begun.',
      });
      
      // Start timer to update session duration
      timerId = setInterval(() => {
        if (sessionStartTime) {
          const now = new Date();
          const durationMinutes = Math.floor((now.getTime() - sessionStartTime.getTime()) / 60000);
          setSessionDuration(durationMinutes);
        }
      }, 5000); // Update every 5 seconds
      
      // Start billing timer if user is the client
      if (userRole === 'client') {
        // Billing runs every minute
        billingTimerId = setInterval(() => {
          const now = new Date();
          const durationMinutes = Math.floor((now.getTime() - sessionStartTime!.getTime()) / 60000);
          
          if (durationMinutes > 0 && durationMinutes % 1 === 0) {
            console.log(`Billing for session duration: ${durationMinutes} minutes`);
            
            // Call the billing API
            recordSessionBilling(durationMinutes);
          }
        }, 60000); // Every minute
      }
    }
    
    function endSession() {
      setBillingActive(false);
      
      // Record final session duration if session was active
      if (sessionStartTime && billingActive) {
        const endTime = new Date();
        const totalMinutes = Math.ceil((endTime.getTime() - sessionStartTime.getTime()) / 60000);
        
        // Record final session
        recordSessionEnded(totalMinutes);
      }
      
      // Clear timers
      if (timerId) clearInterval(timerId);
      if (billingTimerId) clearInterval(billingTimerId);
    }
    
    async function recordSessionBilling(minutes: number) {
      try {
        const response = await fetch('/api/sessions/billing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            roomName,
            duration: minutes,
            userId,
            userRole
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to record session billing');
        }
        
        const data = await response.json();
        console.log('Billing recorded:', data);
      } catch (error) {
        console.error('Error recording session billing:', error);
      }
    }
    
    async function recordSessionEnded(totalMinutes: number) {
      try {
        const response = await fetch('/api/sessions/end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            roomName,
            totalDuration: totalMinutes,
            userId,
            userRole,
            startTime: sessionStartTime?.toISOString(),
            endTime: new Date().toISOString()
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to record session end');
        }
        
        const data = await response.json();
        console.log('Session ended and recorded:', data);
      } catch (error) {
        console.error('Error recording session end:', error);
      }
    }
    
    connectToRoom();
    
    return () => {
      // Clean up
      if (timerId) clearInterval(timerId);
      if (billingTimerId) clearInterval(billingTimerId);
      
      if (room) {
        room.disconnect();
      }
    };
  }, [token, roomName, userId, userName, userRole]);
  
  // Toggle camera
  const toggleCamera = async () => {
    if (!room) return;
    
    try {
      if (isCameraEnabled) {
        // Disable camera
        room.localParticipant.trackPublications.forEach((publication) => {
          if (
            publication.track?.kind === Track.Kind.Video && 
            publication.track?.source === Track.Source.Camera
          ) {
            publication.track?.stop();
            room.localParticipant.unpublishTrack(publication.track);
          }
        });
      } else {
        // Enable camera
        const videoTrack = await createLocalVideoTrack();
        await room.localParticipant.publishTrack(videoTrack);
      }
      
      setIsCameraEnabled(!isCameraEnabled);
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Failed to toggle camera. Please check your permissions.',
        variant: 'destructive'
      });
    }
  };
  
  // Toggle microphone
  const toggleMicrophone = async () => {
    if (!room) return;
    
    try {
      if (isMicEnabled) {
        // Disable microphone
        room.localParticipant.trackPublications.forEach((publication) => {
          if (publication.track?.kind === Track.Kind.Audio) {
            publication.track?.stop();
            room.localParticipant.unpublishTrack(publication.track);
          }
        });
      } else {
        // Enable microphone
        const audioTrack = await createLocalAudioTrack();
        await room.localParticipant.publishTrack(audioTrack);
      }
      
      setIsMicEnabled(!isMicEnabled);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
      toast({
        title: 'Microphone Error',
        description: 'Failed to toggle microphone. Please check your permissions.',
        variant: 'destructive'
      });
    }
  };
  
  // Leave room
  const leaveRoom = () => {
    if (room) {
      room.disconnect();
    }
    onEndSession();
  };
  
  // Format time display (e.g., "05:30")
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };
  
  // Render video elements
  const renderVideoElements = () => {
    return participants.map((participant) => (
      <div
        key={participant.identity}
        className="relative bg-black rounded-lg overflow-hidden aspect-video"
      >
        {/* Video would normally be rendered using LiveKit's components */}
        <div className="absolute inset-0 flex items-center justify-center">
          {participant === room?.localParticipant ? (
            <div className={`w-full h-full ${isCameraEnabled ? 'bg-slate-600' : 'bg-slate-800'} flex items-center justify-center`}>
              {!isCameraEnabled && (
                <div className="text-white text-center p-4 bg-slate-700 rounded-full h-24 w-24 flex items-center justify-center">
                  {userName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full bg-slate-700 flex items-center justify-center">
              <div className="text-white text-center p-4 bg-slate-600 rounded-full h-24 w-24 flex items-center justify-center">
                {participant.identity.slice(0, 2).toUpperCase()}
              </div>
            </div>
          )}
        </div>
        
        <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white">
          {participant.identity} 
          {participant === room?.localParticipant ? ' (You)' : ''}
        </div>
      </div>
    ));
  };
  
  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Live Session: {roomName}</h2>
          <p className="text-muted-foreground">Connected as: {userName} ({userRole})</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={isOtherParticipantConnected ? "success" : "destructive"}>
            {isOtherParticipantConnected ? 'Session Active' : 'Waiting...'}
          </Badge>
          
          {sessionStartTime && (
            <Badge variant="outline" className="text-lg">
              {formatTime(sessionDuration)}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Video Display Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow min-h-[400px]">
        {renderVideoElements()}
      </div>
      
      {/* Controls */}
      <div className="flex justify-center gap-4 p-4 bg-muted rounded-lg">
        <Button
          onClick={toggleCamera}
          variant={isCameraEnabled ? "default" : "outline"}
          className="w-24"
        >
          {isCameraEnabled ? 'Camera On' : 'Camera Off'}
        </Button>
        
        <Button
          onClick={toggleMicrophone}
          variant={isMicEnabled ? "default" : "outline"}
          className="w-24"
        >
          {isMicEnabled ? 'Mic On' : 'Mic Off'}
        </Button>
        
        <Button 
          onClick={leaveRoom} 
          variant="destructive"
        >
          Leave Room
        </Button>
      </div>
    </div>
  );
}