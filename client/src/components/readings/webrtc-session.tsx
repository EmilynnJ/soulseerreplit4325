import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { formatDuration } from '@/lib/utils';

// Define the props for the WebRTC session component
interface WebRTCSessionProps {
  roomId: string;
  userId: number;
  userName: string;
  readerId: number;
  readerName: string;
  sessionType: 'video' | 'voice' | 'chat';
  isReader: boolean;
  onSessionEnd?: (totalDuration: number) => void;
}

export default function WebRTCSession({
  roomId,
  userId,
  userName,
  readerId,
  readerName,
  sessionType,
  isReader,
  onSessionEnd
}: WebRTCSessionProps) {
  // References for media elements and connections
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
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

  // Function to initialize the WebRTC connection
  const initializeConnection = async () => {
    try {
      // Get the session token from localStorage
      const sessionId = localStorage.getItem('sessionId') || '';
      
      // Initialize socket connection with auth headers
      socketRef.current = io(window.location.origin, {
        transports: ['websocket'],
        upgrade: false,
        extraHeaders: {
          'Authorization': `Bearer ${sessionId}`,
          'X-Session-ID': sessionId
        }
      });

      // Register with the socket server
      socketRef.current.emit('register', {
        userId: userId,
        userType: isReader ? 'reader' : 'client'
      });

      // Handle registration response
      socketRef.current.on('registered', (response) => {
        if (response.success) {
          console.log('Socket registration successful');
          joinRoom();
        } else {
          setConnectionState('error');
          toast({
            title: 'Connection Error',
            description: 'Failed to register with signaling server',
            variant: 'destructive'
          });
        }
      });

      // Initialize WebRTC connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };
      peerConnectionRef.current = new RTCPeerConnection(configuration);

      // Get media based on session type
      let mediaConstraints: MediaStreamConstraints = {};
      if (sessionType === 'video') {
        mediaConstraints = { video: true, audio: true };
      } else if (sessionType === 'voice') {
        mediaConstraints = { audio: true };
      } else if (sessionType === 'chat') {
        // No media needed for chat only
        setConnectionState('ready');
        return;
      }

      // Get user media
      const localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      localStreamRef.current = localStream;

      // Display local video
      if (localVideoRef.current && sessionType === 'video') {
        localVideoRef.current.srcObject = localStream;
      }

      // Add tracks to peer connection
      localStream.getTracks().forEach(track => {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addTrack(track, localStream);
        }
      });

      // Set up event handlers for WebRTC connection
      if (peerConnectionRef.current) {
        // Handle ICE candidates
        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit('ice-candidate', {
              candidate: event.candidate,
              roomId,
              sender: userId,
              target: isReader ? parseInt(userId.toString()) : readerId
            });
          }
        };

        // Handle connection state changes
        peerConnectionRef.current.onconnectionstatechange = () => {
          if (peerConnectionRef.current) {
            setConnectionState(peerConnectionRef.current.connectionState);
          }
        };

        // Handle new tracks from remote peer
        peerConnectionRef.current.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };
      }

      // Set up socket event handlers
      if (socketRef.current) {
        // Handle incoming offers
        socketRef.current.on('offer', async (data) => {
          if (peerConnectionRef.current && data.sender !== userId) {
            try {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
              const answer = await peerConnectionRef.current.createAnswer();
              await peerConnectionRef.current.setLocalDescription(answer);

              socketRef.current?.emit('answer', {
                answer,
                roomId,
                sender: userId,
                target: data.sender
              });
            } catch (error) {
              console.error('Error handling offer:', error);
            }
          }
        });

        // Handle incoming answers
        socketRef.current.on('answer', async (data) => {
          if (peerConnectionRef.current && data.sender !== userId) {
            try {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (error) {
              console.error('Error handling answer:', error);
            }
          }
        });

        // Handle incoming ICE candidates
        socketRef.current.on('ice-candidate', async (data) => {
          if (peerConnectionRef.current && data.sender !== userId) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          }
        });

        // Handle user joining
        socketRef.current.on('user-joined', (data) => {
          console.log(`User joined: ${data.userId} (${data.userType})`);
          if (data.userId !== userId) {
            setConnectionState('connected');
            setIsSessionActive(true);
            
            // Start timer when both users are connected
            startTimer();
            
            // For client, start billing interval
            if (!isReader) {
              startBillingInterval();
            }
          }
        });

        // Handle session start
        socketRef.current.on('session-started', (data) => {
          console.log('Session started:', data);
          setIsSessionActive(true);
        });

        // Handle session end
        socketRef.current.on('session-ended', (data) => {
          console.log('Session ended:', data);
          handleEndSession(data.duration);
        });

        // Handle billing events
        socketRef.current.on('billing-processed', (data) => {
          console.log('Billing processed:', data);
          setBillingStatus(prev => ({
            lastBilled: new Date(),
            amount: prev.amount + data.duration
          }));
          
          // Update the elapsed time to match the server
          if (data.billingDetails && data.billingDetails.duration) {
            setElapsedTime(Math.floor(data.billingDetails.duration * 60));
          }
        });
      }

      setConnectionState('ready');
    } catch (error) {
      console.error('Error initializing connection:', error);
      setConnectionState('error');
      toast({
        title: 'Connection Error',
        description: `Failed to initialize connection: ${(error as Error).message}`,
        variant: 'destructive'
      });
    }
  };

  // Function to join the room
  const joinRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('join-session', {
        roomId,
        userId,
        userType: isReader ? 'reader' : 'client'
      });
      
      // If reader, create and send offer
      if (isReader && peerConnectionRef.current) {
        createAndSendOffer();
      }
    }
  };

  // Function to create and send an offer
  const createAndSendOffer = async () => {
    if (peerConnectionRef.current && socketRef.current) {
      try {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        
        socketRef.current.emit('offer', {
          offer,
          roomId,
          sender: userId,
          target: parseInt(userId.toString()) === readerId ? parseInt(userId.toString()) : readerId
        });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
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
    
    // Process billing every minute
    billingIntervalRef.current = setInterval(() => {
      if (socketRef.current) {
        socketRef.current.emit('process-billing', {
          roomId,
          duration: 1, // bill 1 minute
          userId,
          userRole: isReader ? 'reader' : 'client'
        });
      }
    }, 60000); // every minute
  };

  // Function to toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Function to toggle video
  const toggleVideo = () => {
    if (localStreamRef.current && sessionType === 'video') {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Function to send a chat message
  const sendChatMessage = () => {
    if (chatInput.trim() && socketRef.current) {
      const message = {
        sender: isReader ? readerName : userName,
        text: chatInput.trim(),
        timestamp: new Date()
      };
      
      // Add message to local state
      setChatMessages(prev => [...prev, message]);
      
      // Send message through socket
      socketRef.current.emit('chat-message', {
        roomId,
        sender: userId,
        senderName: isReader ? readerName : userName,
        message: chatInput.trim(),
        target: isReader ? parseInt(userId.toString()) : readerId
      });
      
      // Clear input
      setChatInput('');
    }
  };

  // Function to handle ending the session
  const handleEndSession = (duration?: number) => {
    // Stop timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (billingIntervalRef.current) {
      clearInterval(billingIntervalRef.current);
      billingIntervalRef.current = null;
    }
    
    // Close media streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    // Notify server
    if (socketRef.current) {
      socketRef.current.emit('end-session', {
        roomId,
        totalDuration: duration || Math.ceil(elapsedTime / 60) // convert seconds to minutes
      });
      
      socketRef.current.disconnect();
    }
    
    setIsSessionActive(false);
    setConnectionState('closed');
    
    // Call onSessionEnd if provided
    if (onSessionEnd) {
      onSessionEnd(duration || Math.ceil(elapsedTime / 60));
    }
    
    // Update query cache
    queryClient.invalidateQueries({ queryKey: ['/api/sessions/reader', readerId] });
    queryClient.invalidateQueries({ queryKey: ['/api/sessions/client', userId] });
  };

  // Initialize connection on component mount
  useEffect(() => {
    initializeConnection();
    
    // Clean up on unmount
    return () => {
      if (isSessionActive) {
        handleEndSession();
      }
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessionType === 'video' && (
              <>
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
              </>
            )}
            
            {sessionType === 'voice' && (
              <div className="flex items-center justify-center p-4 bg-slate-100 rounded-md h-48">
                <div className="text-center">
                  <div className="text-xl font-semibold mb-2">Voice Session</div>
                  <div>Speaking with: {isReader ? userName : readerName}</div>
                  <audio ref={remoteVideoRef} autoPlay className="hidden" />
                </div>
              </div>
            )}
            
            {/* Chat area */}
            <div className={`flex flex-col ${sessionType === 'chat' ? 'col-span-2' : 'col-span-2 md:col-span-1'}`}>
              <div
                ref={chatMessagesRef}
                className="h-48 md:h-64 overflow-y-auto p-4 bg-slate-100 rounded-md mb-2"
              >
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 h-full flex items-center justify-center">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-2 p-2 rounded-md max-w-[80%] ${
                        msg.sender === (isReader ? readerName : userName)
                          ? 'bg-blue-100 ml-auto'
                          : 'bg-white'
                      }`}
                    >
                      <div className="font-semibold text-sm">{msg.sender}</div>
                      <div>{msg.text}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendChatMessage();
                  }}
                  placeholder="Type your message..."
                  className="flex-1 p-2 border rounded-md"
                  disabled={!isSessionActive || connectionState !== 'connected'}
                />
                <Button
                  onClick={sendChatMessage}
                  disabled={!isSessionActive || connectionState !== 'connected' || !chatInput.trim()}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>

          <Separator className="my-4" />
          
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex gap-2">
              {(sessionType === 'video' || sessionType === 'voice') && (
                <>
                  <Button
                    variant={isMuted ? 'destructive' : 'outline'}
                    onClick={toggleAudio}
                    disabled={!isSessionActive}
                  >
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                  
                  {sessionType === 'video' && (
                    <Button
                      variant={isVideoOff ? 'destructive' : 'outline'}
                      onClick={toggleVideo}
                      disabled={!isSessionActive}
                    >
                      {isVideoOff ? 'Turn On Video' : 'Turn Off Video'}
                    </Button>
                  )}
                </>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm">
                Session duration: <span className="font-semibold">{formatDuration(elapsedTime)}</span>
              </div>
              
              {!isReader && (
                <div className="text-sm">
                  Billed: <span className="font-semibold">${billingStatus.amount.toFixed(2)}</span>
                </div>
              )}
              
              <Button
                variant="destructive"
                onClick={() => handleEndSession()}
                disabled={!isSessionActive}
              >
                End Session
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}