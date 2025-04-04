import { InfoIcon } from 'lucide-react';

/**
 * Placeholder for the removed Mux video call component
 */
export function VideoCallMux() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg p-6">
      <InfoIcon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">Video Call System Removed</h3>
      <p className="text-center text-muted-foreground">
        The video call feature has been removed from the platform.
      </p>
    </div>
  );
}
