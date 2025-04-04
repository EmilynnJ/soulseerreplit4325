import { InfoIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Placeholder for the removed video call system
 */
export function VideoCallPlaceholder() {
  return (
    <Card className="w-full h-full flex flex-col justify-center items-center p-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <InfoIcon className="h-6 w-6 text-primary" />
          Video Call System Removed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-4">
            The video call feature is no longer available.
            We are working on implementing a new system.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
