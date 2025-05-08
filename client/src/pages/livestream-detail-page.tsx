import { useEffect, useState, useRef } from "react";
import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Gift, Livestream, User } from "@shared/schema";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import env from "@/lib/env";
import {
  ArrowLeft,
  Users,
  Heart,
  Star,
  Diamond,
  Send,
  DollarSign,
  Sparkles,
  MessageCircle,
  Clock,
  MonitorPlay,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PATHS } from "@/lib/constants";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function LivestreamDetailPage() {
  const { id } = useParams();
  const livestreamId = parseInt(id as string);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [chatMessage, setChatMessage] = useState("");
  const [isGiftDialogOpen, setIsGiftDialogOpen] = useState(false);
  const [selectedGiftType, setSelectedGiftType] = useState<string>("applause");
  const [giftAmount, setGiftAmount] = useState<number>(100); // Default $1.00
  const [giftMessage, setGiftMessage] = useState<string>("");
  const [giftAmountCustom, setGiftAmountCustom] = useState<string>("");
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  
  // Connect to websocket
  useEffect(() => {
    // Function to create WebSocket connection
    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log("WebSocket connected");
        
        // Authenticate with the server if user is logged in
        if (user?.id) {
          socket.send(JSON.stringify({
            type: 'authenticate',
            userId: user.id
          }));
        }
        
        // Subscribe to livestream channel
        socket.send(JSON.stringify({
          type: 'subscribe',
          channel: `livestream:${livestreamId}`
        }));
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.type === 'chat_message' && data.livestreamId === livestreamId) {
            setChatMessages(prev => [...prev, data]);
            
            // Scroll to bottom when new messages arrive
            if (chatContainerRef.current) {
              setTimeout(() => {
                chatContainerRef.current!.scrollTop = chatContainerRef.current!.scrollHeight;
              }, 100);
            }
          } else if (data.type === 'new_gift' && data.gift.livestreamId === livestreamId) {
            // Add gift notification to chat
            setChatMessages(prev => [
              ...prev, 
              {
                type: 'gift',
                senderName: data.senderUsername,
                recipientName: data.recipientUsername,
                gift: data.gift,
                timestamp: Date.now()
              }
            ]);
            
            // Invalidate gifts query to refresh the gifts list
            queryClient.invalidateQueries({ queryKey: ['/api/gifts/livestream', livestreamId] });
            
            // Scroll to bottom when new gifts arrive
            if (chatContainerRef.current) {
              setTimeout(() => {
                chatContainerRef.current!.scrollTop = chatContainerRef.current!.scrollHeight;
              }, 100);
            }
          } else if (data.type === 'viewer_count_update' && data.livestreamId === livestreamId) {
            // Update viewer count in UI
            queryClient.invalidateQueries({ queryKey: ['/api/livestreams', livestreamId] });
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };
      
      socket.onclose = () => {
        console.log("WebSocket disconnected. Reconnecting...");
        setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
      
      return socket;
    };
    
    // Initialize WebSocket
    const socket = connectWebSocket();
    
    // Cleanup on component unmount
    return () => {
      socket.close();
    };
  }, [livestreamId, user?.id]);
  
  // Fetch livestream data
  const { 
    data: livestream, 
    isLoading,
    error 
  } = useQuery<Livestream>({
    queryKey: ['/api/livestreams', livestreamId],
    enabled: !isNaN(livestreamId),
  });
  
  // Fetch livestream gifts
  const { 
    data: gifts,
    isLoading: isLoadingGifts
  } = useQuery<Gift[]>({
    queryKey: ['/api/gifts/livestream', livestreamId],
    enabled: !isNaN(livestreamId),
  });
  
  // Fetch streamer info
  const {
    data: streamer,
    isLoading: isLoadingStreamer
  } = useQuery<User>({
    queryKey: ['/api/readers', livestream?.userId],
    enabled: !!livestream?.userId,
  });
  
  // Mutation for sending a chat message
  const sendChatMutation = useMutation({
    mutationFn: async (message: string) => {
      // This is handled through WebSocket, so we don't need an API call
      // Just need to send the message via WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      
      return new Promise<void>((resolve, reject) => {
        socket.onopen = () => {
          socket.send(JSON.stringify({
            type: 'chat_message',
            livestreamId: livestreamId,
            senderId: user?.id,
            senderName: user?.username || 'Anonymous',
            message: message
          }));
          
          resolve();
          socket.close();
        };
        
        socket.onerror = (error) => {
          reject(error);
          socket.close();
        };
      });
    },
    onSuccess: () => {
      setChatMessage("");
    },
    onError: (error) => {
      toast({
        title: "Error sending message",
        description: "Please try again",
        variant: "destructive",
      });
    }
  });
  
  // Mutation for sending a gift
  const sendGiftMutation = useMutation({
    mutationFn: async (giftData: {
      recipientId: number;
      livestreamId: number;
      amount: number;
      giftType: string;
      message?: string;
    }) => {
      const response = await apiRequest('POST', '/api/gifts', giftData);
      return response.json();
    },
    onSuccess: (data) => {
      setIsGiftDialogOpen(false);
      toast({
        title: "Gift Sent!",
        description: "Your gift has been sent successfully.",
      });
      
      // Reset gift form
      setSelectedGiftType("applause");
      setGiftAmount(100);
      setGiftMessage("");
      setGiftAmountCustom("");
      setShowCustomAmount(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/gifts/livestream', livestreamId] });
      
      // Refresh user data to update balance
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: any) => {
      let errorMsg = "Failed to send gift. Please try again.";
      
      // Check if there's a response with a detailed error
      if (error.response) {
        try {
          const errorData = error.response.json();
          if (errorData.message) {
            errorMsg = errorData.message;
          }
        } catch (e) {
          // Use generic error message
        }
      }
      
      toast({
        title: "Gift Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  });
  
  // Handle chat form submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to send messages",
        variant: "destructive",
      });
      return;
    }
    
    if (chatMessage.trim() === "") return;
    
    sendChatMutation.mutate(chatMessage);
  };
  
  // Handle sending a gift
  const handleSendGift = () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to send gifts",
        variant: "destructive",
      });
      return;
    }
    
    if (!livestream || !livestream.userId) {
      toast({
        title: "Error",
        description: "Couldn't identify the recipient",
        variant: "destructive",
      });
      return;
    }
    
    const finalAmount = showCustomAmount && giftAmountCustom 
      ? parseInt(giftAmountCustom) * 100 // Convert dollars to cents
      : giftAmount;
    
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid gift amount",
        variant: "destructive",
      });
      return;
    }
    
    sendGiftMutation.mutate({
      recipientId: livestream.userId,
      livestreamId: livestreamId,
      amount: finalAmount,
      giftType: selectedGiftType,
      message: giftMessage || undefined,
    });
  };
  
  // Handle back button
  const handleBack = () => {
    setLocation(PATHS.LIVE);
  };
  
  // If there's an error or livestream not found
  if (error) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <h1 className="text-3xl font-alex-brush text-accent mb-4">Livestream Not Found</h1>
        <p className="text-light/80 font-playfair mb-6">The livestream you're looking for might have ended or doesn't exist.</p>
        <Link href={PATHS.LIVE}>
          <CelestialButton variant="secondary">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Livestreams
          </CelestialButton>
        </Link>
      </div>
    );
  }
  
  // Loading state
  if (isLoading || !livestream) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-light/80 font-playfair">Loading livestream...</p>
      </div>
    );
  }
  
  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amountInCents / 100);
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      {/* Back button */}
      <div className="mb-6">
        <CelestialButton
          variant="secondary"
          size="sm"
          onClick={handleBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Livestreams
        </CelestialButton>
      </div>
      
      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video player */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden bg-primary-dark/40 border-accent/20">
            <div className="relative aspect-video">
              {/* Check if livestreams are enabled in environment */}
              {!env.ENABLE_LIVESTREAMS ? (
                <div className="flex items-center justify-center bg-dark/50 h-full">
                  <div className="text-center p-8">
                    <AlertCircle className="h-16 w-16 mx-auto mb-4 text-accent/60" />
                    <h3 className="text-xl font-cinzel text-secondary mb-2">Livestreams Temporarily Unavailable</h3>
                    <p className="text-light/70">
                      Livestreaming functionality is currently unavailable. Please check back later.
                    </p>
                  </div>
                </div>
              ) : livestream.status === "live" && livestream.playbackId ? (
                <MuxPlayerErrorBoundary>
                  <MuxPlayer
                    playbackId={livestream.playbackId}
                    style={{ height: "100%", width: "100%" }}
                    streamType="live"
                    autoPlay
                    muted={false}
                    metadata={{ 
                      video_title: livestream.title || "Live Psychic Session",
                      player_name: "SoulSeer Live Stream"
                    }}
                  />
                </MuxPlayerErrorBoundary>
              ) : livestream.status === "ended" && livestream.muxAssetId && livestream.playbackId ? (
                <MuxPlayerErrorBoundary>
                  <MuxPlayer
                    playbackId={livestream.playbackId}
                    style={{ height: "100%", width: "100%" }}
                    streamType="on-demand"
                    autoPlay={false}
                    muted={false}
                    metadata={{ 
                      video_title: livestream.title || "Recorded Psychic Session",
                      player_name: "SoulSeer Replay"
                    }}
                  />
                </MuxPlayerErrorBoundary>
              ) : (
                <div className="flex items-center justify-center bg-dark/50 h-full">
                  {livestream.status === "scheduled" ? (
                    <div className="text-center p-8">
                      <Clock className="h-16 w-16 mx-auto mb-4 text-accent/60" />
                      <h3 className="text-xl font-cinzel text-secondary mb-2">Livestream Scheduled</h3>
                      <p className="text-light/70">
                        Scheduled to start at {livestream.scheduledFor ? new Date(livestream.scheduledFor).toLocaleString() : 'a later time'}
                      </p>
                    </div>
                  ) : livestream.status === "created" ? (
                    <div className="text-center p-8">
                      <MonitorPlay className="h-16 w-16 mx-auto mb-4 text-accent/60" />
                      <h3 className="text-xl font-cinzel text-secondary mb-2">Coming Soon</h3>
                      <p className="text-light/70">
                        The streamer is preparing to go live.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <Star className="h-16 w-16 mx-auto mb-4 text-accent/60" />
                      <h3 className="text-xl font-cinzel text-secondary mb-2">Stream Ended</h3>
                      <p className="text-light/70">
                        This livestream has ended and no recording is available.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Live indicator */}
              {livestream.status === "live" && (
                <div className="absolute top-4 left-4 bg-red-600 text-white text-sm px-3 py-1 rounded-full flex items-center">
                  <div className="h-2 w-2 rounded-full bg-white mr-2 animate-pulse"></div>
                  <span>LIVE</span>
                </div>
              )}
              
              {/* Viewer count */}
              {livestream.status === "live" && (
                <div className="absolute top-4 right-4 bg-dark/70 text-white text-sm px-3 py-1 rounded-full flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  <span>{livestream.viewerCount || 0} Viewers</span>
                </div>
              )}
            </div>
            
            {/* Stream details */}
            <div className="p-6">
              <h1 className="text-3xl font-alex-brush text-accent mb-2">{livestream.title}</h1>
              
              <div className="flex items-center mb-4">
                <div className="flex-1">
                  <p className="text-light/70 font-playfair">
                    By {streamer?.fullName || streamer?.username || `Reader #${livestream.userId}`}
                  </p>
                  <p className="text-accent text-sm">
                    {livestream.category.charAt(0).toUpperCase() + livestream.category.slice(1)}
                  </p>
                </div>
                
                {livestream.status === "live" && (
                  <Dialog open={isGiftDialogOpen} onOpenChange={setIsGiftDialogOpen}>
                    <DialogTrigger asChild>
                      <CelestialButton variant="default" size="sm">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Send Gift
                      </CelestialButton>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-center font-alex-brush text-2xl text-accent">Send a Gift</DialogTitle>
                        <DialogDescription className="text-center">
                          Send a gift to support {streamer?.fullName || streamer?.username || "the streamer"}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="py-4">
                        <div className="mb-4">
                          <h4 className="font-cinzel mb-2 text-light/90">Select Gift Type</h4>
                          <RadioGroup defaultValue="applause" value={selectedGiftType} onValueChange={setSelectedGiftType} className="grid grid-cols-5 gap-4">
                            <div className="flex flex-col items-center space-y-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`p-3 cursor-pointer rounded-full ${selectedGiftType === 'applause' ? 'bg-accent/30 ring-2 ring-accent' : 'bg-primary-dark/40'}`}>
                                      <Label htmlFor="applause" className="cursor-pointer">
                                        <span className="text-2xl">👏</span>
                                      </Label>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Applause</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <RadioGroupItem value="applause" id="applause" className="sr-only" />
                              <Label htmlFor="applause" className="text-xs text-light/70">Applause</Label>
                            </div>
                            
                            <div className="flex flex-col items-center space-y-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`p-3 cursor-pointer rounded-full ${selectedGiftType === 'heart' ? 'bg-accent/30 ring-2 ring-accent' : 'bg-primary-dark/40'}`}>
                                      <Label htmlFor="heart" className="cursor-pointer">
                                        <Heart className="h-6 w-6 text-red-500" />
                                      </Label>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Heart</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <RadioGroupItem value="heart" id="heart" className="sr-only" />
                              <Label htmlFor="heart" className="text-xs text-light/70">Heart</Label>
                            </div>
                            
                            <div className="flex flex-col items-center space-y-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`p-3 cursor-pointer rounded-full ${selectedGiftType === 'star' ? 'bg-accent/30 ring-2 ring-accent' : 'bg-primary-dark/40'}`}>
                                      <Label htmlFor="star" className="cursor-pointer">
                                        <Star className="h-6 w-6 text-yellow-400" />
                                      </Label>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Star</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <RadioGroupItem value="star" id="star" className="sr-only" />
                              <Label htmlFor="star" className="text-xs text-light/70">Star</Label>
                            </div>
                            
                            <div className="flex flex-col items-center space-y-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`p-3 cursor-pointer rounded-full ${selectedGiftType === 'diamond' ? 'bg-accent/30 ring-2 ring-accent' : 'bg-primary-dark/40'}`}>
                                      <Label htmlFor="diamond" className="cursor-pointer">
                                        <Diamond className="h-6 w-6 text-cyan-400" />
                                      </Label>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Diamond</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <RadioGroupItem value="diamond" id="diamond" className="sr-only" />
                              <Label htmlFor="diamond" className="text-xs text-light/70">Diamond</Label>
                            </div>
                            
                            <div className="flex flex-col items-center space-y-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`p-3 cursor-pointer rounded-full ${selectedGiftType === 'custom' ? 'bg-accent/30 ring-2 ring-accent' : 'bg-primary-dark/40'}`}>
                                      <Label htmlFor="custom" className="cursor-pointer">
                                        <Sparkles className="h-6 w-6 text-purple-400" />
                                      </Label>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Custom Gift</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <RadioGroupItem value="custom" id="custom" className="sr-only" />
                              <Label htmlFor="custom" className="text-xs text-light/70">Custom</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        
                        <div className="mb-4">
                          <div className="flex justify-between mb-2">
                            <h4 className="font-cinzel text-light/90">Gift Amount</h4>
                            <Label className="text-accent font-bold">
                              {showCustomAmount 
                                ? giftAmountCustom ? `$${giftAmountCustom}` : "$0.00"
                                : formatCurrency(giftAmount)}
                            </Label>
                          </div>
                          
                          {showCustomAmount ? (
                            <div className="flex items-center mb-2">
                              <span className="mr-2 text-light/70">$</span>
                              <Input 
                                type="number"
                                placeholder="Enter amount"
                                value={giftAmountCustom}
                                onChange={(e) => setGiftAmountCustom(e.target.value)}
                                className="bg-primary-dark/30 border-accent/20"
                                min="1"
                                step="1"
                              />
                              <Button 
                                variant="secondary" 
                                className="ml-2"
                                onClick={() => setShowCustomAmount(false)}
                              >
                                Use Preset
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Slider
                                value={[giftAmount]}
                                min={100}
                                max={10000}
                                step={100}
                                onValueChange={(value) => setGiftAmount(value[0])}
                                className="mb-2"
                              />
                              <div className="flex justify-between text-xs text-light/50">
                                <span>$1</span>
                                <span>$25</span>
                                <span>$50</span>
                                <span>$100</span>
                              </div>
                              <Button 
                                variant="secondary" 
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => setShowCustomAmount(true)}
                              >
                                Custom Amount
                              </Button>
                            </>
                          )}
                        </div>
                        
                        <div className="mb-4">
                          <Label htmlFor="message" className="font-cinzel mb-2 inline-block text-light/90">
                            Add a Message (Optional)
                          </Label>
                          <Input
                            id="message"
                            placeholder="Say something nice..."
                            value={giftMessage}
                            onChange={(e) => setGiftMessage(e.target.value)}
                            className="bg-primary-dark/30 border-accent/20"
                          />
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button 
                          variant="secondary"
                          onClick={() => setIsGiftDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <CelestialButton
                          variant="default"
                          onClick={handleSendGift}
                          disabled={sendGiftMutation.isPending}
                        >
                          {sendGiftMutation.isPending ? (
                            <>Processing...</>
                          ) : (
                            <>
                              <DollarSign className="mr-2 h-4 w-4" />
                              Send Gift
                            </>
                          )}
                        </CelestialButton>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              
              <p className="text-light/80 font-playfair">{livestream.description}</p>
            </div>
          </Card>
        </div>
        
        {/* Chat and Info Sidebar */}
        <div>
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-primary-dark/50">
              <TabsTrigger value="chat" className="font-cinzel">Live Chat</TabsTrigger>
              <TabsTrigger value="gifts" className="font-cinzel">Gifts</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="space-y-4">
              <Card className="bg-primary-dark/40 border-accent/20">
                <div className="p-4 h-96 flex flex-col">
                  {/* Chat messages */}
                  <div 
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto mb-4 pr-2 space-y-2"
                  >
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-8 text-light/50">
                        <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No messages yet. Be the first to start the conversation!</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div key={idx} className="animate-fadeIn">
                          {msg.type === 'chat_message' ? (
                            <div className="bg-primary-dark/30 p-3 rounded-lg">
                              <div className="flex justify-between">
                                <span className="font-cinzel text-accent">{msg.senderName}</span>
                                <span className="text-light/50 text-xs">
                                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-light/90 mt-1">{msg.message}</p>
                            </div>
                          ) : msg.type === 'gift' ? (
                            <div className="bg-accent/20 p-3 rounded-lg border border-accent/30">
                              <div className="flex justify-between">
                                <span className="font-cinzel text-accent">{msg.senderName}</span>
                                <span className="text-light/50 text-xs">
                                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-light/90 mt-1 flex items-center">
                                <Sparkles className="h-4 w-4 mr-2 text-yellow-400" />
                                Sent a {msg.gift.giftType} gift ({formatCurrency(msg.gift.amount)}) to {msg.recipientName}!
                              </p>
                              {msg.gift.message && (
                                <p className="text-light/70 mt-1 italic">"{msg.gift.message}"</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Chat input */}
                  <form onSubmit={handleSendMessage} className="mt-auto">
                    <div className="flex">
                      <Input
                        placeholder="Type a message..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        className="flex-1 bg-primary-dark/30 border-accent/20"
                        disabled={!user || livestream.status !== 'live'}
                      />
                      <Button 
                        type="submit" 
                        disabled={!user || chatMessage.trim() === '' || livestream.status !== 'live'}
                        className="ml-2"
                      >
                        <Send className="h-4 w-4" />
                        <span className="sr-only">Send</span>
                      </Button>
                    </div>
                  </form>
                </div>
              </Card>
              
              {!user && (
                <div className="text-center p-3 border border-accent/20 rounded-md bg-primary-dark/30">
                  <p className="text-light/70 mb-2">Sign in to join the conversation</p>
                  <Link href={`${PATHS.AUTH}?redirect=${encodeURIComponent(window.location.pathname)}`}>
                    <Button variant="secondary" size="sm">Sign In</Button>
                  </Link>
                </div>
              )}
              
              {livestream.status !== 'live' && (
                <div className="text-center p-3 border border-accent/20 rounded-md bg-primary-dark/30">
                  <p className="text-light/70">
                    {livestream.status === 'scheduled' 
                      ? 'Chat will be available when the stream starts' 
                      : 'This stream has ended'}
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="gifts" className="space-y-4">
              <Card className="bg-primary-dark/40 border-accent/20">
                <div className="p-4 h-96 overflow-y-auto">
                  <h3 className="text-xl font-cinzel text-accent mb-4">Recent Gifts</h3>
                  
                  {isLoadingGifts ? (
                    <div className="text-center py-8">
                      <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-light/70">Loading gifts...</p>
                    </div>
                  ) : gifts && gifts.length > 0 ? (
                    <div className="space-y-3">
                      {gifts.map((gift) => (
                        <div 
                          key={gift.id} 
                          className="bg-primary-dark/30 p-3 rounded-lg border border-accent/10"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="mb-1">
                                <span className="font-cinzel text-accent">User #{gift.senderId}</span>
                                <span className="text-light/70 mx-2">→</span>
                                <span className="font-cinzel text-accent">User #{gift.recipientId}</span>
                              </div>
                              <div className="flex items-center text-light/90">
                                {gift.giftType === 'applause' && <span className="mr-2 text-xl">👏</span>}
                                {gift.giftType === 'heart' && <Heart className="mr-2 h-5 w-5 text-red-500" />}
                                {gift.giftType === 'star' && <Star className="mr-2 h-5 w-5 text-yellow-400" />}
                                {gift.giftType === 'diamond' && <Diamond className="mr-2 h-5 w-5 text-cyan-400" />}
                                {gift.giftType === 'custom' && <Sparkles className="mr-2 h-5 w-5 text-purple-400" />}
                                <span>
                                  {gift.giftType.charAt(0).toUpperCase() + gift.giftType.slice(1)} Gift
                                </span>
                              </div>
                              {gift.message && (
                                <p className="text-light/70 mt-1 italic">"{gift.message}"</p>
                              )}
                            </div>
                            <span className="font-bold text-accent bg-accent/10 px-2 py-1 rounded">
                              {formatCurrency(gift.amount)}
                            </span>
                          </div>
                          <div className="mt-2 text-right text-xs text-light/50">
                            {gift.createdAt ? new Date(gift.createdAt).toLocaleString() : 'Unknown time'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-light/50">
                      <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No gifts yet. Be the first to send a gift!</p>
                    </div>
                  )}
                </div>
              </Card>
              
              {livestream.status === 'live' && (
                <div className="text-center">
                  <Dialog open={isGiftDialogOpen} onOpenChange={setIsGiftDialogOpen}>
                    <DialogTrigger asChild>
                      <CelestialButton variant="default">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Send a Gift
                      </CelestialButton>
                    </DialogTrigger>
                  </Dialog>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
