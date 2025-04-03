import { useState, useEffect } from 'react';
import { InstallPWAButton, usePwaInstall } from '@/hooks/use-pwa-install';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function PwaInstallBanner() {
  const { canInstall, isInstalled, isPwaEnabled } = usePwaInstall();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  // Check if the banner was previously dismissed
  useEffect(() => {
    if (!isPwaEnabled) return;
    
    const hasDismissedBanner = localStorage.getItem('pwa-banner-dismissed') === 'true';
    setDismissed(hasDismissedBanner);
    
    // Only show the banner after a delay (to not annoy users immediately)
    if (canInstall && !isInstalled && !hasDismissedBanner) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 5000); // 5 seconds delay
      
      return () => clearTimeout(timer);
    }
  }, [canInstall, isInstalled, isPwaEnabled]);
  
  // Save the dismissal to localStorage
  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };
  
  if (!isPwaEnabled || !showBanner || dismissed || isInstalled) {
    return null;
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-primary text-white z-50 flex items-center justify-between shadow-lg animate-slide-up">
      <div className="flex items-center flex-1">
        <div className="text-2xl mr-3">📱</div>
        <div>
          <h3 className="font-semibold">Install SoulSeer App</h3>
          <p className="text-sm opacity-90 max-w-md">Get a better experience with our app - faster loading, offline access, and push notifications.</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <InstallPWAButton />
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleDismiss}
          className="text-white hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}

// A smaller version for in-page promotion
export function PwaInstallPromotion() {
  const { canInstall, isInstalled, isPwaEnabled } = usePwaInstall();
  
  if (!isPwaEnabled || isInstalled || !canInstall) {
    return null;
  }
  
  return (
    <div className="p-4 border rounded-lg bg-primary/5 flex items-center justify-between mb-6">
      <div>
        <h3 className="font-semibold flex items-center">
          <span className="text-xl mr-2">📱</span>
          Install SoulSeer App
        </h3>
        <p className="text-sm text-muted-foreground">Faster access to readings and spiritual guidance</p>
      </div>
      <InstallPWAButton />
    </div>
  );
}