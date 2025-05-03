import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "react-hot-toast";
import { Auth0Provider } from '@auth0/auth0-react';
import { AuthProvider } from "@/hooks/use-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import env from "@/lib/env";

// Log authentication configuration status for debugging
console.log(`Auth0 Configuration Status:
  Domain: ${env.AUTH0_DOMAIN ? 'Available ✓' : 'Missing ✗'}
  ClientID: ${env.AUTH0_CLIENT_ID ? 'Available ✓' : 'Missing ✗'}
  Callback URL: ${env.AUTH0_CALLBACK_URL ? 'Available ✓' : 'Missing ✗'}`
);

// Check if Auth0 variables are set
if (!env.AUTH0_DOMAIN || !env.AUTH0_CLIENT_ID) {
  console.error("Auth0 environment variables not found. Authentication will not work properly.");
  // We'll still render the app for now, just without working authentication
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
if (env.IS_PRODUCTION) {
  registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(
  <Auth0Provider
    domain={env.AUTH0_DOMAIN}
    clientId={env.AUTH0_CLIENT_ID}
    authorizationParams={{
      redirect_uri: env.AUTH0_CALLBACK_URL || window.location.origin + '/dashboard',
      scope: "openid profile email"
    }}
    useRefreshTokens={true}
    cacheLocation="localstorage"
  >
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  </Auth0Provider>
);
