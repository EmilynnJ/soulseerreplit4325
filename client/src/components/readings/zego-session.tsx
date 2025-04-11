import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/formatters';

// Session type definitions
type SessionType = 'video' | 'voice' | 'chat';
type SessionStatus = 'connecting' | 'active' | 'ended' | 'error';

// Zego session props
interface ZegoSessionProps {
  roomId: string;
  userId: string;
  userName: string;
  readerMode?: boolean;
  sessionType: SessionType;
  onSessionEnd?: (duration: number, amount: number) => void;
  checkoutUrl?: string;
}

/**
 * ZegoSession component for video, voice, and chat readings
 */
export const ZegoSession: React.FC<ZegoSessionProps> = ({
  roomId,
  userId,
  userName,
  readerMode = false,
  sessionType = 'video',
  onSessionEnd,
  checkoutUrl
}) => {
  // State management
  const [status, setStatus] = useState<SessionStatus>('connecting');
  const [duration, setDuration] = useState<number>(0);
  const [billingAmount, setBillingAmount] = useState<number>(0);
  const [readerInfo, setReaderInfo] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  
  // Refs
  const zegoEngineRef = useRef<ZegoExpressEngine | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const billingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  
  // Timer for tracking session duration
  const startTimer = () => {
    if (timerRef.current) return;
    
    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };
  
  // Initialize billing tracking
  const startBillingTracker = () => {
    if (billingIntervalRef.current) return;
    
    // Check billing amount every minute
    billingIntervalRef.current = setInterval(async () => {
      try {
        const response = await apiRequest(`/api/sessions/billing`, {
          method: 'POST',
          body: JSON.stringify({ roomId })
        });
        
        if (response && response.amount) {
          setBillingAmount(response.amount);
        }
      } catch (error) {
        console.error('Failed to update billing amount:', error);
      }
    }, 60000); // Check every minute
  };
  
  // Stop all timers
  const stopTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (billingIntervalRef.current) {
      clearInterval(billingIntervalRef.current);
      billingIntervalRef.current = null;
    }
  };
  
  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Get token for the session
  const { data: tokenData, isLoading: isLoadingToken } = useQuery({
    queryKey: ['sessionToken', roomId],
    queryFn: async () => {
      const sessionType = 'video'; // or 'voice', 'chat' based on your session type
      const response = await apiRequest(`/api/sessions/token`, {
        method: 'POST',
        body: JSON.stringify({ roomId, sessionType })
      });
      return response;
    },
    enabled: !!roomId
  });
  
  // Get reader information
  useEffect(() => {
    const fetchReaderInfo = async () => {
      if (!readerMode) {
        try {
          const readerId = roomId.split('_')[1];
          if (readerId) {
            const response = await apiRequest(`/api/sessions/reader/${readerId}`);
            if (response) {
              setReaderInfo(response);
            }
          }
        } catch (error) {
          console.error('Failed to fetch reader info:', error);
        }
      }
    };
    
    fetchReaderInfo();
  }, [roomId, readerMode]);
  
  // Initialize ZEGO session
  useEffect(() => {
    if (isLoadingToken || !tokenData || !tokenData.token) return;
    
    // Start tracking time and billing
    startTimer();
    startBillingTracker();
    
    let appID: number;
    if (sessionType === 'video') {
      appID = parseInt(import.meta.env.VITE_ZEGO_VIDEO_APP_ID as string);
    } else if (sessionType === 'voice') {
      appID = parseInt(import.meta.env.VITE_ZEGO_PHONE_APP_ID as string);
    } else {
      appID = parseInt(import.meta.env.VITE_ZEGO_CHAT_APP_ID as string);
    }
    
    // Initialize ZEGO engine
    zegoEngineRef.current = new ZegoExpressEngine(appID, import.meta.env.VITE_ZEGO_APP_ENV || 'production');
    
    // Set up event listeners
    zegoEngineRef.current.on('roomStateUpdate', (roomID, state, errorCode) => {
      console.log(`Room ${roomID} state update: ${state}, error: ${errorCode}`);
      if (state === 'DISCONNECTED') {
        setStatus('ended');
        stopTimers();
      } else if (state === 'CONNECTED') {
        setStatus('active');
      }
    });
    
    zegoEngineRef.current.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
      console.log(`Room ${roomID} stream update:`, updateType, streamList);
      
      if (updateType === 'ADD' && streamList.length > 0) {
        // Play remote stream
        if (sessionType === 'video' && remoteVideoRef.current) {
          await zegoEngineRef.current!.startPlayingStream(
            streamList[0].streamID,
            {
              canvas: remoteVideoRef.current
            }
          );
        }
      }
    });
    
    // Join room
    zegoEngineRef.current.loginRoom(roomId, tokenData.token, {
      userID: userId,
      userName: userName
    });
    
    // Start local preview if in video mode
    const startLocalPreview = async () => {
      if (sessionType === 'video' && localVideoRef.current) {
        try {
          // Get user media
          const localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          
          setStream(localStream);
          
          // Set local video
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
          }
          
          // Start publishing stream
          await zegoEngineRef.current!.startPublishingStream(`${roomId}_${userId}`, localStream);
        } catch (error) {
          console.error('Failed to start local preview:', error);
          toast({
            title: 'Media Access Error',
            description: 'Failed to access camera or microphone. Please check your permissions.',
            variant: 'destructive'
          });
          setStatus('error');
        }
      }
    };
    
    startLocalPreview();
    
    // Clean up
    return () => {
      if (zegoEngineRef.current) {
        zegoEngineRef.current.stopPublishingStream();
        zegoEngineRef.current.logoutRoom(roomId);
        zegoEngineRef.current.destroy();
        zegoEngineRef.current = null;
      }
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      stopTimers();
    };
  }, [isLoadingToken, tokenData, roomId, userId, userName, sessionType]);
  
  // End session mutation
  const endSessionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/sessions/end', {
        method: 'POST',
        body: JSON.stringify({ roomId })
      });
    },
    onSuccess: (data) => {
      setStatus('ended');
      stopTimers();
      
      if (onSessionEnd && data) {
        onSessionEnd(data.duration || 0, data.totalAmount || 0);
      }
      
      // Clean up
      if (zegoEngineRef.current) {
        zegoEngineRef.current.stopPublishingStream();
        zegoEngineRef.current.logoutRoom(roomId);
        zegoEngineRef.current.destroy();
        zegoEngineRef.current = null;
      }
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    },
    onError: (error) => {
      console.error('Failed to end session:', error);
      toast({
        title: 'Error',
        description: 'Failed to end session gracefully. Please try again.',
        variant: 'destructive'
      });
    }
  });
  
  // Handle toggling audio
  const toggleAudio = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  // Handle toggling video
  const toggleVideo = () => {
    if (stream && sessionType === 'video') {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };
  
  // Handle ending the session
  const handleEndSession = () => {
    endSessionMutation.mutate();
  };
  
  // Render loading state
  if (isLoadingToken) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center">
            {readerMode ? 'Starting Reading Session' : 'Connecting to Reader'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-center">
            {readerMode ? 'Preparing your reading environment...' : 'Connecting to your reader...'}
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Render error state
  if (status === 'error') {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-destructive">Connection Error</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-center">
            There was a problem connecting to the session. Please check your internet connection and media permissions.
          </p>
          {checkoutUrl && (
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = checkoutUrl}>
              Return to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Render ended state
  if (status === 'ended') {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Session Ended</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-lg font-semibold">Thank you for your session!</p>
          <p className="mt-2">Session duration: {formatDuration(duration)}</p>
          <p className="mt-1">Amount: {formatCurrency(billingAmount)}</p>
          {checkoutUrl && (
            <Button className="mt-6" onClick={() => window.location.href = checkoutUrl}>
              Return to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Render active session
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="relative">
        <CardTitle className="flex justify-between items-center">
          <span>
            {readerMode ? `Reading with ${readerInfo?.username || 'Client'}` : `Reading with ${readerInfo?.username || 'Mystic Reader'}`}
          </span>
          <span className="text-sm font-normal flex items-center">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            {status === 'active' ? 'Connected' : 'Connecting...'}
          </span>
        </CardTitle>
        
        <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-sm">
          {formatDuration(duration)}
          {!readerMode && (
            <span className="ml-2">
              ({formatCurrency(billingAmount)})
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0 relative">
        <div className="w-full aspect-video bg-black relative">
          {/* Remote video (full size) */}
          {sessionType === 'video' && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Local video (picture-in-picture) */}
          {sessionType === 'video' && (
            <div className="absolute bottom-4 right-4 w-1/4 aspect-video bg-gray-900 rounded overflow-hidden shadow-lg border border-gray-700">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted={true}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          {/* Voice-only UI */}
          {sessionType === 'voice' && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <span className="text-4xl">{readerInfo?.username?.[0] || (readerMode ? 'C' : 'R')}</span>
              </div>
              <h3 className="text-xl font-semibold text-white">
                {readerInfo?.username || (readerMode ? 'Client' : 'Reader')}
              </h3>
              <p className="text-white/70 mt-2">Voice Reading in Progress</p>
              
              <div className="mt-8 flex space-x-4">
                <div className={`w-3 h-3 rounded-full ${status === 'active' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
                <div className={`w-3 h-3 rounded-full ${status === 'active' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse delay-100`}></div>
                <div className={`w-3 h-3 rounded-full ${status === 'active' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse delay-200`}></div>
              </div>
            </div>
          )}
          
          {/* Chat-only UI */}
          {sessionType === 'chat' && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <span className="text-4xl">{readerInfo?.username?.[0] || (readerMode ? 'C' : 'R')}</span>
              </div>
              <h3 className="text-xl font-semibold text-white">
                {readerInfo?.username || (readerMode ? 'Client' : 'Reader')}
              </h3>
              <p className="text-white/70 mt-2">Chat Reading in Progress</p>
              
              {/* Implement chat UI here */}
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between items-center p-4">
        <div className="flex space-x-2">
          {sessionType === 'video' && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={toggleVideo}
              className={isVideoOff ? 'bg-destructive text-white' : ''}
            >
              {isVideoOff ? (
                <span className="h-5 w-5">🚫</span>
              ) : (
                <span className="h-5 w-5">📹</span>
              )}
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleAudio}
            className={isMuted ? 'bg-destructive text-white' : ''}
          >
            {isMuted ? (
              <span className="h-5 w-5">🔇</span>
            ) : (
              <span className="h-5 w-5">🎤</span>
            )}
          </Button>
        </div>
        
        <Button 
          variant="destructive" 
          onClick={handleEndSession}
          disabled={endSessionMutation.isPending}
        >
          {endSessionMutation.isPending ? 'Ending...' : 'End Session'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ZegoSession;