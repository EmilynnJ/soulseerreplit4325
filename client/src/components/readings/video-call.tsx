import { Video } from 'lucide-react';

/**
 * LiveKit video call component for readings (placeholder)
 * 
 * This component replaces the previous Mux implementation with a LiveKit-based solution.
 */
export function VideoCall() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg p-6">
      <Video className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">LiveKit Video Call</h3>
      <p className="text-center text-muted-foreground">
        The video call system is being updated with LiveKit integration for improved performance and reliability.
      </p>
    </div>
  );
}

/**
 * Audio-only call component for readings (placeholder)
 */
export function VoiceCall() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg p-6">
      <Video className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">LiveKit Voice Call</h3>
      <p className="text-center text-muted-foreground">
        The voice call system is being updated with LiveKit integration for improved performance and reliability.
      </p>
    </div>
  );
}