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
import "@/styles/globals.css";

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
