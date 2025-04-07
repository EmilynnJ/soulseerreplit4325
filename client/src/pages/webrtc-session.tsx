import React, { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import WebRTCSession from '@/components/readings/webrtc-session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserContext } from '@/providers/user-provider';

// Define session params type
interface SessionParams {
  roomId: string;
}

export default function WebRTCSessionPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute<SessionParams>('/reading-session/:roomId');
  const { toast } = useToast();
  const { user } = useUserContext();
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any>(null);

  // Get the room ID from the URL
  const roomId = params?.roomId || '';

  // Query session details
  const { data: sessionData, isLoading, error } = useQuery({
    queryKey: ['/api/sessions/details', roomId],
    queryFn: async () => {
      if (!roomId) return null;
      const response = await fetch(`/api/sessions/details/${roomId}`);
      const data = await response.json();
      return data;
    },
    enabled: !!roomId && !!user,
    staleTime: Infinity // Don't refetch during session
  });

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load session details. Please try again.',
        variant: 'destructive'
      });
      // Redirect to dashboard
      setLocation('/dashboard');
    }
  }, [error]);

  // Handle session end
  const handleSessionEnd = async (totalDuration: number) => {
    try {
      const response = await fetch('/api/sessions/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomName: roomId,
          totalDuration,
          userId: user?.id,
          userRole: user?.role
        })
      });

      const data = await response.json();
      setSessionSummary(data);
      setSessionEnded(true);
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: 'Error',
        description: 'Failed to properly end the session. Please contact support.',
        variant: 'destructive'
      });
    }
  };

  // Handle return to dashboard
  const handleReturnToDashboard = () => {
    setLocation('/dashboard');
  };

  // Show loading state
  if (isLoading || !sessionData) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Loading Session...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if session is valid
  if (!sessionData.readerId || !sessionData.clientId) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Invalid Session</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This session is not valid or has already ended.</p>
            <Button className="mt-4" onClick={handleReturnToDashboard}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If the session has ended, show summary
  if (sessionEnded) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Session Ended</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>Your session has ended. Here's a summary:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-100 p-4 rounded-md">
                <div>
                  <h3 className="font-semibold">Session Details</h3>
                  <p>Duration: {sessionSummary?.session?.duration || 0} minutes</p>
                  <p>Type: {sessionSummary?.session?.type || 'N/A'}</p>
                </div>
                
                {user?.role === 'client' && (
                  <div>
                    <h3 className="font-semibold">Billing Details</h3>
                    <p>Total Charged: ${sessionSummary?.session?.price?.toFixed(2) || '0.00'}</p>
                  </div>
                )}
                
                {user?.role === 'reader' && (
                  <div>
                    <h3 className="font-semibold">Earnings</h3>
                    <p>Total Earned: ${(sessionSummary?.session?.price * 0.7)?.toFixed(2) || '0.00'}</p>
                  </div>
                )}
              </div>
              
              <Button onClick={handleReturnToDashboard}>
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine if the current user is the reader
  const isReader = user?.id === sessionData.readerId;

  return (
    <div className="container mx-auto py-4">
      <WebRTCSession
        roomId={roomId}
        userId={user?.id || 0}
        userName={user?.fullName || user?.username || 'User'}
        readerId={sessionData.readerId}
        readerName={sessionData.readerName || 'Reader'}
        sessionType={sessionData.type || 'video'}
        isReader={isReader}
        onSessionEnd={handleSessionEnd}
      />
    </div>
  );
}