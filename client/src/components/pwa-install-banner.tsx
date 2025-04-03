import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface PwaInstallBannerProps {
  delay?: number; // Delay in ms before showing the banner
  maxShowCount?: number; // Maximum number of times to show the banner
}

export function PwaInstallBanner({ 
  delay = 3000, 
  maxShowCount = 3 
}: PwaInstallBannerProps) {
  const { canInstall, promptInstall, installationOutcome } = usePwaInstall();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Handle local storage for banner dismissal count
  useEffect(() => {
    if (!canInstall) return;

    // Get current show count from localStorage
    const storedCount = localStorage.getItem('pwa-banner-shown-count');
    const showCount = storedCount ? parseInt(storedCount, 10) : 0;
    
    // Check if we're under the max show count
    if (showCount < maxShowCount) {
      // Set a timer to show the banner after the specified delay
      const timer = setTimeout(() => {
        setShowBanner(true);
        // Increment and store the new count
        localStorage.setItem('pwa-banner-shown-count', (showCount + 1).toString());
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [canInstall, delay, maxShowCount]);

  // Hide banner when installation outcome is known
  useEffect(() => {
    if (installationOutcome) {
      setShowBanner(false);
    }
  }, [installationOutcome]);

  // Handle dismissal
  const handleDismiss = () => {
    setDismissed(true);
    // Use animation to hide, then actually remove from DOM
    setTimeout(() => setShowBanner(false), 300);
  };

  // If we can't install or banner shouldn't be shown, don't render anything
  if (!canInstall || !showBanner) {
    return null;
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 mx-auto max-w-md"
        >
          <div className="bg-card shadow-lg rounded-lg p-4 border border-border flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 flex-shrink-0">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Install SoulSeer App</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add SoulSeer to your home screen for a better experience and quicker access to psychic readings.
              </p>
              
              <div className="mt-3 flex gap-2">
                <Button 
                  variant="default" 
                  size="sm" 
                  className="flex items-center gap-1"
                  onClick={promptInstall}
                >
                  <Download className="h-4 w-4" />
                  Install Now
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                >
                  Not Now
                </Button>
              </div>
            </div>
            
            <button 
              onClick={handleDismiss} 
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}