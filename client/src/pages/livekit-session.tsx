import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { RoomUI } from '@/components/livekit/room-ui';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';

export default function LiveKitSessionPage() {
  const [_, setLocation] = useLocation();
  const params = useParams<{ readerId: string }>();
  const queryClient = useQueryClient();
  
  const [token, setToken] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [readerData, setReaderData] = useState<any>(null);
  
  // Fetch current user and reader data
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        
        // Get current user data
        const userResponse = await fetch('/api/user');
        
        if (!userResponse.ok) {
          throw new Error('Please log in to start a session');
        }
        
        const userData = await userResponse.json();
        setUserData(userData);
        
        // Get reader data
        if (params.readerId) {
          const readerResponse = await fetch(`/api/readers/${params.readerId}`);
          
          if (!readerResponse.ok) {
            throw new Error('Reader not found');
          }
          
          const readerData = await readerResponse.json();
          setReaderData(readerData);
          
          // Generate a unique room name
          const timestamp = Date.now();
          const uniqueRoomName = `session-${params.readerId}-${userData.id}-${timestamp}`;
          setRoomName(uniqueRoomName);
          
          // Generate session token
          await generateToken(userData, readerData, uniqueRoomName);
        } else {
          throw new Error('Reader ID is required');
        }
      } catch (error: any) {
        console.error('Error setting up session:', error);
        setError(error.message || 'Failed to set up session');
        toast({
          title: 'Session Error',
          description: error.message || 'Failed to set up session',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [params.readerId]);
  
  // Generate token for the current user
  async function generateToken(user: any, reader: any, roomName: string) {
    try {
      const response = await fetch('/api/sessions/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          userName: user.fullName,
          readerId: reader.id,
          readerName: reader.fullName,
          roomName
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate token');
      }
      
      const data = await response.json();
      setToken(data.token);
    } catch (error: any) {
      console.error('Error generating token:', error);
      setError(error.message || 'Failed to generate session token');
      toast({
        title: 'Token Error',
        description: error.message || 'Failed to generate session token',
        variant: 'destructive'
      });
    }
  }
  
  // Handle session end
  function handleEndSession() {
    toast({
      title: 'Session Ended',
      description: 'Your session has ended.',
    });
    
    // Redirect to reader profile
    if (params.readerId) {
      setLocation(`/readers/${params.readerId}`);
    } else {
      setLocation('/readers');
    }
    
    // Invalidate relevant queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['/api/readings'] });
  }
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Spinner size="lg" />
        <p className="mt-4 text-muted-foreground">Setting up your session...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">Session Error</h2>
          <p className="mb-6">{error}</p>
          <Button onClick={() => setLocation('/readers')}>
            Back to Readers
          </Button>
        </div>
      </div>
    );
  }
  
  if (!token || !roomName || !userData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">Missing Session Data</h2>
          <p className="mb-6">Unable to start session. Please try again.</p>
          <Button onClick={() => setLocation('/readers')}>
            Back to Readers
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="bg-card rounded-lg shadow-lg p-6">
        <RoomUI
          token={token}
          roomName={roomName}
          userId={userData.id}
          userName={userData.fullName}
          userRole={userData.role}
          onEndSession={handleEndSession}
        />
      </div>
    </div>
  );
}