import { useState, useEffect, useRef } from 'react';
import { Video, Mic, MicOff, VideoOff, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface VideoCallProps {
  token: string;
  readingId: number;
  readingType: 'video' | 'voice' | 'chat';
  onSessionEnd?: () => void;
}

/**
 * Placeholder component for video calls - LIVEKIT REMOVED
 * 
 * This component will be replaced with Zego Cloud implementation
 */
export function VideoCall({ token, readingId, readingType, onSessionEnd }: VideoCallProps) {
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(readingType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentCost, setCurrentCost] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  
  // Timer for elapsed time simulation
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    // Display a notification that LiveKit has been removed
    toast({
      title: 'LiveKit has been removed',
      description: 'Video calls will be implemented using Zego Cloud.',
    });
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [toast]);
  
  // Format seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // End the call
  const endCall = () => {
    if (onSessionEnd) {
      onSessionEnd();
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-background rounded-lg overflow-hidden">
      {/* Call status header */}
      <div className="bg-muted p-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-yellow-100 border-yellow-400 text-yellow-700">
            LiveKit Removed
          </Badge>
          <span className="text-sm font-medium">Duration: {formatTime(elapsedTime)}</span>
        </div>
        <div className="text-sm font-medium">
          Cost: ${currentCost.toFixed(2)}
        </div>
      </div>
      
      {/* Video area - placeholder */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        {/* Local video placeholder */}
        <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
            <Video className="h-12 w-12 text-muted-foreground opacity-50" />
            <p className="text-center text-muted-foreground mt-4 px-4">
              LiveKit has been removed. Zego Cloud will be implemented for video calls.
            </p>
          </div>
          <div className="absolute bottom-2 left-2 text-sm bg-black/50 text-white px-2 py-1 rounded">
            You
          </div>
        </div>
        
        {/* Remote participant placeholder */}
        <div className="relative bg-muted rounded-lg overflow-hidden aspect-video flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Video className="h-12 w-12 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground absolute bottom-4">
              Waiting for Zego Cloud implementation...
            </p>
          </div>
          <div className="absolute bottom-2 left-2 text-sm bg-black/50 text-white px-2 py-1 rounded">
            Participant
          </div>
        </div>
      </div>
      
      {/* Controls - placeholders */}
      <div className="bg-muted p-4 flex justify-center space-x-4">
        {readingType === 'video' && (
          <Button
            variant="outline"
            size="icon"
            className={isVideoEnabled ? 'bg-primary/10' : 'bg-destructive/10'}
            onClick={() => setIsVideoEnabled(!isVideoEnabled)}
            disabled
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        )}
        
        <Button
          variant="outline"
          size="icon"
          className={isAudioEnabled ? 'bg-primary/10' : 'bg-destructive/10'}
          onClick={() => setIsAudioEnabled(!isAudioEnabled)}
          disabled
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