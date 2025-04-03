import { DashboardLayout } from "./dashboard-layout";
import { useQuery } from "@tanstack/react-query";
import { Reading, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Phone, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
  const [pricingChat, setPricingChat] = useState<number | undefined>(user?.pricingChat || 0);
  const [pricingVoice, setPricingVoice] = useState<number | undefined>(user?.pricingVoice || 0);
  const [pricingVideo, setPricingVideo] = useState<number | undefined>(user?.pricingVideo || 0);
  const [isUpdatingPricing, setIsUpdatingPricing] = useState(false);

  const { data: readings, isLoading } = useQuery<Reading[]>({
    queryKey: ["/api/readings/reader"],
  });

  useEffect(() => {
    if (user) {
      setIsOnline(user.isOnline || false);
      setPricingChat(user.pricingChat || 0);
      setPricingVoice(user.pricingVoice || 0);
      setPricingVideo(user.pricingVideo || 0);
    }
  }, [user]);

  const handleOnlineToggle = async (checked: boolean) => {
    setIsOnline(checked);

    try {
      await apiRequest("PATCH", "/api/readers/status", {
        isOnline: checked
      });

      // Invalidate user data to refresh status
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    } catch (err) {
      console.error("Failed to update online status:", err);
      setIsOnline(!checked); // Revert on failure
    }
  };

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    fullName: user?.fullName || '',
    bio: user?.bio || '',
    specialties: user?.specialties || [],
    profileImage: null as File | null
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async () => {
    try {
      const formData = new FormData();
      
      // Add all profile data to formData
      Object.entries(profileData).forEach(([key, value]) => {
        if (key === 'specialties') {
          formData.append(key, JSON.stringify(value));
        } else if (key === 'profileImage' && value) {
          formData.append(key, value);
        } else {
          formData.append(key, String(value));
        }
      });

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
        pricingChat,
        pricingVoice,
        pricingVideo
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
        description: "Your new reading rates have been saved.",
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
              <Badge className={isOnline ? "bg-green-500" : "bg-red-500"}>
                {isOnline ? "Online" : "Offline"}
              </Badge>
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
                  {formatCurrency(pricingChat / 100)}/min
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">

        <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full mt-4">Edit Profile</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update your reader profile information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="profile-image">Profile Image</Label>
                <div className="flex items-center gap-4">
                  <div 
                    className="h-24 w-24 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center bg-muted overflow-hidden cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {user?.profileImage ? (
                      <img 
                        src={user.profileImage} 
                        alt="Profile" 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setProfileData(prev => ({
                          ...prev,
                          profileImage: e.target.files![0]
                        }));
                      }
                    }}
                  />
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

                  <Phone className="h-4 w-4 mr-2" />
                  <span className="text-sm">Voice:</span>
                </div>
                <span className="font-bold text-sm gold-gradient">
                  {formatCurrency(pricingVoice / 100)}/min
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Video className="h-4 w-4 mr-2" />
                  <span className="text-sm">Video:</span>
                </div>
                <span className="font-bold text-sm gold-gradient">
                  {formatCurrency(pricingVideo / 100)}/min
                </span>
              </div>
            </div>

            <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">Update Pricing</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Update Reading Rates</DialogTitle>
                  <DialogDescription>
                    Set your per-minute pricing for each reading type.
                    All prices are in US dollars (cents).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
            <Button className="w-full mt-4 bg-accent hover:bg-accent-dark text-white">
              {actionLabel}
            </Button>
          )}

          {reading.status === "in_progress" && (
            <Button className="w-full mt-4 bg-purple-500 hover:bg-purple-700 text-white">
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