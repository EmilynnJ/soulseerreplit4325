import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { ZegoCall, ZegoVoiceCall, ZegoVideoCall, ZegoChatCall } from './zego-call';

interface VideoCallProps {
  token: string;
  readingId: number;
  readingType: 'video' | 'voice' | 'chat';
  onSessionEnd?: () => void;
}

/**
 * Video/Voice Call component using Zego Cloud
 * This component fetches the necessary Zego tokens and config based on reading type
 */
export function VideoCall({ token, readingId, readingType, onSessionEnd }: VideoCallProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zegoData, setZegoData] = useState<{
    roomId: string;
    userId: string;
    userName: string;
    token: string;
    appId: string;
    config: any;
    zegoType: string;
  } | null>(null);
  
  // Fetch Zego token and configuration
  useEffect(() => {
    const fetchZegoToken = async () => {
      try {
        setIsLoading(true);
        
        // Get reading token using the existing roomName
        const response = await apiRequest('POST', '/api/livekit/token', {
          roomId: `reading-${readingId}`,
          readingType
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get token');
        }
        
        const data = await response.json();
        
        // Get appropriate app ID based on reading type
        let appId = '';
        if (readingType === 'chat') {
          appId = import.meta.env.VITE_ZEGO_CHAT_APP_ID as string;
        } else if (readingType === 'voice') {
          appId = import.meta.env.VITE_ZEGO_PHONE_APP_ID as string;
        } else {
          appId = import.meta.env.VITE_ZEGO_VIDEO_APP_ID as string;
        }
        
        setZegoData({
          roomId: data.roomId,
          userId: data.userId,
          userName: data.userName || 'User',
          token: data.token,
          appId: appId || data.appId,
          config: data.config,
          zegoType: data.zegoType || readingType
        });
      } catch (error) {
        console.error('Error fetching Zego token:', error);
        setError('Failed to initialize session. Please try again.');
        
        toast({
          title: 'Session Error',
          description: 'Could not initialize reading session. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchZegoToken();
  }, [readingId, readingType, token, toast]);
  
  // Handle errors
  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background rounded-lg">
        <div className="text-center p-6">
          <p className="text-lg text-red-500 mb-4">{error}</p>
          <button 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // Show loading state
  if (isLoading || !zegoData) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background rounded-lg">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-lg">Initializing {readingType} session...</p>
      </div>
    );
  }
  
  // Render the appropriate call component based on reading type
  switch (readingType) {
    case 'voice':
      return (
        <ZegoVoiceCall
          roomId={zegoData.roomId}
          userId={zegoData.userId}
          userName={zegoData.userName}
          token={zegoData.token}
          appId={zegoData.appId}
          config={zegoData.config}
          onSessionEnd={onSessionEnd}
        />
      );
    case 'chat':
      return (
        <ZegoChatCall
          roomId={zegoData.roomId}
          userId={zegoData.userId}
          userName={zegoData.userName}
          token={zegoData.token}
          appId={zegoData.appId}
          config={zegoData.config}
          onSessionEnd={onSessionEnd}
        />
      );
    case 'video':
    default:
      return (
        <ZegoVideoCall
          roomId={zegoData.roomId}
          userId={zegoData.userId}
          userName={zegoData.userName}
          token={zegoData.token}
          appId={zegoData.appId}
          config={zegoData.config}
          onSessionEnd={onSessionEnd}
        />
      );
  }
}

/**
 * Audio-only call component for readings
 * Reuses the VideoCall component with audio-only configuration
 */
export function VoiceCall(props: Omit<VideoCallProps, 'readingType'>) {
  return <VideoCall {...props} readingType="voice" />;
}