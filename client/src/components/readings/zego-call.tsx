import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, MicOff, Phone, Video, VideoOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface ZegoCallProps {
  roomId: string;
  userId: string;
  userName: string;
  token: string;
  appId: string;
  config: any;
  readingType: 'chat' | 'voice' | 'video';
  onSessionEnd?: () => void;
}

/**
 * Zego Cloud Video/Voice Call Component
 * This component handles both video and voice calls using ZEGOCLOUD SDK
 */
export function ZegoCall({
  roomId,
  userId,
  userName,
  token,
  appId,
  config,
  readingType,
  onSessionEnd
}: ZegoCallProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [zegoLoaded, setZegoLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(readingType === 'voice');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const zegoRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Load Zego script dynamically
  useEffect(() => {
    const loadZegoScript = async () => {
      if (window.ZegoUIKitPrebuilt) {
        setZegoLoaded(true);
        return;
      }
      
      try {
        const script = document.createElement('script');
        script.src = 'https://zegocloud.github.io/zego-uikit-prebuilt/ZegoUIKitPrebuilt.js';
        script.async = true;
        script.onload = () => setZegoLoaded(true);
        script.onerror = () => {
          setError('Failed to load Zego SDK. Please refresh the page.');
          toast({
            title: 'Connection Error',
            description: 'Failed to load video call component. Please refresh the page.',
            variant: 'destructive',
          });
        };
        document.body.appendChild(script);
      } catch (err) {
        console.error('Error loading Zego script:', err);
        setError('Failed to load video call component.');
      }
    };
    
    loadZegoScript();
    
    return () => {
      // Cleanup script if component unmounts during loading
      const script = document.querySelector('script[src="https://zegocloud.github.io/zego-uikit-prebuilt/ZegoUIKitPrebuilt.js"]');
      if (script && !zegoLoaded) {
        document.body.removeChild(script);
      }
    };
  }, [toast]);
  
  // Initialize Zego when script is loaded
  useEffect(() => {
    if (!zegoLoaded || !containerRef.current) return;
    
    const initZego = async () => {
      try {
        setIsLoading(true);
        
        // Make sure ZegoUIKitPrebuilt is available
        if (!window.ZegoUIKitPrebuilt) {
          throw new Error('Zego SDK not loaded');
        }
        
        // Create instance
        const { ZegoUIKitPrebuilt } = window;
        const kitToken = token;
        
        // Create instance
        zegoRef.current = ZegoUIKitPrebuilt.create(appId);
        
        // Join the room
        zegoRef.current.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: readingType === 'voice' ? 'OneONoneCall' : 'VideoCall',
            config: config,
          },
          showPreJoinView: false,
          token: kitToken,
          userID: userId,
          userName: userName,
          roomID: roomId,
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: readingType !== 'voice',
          showMyCameraToggleButton: readingType !== 'voice',
          showMyMicrophoneToggleButton: true,
          showUserList: true,
          maxUsers: 2,
          layout: "Auto",
          showScreenSharingButton: readingType === 'video',
          showTextChat: true,
          showLayoutButton: false,
          onLeaveRoom: () => {
            console.log('Left Zego room');
            if (onSessionEnd) {
              onSessionEnd();
            }
          },
          onJoinRoom: () => {
            console.log('Joined Zego room');
            setIsConnected(true);
            setIsLoading(false);
            
            // Start timer for session duration
            timerRef.current = setInterval(() => {
              setElapsedTime(prev => prev + 1);
            }, 1000);
          },
          onError: (error: any) => {
            console.error('Zego error:', error);
            setError(`Connection error: ${error.message || 'Failed to connect'}`);
            setIsLoading(false);
          }
        });
      } catch (error: any) {
        console.error('Error initializing Zego:', error);
        setError(`Failed to initialize call: ${error.message || 'Unknown error'}`);
        setIsLoading(false);
        
        toast({
          title: 'Connection Error',
          description: 'Failed to initialize call session. Please try again.',
          variant: 'destructive',
        });
      }
    };
    
    initZego();
    
    return () => {
      // Clean up
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (zegoRef.current) {
        try {
          zegoRef.current.destroy();
        } catch (err) {
          console.error('Error destroying Zego instance:', err);
        }
      }
    };
  }, [zegoLoaded, token, roomId, userId, userName, appId, config, readingType, onSessionEnd, toast]);
  
  // Format seconds into MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle muting/unmuting
  const toggleMute = () => {
    if (zegoRef.current) {
      try {
        if (isMuted) {
          zegoRef.current.turnOnMicrophone();
        } else {
          zegoRef.current.turnOffMicrophone();
        }
        setIsMuted(!isMuted);
      } catch (err) {
        console.error('Error toggling microphone:', err);
      }
    }
  };
  
  // Handle video on/off (for video calls only)
  const toggleVideo = () => {
    if (readingType !== 'video' || !zegoRef.current) return;
    
    try {
      if (isVideoDisabled) {
        zegoRef.current.turnOnCamera();
      } else {
        zegoRef.current.turnOffCamera();
      }
      setIsVideoDisabled(!isVideoDisabled);
    } catch (err) {
      console.error('Error toggling camera:', err);
    }
  };
  
  // End the call
  const endCall = () => {
    if (zegoRef.current) {
      try {
        zegoRef.current.leaveRoom();
      } catch (err) {
        console.error('Error leaving room:', err);
      }
    }
    
    if (onSessionEnd) {
      onSessionEnd();
    }
  };
  
  // If we have an error, display it
  if (error) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-red-500">Connection Error</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="text-center p-6">
            <p className="mb-4">{error}</p>
            <Button variant="default" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Show loading while initializing
  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin mb-4" />
        <p className="text-xl font-semibold mb-2">Connecting to Session</p>
        <p className="text-muted-foreground">Setting up secure {readingType} call...</p>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex flex-col">
      {/* Call container */}
      <div ref={containerRef} className="flex-grow relative" />
      
      {/* Call controls */}
      <div className="p-3 flex justify-between items-center bg-background border-t">
        <div className="flex items-center">
          <div className="bg-muted p-2 rounded-md mr-4">
            <span className="text-sm font-medium">
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleMute}
            className={isMuted ? "bg-red-100 text-red-500" : ""}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          
          {readingType === 'video' && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={toggleVideo}
              className={isVideoDisabled ? "bg-red-100 text-red-500" : ""}
            >
              {isVideoDisabled ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>
          )}
          
          <Button 
            variant="destructive" 
            size="icon" 
            onClick={endCall}
          >
            <Phone className="h-5 w-5 rotate-135" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Type augmentation for global window object
declare global {
  interface Window {
    ZegoUIKitPrebuilt: any;
  }
}

/**
 * Voice Call Component (uses ZegoCall with voice settings)
 */
export function ZegoVoiceCall(props: Omit<ZegoCallProps, 'readingType'>) {
  return <ZegoCall {...props} readingType="voice" />;
}

/**
 * Video Call Component (uses ZegoCall with video settings)
 */
export function ZegoVideoCall(props: Omit<ZegoCallProps, 'readingType'>) {
  return <ZegoCall {...props} readingType="video" />;
}

/**
 * Chat Component (uses ZegoCall with chat settings)
 */
export function ZegoChatCall(props: Omit<ZegoCallProps, 'readingType'>) {
  return <ZegoCall {...props} readingType="chat" />;
}