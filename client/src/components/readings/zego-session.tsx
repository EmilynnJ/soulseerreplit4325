import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { formatDuration } from '@/lib/utils';
import { zegoService, ZegoServiceType } from '@/services/zego-service';
import { apiRequest } from '@/lib/queryClient';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Clock, DollarSign } from 'lucide-react';

// Define the props for the ZEGO session component
interface ZegoSessionProps {
  roomId: string;
  token: string;
  userId: number;
  userName: string;
  readerId: number;
  readerName: string;
  sessionType: 'video' | 'voice' | 'chat';
  isReader: boolean;
  onSessionEnd?: (totalDuration: number) => void;
}

export default function ZegoSession({
  roomId,
  token,
  userId,
  userName,
  readerId,
  readerName,
  sessionType,
  isReader,
  onSessionEnd
}: ZegoSessionProps) {
  // References for media elements
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);

  // State for session management
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; timestamp: Date }[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [billingStatus, setBillingStatus] = useState<{ lastBilled: Date; amount: number }>({
    lastBilled: new Date(),
    amount: 0
  });

  // Timer interval reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const billingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Convert session type to ZEGO service type
  const getServiceType = (): ZegoServiceType => {
    switch (sessionType) {
      case 'video': return 'video';
      case 'voice': return 'voice';
      case 'chat': return 'chat';
      default: return 'video';
    }
  };

  // Function to initialize the ZEGO connection
  const initializeConnection = async () => {
    try {
      setConnectionState('connecting');
      
      // Convert userId to ZEGO format
      const zegoUserId = isReader ? `reader_${userId}` : `client_${userId}`;
      
      // Initialize ZEGO service
      await zegoService.initialize(getServiceType());
      
      // Setup event listeners
      setupEventListeners();
      
      // Join the room
      await zegoService.joinRoom(roomId, zegoUserId, token);
      
      // Get media for video/voice sessions
      if (sessionType === 'video' || sessionType === 'voice') {
        const mediaConfig = {
          video: sessionType === 'video',
          audio: true
        };
        
        const localStream = await zegoService.startLocalStream(
          mediaConfig.video, 
          mediaConfig.audio
        );
        
        // Set local video reference
        if (localVideoRef.current && localStream && sessionType === 'video') {
          localVideoRef.current.srcObject = localStream;
          localStreamRef.current = localStream;
        }
        
        // Start publishing the stream
        await zegoService.publishStream();
      }
      
      // Update connection state
      setConnectionState('connected');
      setIsSessionActive(true);
      
      // Notify server that session is connected
      await fetch(`/api/zego/reading/connected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomId })
      });
      
      // Start timer when both users are connected
      startTimer();
      
      // For client, track billing
      if (!isReader) {
        startBillingInterval();
      }
    } catch (error) {
      console.error('Error initializing ZEGO connection:', error);
      setConnectionState('error');
      toast({
        title: 'Connection Error',
        description: `Failed to connect: ${(error as Error).message}`,
        variant: 'destructive'
      });
    }
  };

  // Set up event listeners for ZEGO service
  const setupEventListeners = () => {
    // Room state updates
    zegoService.addEventListener('roomStateUpdate', (data: any) => {
      if (data.state === 'CONNECTED') {
        setConnectionState('connected');
      } else if (data.state === 'DISCONNECTED') {
        setConnectionState('disconnected');
      }
    });
    
    // Remote stream added
    zegoService.addEventListener('remoteStreamAdded', (data: any) => {
      if (remoteVideoRef.current && data.stream) {
        remoteVideoRef.current.srcObject = data.stream;
      }
    });
    
    // Error handling
    zegoService.addEventListener('error', (data: any) => {
      console.error('ZEGO error:', data);
      toast({
        title: 'Connection Error',
        description: `ZEGO error ${data.errorCode}: ${data.errorMessage}`,
        variant: 'destructive'
      });
    });
  };

  // Function to start the session timer
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
  };

  // Function to start the billing interval
  const startBillingInterval = () => {
    if (billingIntervalRef.current) {
      clearInterval(billingIntervalRef.current);
    }
    
    // Process billing every minute on client side
    billingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/sessions/billing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            roomId,
            duration: 1 // bill 1 minute
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result && result.success) {
            setBillingStatus(prev => ({
              lastBilled: new Date(),
              amount: prev.amount + (result.amount || 0)
            }));
          }
        }
      } catch (error) {
        console.error('Error processing billing:', error);
      }
    }, 60000); // every minute
  };

  // Function to toggle audio
  const toggleAudio = () => {
    zegoService.muteLocalAudio(isMuted);
    setIsMuted(!isMuted);
  };

  // Function to toggle video
  const toggleVideo = () => {
    if (sessionType === 'video') {
      zegoService.enableLocalVideo(!isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  // Function to send a chat message
  const sendChatMessage = async () => {
    if (chatInput.trim()) {
      const message = {
        sender: isReader ? readerName : userName,
        text: chatInput.trim(),
        timestamp: new Date()
      };
      
      // Add message to local state
      setChatMessages(prev => [...prev, message]);
      
      // Clear input
      setChatInput('');
      
      // In a real implementation, you'd send this through your messaging system
      // For this example, we don't have a ZEGO messaging implementation
      // so this is local-only chat
    }
  };

  // Function to handle ending the session
  const handleEndSession = async () => {
    // Stop timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (billingIntervalRef.current) {
      clearInterval(billingIntervalRef.current);
      billingIntervalRef.current = null;
    }
    
    // Leave ZEGO room
    await zegoService.leaveRoom();
    
    // Notify server
    try {
      const response = await fetch(`/api/zego/reading/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId,
          reason: 'completed'
        })
      });
      
      setIsSessionActive(false);
      setConnectionState('closed');
      
      // Call onSessionEnd if provided
      if (response.ok) {
        const result = await response.json();
        if (onSessionEnd && result && result.sessionLog) {
          onSessionEnd(result.sessionLog.duration || Math.ceil(elapsedTime / 60));
        }
      }
      
      // Update queries
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/reader', readerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/client', userId] });
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: 'Error',
        description: 'Failed to end the session properly. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Initialize connection on component mount
  useEffect(() => {
    initializeConnection();
    
    // Clean up on unmount
    return () => {
      if (isSessionActive) {
        handleEndSession();
      }
      
      // Remove event listeners
      zegoService.destroy();
    };
  }, []);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto">
      <Card className="mb-4">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Reading Session
            </CardTitle>
            <Badge variant={
              connectionState === 'connected' ? 'default' :
              connectionState === 'closed' ? 'destructive' :
              connectionState === 'error' ? 'destructive' :
              'secondary'
            }>
              {connectionState}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {sessionType === 'video' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local video */}
              <div className="relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-48 md:h-64 bg-black rounded-md object-cover"
                />
                <div className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                  {isReader ? readerName : userName} (You)
                </div>
              </div>
              
              {/* Remote video */}
              <div className="relative">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-48 md:h-64 bg-black rounded-md object-cover"
                />
                <div className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
                  {isReader ? userName : readerName}
                </div>
              </div>
            </div>
          )}
          
          {sessionType === 'voice' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-md bg-primary/5 flex flex-col items-center justify-center min-h-[200px]">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-3">
                  <span className="text-xl font-bold text-white">
                    {isReader ? readerName.charAt(0).toUpperCase() : userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-center font-medium">{isReader ? readerName : userName} (You)</p>
                <p className="text-xs text-muted-foreground">
                  {isMuted ? 'Muted' : 'Speaking'}
                </p>
              </div>
              
              <div className="p-4 rounded-md bg-primary/5 flex flex-col items-center justify-center min-h-[200px]">
                <div className="w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center mb-3">
                  <span className="text-xl font-bold text-primary-foreground">
                    {isReader ? userName.charAt(0).toUpperCase() : readerName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-center font-medium">{isReader ? userName : readerName}</p>
                <p className="text-xs text-muted-foreground">
                  {connectionState === 'connected' ? 'Connected' : 'Connecting...'}
                </p>
              </div>
            </div>
          )}
          
          {/* Session info */}
          <div className="flex flex-wrap justify-between items-center mt-6 gap-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Duration: {formatDuration(elapsedTime)}
              </span>
            </div>
            
            {!isReader && (
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Current charge: ${(billingStatus.amount).toFixed(2)}
                </span>
              </div>
            )}
          </div>
          
          <Separator className="my-4" />
          
          {/* Chat area if needed */}
          {(sessionType === 'chat' || true) && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Chat</h3>
              <div 
                ref={chatMessagesRef}
                className="h-48 overflow-y-auto p-3 border rounded-md mb-2 bg-background"
              >
                {chatMessages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No messages yet
                  </p>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-xs text-muted-foreground">
                        {msg.sender} - {msg.timestamp.toLocaleTimeString()}
                      </p>
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                />
                <Button onClick={sendChatMessage} variant="secondary" size="sm">Send</Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <div className="flex space-x-2">
            <Button
              onClick={toggleAudio}
              variant="outline"
              size="sm"
              className={isMuted ? 'text-red-500' : ''}
            >
              {isMuted ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>
            
            {sessionType === 'video' && (
              <Button
                onClick={toggleVideo}
                variant="outline"
                size="sm"
                className={isVideoOff ? 'text-red-500' : ''}
              >
                {isVideoOff ? <VideoOff className="h-4 w-4 mr-1" /> : <Video className="h-4 w-4 mr-1" />}
                {isVideoOff ? 'Show Video' : 'Hide Video'}
              </Button>
            )}
          </div>
          
          <Button onClick={handleEndSession} variant="destructive" size="sm">
            <PhoneOff className="h-4 w-4 mr-1" />
            End Session
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}