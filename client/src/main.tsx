import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "react-hot-toast";
import { Auth0Provider } from '@auth0/auth0-react';
import { AuthProvider } from "@/hooks/use-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

// Get Auth0 credentials from environment variables (must be prefixed with VITE_)
const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

// Check if Auth0 variables are set
if (!auth0Domain || !auth0ClientId) {
  console.error("Auth0 environment variables VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID must be set in the .env file for the client.");
  // Optionally, render an error message or prevent the app from rendering
}

// Register the service worker for PWA support
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/serviceWorker.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
};

// Register service worker for production environments
if (import.meta.env.PROD) {
  registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(
  <Auth0Provider
    domain={auth0Domain}
    clientId={auth0ClientId}
    authorizationParams={{
      // Use the same callback URL configured in the backend and Auth0 dashboard
      // Make sure this doesn't end with a slash if your Auth0 config doesn't
      redirect_uri: window.location.origin + '/dashboard' // Redirect to dashboard after login
      // You might need 'audience' and 'scope' depending on your API setup
      // audience: `YOUR_API_IDENTIFIER`,
      // scope: "openid profile email"
    }}
  >
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  </Auth0Provider>
);
