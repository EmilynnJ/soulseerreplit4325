import { useState, useEffect } from 'react';
import env from '@/lib/env';

// Interface for the install prompt event that browsers provide
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * A React hook to manage PWA installation prompts
 * 
 * @returns {Object} Object containing installation state and functions
 */
export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installationError, setInstallationError] = useState<string | null>(null);
  
  // Check if PWA is enabled in environment
  const isPwaEnabled = env.ENABLE_PWA;

  useEffect(() => {
    if (!isPwaEnabled) return;

    // Function to detect if app is already installed
    const checkIfInstalled = () => {
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone || 
        document.referrer.includes('android-app://');
      
      setIsInstalled(isStandalone);
    };

    // Initial check
    checkIfInstalled();

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome <= 67 from automatically showing the prompt
      e.preventDefault();
      // Store the event so it can be triggered later
      setInstallPrompt(e as BeforeInstallPromptEvent);
      console.log('PWA install prompt available');
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      // Clear the saved prompt since it's no longer needed
      setInstallPrompt(null);
      setIsInstalled(true);
      console.log('PWA was installed');
    };

    // Listen for display mode changes (for iOS detection which doesn't support beforeinstallprompt)
    const handleDisplayModeChange = () => {
      checkIfInstalled();
    };

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', handleDisplayModeChange);

    // Remove event listeners on cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
    };
  }, [isPwaEnabled]);

  // Function to prompt the user to install the PWA
  const promptInstall = async () => {
    if (!installPrompt) {
      setInstallationError('Installation prompt not available');
      return false;
    }

    try {
      // Show the installation prompt
      await installPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const choiceResult = await installPrompt.userChoice;
      
      // Reset the installPrompt - it can only be used once
      setInstallPrompt(null);
      
      // Check if the user accepted or dismissed
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA installation');
        setIsInstalled(true);
        return true;
      } else {
        console.log('User dismissed the PWA installation');
        return false;
      }
    } catch (error) {
      console.error('Error during PWA installation:', error);
      setInstallationError((error as Error).message || 'Installation failed');
      return false;
    }
  };

  // Function to determine if we should show iOS install instructions
  // iOS doesn't support the beforeinstallprompt event
  const isIOSDevice = () => {
    return isPwaEnabled && 
      !isInstalled && 
      /iPad|iPhone|iPod/.test(navigator.userAgent) && 
      !(window as any).MSStream;
  };

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    promptInstall,
    installationError,
    isPwaEnabled,
    // Special case for iOS
    isIOSDevice: isIOSDevice(),
  };
}

// Component for showing iOS installation instructions
export function IOSInstallInstructions() {
  return (
    <div className="p-4 rounded-lg bg-primary/10 mt-4 text-sm">
      <h3 className="text-lg font-semibold mb-2">Install this app on your iPhone</h3>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Tap the Share button <span className="inline-block w-6 h-6 text-center leading-6 bg-gray-100 rounded-full">↑</span> at the bottom of your screen</li>
        <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
        <li>Tap <strong>Add</strong> in the top right corner</li>
      </ol>
    </div>
  );
}

// Simple install button component
export function InstallPWAButton() {
  const { canInstall, promptInstall, isIOSDevice } = usePwaInstall();
  
  if (isIOSDevice) {
    return <IOSInstallInstructions />;
  }
  
  if (!canInstall) {
    return null;
  }
  
  return (
    <button 
      onClick={promptInstall}
      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 flex items-center"
    >
      <span className="mr-2">📱</span>
      Install App
    </button>
  );
}