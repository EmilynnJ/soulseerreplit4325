import { useEffect, useState } from 'react';
import { MonitorPlay } from 'lucide-react';

/**
 * LiveKit player component for the livestream
 */
export function LiveKitPlayer() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg p-6">
      <MonitorPlay className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">LiveKit Livestream</h3>
      <p className="text-center text-muted-foreground">
        The livestream system is being updated with LiveKit integration for improved performance and reliability.
      </p>
    </div>
  );
}

/**
 * LiveKit recording player component 
 */
export function LiveKitRecordingPlayer() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg p-6">
      <MonitorPlay className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">LiveKit Recording</h3>
      <p className="text-center text-muted-foreground">
        The recorded session playback is being updated with LiveKit integration for improved performance and reliability.
      </p>
    </div>
  );
}