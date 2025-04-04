import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Reading, User } from '@shared/schema';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface VideoCallProps {
  reading: Reading;
  user: User;
  isReader: boolean;
  onEndCall: () => void;
  onTimerUpdate: (seconds: number) => void;
}

export function VideoCall({ 
  reading, 
  user, 
  isReader, 
  onEndCall, 
  onTimerUpdate 
}: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [seconds, setSeconds] = useState(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  
  // Initialize media streams and WebRTC
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        // Get local media stream with audio and video
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        setLocalStream(stream);
        
        // Display local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Create RTCPeerConnection with STUN servers for NAT traversal
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        });
        
        // Add local tracks to peer connection
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
        
        // Handle incoming tracks (remote video)
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setRemoteStream(event.streams[0]);
            setIsConnected(true);
            setIsLoading(false);
          }
        };
        
        // Ice candidate handling
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            // Send ICE candidate to the other peer via WebSocket
            sendSignalingMessage({
              type: 'ice_candidate',
              candidate: event.candidate,
              readingId: reading.id,
              senderId: user.id,
              recipientId: isReader ? reading.clientId : reading.readerId
            });
          }
        };
        
        setPeerConnection(pc);
        
        // Establish WebSocket connection to our signaling server
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
          console.log('WebSocket connection established for video call');
          // Send a join message to register this peer in the reading session
          sendSignalingMessage({
            type: 'join_reading',
            readingId: reading.id,
            userId: user.id,
            role: isReader ? 'reader' : 'client'
          });
        };
        
        socket.onmessage = async (event) => {
          const message = JSON.parse(event.data);
          
          // Only process messages for this reading
          if (message.readingId !== reading.id) return;
          
          // Handle different signaling message types
          switch (message.type) {
            case 'offer':
              await handleOffer(message, pc);
              break;
            case 'answer':
              await handleAnswer(message, pc);
              break;
            case 'ice_candidate':
              handleIceCandidate(message, pc);
              break;
            case 'reading_joined':
              // Another user joined, initiate connection if we're the reader
              if (isReader && message.userId !== user.id) {
                initiateCall(pc, reading.id, user.id, message.userId);
              }
              break;
            case 'call_connected':
              // Start the timer once the call is connected
              startTimer();
              setIsConnected(true);
              setIsLoading(false);
              toast({
                title: 'Call Connected',
                description: 'Your video call is now active',
              });
              break;
          }
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          toast({
            title: 'Connection Error',
            description: 'Failed to establish signaling connection',
            variant: 'destructive',
          });
        };
        
        socketRef.current = socket;
      } catch (error) {
        console.error('Error accessing media devices:', error);
        toast({
          title: 'Camera Access Error',
          description: 'Could not access camera or microphone',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    };
    
    initializeMedia();
    
    // Cleanup function
    return () => {
      // Stop all tracks in local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Close peer connection
      if (peerConnection) {
        peerConnection.close();
      }
      
      // Close WebSocket connection
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [reading.id, user.id, isReader]);
  
  // Helper function to send signaling messages via WebSocket
  const sendSignalingMessage = (message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };
  
  // Start the session timer
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setSeconds(prevSeconds => {
        const newSeconds = prevSeconds + 1;
        onTimerUpdate(newSeconds);
        return newSeconds;
      });
    }, 1000);
  };
  
  // Initiate a call (create and send offer)
  const initiateCall = async (
    pc: RTCPeerConnection, 
    readingId: number, 
    senderId: number, 
    recipientId: number
  ) => {
    try {
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Send the offer to the other peer
      sendSignalingMessage({
        type: 'offer',
        sdp: pc.localDescription,
        readingId,
        senderId,
        recipientId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      toast({
        title: 'Call Error',
        description: 'Failed to initiate call',
        variant: 'destructive',
      });
    }
  };
  
  // Handle an incoming offer
  const handleOffer = async (message: any, pc: RTCPeerConnection) => {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
      
      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Send answer back
      sendSignalingMessage({
        type: 'answer',
        sdp: pc.localDescription,
        readingId: message.readingId,
        senderId: user.id,
        recipientId: message.senderId
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };
  
  // Handle an incoming answer
  const handleAnswer = async (message: any, pc: RTCPeerConnection) => {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
      
      // Notify both parties that the call is connected
      sendSignalingMessage({
        type: 'call_connected',
        readingId: message.readingId,
        senderId: user.id,
        recipientId: message.senderId
      });
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };
  
  // Handle an incoming ICE candidate
  const handleIceCandidate = (message: any, pc: RTCPeerConnection) => {
    try {
      const candidate = new RTCIceCandidate(message.candidate);
      pc.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };
  
  // Toggle microphone mute
  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };
  
  // Handle ending the call
  const handleEndCall = () => {
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Notify the other peer that we're ending the call
    sendSignalingMessage({
      type: 'call_ended',
      readingId: reading.id,
      senderId: user.id,
      recipientId: isReader ? reading.clientId : reading.readerId
    });
    
    // Call the parent onEndCall handler
    onEndCall();
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <LoadingSpinner size="lg" />
        <p className="mt-4">Connecting to video call...</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative">
        {/* Remote video (full size) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full rounded-lg bg-black"
        />
        
        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-4 right-4 w-1/4 z-10">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted // Mute local video to prevent feedback
            className="w-full rounded-lg bg-gray-900 border border-primary"
          />
        </div>
        
        {/* Not connected message */}
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="text-center text-white">
              <p className="text-lg font-medium">Waiting for the other person to join...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="mt-4 flex justify-center space-x-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={toggleMute} 
          className={isMuted ? 'bg-destructive text-destructive-foreground' : ''}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={toggleVideo}
          className={!isVideoEnabled ? 'bg-destructive text-destructive-foreground' : ''}
        >
          {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        
        <Button 
          variant="destructive" 
          size="icon" 
          onClick={handleEndCall}
        >
          <Phone className="h-4 w-4 rotate-135" />
        </Button>
      </div>
    </div>
  );
}