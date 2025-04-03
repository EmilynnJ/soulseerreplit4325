import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { User, Reading } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Star, 
  ChevronLeft, 
  Clock, 
  Calendar, 
  MessageSquare, 
  Video, 
  Phone, 
  CheckCircle, 
  Award,
  Shield
} from "lucide-react";

export default function ReaderProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("about");
  const [readingType, setReadingType] = useState<"chat" | "voice" | "video">("chat");
  const [isCreatingReading, setIsCreatingReading] = useState(false);
  const [scheduledReadingOptions, setScheduledReadingOptions] = useState({
    type: "chat" as "chat" | "voice" | "video",
    duration: 30,
    date: new Date(new Date().setDate(new Date().getDate() + 1)),
    notes: ""
  });
  const [isSchedulingReading, setIsSchedulingReading] = useState(false);

  // Fetch reader data
  const { data: reader, isLoading, error } = useQuery<Omit<User, 'password'>>({
    queryKey: [`/api/readers/${id}`],
    enabled: !!id,
  });

  // Fetch user's past readings with this reader if authenticated
  const { data: userReadings } = useQuery<Reading[]>({
    queryKey: ['/api/readings/client'],
    enabled: !!user,
  });

  // Past readings with this reader
  const pastReadings = userReadings 
    ? userReadings.filter(reading => 
        reading.readerId === Number(id) && 
        reading.status === "completed")
    : [];

  // Handle starting a reading
  const handleStartReading = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to book a reading with this reader.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!reader) return;

    setIsCreatingReading(true);

    try {
      const response = await apiRequest("POST", "/api/readings/on-demand", {
        readerId: reader.id,
        type: readingType
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create reading");
      }

      const data = await response.json();

      if (data.paymentLink) {
        // Redirect to payment if needed
        window.location.href = data.paymentLink;
      } else if (data.reading) {
        // Redirect to reading session
        navigate(`/reading-session/${data.reading.id}`);
      }

      toast({
        title: "Reading Created",
        description: "Your reading session is being set up.",
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create reading. Please try again.",
        variant: "destructive",
      });
    }

    setIsCreatingReading(false);
  };

  // Handle scheduling a reading
  const handleScheduleReading = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to schedule a reading with this reader.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!reader) return;

    setIsSchedulingReading(true);

    try {
      // Calculate total price based on duration and type
      const basePrice = (
        scheduledReadingOptions.type === "chat" 
          ? (reader.pricingChat || reader.pricing || 0)
          : scheduledReadingOptions.type === "voice" 
            ? (reader.pricingVoice || (reader.pricing ? reader.pricing + 100 : 0))
            : (reader.pricingVideo || (reader.pricing ? reader.pricing + 200 : 0))
      );

      const totalPrice = basePrice * scheduledReadingOptions.duration;

      const response = await apiRequest("POST", "/api/readings/schedule", {
        readerId: reader.id,
        type: scheduledReadingOptions.type,
        duration: scheduledReadingOptions.duration,
        scheduledFor: scheduledReadingOptions.date,
        notes: scheduledReadingOptions.notes,
        price: totalPrice
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to schedule reading");
      }

      const data = await response.json();

      if (data.paymentLink) {
        // Redirect to payment
        window.location.href = data.paymentLink;
      } else {
        toast({
          title: "Reading Scheduled",
          description: "Your reading has been successfully scheduled.",
        });

        // Refresh readings data
        queryClient.invalidateQueries({ queryKey: ['/api/readings/client'] });

        // Switch to dashboard tab
        navigate("/dashboard");
      }

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule reading. Please try again.",
        variant: "destructive",
      });
    }

    setIsSchedulingReading(false);
  };

  // Format price from cents to dollars
  const formatPrice = (cents: number | null | undefined) => {
    if (!cents) return "$0.00";
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Handle error state
  if (error) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <div className="cosmic-bg p-8 rounded-lg max-w-lg mx-auto">
          <h2 className="text-2xl font-cinzel text-accent mb-4">Reader Not Found</h2>
          <p className="text-light/80 font-playfair mb-6">
            We couldn't find the reader you're looking for. They may have moved to a different spiritual plane.
          </p>
          <CelestialButton onClick={() => navigate("/readers")}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Readers
          </CelestialButton>
        </div>
      </div>
    );
  }

  if (isLoading || !reader) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-light/80 font-playfair">Loading reader profile...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4">
      {/* Back button */}
      <div className="mb-6">
        <CelestialButton variant="secondary" onClick={() => navigate("/readers")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Readers
        </CelestialButton>
      </div>

      {/* Reader Profile Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        {/* Profile Image */}
        <div className="md:col-span-1">
          <div className="relative">
            {reader.profileImage ? (
              <img 
                src={reader.profileImage} 
                alt={reader.fullName}
                className="w-full rounded-lg shadow-lg aspect-square object-cover"
              />
            ) : (
              <div className="w-full rounded-lg shadow-lg aspect-square bg-gradient-to-r from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                <span className="text-7xl font-playfair text-accent/50">{reader.fullName.charAt(0)}</span>
              </div>
            )}

            {reader.isOnline && (
              <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full flex items-center">
                <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
                Online Now
              </div>
            )}
          </div>
        </div>

        {/* Profile Info */}
        <div className="md:col-span-2">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-alex-brush text-accent mb-2">{reader.fullName}</h1>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {reader.verified && (
                  <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                    <CheckCircle className="w-3 h-3 mr-1" /> Verified
                  </Badge>
                )}

                <Badge variant="outline" className="bg-primary-dark/50 text-light/80 border-accent/20">
                  <Star className="w-3 h-3 mr-1 text-yellow-500" /> 
                  {reader.rating || "New"} 
                  {reader.reviewCount ? ` (${reader.reviewCount} reviews)` : ""}
                </Badge>

                <Badge variant="outline" className="bg-primary-dark/50 text-light/80 border-accent/20">
                  <Clock className="w-3 h-3 mr-1 text-accent/60" /> 
                  {formatPrice(reader.pricing)}/minute
                </Badge>
              </div>

              {reader.specialties && reader.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {reader.specialties.map(specialty => (
                    <Badge key={specialty} variant="secondary" className="bg-primary-dark/40 text-accent/80 border-accent/20">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reading Options */}
          <Card className="glow-card bg-primary-dark/40 border-accent/20 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="font-cinzel text-accent">Request a Reading</CardTitle>
              <CardDescription className="text-light/70">
                Choose your preferred reading method below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setReadingType("chat")}
                  className={`px-4 py-2 rounded-md flex items-center ${
                    readingType === "chat" 
                      ? "bg-accent/30 text-accent border border-accent/50" 
                      : "bg-primary-dark/30 text-light/70 border border-accent/10 hover:bg-primary-dark/50"
                  }`}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Text Chat
                </button>

                <button
                  onClick={() => setReadingType("voice")}
                  className={`px-4 py-2 rounded-md flex items-center ${
                    readingType === "voice" 
                      ? "bg-accent/30 text-accent border border-accent/50" 
                      : "bg-primary-dark/30 text-light/70 border border-accent/10 hover:bg-primary-dark/50"
                  }`}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Voice Call
                </button>

                <button
                  onClick={() => setReadingType("video")}
                  className={`px-4 py-2 rounded-md flex items-center ${
                    readingType === "video" 
                      ? "bg-accent/30 text-accent border border-accent/50" 
                      : "bg-primary-dark/30 text-light/70 border border-accent/10 hover:bg-primary-dark/50"
                  }`}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Video Call
                </button>
              </div>

              <div className="mb-4">
                <h3 className="text-sm font-medium text-accent mb-2">Pricing:</h3>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex flex-col items-center p-2 rounded-md bg-primary-dark/40 border border-accent/20">
                    <MessageSquare className="w-4 h-4 mb-1 text-accent" />
                    <span className="font-bold text-light">Chat</span>
                    <span className="text-light/80">
                      {formatPrice(reader.pricingChat || 0)}/min
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-md bg-primary-dark/40 border border-accent/20">
                    <Phone className="w-4 h-4 mb-1 text-accent" />
                    <span className="font-bold text-light">Voice</span>
                    <span className="text-light/80">
                      {formatPrice(reader.pricingVoice || 0)}/min
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-md bg-primary-dark/40 border border-accent/20">
                    <Video className="w-4 h-4 mb-1 text-accent" />
                    <span className="font-bold text-light">Video</span>
                    <span className="text-light/80">
                      {formatPrice(reader.pricingVideo || 0)}/min
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center text-xs text-light/70 mb-6">
                <Shield className="w-4 h-4 mr-2 text-accent/60" />
                <p>Pay-per-minute: only pay for the time you use. Secure payment via Stripe.</p>
              </div>

              <CelestialButton
                onClick={handleStartReading}
                className="w-full"
                disabled={!reader.isOnline || isCreatingReading}
              >
                {isCreatingReading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                    Setting Up Reading...
                  </>
                ) : !reader.isOnline ? (
                  "Reader is Offline"
                ) : (
                  "Start Reading Now"
                )}
              </CelestialButton>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs for About, Reviews, etc. */}
      <Tabs defaultValue="about" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-primary-dark/50">
          <TabsTrigger value="about" className="font-cinzel">About</TabsTrigger>
          <TabsTrigger value="reviews" className="font-cinzel">Reviews</TabsTrigger>
          <TabsTrigger value="availability" className="font-cinzel">Availability</TabsTrigger>
        </TabsList>

        {/* About Tab */}
        <TabsContent value="about" className="mt-6">
          <Card className="glow-card bg-primary-dark/40 border-accent/20">
            <CardHeader>
              <CardTitle className="font-cinzel text-accent">About {reader.fullName}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none font-playfair">
              <p className="text-light/90 whitespace-pre-line">
                {reader.bio || "This reader has not provided a bio yet."}
              </p>

              {reader.specialties && reader.specialties.length > 0 && (
                <>
                  <h3 className="text-xl font-cinzel text-accent mt-6 mb-3">Specialties</h3>
                  <ul className="list-disc pl-6 text-light/80">
                    {reader.specialties.map(specialty => (
                      <li key={specialty}>{specialty}</li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-6 p-4 border border-accent/20 rounded-lg bg-primary-dark/20">
                <h3 className="text-xl font-cinzel text-accent mb-3 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-yellow-500" />
                  Reader Stats
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-light/60 text-sm">Member Since</p>
                    <p className="text-light/90">
                      {reader.createdAt 
                        ? new Date(reader.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) 
                        : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-light/60 text-sm">Completed Readings</p>
                    <p className="text-light/90">{reader.reviewCount || 0}+</p>
                  </div>
                  <div>
                    <p className="text-light/60 text-sm">Rating</p>
                    <p className="text-light/90 flex items-center">
                      <Star className="w-4 h-4 text-yellow-500 mr-1" />
                      {reader.rating || "New"}
                    </p>
                  </div>
                  <div>
                    <p className="text-light/60 text-sm">Rates</p>
                    <div className="flex items-center text-light/90 text-xs gap-2">
                      <div className="flex items-center">
                        <MessageSquare className="w-3 h-3 text-accent mr-1" />
                        {formatPrice(reader.pricingChat || reader.pricing || 0)}
                      </div>
                      <div className="flex items-center">
                        <Phone className="w-3 h-3 text-accent mr-1" />
                        {formatPrice(reader.pricingVoice || (reader.pricing ? reader.pricing + 100 : 0))}
                      </div>
                      <div className="flex items-center">
                        <Video className="w-3 h-3 text-accent mr-1" />
                        {formatPrice(reader.pricingVideo || (reader.pricing ? reader.pricing + 200 : 0))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="mt-6">
          <Card className="glow-card bg-primary-dark/40 border-accent/20">
            <CardHeader>
              <CardTitle className="font-cinzel text-accent">Client Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {/* We'd normally fetch reviews here, but for now show a placeholder */}
              <div className="text-center py-6">
                <p className="text-light/70 font-playfair mb-4">
                  No reviews available yet. Be the first to experience a reading with {reader.fullName}.
                </p>
                {reader.isOnline && (
                  <CelestialButton onClick={handleStartReading}>
                    Book a Reading Now
                  </CelestialButton>
                )}
              </div>
            </CardContent>
          </Card>

          {pastReadings.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-cinzel text-accent mb-4">Your Past Readings</h3>
              <div className="space-y-4">
                {pastReadings.map(reading => (
                  <Card key={reading.id} className="bg-primary-dark/30 border-accent/10">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-cinzel text-light/90">
                          {new Date(reading.createdAt || "").toLocaleDateString()} Reading
                        </CardTitle>
                        <Badge variant="outline" className="bg-primary-dark/50 text-accent/80 border-accent/20">
                          {reading.type === "chat" ? (
                            <MessageSquare className="w-3 h-3 mr-1" />
                          ) : reading.type === "voice" ? (
                            <Phone className="w-3 h-3 mr-1" />
                          ) : (
                            <Video className="w-3 h-3 mr-1" />
                          )}
                          {reading.type.charAt(0).toUpperCase() + reading.type.slice(1)}
                        </Badge>
                      </div>
                      <CardDescription className="text-light/70">
                        <div className="flex items-center mt-1">
                          <Clock className="w-4 h-4 text-accent/60 mr-1" />
                          <span>{reading.duration ? `${Math.floor(reading.duration / 60)} minutes` : "Duration unavailable"}</span>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-0">
                      <CelestialButton variant="secondary" className="w-full" onClick={() => navigate(`/reading-session/${reading.id}`)}>
                        View Session
                      </CelestialButton>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability" className="mt-6">
          <Card className="glow-card bg-primary-dark/40 border-accent/20">
            <CardHeader>
              <CardTitle className="font-cinzel text-accent">Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <h3 className="text-lg font-cinzel text-light mb-3">Current Status</h3>
                <div className={`flex items-center p-4 rounded-lg ${reader.isOnline ? 'bg-green-500/10 border border-green-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                  <div className={`w-3 h-3 rounded-full mr-3 ${reader.isOnline ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
                  <div>
                    <p className={`font-medium ${reader.isOnline ? 'text-green-500' : 'text-amber-500'}`}>
                      {reader.isOnline ? 'Online Now' : 'Currently Offline'}
                    </p>
                    <p className="text-light/70 text-sm">
                      {reader.isOnline 
                        ? 'This reader is available for immediate readings.' 
                        : 'This reader is not currently available. Please check back later.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-cinzel text-light mb-3">Schedule a Reading</h3>
                <div className="p-5 rounded-lg bg-primary-dark/20 border border-accent/30">
                  <p className="text-light/80 text-sm mb-4">
                    Book a set time with {reader.fullName} for a fixed-price reading. 
                    Choose your preferred reading method, duration, and date.
                  </p>

                  <div className="space-y-4 mb-5">
                    <div>
                      <label className="text-light font-medium mb-1 block">Reading Type</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setScheduledReadingOptions(prev => ({ ...prev, type: "chat" }))}
                          className={`px-4 py-2 rounded-md flex items-center ${
                            scheduledReadingOptions.type === "chat" 
                              ? "bg-accent/30 text-accent border border-accent/50" 
                              : "bg-primary-dark/30 text-light/70 border border-accent/10 hover:bg-primary-dark/50"
                          }`}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Text Chat
                        </button>

                        <button
                          onClick={() => setScheduledReadingOptions(prev => ({ ...prev, type: "voice" }))}
                          className={`px-4 py-2 rounded-md flex items-center ${
                            scheduledReadingOptions.type === "voice" 
                              ? "bg-accent/30 text-accent border border-accent/50" 
                              : "bg-primary-dark/30 text-light/70 border border-accent/10 hover:bg-primary-dark/50"
                          }`}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Voice Call
                        </button>

                        <button
                          onClick={() => setScheduledReadingOptions(prev => ({ ...prev, type: "video" }))}
                          className={`px-4 py-2 rounded-md flex items-center ${
                            scheduledReadingOptions.type === "video" 
                              ? "bg-accent/30 text-accent border border-accent/50" 
                              : "bg-primary-dark/30 text-light/70 border border-accent/10 hover:bg-primary-dark/50"
                          }`}
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Video Call
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-light font-medium mb-1 block">Duration (minutes)</label>
                      <select 
                        value={scheduledReadingOptions.duration} 
                        onChange={(e) => setScheduledReadingOptions(prev => ({ 
                          ...prev, 
                          duration: parseInt(e.target.value) 
                        }))}
                        className="w-full p-2 rounded-md bg-primary-dark/50 border border-accent/20 text-black"
                      >
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="45">45 minutes</option>
                        <option value="60">60 minutes</option>
                        <option value="90">90 minutes</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-light font-medium mb-1 block">Date and Time</label>
                      <input 
                        type="datetime-local" 
                        value={scheduledReadingOptions.date.toISOString().slice(0, 16)} 
                        onChange={(e) => setScheduledReadingOptions(prev => ({ 
                          ...prev, 
                          date: new Date(e.target.value) 
                        }))}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full p-2 rounded-md bg-primary-dark/50 border border-accent/20 text-black"
                      />
                    </div>

                    <div>
                      <label className="text-light font-medium mb-1 block">Notes for the Reader (Optional)</label>
                      <textarea 
                        value={scheduledReadingOptions.notes} 
                        onChange={(e) => setScheduledReadingOptions(prev => ({ 
                          ...prev, 
                          notes: e.target.value 
                        }))}
                        placeholder="Share any specific topics or questions you'd like to cover in your reading."
                        className="w-full p-2 rounded-md bg-primary-dark/50 border border-accent/20 text-black h-24"
                      />
                    </div>
                  </div>

                  <div className="border-t border-accent/10 pt-4">
                    <h4 className="text-accent font-medium mb-2">Price Summary</h4>
                    <div className="flex justify-between mb-1 text-light/80 text-sm">
                      <span>Base rate ({scheduledReadingOptions.type}):</span>
                      <span>{formatPrice(
                        scheduledReadingOptions.type === "chat" 
                          ? (reader.pricingChat || reader.pricing || 0)
                          : scheduledReadingOptions.type === "voice" 
                            ? (reader.pricingVoice || (reader.pricing ? reader.pricing + 100 : 0))
                            : (reader.pricingVideo || (reader.pricing ? reader.pricing + 200 : 0))
                      )}/min</span>
                    </div>
                    <div className="flex justify-between mb-1 text-light/80 text-sm">
                      <span>Duration:</span>
                      <span>{scheduledReadingOptions.duration} minutes</span>
                    </div>
                    <div className="flex justify-between text-light font-medium mt-2 pt-2 border-t border-accent/10">
                      <span>Total:</span>
                      <span>{formatPrice(
                        (scheduledReadingOptions.type === "chat" 
                          ? (reader.pricingChat || reader.pricing || 0)
                          : scheduledReadingOptions.type === "voice" 
                            ? (reader.pricingVoice || (reader.pricing ? reader.pricing + 100 : 0))
                            : (reader.pricingVideo || (reader.pricing ? reader.pricing + 200 : 0))
                        ) * scheduledReadingOptions.duration
                      )}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <CelestialButton
                      onClick={handleScheduleReading}
                      className="w-full"
                      disabled={isSchedulingReading}
                    >
                      {isSchedulingReading ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        "Schedule and Pay"
                      )}
                    </CelestialButton>

                    <p className="text-light/60 text-xs text-center mt-2">
                      You'll be charged the full amount once the reader confirms your appointment.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-cinzel text-light mb-3">Reading Options</h3>
                <div className="space-y-4">
                  <div className="flex items-start p-4 rounded-lg bg-primary-dark/20 border border-accent/20">
                    <MessageSquare className="w-5 h-5 text-accent mr-3 mt-0.5" />
                    <div>
                      <p className="font-medium text-light">Text Chat Reading</p>
                      <p className="text-light/70 text-sm">
                        Chat-based readings offer a written record of your session. Perfect if you prefer text communication.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start p-4 rounded-lg bg-primary-dark/20 border border-accent/20">
                    <Phone className="w-5 h-5 text-accent mr-3 mt-0.5" />
                    <div>
                      <p className="font-medium text-light">Voice Call Reading</p>
                      <p className="text-light/70 text-sm">
                        Voice readings provide a more personal connection through audio. Great for detailed discussions.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start p-4 rounded-lg bg-primary-dark/20 border border-accent/20">
                    <Video className="w-5 h-5 text-accent mr-3 mt-0.5" />
                    <div>
                      <p className="font-medium text-light">Video Call Reading</p>
                      <p className="text-light/70 text-sm">
                        Our most immersive option with face-to-face interaction. Perfect for tarot or visual readings.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <CelestialButton
                onClick={handleStartReading}
                className="w-full"
                disabled={!reader.isOnline || isCreatingReading}
              >
                {isCreatingReading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2border-current border-t-transparent rounded-full mr-2"></div>
                    Setting Up Reading...
                  </>
                ) : !reader.isOnline ? (
                  "Reader is Offline"
                ) : (
                  "Start Reading Now"
                )}
              </CelestialButton>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}