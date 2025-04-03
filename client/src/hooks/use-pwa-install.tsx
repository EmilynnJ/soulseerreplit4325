import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Check if PWA is enabled via environment variable
const isPwaEnabled = import.meta.env.VITE_ENABLE_PWA === 'true';

/**
 * Hook to handle PWA installation
 * Returns an object with:
 * - canInstall: boolean if installation is possible
 * - isInstalling: boolean if installation is in progress
 * - isInstalled: boolean if already installed
 * - installPromptEvent: The saved beforeinstallprompt event
 * - promptInstall: Function to trigger installation
 * - installationOutcome: The result of installation ('accepted', 'dismissed', or null)
 */
export function usePwaInstall() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installationOutcome, setInstallationOutcome] = useState<'accepted' | 'dismissed' | null>(null);

  // Check if app is already installed by looking for display-mode: standalone
  useEffect(() => {
    const checkIfInstalled = () => {
      // Check if in standalone mode (PWA installed)
      if (window.matchMedia('(display-mode: standalone)').matches || 
          // @ts-ignore - navigator.standalone is available on iOS Safari but not in the TypeScript definitions
          (window.navigator as any).standalone === true) {
        setIsInstalled(true);
      }
    };

    checkIfInstalled();
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallationOutcome('accepted');
    });

    return () => {
      window.removeEventListener('appinstalled', checkIfInstalled);
    };
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    if (!isPwaEnabled) return;

    const handler = (e: Event) => {
      // Prevent the default browser install prompt
      e.preventDefault();
      // Save the event for later use
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Function to prompt the user to install the app
  const promptInstall = async () => {
    if (!installPromptEvent) {
      return;
    }

    setIsInstalling(true);
    
    // Show the install prompt
    await installPromptEvent.prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await installPromptEvent.userChoice;
    
    // Reset the saved prompt since it can't be used again
    setInstallPromptEvent(null);
    setIsInstalling(false);
    setInstallationOutcome(choiceResult.outcome);
  };

  return {
    canInstall: !!installPromptEvent && !isInstalled && isPwaEnabled,
    isInstalling,
    isInstalled,
    installPromptEvent,
    promptInstall,
    installationOutcome
  };
}