import { Video } from 'lucide-react';

/**
 * LiveKit player component for the livestream (placeholder)
 */
export function LiveKitPlayer() {
  return (
    <div className="flex items-center justify-center bg-dark/50 h-full">
      <div className="text-center p-8">
        <Video className="h-16 w-16 mx-auto mb-4 text-accent/60" />
        <h3 className="text-xl font-cinzel text-secondary mb-2">LiveKit Integration</h3>
        <p className="text-light/70">
          Livestream functionality is being updated with LiveKit integration.
        </p>
        <p className="text-light/70 mt-4">
          This placeholder will be replaced with a LiveKit video player.
        </p>
      </div>
    </div>
  );
}

/**
 * LiveKit recording player component (placeholder)
 */
export function LiveKitRecordingPlayer() {
  return (
    <div className="flex items-center justify-center bg-dark/50 h-full">
      <div className="text-center p-8">
        <Video className="h-16 w-16 mx-auto mb-4 text-accent/60" />
        <h3 className="text-xl font-cinzel text-secondary mb-2">Recorded Session</h3>
        <p className="text-light/70">
          Recorded session playback is being updated with LiveKit integration.
        </p>
      </div>
    </div>
  );
}