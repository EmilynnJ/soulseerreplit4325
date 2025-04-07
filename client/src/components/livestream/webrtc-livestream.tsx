import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Video, Mic, MicOff, VideoOff, Users, Send, VideoIcon, Heart, Star, Gift } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import io, { Socket } from 'socket.io-client';
import { apiRequest } from '@/lib/queryClient';

interface WebRTCLivestreamProps {
  roomId: string;
  hostId: number;
  isHost: boolean;
  title: string;
  onEnd?: () => void;
}

type ChatMessage = {
  sender: number;
  senderName: string;
  message: string;
  timestamp: Date;
};

type Gift = {
  id: string;
  senderId: number;
  senderName: string;
  amount: number;
  giftType: string;
  message?: string;
  timestamp: Date;
};

export function WebRTCLivestream({ roomId, hostId, isHost, title, onEnd }: WebRTCLivestreamProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Refs
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [message, setMessage] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isGiftDialogOpen, setIsGiftDialogOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState(100); // $1.00
  const [giftType, setGiftType] = useState<string>('applause');
  const [giftMessage, setGiftMessage] = useState('');
  
  // ICE servers configuration for WebRTC
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };
  
  // Initialize the WebRTC connection
  useEffect(() => {
    if (!user || !roomId) return;
    
    const initializeLivestream = async () => {
      try {
        // Get the session token from localStorage
        const sessionId = localStorage.getItem('sessionId') || '';
        
        // Connect to socket server with auth headers - use the same path as the WebRTC service
        socketRef.current = io(window.location.origin, {
          transports: ['websocket', 'polling'],
          extraHeaders: {
            'Authorization': `Bearer ${sessionId}`,
            'X-Session-ID': sessionId
          }
        });
        
        // Set up event handlers
        setupSocketEventHandlers();
        
        // Register with the livestream service
        socketRef.current.emit('register-livestream', {
          userId: user.id,
          userType: isHost ? 'host' : 'viewer',
          displayName: user.fullName || user.username,
        });
        
        // Initialize WebRTC for host
        if (isHost) {
          await initializeHostWebRTC();
        }
        
        // Join the livestream room
        socketRef.current.emit('join-livestream', {
          roomId,
          userId: user.id,
          userType: isHost ? 'host' : 'viewer',
        });
        
        toast({
          title: isHost ? 'Livestream started' : 'Joined livestream',
          description: isHost ? 'Your livestream is now live!' : `You've joined the livestream`,
          duration: 3000,
        });
        
        // Cleanup on unmount
        return () => {
          if (socketRef.current) {
            socketRef.current.emit('leave-livestream', {
              roomId,
              userId: user.id,
              userType: isHost ? 'host' : 'viewer',
            });
            socketRef.current.disconnect();
          }
          
          cleanup();
        };
      } catch (error) {
        console.error('Failed to initialize livestream:', error);
        toast({
          title: 'Connection error',
          description: 'Failed to connect to the livestream',
          variant: 'destructive',
        });
      }
    };
    
    initializeLivestream();
  }, [user, roomId, isHost]);
  
  // Set up socket event handlers
  const setupSocketEventHandlers = () => {
    if (!socketRef.current) return;
    
    socketRef.current.on('livestream-registered', (data) => {
      if (data.success) {
        console.log('Successfully registered with livestream service');
      } else {
        console.error('Failed to register with livestream service:', data.error);
      }
    });
    
    socketRef.current.on('joined-livestream', (data) => {
      console.log('Joined livestream:', data);
      setIsConnected(true);
      setViewerCount(data.viewerCount || 0);
    });
    
    socketRef.current.on('viewer-joined', (data) => {
      console.log('Viewer joined:', data);
      setViewerCount(data.viewerCount || 0);
      
      // Add system message
      setChatMessages((prev) => [
        ...prev,
        {
          sender: -1, // System message
          senderName: 'System',
          message: `${data.username} joined the livestream`,
          timestamp: new Date(),
        },
      ]);
    });
    
    socketRef.current.on('viewer-left', (data) => {
      console.log('Viewer left:', data);
      setViewerCount(data.viewerCount || 0);
    });
    
    socketRef.current.on('livestream-chat', (data) => {
      setChatMessages((prev) => [...prev, {
        sender: data.sender,
        senderName: data.senderName,
        message: data.message,
        timestamp: new Date(data.timestamp),
      }]);
      
      // Scroll to bottom of chat
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });
    
    socketRef.current.on('livestream-gift', (data) => {
      setGifts((prev) => [...prev, {
        id: data.id,
        senderId: data.senderId,
        senderName: data.senderName,
        amount: data.amount,
        giftType: data.giftType,
        message: data.message,
        timestamp: new Date(data.timestamp),
      }]);
      
      // Add system message about the gift
      setChatMessages((prev) => [
        ...prev,
        {
          sender: -1, // System message
          senderName: 'System',
          message: `${data.senderName} sent a ${data.giftType} gift of $${(data.amount / 100).toFixed(2)}!`,
          timestamp: new Date(),
        },
      ]);
    });
    
    socketRef.current.on('livestream-ended', (data) => {
      console.log('Livestream ended:', data);
      toast({
        title: 'Livestream ended',
        description: 'The livestream has ended',
        duration: 3000,
      });
      
      // Clean up and call onEnd callback
      cleanup();
      if (onEnd) onEnd();
    });
    
    // WebRTC signaling
    socketRef.current.on('livestream-offer', async (data) => {
      if (!isHost && data.sender === hostId) {
        console.log('Received offer from host');
        await handleHostOffer(data.sdp);
      }
    });
    
    socketRef.current.on('livestream-answer', (data) => {
      if (isHost && peerConnectionRef.current) {
        console.log('Received answer from viewer');
        const remoteDesc = new RTCSessionDescription(data.sdp);
        peerConnectionRef.current.setRemoteDescription(remoteDesc).catch(console.error);
      }
    });
    
    socketRef.current.on('livestream-ice-candidate', (data) => {
      if (peerConnectionRef.current) {
        console.log('Received ICE candidate');
        try {
          const candidate = new RTCIceCandidate(data.candidate);
          peerConnectionRef.current.addIceCandidate(candidate).catch(console.error);
        } catch (e) {
          console.error('Error adding received ICE candidate', e);
        }
      }
    });
    
    socketRef.current.on('error', (data) => {
      console.error('Socket error:', data);
      toast({
        title: 'Error',
        description: data.message || 'An error occurred',
        variant: 'destructive',
      });
    });
  };
  
  // Initialize WebRTC for host
  const initializeHostWebRTC = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      localStreamRef.current = stream;
      
      // Show local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Create peer connection
      peerConnectionRef.current = new RTCPeerConnection(iceServers);
      
      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track) => {
        peerConnectionRef.current?.addTrack(track, stream);
      });
      
      // Set up ICE candidate handling
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('livestream-ice-candidate', {
            roomId,
            sender: user?.id,
            candidate: event.candidate,
          });
        }
      };
      
      // Create and send offer to all viewers
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      if (socketRef.current) {
        socketRef.current.emit('livestream-offer', {
          roomId,
          sender: user?.id,
          sdp: offer,
        });
      }
      
      console.log('Host WebRTC initialized');
    } catch (error) {
      console.error('Error initializing host WebRTC:', error);
      toast({
        title: 'Camera/Mic Error',
        description: 'Failed to access camera or microphone',
        variant: 'destructive',
      });
    }
  };
  
  // Handle offer from host (for viewers)
  const handleHostOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      // Create peer connection if not exists
      if (!peerConnectionRef.current) {
        peerConnectionRef.current = new RTCPeerConnection(iceServers);
        
        // Set up remote stream handling
        peerConnectionRef.current.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };
        
        // Set up ICE candidate handling
        peerConnectionRef.current.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit('livestream-ice-candidate', {
              roomId,
              sender: user?.id,
              candidate: event.candidate,
            });
          }
        };
      }
      
      // Set remote description (the host's offer)
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Create and send answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      if (socketRef.current) {
        socketRef.current.emit('livestream-answer', {
          roomId,
          sender: user?.id,
          sdp: answer,
        });
      }
      
      console.log('Viewer answered host offer');
    } catch (error) {
      console.error('Error handling host offer:', error);
    }
  };
  
  // Send a chat message
  const sendMessage = () => {
    if (!message.trim() || !socketRef.current || !user) return;
    
    socketRef.current.emit('livestream-chat', {
      roomId,
      sender: user.id,
      senderName: user.fullName || user.username,
      message: message.trim(),
    });
    
    setMessage('');
  };
  
  // Send a gift to the host
  const sendGift = async () => {
    if (!socketRef.current || !user) return;
    
    try {
      // First verify the user has enough funds (this would integrate with your payment system)
      // For demo purposes, we'll assume successful payment
      
      // Send gift via socket
      socketRef.current.emit('livestream-gift', {
        roomId,
        senderId: user.id,
        hostId,
        amount: giftAmount,
        giftType,
        message: giftMessage,
      });
      
      // Close gift dialog
      setIsGiftDialogOpen(false);
      setGiftMessage('');
      
      toast({
        title: 'Gift sent',
        description: `You sent a ${giftType} gift of $${(giftAmount / 100).toFixed(2)}!`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error sending gift:', error);
      toast({
        title: 'Gift failed',
        description: 'Failed to send gift',
        variant: 'destructive',
      });
    }
  };
  
  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };
  
  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };
  
  // End livestream (host only)
  const endLivestream = async () => {
    try {
      if (isHost) {
        // Call API to end livestream
        await apiRequest(`/api/livestreams/${roomId}/end`, {
          method: 'POST',
          body: {}
        });
        
        toast({
          title: 'Livestream ended',
          description: 'Your livestream has been ended',
          duration: 3000,
        });
      } else {
        // Just leave the livestream
        if (socketRef.current) {
          socketRef.current.emit('leave-livestream', {
            roomId,
            userId: user?.id,
            userType: isHost ? 'host' : 'viewer',
          });
        }
      }
      
      cleanup();
      if (onEnd) onEnd();
    } catch (error) {
      console.error('Error ending livestream:', error);
      toast({
        title: 'Error',
        description: 'Failed to end livestream',
        variant: 'destructive',
      });
    }
  };
  
  // Cleanup WebRTC resources
  const cleanup = () => {
    // Stop all tracks in local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    setIsConnected(false);
  };
  
  // Format timestamp
  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const date = new Date(timestamp);
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-100px)]">
      {/* Video Area */}
      <div className="flex flex-col space-y-4 w-full md:w-3/4">
        <Card className="rounded-lg overflow-hidden relative bg-black flex-1">
          {/* Host Video */}
          {isHost ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
            />
          ) : (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Video disabled placeholder */}
          {isHost && !isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff size={64} className="text-gray-400" />
            </div>
          )}
          
          {/* Viewer count */}
          <div className="absolute top-4 right-4 bg-black/60 rounded-full px-3 py-1 flex items-center space-x-1">
            <Users size={16} className="text-white" />
            <span className="text-white text-sm">{viewerCount}</span>
          </div>
          
          {/* Livestream title */}
          <div className="absolute top-4 left-4 bg-black/60 rounded-full px-3 py-1">
            <span className="text-white text-sm font-medium">{title}</span>
          </div>
          
          {/* Controls for host */}
          {isHost && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-black/60 rounded-full px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                className={isVideoEnabled ? 'text-white hover:text-white/80' : 'text-red-500 hover:text-red-400'}
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className={isAudioEnabled ? 'text-white hover:text-white/80' : 'text-red-500 hover:text-red-400'}
                onClick={toggleAudio}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={endLivestream}
              >
                End Livestream
              </Button>
            </div>
          )}
          
          {/* Leave button for viewers */}
          {!isHost && (
            <div className="absolute bottom-4 right-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={endLivestream}
              >
                Leave
              </Button>
            </div>
          )}
        </Card>
      </div>
      
      {/* Chat and Gifts Area */}
      <Card className="w-full md:w-1/4 flex flex-col">
        <div className="p-3 border-b flex justify-between items-center">
          <h3 className="font-semibold">Live Chat</h3>
          <div className="flex items-center space-x-1">
            <Users size={14} />
            <span className="text-sm">{viewerCount}</span>
          </div>
        </div>
        
        {/* Chat messages */}
        <ScrollArea className="flex-1 p-3" ref={chatContainerRef}>
          <div className="space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className="flex flex-col">
                <div className="flex items-start space-x-2">
                  {msg.sender === -1 ? (
                    <div className="bg-purple-100 dark:bg-purple-900/20 p-2 rounded-md text-xs w-full text-center">
                      {msg.message}
                    </div>
                  ) : (
                    <>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-xs">
                            {msg.senderName}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{msg.message}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {/* Chat input */}
        <div className="p-3 border-t">
          {!isHost && (
            <div className="flex justify-center space-x-2 mb-3">
              <Dialog open={isGiftDialogOpen} onOpenChange={setIsGiftDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Gift size={16} className="mr-1" /> Send Gift
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send a Gift</DialogTitle>
                    <DialogDescription>
                      Show your appreciation by sending a gift to the host.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={giftType === 'applause' ? 'default' : 'outline'}
                        className="flex flex-col p-3 h-auto"
                        onClick={() => setGiftType('applause')}
                      >
                        <span className="text-2xl">👏</span>
                        <span className="text-xs mt-1">Applause</span>
                        <span className="text-xs font-semibold">$1</span>
                      </Button>
                      
                      <Button
                        variant={giftType === 'heart' ? 'default' : 'outline'}
                        className="flex flex-col p-3 h-auto"
                        onClick={() => {
                          setGiftType('heart');
                          setGiftAmount(200);
                        }}
                      >
                        <span className="text-2xl">❤️</span>
                        <span className="text-xs mt-1">Heart</span>
                        <span className="text-xs font-semibold">$2</span>
                      </Button>
                      
                      <Button
                        variant={giftType === 'star' ? 'default' : 'outline'}
                        className="flex flex-col p-3 h-auto"
                        onClick={() => {
                          setGiftType('star');
                          setGiftAmount(500);
                        }}
                      >
                        <span className="text-2xl">⭐</span>
                        <span className="text-xs mt-1">Star</span>
                        <span className="text-xs font-semibold">$5</span>
                      </Button>
                      
                      <Button
                        variant={giftType === 'diamond' ? 'default' : 'outline'}
                        className="flex flex-col p-3 h-auto"
                        onClick={() => {
                          setGiftType('diamond');
                          setGiftAmount(1000);
                        }}
                      >
                        <span className="text-2xl">💎</span>
                        <span className="text-xs mt-1">Diamond</span>
                        <span className="text-xs font-semibold">$10</span>
                      </Button>
                      
                      <Button
                        variant={giftType === 'energy' ? 'default' : 'outline'}
                        className="flex flex-col p-3 h-auto"
                        onClick={() => {
                          setGiftType('energy');
                          setGiftAmount(2000);
                        }}
                      >
                        <span className="text-2xl">⚡</span>
                        <span className="text-xs mt-1">Energy</span>
                        <span className="text-xs font-semibold">$20</span>
                      </Button>
                      
                      <Button
                        variant={giftType === 'custom' ? 'default' : 'outline'}
                        className="flex flex-col p-3 h-auto"
                        onClick={() => {
                          setGiftType('custom');
                          setGiftAmount(500);
                        }}
                      >
                        <span className="text-2xl">🎁</span>
                        <span className="text-xs mt-1">Custom</span>
                        <span className="text-xs font-semibold">$5+</span>
                      </Button>
                    </div>
                    
                    {giftType === 'custom' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Custom Amount (min $1)</label>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={(giftAmount / 100).toString()}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 1) {
                                setGiftAmount(Math.round(value * 100));
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Add a message (optional)</label>
                      <Input
                        placeholder="Write a message..."
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value)}
                        maxLength={100}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsGiftDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={sendGift}>
                      Send ${(giftAmount / 100).toFixed(2)}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
          
          <div className="flex space-x-2">
            <Input
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button size="icon" onClick={sendMessage}>
              <Send size={16} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}