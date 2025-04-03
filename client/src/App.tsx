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
import { ProtectedRoute } from "./lib/protected-route";
import { Layout } from "./components/layout";
import "@/styles/globals.css";

// Dashboard page has been moved to its own component file

// Messages component
const Messages = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Messages</h1>
    <p className="font-playfair">Your messages will appear here.</p>
  </div>
);

// Readers component
const Readers = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Our Readers</h1>
    <p className="font-playfair">Meet our gifted psychic readers.</p>
  </div>
);

// Reader details component
const ReaderDetails = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Reader Profile</h1>
    <p className="font-playfair">Reader details will appear here.</p>
  </div>
);

// Live streams component
const LiveStreams = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Live Streams</h1>
    <p className="font-playfair">Watch live psychic readings and spiritual sessions.</p>
  </div>
);

// Live stream details component
const LiveStreamDetails = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Live Stream</h1>
    <p className="font-playfair">This live stream will appear here.</p>
  </div>
);

// Shop component
const Shop = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Spiritual Shop</h1>
    <p className="font-playfair">Browse our mystical products and spiritual tools.</p>
  </div>
);

// Community component
const Community = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Community</h1>
    <p className="font-playfair">Connect with fellow spiritual seekers.</p>
  </div>
);

// Help component
const Help = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Help Center</h1>
    <p className="font-playfair">Find answers to your questions.</p>
  </div>
);

// Policies component
const Policies = () => (
  <div className="container min-h-screen py-8">
    <h1 className="text-4xl font-alex mb-6">Policies</h1>
    <p className="font-playfair">Our terms, privacy policy, and guidelines.</p>
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
        <Route path="/live" component={LiveStreams} />
        <Route path="/live/:id" component={LiveStreamDetails} />
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

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <WebSocketProvider>
              <Router />
              <Toaster />
            </WebSocketProvider>
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
