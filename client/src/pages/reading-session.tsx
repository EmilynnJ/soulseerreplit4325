import { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useWebSocketContext } from '@/hooks/websocket-provider';
import { Reading } from '@shared/schema';
import { VideoCallMux } from '@/components/readings/video-call-mux';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Clock, MessageCircle, MessageSquare, Video, Phone, Mic } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function ReadingSessionPage() {
  const [_, setLocation] = useLocation();
  const [match, params] = useRoute('/reading-session/:id');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [chatMessages, setChatMessages] = useState<{ sender: string; message: string; timestamp: number }[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use the WebSocket context instead of creating a direct connection
  const { status, sendMessage, lastMessage, reconnect } = useWebSocketContext();

  // Get reading session data
  const { data: reading, isLoading } = useQuery<Reading>({
    queryKey: [`/api/readings/${params?.id}`],
    enabled: !!params?.id && !!user,
    refetchInterval: 5000, // Refresh every 5 seconds to update status
  });
  
  // Get user balance
  const { data: userBalance } = useQuery({
    queryKey: ['/api/user/balance'],
    enabled: !!user,
  });
  
  // Start reading session mutation
  const startReadingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/readings/${params?.id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/readings/${params?.id}`] });
      toast({
        title: 'Reading Started',
        description: 'Your reading session has successfully started.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Starting Reading',
        description: error.message || 'Failed to start the reading session. Please try again.',
        variant: 'destructive',
      });
    }
  });

  // End the reading session mutation
  const endReadingMutation = useMutation({
    mutationFn: async () => {
      // Calculate the total cost based on elapsed time
      const finalCost = Math.ceil((reading!.pricePerMinute * elapsedTime) / 60);
      
      await apiRequest('POST', `/api/readings/${params?.id}/end`, {
        duration: Math.ceil(elapsedTime / 60), // Convert to minutes and round up
        totalPrice: finalCost  
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/readings/${params?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/balance'] });
      toast({
        title: 'Reading Ended',
        description: 'Your reading session has been completed and payment processed from your account balance.',
      });
      setLocation('/readings');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to end reading: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
  
  // Send chat message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      await apiRequest('POST', `/api/readings/${params?.id}/message`, {
        message
      });
    },
    onSuccess: () => {
      // We'll handle message display via WebSocket, so no need to update state here
      setMessageInput('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to send message: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
  
  // Start the timer for chat and voice sessions
  useEffect(() => {
    if (!reading || !user || reading.type === 'video') return;
    
    // Only start the timer if the session is in progress and hasn't already started
    if (reading.status === 'in_progress' && !sessionStarted) {
      // Start the timer for chat and voice sessions
      setSessionStarted(true);
      
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newSeconds = prev + 1;
          return newSeconds;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [reading, user, sessionStarted]);
  
  // Listen for WebSocket messages for the chat
  useEffect(() => {
    if (!reading || !user) return;
    
    // Add a message based on connection status
    if (status === 'open') {
      setChatMessages(prev => {
        // Only add the system message if it doesn't already exist
        const hasConnectedMessage = prev.some(msg => 
          msg.sender === 'System' && 
          msg.message.includes('Connected to chat')
        );
        
        if (!hasConnectedMessage) {
          return [...prev, {
            sender: 'System',
            message: 'Connected to chat. Your messages will appear instantly.',
            timestamp: Date.now()
          }];
        }
        return prev;
      });
      
      // Subscribe to reading-specific messages
      sendMessage({
        type: 'subscribe',
        channel: `reading_${reading.id}`
      });
    } else if (status === 'closed' || status === 'error') {
      setChatMessages(prev => {
        // Only add the system message if it doesn't already exist
        const hasDisconnectMessage = prev.some(msg => 
          msg.sender === 'System' && 
          msg.message.includes('Connection lost')
        );
        
        if (!hasDisconnectMessage) {
          return [...prev, {
            sender: 'System',
            message: 'Connection lost. Attempting to reconnect...',
            timestamp: Date.now()
          }];
        }
        return prev;
      });
      
      // Try to reconnect
      reconnect();
    }
  }, [reading, user, status, sendMessage, reconnect]);
  
  // Process messages from WebSocket
  useEffect(() => {
    if (!lastMessage || !reading || !user) return;
    
    try {
      // Handle ping response
      if (lastMessage === 'pong' || lastMessage.type === 'pong') {
        console.log("Received pong response");
        return;
      }

      // Handle reading status updates
      if (lastMessage.type === 'reading_started' && lastMessage.reading?.id === reading.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/readings/${reading.id}`] });
        toast({
          title: 'Reading Started',
          description: 'Your reading session has begun.',
        });
        return;
      }

      if (lastMessage.type === 'reading_completed' && lastMessage.reading?.id === reading.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/readings/${reading.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/user/balance'] });
        toast({
          title: 'Reading Completed',
          description: `Your reading session has ended. Total cost: ${formatCost(lastMessage.totalPrice)}`,
        });
        setLocation('/readings');
        return;
      }
      
      // Handle authentication success
      if (lastMessage.type === 'authentication_success') {
        console.log("Successfully authenticated with WebSocket server");
        return;
      }
      
      // Handle subscription success
      if (lastMessage.type === 'subscription_success') {
        console.log(`Successfully subscribed to ${lastMessage.channel}`);
        return;
      }
      
      // Only handle messages for this reading
      if (lastMessage.readingId === reading.id && lastMessage.type === 'chat_message') {
        console.log("Adding chat message to UI:", lastMessage);
        
        // Don't duplicate messages that were already added locally
        const isDuplicate = chatMessages.some(msg => 
          msg.message === lastMessage.message && 
          msg.sender === (lastMessage.senderId === user.id ? 'You' : lastMessage.senderName) &&
          Math.abs(msg.timestamp - lastMessage.timestamp) < 5000 // within 5 seconds
        );
        
        if (!isDuplicate) {
          setChatMessages(prev => [...prev, {
            sender: lastMessage.senderId === user.id ? 'You' : lastMessage.senderName,
            message: lastMessage.message,
            timestamp: lastMessage.timestamp
          }]);
        }
        
        // Start the timer on first message if not already started
        if (!sessionStarted && reading.type === 'chat') {
          setSessionStarted(true);
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }, [lastMessage, reading, user, chatMessages, sessionStarted]);
  
  // Auto-start reading if needed
  useEffect(() => {
    if (!reading) return;
    
    // If the reading is in completed status, show a toast and redirect
    if (reading.status === 'completed') {
      toast({
        title: 'Reading Completed',
        description: `This reading session has already ended.`,
        variant: 'destructive',
      });
      setLocation('/readings');
      return;
    }
    
    // If the reading is ready to be started, start it automatically
    if (reading.status === 'payment_completed' && !startReadingMutation.isPending) {
      console.log("Attempting to auto-start reading session:", reading.id);
      startReadingMutation.mutate();
    } else if (reading.status === 'waiting_payment') {
      toast({
        title: 'Payment Required',
        description: 'Please complete the payment to start the reading session.',
        variant: 'destructive',
      });
      // Redirect to payment page or show payment modal
      return;
    }
  }, [reading, startReadingMutation, toast, setLocation]);
  
  // Update total cost whenever elapsed time changes
  useEffect(() => {
    if (reading) {
      const cost = (reading.pricePerMinute * elapsedTime) / 60; // Convert to cents per second
      setTotalCost(cost);
    }
  }, [elapsedTime, reading]);
  
  // Format cost for display
  const formatCost = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };
  
  // Handle timer updates from the VideoCallMux component
  const handleTimerUpdate = (seconds: number) => {
    setElapsedTime(seconds);
  };
  
  // Handle ending the reading session
  const handleEndReading = () => {
    endReadingMutation.mutate();
  };
  
  // Handle sending a chat message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() && reading && user) {
      // Send via API
      sendMessageMutation.mutate(messageInput.trim());
      
      // Also send directly via WebSocket if connected (for redundancy)
      if (status === 'open') {
        console.log("Sending message directly via WebSocket");
        sendMessage({
          type: 'chat_message',
          readingId: reading.id,
          senderId: user.id,
          senderName: user.fullName || user.username,
          message: messageInput.trim(),
          timestamp: Date.now()
        });
      }
      
      // Add message to the UI immediately
      setChatMessages(prev => [...prev, {
        sender: 'You',
        message: messageInput.trim(),
        timestamp: Date.now()
      }]);
      
      // Clear input field
      setMessageInput('');
    }
  };
  
  // Format timestamp to local time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Determine if the current user is the reader
  const isReader = user?.id === reading?.readerId;
  
  if (isLoading || !reading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 cosmic-bg min-h-screen">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <span className="mb-2 sm:mb-0">
              {reading.type.charAt(0).toUpperCase() + reading.type.slice(1)} Reading Session
            </span>
            <div className="flex items-center gap-2 text-base font-normal">
              <Clock className="h-4 w-4" />
              <span>{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
              <span className="ml-2">|</span>
              <span className="text-primary font-semibold">{formatCost(totalCost)}</span>
            </div>
          </CardTitle>
          <CardDescription>
            {isReader ? `Session with ${reading.clientId}` : `Session with Reader #${reading.readerId}`}
          </CardDescription>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="p-6">
          <Tabs defaultValue={reading.type} className="w-full">
            <TabsList className="mb-4">
              {reading.type === 'chat' && <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-2" /> Chat</TabsTrigger>}
              {reading.type === 'video' && <TabsTrigger value="video"><Video className="h-4 w-4 mr-2" /> Video</TabsTrigger>}
              {reading.type === 'voice' && <TabsTrigger value="voice"><Phone className="h-4 w-4 mr-2" /> Voice</TabsTrigger>}
            </TabsList>
            
            {/* Chat UI */}
            {reading.type === 'chat' && (
              <TabsContent value="chat" className="h-[400px] flex flex-col">
                <div className="flex-1 overflow-y-auto mb-4 space-y-3 p-3 border rounded-md">
                  {chatMessages.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`flex flex-col ${msg.sender === 'You' ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`px-3 py-2 rounded-lg ${msg.sender === 'You' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                        {msg.message}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {msg.sender} • {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No messages yet. Start your conversation...
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm text-black"
                  />
                  <Button type="submit" disabled={sendMessageMutation.isPending} className="whitespace-nowrap">
                    <MessageCircle className="h-4 w-4 mr-2 sm:inline hidden" />
                    Send
                  </Button>
                </form>
              </TabsContent>
            )}
            
            {/* Video Call UI */}
            {reading.type === 'video' && (
              <TabsContent value="video" className="h-[400px]">
                <VideoCallMux
                  reading={reading}
                  user={user}
                  isReader={isReader}
                  onEndCall={handleEndReading}
                  onTimerUpdate={handleTimerUpdate}
                />
              </TabsContent>
            )}
            
            {/* Voice Call UI */}
            {reading.type === 'voice' && (
              <TabsContent value="voice" className="h-[400px] flex flex-col items-center justify-center">
                <div className="text-center">
                  <Phone className="h-24 w-24 mx-auto text-primary animate-pulse" />
                  <h3 className="mt-4 text-lg font-medium">Voice Call in Progress</h3>
                  <p className="text-muted-foreground mb-6">Your voice call is active</p>
                  
                  <div className="flex flex-col gap-4">
                    {!sessionStarted ? (
                      <Button 
                        onClick={() => {
                          // Start the reading session via API if needed
                          if (reading.status === 'payment_completed' || reading.status === 'waiting_payment') {
                            startReadingMutation.mutate();
                          }
                          // Start the timer locally
                          setSessionStarted(true);
                        }} 
                        className="bg-green-600 hover:bg-green-700"
                        disabled={startReadingMutation.isPending}
                      >
                        {startReadingMutation.isPending ? "Starting..." : "Start Voice Session"}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-2xl font-semibold">
                          {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                        </div>
                        
                        <div className="text-lg font-medium">
                          {formatCost(totalCost)}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-4 mt-2">
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="w-12 h-12 rounded-full"
                      >
                        <Mic className="h-5 w-5" />
                      </Button>
                      
                      <Button 
                        variant="destructive" 
                        size="icon"
                        className="w-12 h-12 rounded-full"
                        onClick={handleEndReading}
                      >
                        <Phone className="h-5 w-5 rotate-135" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row gap-3 sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {reading.pricePerMinute ? `Rate: ${formatCost(reading.pricePerMinute)}/min` : 'Rate not set'}
          </div>
          <div className="flex gap-2">
            {(reading.status === 'payment_completed' || reading.status === 'waiting_payment') && (
              <Button 
                variant="default" 
                onClick={() => startReadingMutation.mutate()} 
                disabled={startReadingMutation.isPending}
                className="w-full sm:w-auto"
              >
                {startReadingMutation.isPending ? "Starting..." : "Start Reading"}
              </Button>
            )}
            <Button 
              variant="destructive" 
              onClick={handleEndReading} 
              disabled={endReadingMutation.isPending}
              className="w-full sm:w-auto"
            >
              End Reading Session
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}