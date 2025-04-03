import React, { ReactNode, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { CartProvider } from "@/hooks/use-cart";
// TRTC has been completely removed
import { WebSocketProvider } from "@/hooks/websocket-provider";
import HomePage from "@/pages/home-page";
import AboutPage from "@/pages/about-page";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import ShopPage from "@/pages/shop-page";
import CheckoutPage from "@/pages/checkout-page";
import AddFundsPage from "@/pages/add-funds-page";
import ReadingSessionPage from "@/pages/reading-session";
import CommunityPage from "@/pages/community-page";
import ReadersPage from "@/pages/readers-page";
import ReaderProfilePage from "@/pages/reader-profile-page";
import PoliciesPage from "@/pages/policies-page";
import LivestreamPage from "@/pages/livestream-page";
import LivestreamDetailPage from "@/pages/livestream-detail-page";
import { ProtectedRoute } from "./lib/protected-route";
import { Layout } from "./components/layout";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import "@/styles/globals.css";

// Import at the top level instead of using require
import env from './lib/env';

// Dashboard page has been moved to its own component file

// Messages component
const Messages = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Messages</h1>
    <p className="font-playfair">Your messages will appear here.</p>
  </div>
);

// Help component
const Help = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Help Center</h1>
    <p className="font-playfair">Find answers to your questions.</p>
  </div>
);

// Apply component
const Apply = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Apply as Reader</h1>
    <p className="font-playfair">Join our network of gifted psychic readers.</p>
  </div>
);

function Router() {
  return (
    <Layout>
      <Switch>
        {/* Public home routes */}
        <Route path="/" component={HomePage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/auth" component={AuthPage} />
        
        {/* Protected routes - require login */}
        <ProtectedRoute path="/dashboard" component={DashboardPage} />
        <ProtectedRoute path="/messages" component={Messages} />
        <ProtectedRoute path="/reading-session/:id" component={ReadingSessionPage} />
        <ProtectedRoute path="/add-funds" component={AddFundsPage} />
        
        {/* Public routes */}
        <Route path="/readers" component={ReadersPage} />
        <Route path="/readers/:id" component={ReaderProfilePage} />
        <Route path="/live" component={LivestreamPage} />
        <Route path="/live/:id" component={LivestreamDetailPage} />
        <Route path="/shop" component={ShopPage} />
        <Route path="/checkout" component={CheckoutPage} />
        <Route path="/checkout/success" component={CheckoutPage} />
        <Route path="/community" component={CommunityPage} />
        <Route path="/help" component={Help} />
        <Route path="/policies" component={PoliciesPage} />
        <Route path="/apply" component={Apply} />
        
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

// Component to handle app version checking and updates
const AppUpdater = () => {
  useEffect(() => {
    // Check for app updates (only in PWA mode and production)
    if (env.ENABLE_PWA && env.IS_PRODUCTION) {
      const checkForUpdates = async () => {
        try {
          // If service worker is supported and registered
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            
            if (registration) {
              // Check for updates
              registration.update().catch(err => {
                console.error('Service worker update failed:', err);
              });
            }
          }
        } catch (error) {
          console.error('Error checking for updates:', error);
        }
      };
      
      // Check immediately and then every hour
      checkForUpdates();
      const interval = setInterval(checkForUpdates, 60 * 60 * 1000);
      
      return () => clearInterval(interval);
    }
  }, []);
  
  return null;
};

// Error boundary to catch and gracefully handle errors
class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Something went wrong</h1>
          <p className="mb-4">
            We're experiencing some technical difficulties. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrap WebSocket in a fallback provider with environment-based disabling
const SafeWebSocketProvider = ({ children }: { children: ReactNode }) => {
  // Skip WebSocket provider entirely if disabled in environment
  if (!env.ENABLE_WEBSOCKET) {
    console.log("WebSockets are disabled via environment settings");
    return <>{children}</>;
  }
  
  // In production Railway deployment, wrap in try/catch
  if (env.IS_PRODUCTION) {
    try {
      return <WebSocketProvider>{children}</WebSocketProvider>;
    } catch (error) {
      console.error("Failed to initialize WebSocket provider:", error);
      return <>{children}</>;
    }
  }
  
  // In development, don't catch errors to make debugging easier
  return <WebSocketProvider>{children}</WebSocketProvider>;
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CartProvider>
              <SafeWebSocketProvider>
                <Router />
                <AppUpdater />
                <PwaInstallBanner />
                <Toaster />
              </SafeWebSocketProvider>
            </CartProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
