import { DashboardLayout } from "./dashboard-layout";
import { useQuery } from "@tanstack/react-query";
import { Reading, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Phone, Video, UserIcon, X, Radio, Wifi, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";

export function ReaderDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  
  // Legacy per-minute pricing fields
  const [pricingChat, setPricingChat] = useState<number | undefined>(user?.pricingChat || 0);
  const [pricingVoice, setPricingVoice] = useState<number | undefined>(user?.pricingVoice || 0);
  const [pricingVideo, setPricingVideo] = useState<number | undefined>(user?.pricingVideo || 0);
  
  // New fixed-price scheduled reading fields
  const [scheduledChatPrice15, setScheduledChatPrice15] = useState<number | undefined>(user?.scheduledChatPrice15 || 0);
  const [scheduledChatPrice30, setScheduledChatPrice30] = useState<number | undefined>(user?.scheduledChatPrice30 || 0);
  const [scheduledChatPrice60, setScheduledChatPrice60] = useState<number | undefined>(user?.scheduledChatPrice60 || 0);
  const [scheduledVoicePrice15, setScheduledVoicePrice15] = useState<number | undefined>(user?.scheduledVoicePrice15 || 0);
  const [scheduledVoicePrice30, setScheduledVoicePrice30] = useState<number | undefined>(user?.scheduledVoicePrice30 || 0);
  const [scheduledVoicePrice60, setScheduledVoicePrice60] = useState<number | undefined>(user?.scheduledVoicePrice60 || 0);
  const [scheduledVideoPrice15, setScheduledVideoPrice15] = useState<number | undefined>(user?.scheduledVideoPrice15 || 0);
  const [scheduledVideoPrice30, setScheduledVideoPrice30] = useState<number | undefined>(user?.scheduledVideoPrice30 || 0);
  const [scheduledVideoPrice60, setScheduledVideoPrice60] = useState<number | undefined>(user?.scheduledVideoPrice60 || 0);
  
  const [isUpdatingPricing, setIsUpdatingPricing] = useState(false);

  const { data: readings, isLoading } = useQuery<Reading[]>({
    queryKey: ["/api/readings/reader"],
  });

  useEffect(() => {
    if (user) {
      setIsOnline(user.isOnline || false);
      
      // Initialize legacy per-minute pricing
      setPricingChat(user.pricingChat || 0);
      setPricingVoice(user.pricingVoice || 0);
      setPricingVideo(user.pricingVideo || 0);
      
      // Initialize fixed-price scheduled reading pricing
      setScheduledChatPrice15(user.scheduledChatPrice15 || 0);
      setScheduledChatPrice30(user.scheduledChatPrice30 || 0);
      setScheduledChatPrice60(user.scheduledChatPrice60 || 0);
      setScheduledVoicePrice15(user.scheduledVoicePrice15 || 0);
      setScheduledVoicePrice30(user.scheduledVoicePrice30 || 0);
      setScheduledVoicePrice60(user.scheduledVoicePrice60 || 0);
      setScheduledVideoPrice15(user.scheduledVideoPrice15 || 0);
      setScheduledVideoPrice30(user.scheduledVideoPrice30 || 0);
      setScheduledVideoPrice60(user.scheduledVideoPrice60 || 0);
    }
  }, [user]);

  const handleOnlineToggle = async (checked: boolean) => {
    try {
      const response = await apiRequest("PATCH", "/api/readers/status", {
        isOnline: checked
      });

      if (response.ok) {
        setIsOnline(checked);
        // Invalidate both user and online readers data
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        queryClient.invalidateQueries({ queryKey: ["/api/readers/online"] });
      } else {
        toast({
          title: "Error",
          description: "Failed to update online status",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error("Failed to update online status:", err);
      toast({
        title: "Error",
        description: "Failed to update online status",
        variant: "destructive"
      });
    }
  };

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    fullName: user?.fullName || '',
    bio: user?.bio || '',
    specialties: user?.specialties || []
  });
  
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload for profile picture
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);
      
      // Create URL for preview
      const previewUrl = URL.createObjectURL(file);
      setPreviewImageUrl(previewUrl);
    }
  };
  
  const handleUpdateProfile = async () => {
    try {
      const formData = new FormData();
      
      // Add all profile data to formData
      Object.entries(profileData).forEach(([key, value]) => {
        if (key === 'specialties') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });
      
      // Add profile image if one was selected
      if (profileImage) {
        formData.append('profileImage', profileImage);
      }

      const response = await fetch('/api/readers/profile', {
        method: 'PATCH',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Refresh user data
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsEditingProfile(false);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePricing = async () => {
    if (isUpdatingPricing) return;

    try {
      setIsUpdatingPricing(true);

      const response = await apiRequest("PATCH", "/api/readers/pricing", {
        // Legacy per-minute pricing
        pricingChat,
        pricingVoice,
        pricingVideo,
        
        // Fixed-price scheduled reading pricing
        scheduledChatPrice15,
        scheduledChatPrice30,
        scheduledChatPrice60,
        scheduledVoicePrice15,
        scheduledVoicePrice30,
        scheduledVoicePrice60,
        scheduledVideoPrice15,
        scheduledVideoPrice30,
        scheduledVideoPrice60
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update pricing");
      }

      // Invalidate user data to refresh pricing
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      setIsPricingDialogOpen(false);
      toast({
        title: "Pricing Updated",
        description: "Your reading rates have been successfully saved.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update pricing",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPricing(false);
    }
  };

  // Group readings by status
  const waitingReadings = readings?.filter(
    (r) => r.status === "payment_completed"
  ) || [];

  const activeReadings = readings?.filter(
    (r) => r.status === "in_progress"
  ) || [];

  const upcomingReadings = readings?.filter(
    (r) => r.status === "scheduled"
  ) || [];

  const completedReadings = readings?.filter(
    (r) => r.status === "completed"
  ) || [];

  return (
    <DashboardLayout title="Reader Dashboard">
      {/* Quick Actions Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
        <Button 
          className="bg-purple-600 hover:bg-purple-700 text-white p-6 h-auto flex flex-col items-center justify-center gap-2"
          size="lg"
          onClick={async () => {
            try {
              toast({
                title: "Starting Livestream",
                description: "Setting up your live stream...",
              });
              
              // Create a livestream
              const response = await fetch('/api/livestreams', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  title: `${user?.fullName || 'Reader'}'s Live Session`,
                  description: 'Live psychic reading session. Join now to interact!',
                  category: 'Readings'
                })
              });
              
              if (!response.ok) {
                throw new Error('Failed to create livestream');
              }
              
              const livestream = await response.json();
              
              // Redirect to the livestream page
              window.location.href = `/livestream/${livestream.id}`;
            } catch (error) {
              console.error('Error starting livestream:', error);
              toast({
                title: "Error",
                description: "Failed to start livestream. Please try again.",
                variant: "destructive"
              });
            }
          }}
        >
          <div className="w-full flex items-center justify-center">
            <Radio className="h-8 w-8 text-white mb-2" />
          </div>
          <span className="text-xl font-medium">Go Live Now</span>
          <p className="text-sm opacity-90 font-normal">Start a livestream for your followers</p>
        </Button>

        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white p-6 h-auto flex flex-col items-center justify-center gap-2"
          size="lg"
          onClick={async () => {
            try {
              const response = await fetch('/api/stripe/connect', {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              if (!response.ok) {
                throw new Error('Failed to get Stripe Connect URL');
              }
              
              const data = await response.json();
              
              if (data.url) {
                toast({
                  title: "Redirecting to Stripe",
                  description: "You will be redirected to Stripe to set up payouts.",
                });
                window.location.href = data.url;
              } else {
                throw new Error('Invalid response from server');
              }
            } catch (error) {
              console.error('Stripe Connect error:', error);
              toast({
                title: "Connection Error",
                description: "Unable to connect to Stripe at this time. Please try again later.",
                variant: "destructive"
              });
            }
          }}
        >
          <div className="w-full flex items-center justify-center">
            <CreditCard className="h-8 w-8 text-white mb-2" />
          </div>
          <span className="text-xl font-medium">Connect Stripe</span>
          <p className="text-sm opacity-90 font-normal">Set up payouts for your readings</p>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        <Card className="glow-card">
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-lg md:text-xl">Online Status</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="online-status" className="text-sm md:text-base">Available for Readings</Label>
              <Switch 
                id="online-status" 
                checked={isOnline}
                onCheckedChange={handleOnlineToggle}
              />
            </div>
            <div className="mt-2">
              <Badge className={isOnline ? "bg-green-500 text-white" : "bg-red-500 text-white"}>
                {isOnline ? "Online" : "Offline"}
              </Badge>
              <div className="text-xs mt-1 text-gray-400">
                {isOnline 
                  ? "You are visible to clients" 
                  : "You are not visible to clients"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glow-card">
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-lg md:text-xl">Reading Rates</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Per minute pricing for each reading type
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm">Chat:</span>
                </div>
                <span className="font-bold text-sm gold-gradient">
                  {formatCurrency(pricingChat ? pricingChat / 100 : 0)}/min
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2" />
                  <span className="text-sm">Voice:</span>
                </div>
                <span className="font-bold text-sm gold-gradient">
                  {formatCurrency(pricingVoice ? pricingVoice / 100 : 0)}/min
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Video className="h-4 w-4 mr-2" />
                  <span className="text-sm">Video:</span>
                </div>
                <span className="font-bold text-sm gold-gradient">
                  {formatCurrency(pricingVideo ? pricingVideo / 100 : 0)}/min
                </span>
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={() => setIsPricingDialogOpen(true)}
            >
              Update Pricing
            </Button>
          </CardContent>
        </Card>
        
        <Card className="glow-card">
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-lg md:text-xl">Scheduled Reading Prices</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Fixed pricing for scheduled sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-1 flex items-center">
                  <MessageCircle className="h-3 w-3 mr-1" />Chat
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs">15 min:</span>
                  <span className="font-medium text-xs gold-gradient">
                    {formatCurrency(scheduledChatPrice15 ? scheduledChatPrice15 / 100 : 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">30 min:</span>
                  <span className="font-medium text-xs gold-gradient">
                    {formatCurrency(scheduledChatPrice30 ? scheduledChatPrice30 / 100 : 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">60 min:</span>
                  <span className="font-medium text-xs gold-gradient">
                    {formatCurrency(scheduledChatPrice60 ? scheduledChatPrice60 / 100 : 0)}
                  </span>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1 flex items-center">
                  <Phone className="h-3 w-3 mr-1" />Voice
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs">15 min:</span>
                  <span className="font-medium text-xs gold-gradient">
                    {formatCurrency(scheduledVoicePrice15 ? scheduledVoicePrice15 / 100 : 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">30 min:</span>
                  <span className="font-medium text-xs gold-gradient">
                    {formatCurrency(scheduledVoicePrice30 ? scheduledVoicePrice30 / 100 : 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">60 min:</span>
                  <span className="font-medium text-xs gold-gradient">
                    {formatCurrency(scheduledVoicePrice60 ? scheduledVoicePrice60 / 100 : 0)}
                  </span>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-1 flex items-center">
                  <Video className="h-3 w-3 mr-1" />Video
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs">15 min:</span>
                  <span className="font-medium text-xs gold-gradient">
                    {formatCurrency(scheduledVideoPrice15 ? scheduledVideoPrice15 / 100 : 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">30 min:</span>
                  <span className="font-medium text-xs gold-gradient">
                    {formatCurrency(scheduledVideoPrice30 ? scheduledVideoPrice30 / 100 : 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">60 min:</span>
                  <span className="font-medium text-xs gold-gradient">
                    {formatCurrency(scheduledVideoPrice60 ? scheduledVideoPrice60 / 100 : 0)}
                  </span>
                </div>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4" 
              onClick={() => setIsPricingDialogOpen(true)}
            >
              Update Pricing
            </Button>
          </CardContent>
        </Card>

        <Card className="glow-card sm:col-span-2 md:col-span-1">
          <CardHeader className="p-3 md:p-6">
            <CardTitle className="text-lg md:text-xl">Statistics</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-1 gap-2 md:gap-2">
              <div className="flex flex-col md:flex-row md:justify-between">
                <span className="text-muted-foreground text-xs md:text-sm">Total Readings:</span>
                <span className="text-sm md:text-base font-medium">{completedReadings.length}</span>
              </div>
              <div className="flex flex-col md:flex-row md:justify-between">
                <span className="text-muted-foreground text-xs md:text-sm">Rating:</span>
                <span className="text-sm md:text-base font-medium">⭐ {user?.rating || "-"}/5</span>
              </div>
              <div className="flex flex-col md:flex-row md:justify-between">
                <span className="text-muted-foreground text-xs md:text-sm">Reviews:</span>
                <span className="text-sm md:text-base font-medium">{user?.reviewCount || 0}</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4" 
              onClick={() => setIsEditingProfile(true)}
            >
              Edit Profile
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Readings */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Active Sessions</h2>
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : activeReadings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeReadings.map((reading) => (
              <ReadingCard key={reading.id} reading={reading} />
            ))}
          </div>
        ) : (
          <Card className="glow-card">
            <CardContent className="pt-6 text-center">
              <p>No active reading sessions.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Waiting Readings */}
      {waitingReadings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Waiting for You</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waitingReadings.map((reading) => (
              <ReadingCard key={reading.id} reading={reading} actionLabel="Start Session" />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Readings */}
      {upcomingReadings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Upcoming Sessions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingReadings.map((reading) => (
              <ReadingCard key={reading.id} reading={reading} />
            ))}
          </div>
        </div>
      )}

      {/* Pricing Dialog */}
      <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Reading Rates</DialogTitle>
            <DialogDescription>
              Set your pricing for different reading types and durations.
              All prices are in US dollars (cents).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-8 py-4">
            {/* Legacy per-minute pricing section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Pay-Per-Minute Rates</h3>
              <p className="text-sm text-muted-foreground mb-4">
                These rates are used for pay-per-minute on-demand readings.
              </p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    <Label htmlFor="pricing-chat">Chat Rate (cents per minute)</Label>
                  </div>
                  <Input
                    id="pricing-chat"
                    type="number"
                    value={pricingChat}
                    onChange={(e) => setPricingChat(parseInt(e.target.value) || 0)}
                    min={0}
                    placeholder="199 for $1.99"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: 199 = $1.99 per minute
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 mr-2" />
                    <Label htmlFor="pricing-voice">Voice Rate (cents per minute)</Label>
                  </div>
                  <Input
                    id="pricing-voice"
                    type="number"
                    value={pricingVoice}
                    onChange={(e) => setPricingVoice(parseInt(e.target.value) || 0)}
                    min={0}
                    placeholder="299 for $2.99"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: 299 = $2.99 per minute
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center">
                    <Video className="h-5 w-5 mr-2" />
                    <Label htmlFor="pricing-video">Video Rate (cents per minute)</Label>
                  </div>
                  <Input
                    id="pricing-video"
                    type="number"
                    value={pricingVideo}
                    onChange={(e) => setPricingVideo(parseInt(e.target.value) || 0)}
                    min={0}
                    placeholder="499 for $4.99"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: 499 = $4.99 per minute
                  </p>
                </div>
              </div>
            </div>
            
            {/* Fixed-price scheduled readings section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Scheduled Reading Prices</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set fixed prices for scheduled readings of different durations. 
                Clients pay these upfront when they book. 
                You receive 70% of each payment.
              </p>
              
              {/* Chat Reading Prices */}
              <div className="mb-6">
                <h4 className="font-medium mb-2 flex items-center"><MessageCircle className="h-4 w-4 mr-2" />Chat Readings</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-chat-15">15 Minutes (cents)</Label>
                    <Input
                      id="scheduled-chat-15"
                      type="number"
                      value={scheduledChatPrice15}
                      onChange={(e) => setScheduledChatPrice15(parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="1499 for $14.99"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-chat-30">30 Minutes (cents)</Label>
                    <Input
                      id="scheduled-chat-30"
                      type="number"
                      value={scheduledChatPrice30}
                      onChange={(e) => setScheduledChatPrice30(parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="2999 for $29.99"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-chat-60">60 Minutes (cents)</Label>
                    <Input
                      id="scheduled-chat-60"
                      type="number"
                      value={scheduledChatPrice60}
                      onChange={(e) => setScheduledChatPrice60(parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="5999 for $59.99"
                    />
                  </div>
                </div>
              </div>
              
              {/* Voice Reading Prices */}
              <div className="mb-6">
                <h4 className="font-medium mb-2 flex items-center"><Phone className="h-4 w-4 mr-2" />Voice Readings</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-voice-15">15 Minutes (cents)</Label>
                    <Input
                      id="scheduled-voice-15"
                      type="number"
                      value={scheduledVoicePrice15}
                      onChange={(e) => setScheduledVoicePrice15(parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="1999 for $19.99"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-voice-30">30 Minutes (cents)</Label>
                    <Input
                      id="scheduled-voice-30"
                      type="number"
                      value={scheduledVoicePrice30}
                      onChange={(e) => setScheduledVoicePrice30(parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="3999 for $39.99"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-voice-60">60 Minutes (cents)</Label>
                    <Input
                      id="scheduled-voice-60"
                      type="number"
                      value={scheduledVoicePrice60}
                      onChange={(e) => setScheduledVoicePrice60(parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="7999 for $79.99"
                    />
                  </div>
                </div>
              </div>
              
              {/* Video Reading Prices */}
              <div className="mb-6">
                <h4 className="font-medium mb-2 flex items-center"><Video className="h-4 w-4 mr-2" />Video Readings</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-video-15">15 Minutes (cents)</Label>
                    <Input
                      id="scheduled-video-15"
                      type="number"
                      value={scheduledVideoPrice15}
                      onChange={(e) => setScheduledVideoPrice15(parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="2499 for $24.99"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-video-30">30 Minutes (cents)</Label>
                    <Input
                      id="scheduled-video-30"
                      type="number"
                      value={scheduledVideoPrice30}
                      onChange={(e) => setScheduledVideoPrice30(parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="4999 for $49.99"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-video-60">60 Minutes (cents)</Label>
                    <Input
                      id="scheduled-video-60"
                      type="number"
                      value={scheduledVideoPrice60}
                      onChange={(e) => setScheduledVideoPrice60(parseInt(e.target.value) || 0)}
                      min={0}
                      placeholder="9999 for $99.99"
                    />
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                Example: 5999 = $59.99 for the entire session
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleUpdatePricing} 
              disabled={isUpdatingPricing}
            >
              {isUpdatingPricing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Editing Dialog */}
      <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your reader profile information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Profile Image Upload */}
            <div className="space-y-2">
              <Label>Profile Image</Label>
              <div className="flex items-center gap-4">
                <div 
                  className="h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewImageUrl ? (
                    <img 
                      src={previewImageUrl} 
                      alt="Profile preview" 
                      className="h-full w-full object-cover" 
                    />
                  ) : user?.profileImage ? (
                    <img 
                      src={user.profileImage} 
                      alt={user.fullName} 
                      className="h-full w-full object-cover" 
                    />
                  ) : (
                    <UserIcon className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="w-full mb-2"
                  >
                    Choose Image
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Upload a professional portrait (max 5MB)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={profileData.username}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  username: e.target.value
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={profileData.fullName}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  fullName: e.target.value
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profileData.bio}
                onChange={(e) => setProfileData(prev => ({
                  ...prev,
                  bio: e.target.value
                }))}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Specialties</Label>
              <div className="flex flex-wrap gap-2">
                {profileData.specialties.map((specialty, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => {
                      setProfileData(prev => ({
                        ...prev,
                        specialties: prev.specialties.filter((_, i) => i !== index)
                      }));
                    }}
                  >
                    {specialty}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add a specialty..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value && !profileData.specialties.includes(value)) {
                      setProfileData(prev => ({
                        ...prev,
                        specialties: [...prev.specialties, value]
                      }));
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProfile}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

interface ReadingCardProps {
  reading: Reading;
  actionLabel?: string;
}

function ReadingCard({ reading, actionLabel }: ReadingCardProps) {
  const sessionDate = reading.scheduledFor 
    ? new Date(reading.scheduledFor)
    : reading.createdAt 
      ? new Date(reading.createdAt) 
      : new Date();

  return (
    <Card className="glow-card h-full">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
          <CardTitle className="text-lg break-words">{reading.notes || "General Reading"}</CardTitle>
          <Badge className={`${getStatusColor(reading.status)} whitespace-nowrap`}>
            {reading.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground text-sm">Type:</span>
            <span className="capitalize text-sm text-right">{reading.type}</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground text-sm">Date:</span>
            <span className="text-sm text-right">{sessionDate.toLocaleDateString()}</span>
          </div>
          {reading.scheduledFor && (
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground text-sm">Time:</span>
              <span className="text-sm text-right">{new Date(reading.scheduledFor).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground text-sm">Duration:</span>
            <span className="text-sm text-right">{reading.duration || "-"} min</span>
          </div>

          {actionLabel && (
            <Button 
              className="w-full mt-4 bg-accent hover:bg-accent-dark text-white"
              onClick={() => window.location.href = `/reading-session/${reading.id}`}
            >
              {actionLabel}
            </Button>
          )}

          {reading.status === "in_progress" && (
            <Button 
              className="w-full mt-4 bg-purple-500 hover:bg-purple-700 text-white"
              onClick={() => window.location.href = `/reading-session/${reading.id}`}
            >
              Continue Session
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: string): string {
  const colors = {
    scheduled: "bg-blue-500",
    waiting_payment: "bg-yellow-500",
    payment_completed: "bg-green-500",
    in_progress: "bg-purple-500",
    completed: "bg-green-700",
    cancelled: "bg-red-500",
  };

  return colors[status as keyof typeof colors] || "bg-gray-500";
}