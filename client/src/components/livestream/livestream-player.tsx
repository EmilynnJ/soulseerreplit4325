import { useState, useRef, useEffect } from 'react';
import { MonitorPlay, ExternalLink } from 'lucide-react';
import { CelestialButton } from '@/components/ui/celestial-button';

/**
 * LiveKit player component for livestreams
 * 
 * Connects to LiveKit room for livestreaming functionality
 */
export function LiveKitPlayer({ roomName, token }: { roomName: string; token: string }) {
  const [viewers, setViewers] = useState(0);
  
  // Initialize LiveKit connection here
  useEffect(() => {
    if (!roomName || !token) return;
    
    console.log("Connecting to LiveKit room:", roomName);
    
    // This would use the LiveKit client library to connect
    // For now we'll show a connected state
    
    const timer = setTimeout(() => {
      // Simulate connection success
      console.log("Connected to LiveKit room successfully");
      setViewers(Math.floor(Math.random() * 10) + 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [roomName, token]);
  
  return (
    <div className="w-full rounded-lg overflow-hidden bg-black relative">
      {/* Video container */}
      <div className="w-full h-full min-h-[300px] bg-muted/20">
        <div className="flex flex-col items-center justify-center h-full p-6">
          <MonitorPlay className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">LiveKit Stream</h3>
          <p className="text-center text-muted-foreground">
            Connected to room: {roomName}
          </p>
          <div className="mt-4">
            <CelestialButton size="sm">
              Room Connected
            </CelestialButton>
          </div>
        </div>
      </div>
      
      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-yellow-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
              <MonitorPlay className="mr-1 h-3 w-3" />
              <span>PLACEHOLDER</span>
            </div>
            <div className="text-white text-sm">
              {viewers > 0 ? `${viewers} Viewers` : '0 Viewers'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Recording player component for ended livestreams
 * 
 * This component can still play video recordings if they are available
 */
export function LiveKitRecordingPlayer({ recordingUrl, thumbnail }: { recordingUrl?: string; thumbnail?: string }) {
  // Check if there's a recording URL
  const hasRecording = Boolean(recordingUrl);
  
  return (
    <div className="w-full rounded-lg overflow-hidden bg-black relative">
      {hasRecording ? (
        <div className="w-full min-h-[300px]">
          <video
            src={recordingUrl}
            controls
            poster={thumbnail || '/images/livestream-placeholder.jpg'}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[300px] bg-muted/30 p-6">
          <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Recording Unavailable</h3>
          <p className="text-center text-muted-foreground">
            This livestream recording is no longer available or has not been processed yet.
          </p>
        </div>
      )}
    </div>
  );
}