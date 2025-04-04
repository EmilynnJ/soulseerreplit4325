import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Reading } from '@shared/schema';
import { User } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Mic, MicOff, PhoneOff } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import MuxPlayer from '@mux/mux-player-react';

interface VideoCallMuxProps {
  reading: Reading;
  user: User;
  isReader: boolean;
  onEndCall: () => void;
  onTimerUpdate: (seconds: number) => void;
}

export function VideoCallMux({
  reading,
  user,
  isReader,
  onEndCall,
  onTimerUpdate,
}: VideoCallMuxProps) {
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [livestreamId, setLivestreamId] = useState<number | null>(null);
  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Setup the video call
  useEffect(() => {
    async function setupVideoCall() {
      try {
        setIsLoading(true);
        
        // Create or get a livestream for this reading
        const response = await apiRequest('POST', `/api/readings/${reading.id}/livestream`, {
          title: `Reading session ${reading.id}`,
          description: `Video reading between reader ${reading.readerId} and client ${reading.clientId}`
        });
        
        const data = await response.json();
        
        if (data.id) {
          setLivestreamId(data.id);
          setPlaybackId(data.playbackId);
          setStreamKey(data.streamKey);
          setStreamUrl(data.streamUrl);
          
          // Start the timer for billing purposes
          startTimer();
        }
      } catch (error) {
        console.error('Error setting up video call:', error);
        toast({
          title: 'Error',
          description: 'Failed to set up the video call. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    setupVideoCall();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [reading.id]);

  // Start timer for billing
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        onTimerUpdate(newTime);
        return newTime;
      });
    }, 1000);
  };

  // Handle reader starting the stream
  const handleStartStream = () => {
    if (isReader && livestreamId) {
      // Provide information on how to start streaming
      toast({
        title: 'Start Streaming',
        description: `To start streaming, use OBS or similar software with the following settings:
          Stream URL: ${streamUrl}
          Stream Key: ${streamKey}`,
      });
      
      // Update the livestream status
      apiRequest('POST', `/api/livestreams/${livestreamId}/start`)
        .then(() => {
          toast({
            title: 'Session Started',
            description: 'The video session has been started. Your stream is now live.',
          });
        })
        .catch(error => {
          console.error('Error starting livestream:', error);
          toast({
            title: 'Error',
            description: 'Failed to start the livestream. Please try again.',
            variant: 'destructive',
          });
        });
    }
  };

  // Handle ending the call
  const handleEndCall = () => {
    if (livestreamId) {
      apiRequest('POST', `/api/livestreams/${livestreamId}/end`)
        .then(() => {
          toast({
            title: 'Call Ended',
            description: 'The video session has been ended.',
          });
          onEndCall();
        })
        .catch(error => {
          console.error('Error ending livestream:', error);
          toast({
            title: 'Error',
            description: 'Failed to end the livestream, but the session will be closed.',
            variant: 'destructive',
          });
          onEndCall();
        });
    } else {
      onEndCall();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          <div className="flex-1 relative mb-4 bg-background/10 rounded-lg overflow-hidden">
            {playbackId ? (
              isReader ? (
                // Reader sees instructions to start streaming
                <div className="absolute inset-0 flex items-center justify-center flex-col p-6">
                  <Video className="h-16 w-16 mb-4 text-primary" />
                  <h3 className="text-xl font-medium mb-2">Start Your Video Stream</h3>
                  <p className="text-center text-muted-foreground mb-6">
                    Use OBS or similar streaming software to start your video feed.
                  </p>
                  <Button onClick={handleStartStream} className="mb-4">
                    Start Streaming Instructions
                  </Button>
                  <div className="w-full max-w-md bg-background/20 p-4 rounded-md">
                    <div className="mb-2">
                      <span className="font-medium">Stream URL:</span> 
                      <code className="ml-2 text-xs break-all">{streamUrl}</code>
                    </div>
                    <div>
                      <span className="font-medium">Stream Key:</span> 
                      <code className="ml-2 text-xs break-all">{streamKey}</code>
                    </div>
                  </div>
                </div>
              ) : (
                // Client sees the video player
                <MuxPlayer
                  playbackId={playbackId}
                  streamType="live"
                  className="w-full h-full"
                  autoPlay
                  muted={isMuted}
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-muted-foreground">Video stream not available</p>
              </div>
            )}
          </div>

          <div className="flex justify-center space-x-4">
            <Button
              variant="outline"
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            
            <Button
              variant="destructive"
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={handleEndCall}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}