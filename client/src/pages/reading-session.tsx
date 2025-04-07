import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, MonitorPlay, VideoIcon, MessageSquare, PhoneIcon } from 'lucide-react';
import WebRTCSession from '@/components/readings/webrtc-session';
import { apiRequest } from '@/lib/queryClient';
import { Reading } from '@shared/schema';
import { PATHS } from '@/lib/constants';

/**
 * Reading session page - WebRTC implementation
 * 
 * Uses custom WebRTC solution for video/voice/chat sessions
 */
export default function ReadingSessionPage() {
  const params = useParams();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get the reading ID from URL params
  const readingId = parseInt(params.id || '0');
  
  // Keep track of the reader name
  const [readerName, setReaderName] = useState<string>('Reader');
  
  // Fetch reading data
  const { 
    data: reading,
    error: readingError,
    isLoading: isReadingLoading,
    refetch: refetchReading
  } = useQuery<Reading>({
    queryKey: ['/api/readings', readingId],
    enabled: Boolean(readingId),
    onSuccess: async (data) => {
      // Fetch reader info when we get reading data
      if (data?.readerId) {
        try {
          const response = await apiRequest('GET', `/api/users/${data.readerId}`);
          if (response.ok) {
            const readerData = await response.json();
            setReaderName(readerData.fullName || readerData.username || 'Reader');
          }
        } catch (error) {
          console.error('Failed to fetch reader info:', error);
        }
      }
    }
  });
  
  // Mutation for starting the reading session
  const startReadingMutation = useMutation({
    mutationFn: async () => {
      console.log(`Starting reading ${readingId}`);
      const response = await apiRequest('POST', `/api/readings/${readingId}/start`);
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Reading started successfully:', data);
      toast({
        title: "Reading Started",
        description: "Your reading session has been started successfully.",
      });
      refetchReading();
    },
    onError: (error) => {
      console.error('Failed to start reading:', error);
      toast({
        title: "Error",
        description: "Failed to start the reading session. Please try again.",
        variant: "destructive",
      });
      setIsStartingSession(false);
    }
  });
  
  // Mutation for ending the reading session
  const endReadingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/readings/${readingId}/end`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reading Ended",
        description: "The reading session has been successfully completed.",
      });
      setLocation(PATHS.DASHBOARD);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to end the reading session. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Start reading session if not in progress
  useEffect(() => {
    if (reading && reading.status !== 'in_progress' && !isStartingSession && 
        (reading.status === 'payment_completed' || reading.status === 'waiting_payment')) {
      console.log('Initiating reading session start...');
      setIsStartingSession(true);
      startReadingMutation.mutate();
    }
  }, [reading, startReadingMutation, isStartingSession]);
  
  // Reset isStartingSession when mutation fails or completes
  useEffect(() => {
    if (startReadingMutation.isError || (startReadingMutation.isSuccess && reading?.status !== 'in_progress')) {
      console.log('Resetting isStartingSession due to mutation state change');
      setIsStartingSession(false);
    }
  }, [startReadingMutation.isError, startReadingMutation.isSuccess, reading?.status]);
  
  // Get user from auth context
  const { user } = useAuth();
  
  // Handle session end
  const handleEndSession = () => {
    if (confirm('Are you sure you want to end this reading session?')) {
      endReadingMutation.mutate();
    }
  };
  
  // Handle starting session manually
  const handleStartSession = () => {
    setIsStartingSession(true);
    startReadingMutation.mutate();
  };
  
  // Handle back button
  
  const handleBack = () => {
    // Check if this is a reader and redirect them to their sessions page if they are
    if (user?.role === 'reader') {
      setLocation(`/reader-sessions/${reading?.readerId}`);
    } else {
      // For clients and others, go to the main dashboard
      setLocation(PATHS.DASHBOARD);
    }
  };
  
  // Loading state
  if (isReadingLoading || isLoading || isStartingSession) {
    return (
      <div className="container mx-auto py-12 cosmic-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-accent" />
          <h2 className="text-2xl font-cinzel text-accent mb-2">
            {isStartingSession ? "Creating Reading Session" : "Initializing Reading Session"}
          </h2>
          <p className="text-light/70">Please wait while we prepare your session...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (readingError || !reading) {
    return (
      <div className="container mx-auto py-8 cosmic-bg min-h-screen">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl">Reading Session Error</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center py-6">
              <h2 className="text-xl font-semibold mb-4 text-red-500">
                Could not load the reading session
              </h2>
              <p className="text-muted-foreground mb-6">
                {readingError instanceof Error 
                  ? readingError.message 
                  : "The reading session could not be found or is unavailable."}
              </p>
              <Button onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Token error state
  if (tokenError) {
    return (
      <div className="container mx-auto py-8 cosmic-bg min-h-screen">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl">Connection Error</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center py-6">
              <h2 className="text-xl font-semibold mb-4 text-red-500">
                Failed to establish connection
              </h2>
              <p className="text-muted-foreground mb-6">
                {tokenError}
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // If reading is not in progress and in a valid state to start
  if (reading.status !== 'in_progress' && 
      (reading.status === 'payment_completed' || reading.status === 'waiting_payment')) {
    return (
      <div className="container mx-auto py-8 cosmic-bg min-h-screen">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl">Start Reading Session</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center py-6">
              <h2 className="text-xl font-semibold mb-4">
                Ready to begin your reading session
              </h2>
              <p className="text-muted-foreground mb-6">
                Current status: <Badge>{reading.status.replace(/_/g, ' ')}</Badge>
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
                <Button onClick={handleStartSession}>
                  Start Session
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // If reading is in an invalid state (not in_progress and not startable)
  if (reading.status !== 'in_progress') {
    return (
      <div className="container mx-auto py-8 cosmic-bg min-h-screen">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl">Reading Not Active</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center py-6">
              <h2 className="text-xl font-semibold mb-4">
                This reading session is not active
              </h2>
              <p className="text-muted-foreground mb-6">
                Current status: <Badge>{reading.status.replace(/_/g, ' ')}</Badge>
              </p>
              <Button onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-4 cosmic-bg min-h-screen">
      <div className="mb-4 flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="flex items-center gap-2">
          {reading.type === 'video' && <VideoIcon className="h-5 w-5 text-accent" />}
          {reading.type === 'voice' && <PhoneIcon className="h-5 w-5 text-accent" />}
          {reading.type === 'chat' && <MessageSquare className="h-5 w-5 text-accent" />}
          <h1 className="text-xl font-cinzel">
            {reading.type.charAt(0).toUpperCase() + reading.type.slice(1)} Reading Session
          </h1>
        </div>
        
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={handleEndSession}
          disabled={endReadingMutation.isPending}
        >
          {endReadingMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ending...
            </>
          ) : (
            'End Session'
          )}
        </Button>
      </div>
      
      <Card className="max-w-6xl mx-auto overflow-hidden">
        <CardContent className="p-0">
          {/* Call WebRTC session component */}
          <div className="h-[70vh]">
            <WebRTCSession
              roomId={`reading-${readingId}`}
              userId={user?.id || 0}
              userName={user?.fullName || 'User'}
              readerId={reading?.readerId || 0}
              readerName={readerName}
              sessionType={reading.type}
              isReader={user?.role === 'reader'}
              onSessionEnd={handleEndSession}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}