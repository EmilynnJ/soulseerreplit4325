import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/hooks/use-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import env from "@/lib/env";

// Log Appwrite configuration status for debugging
console.log(`Appwrite Configuration Status:
  Endpoint: ${env.APPWRITE_API_ENDPOINT ? 'Available ✓' : 'Missing ✗'}
  Project ID: ${env.APPWRITE_PROJECT_ID ? 'Available ✓' : 'Missing ✗'}`
);

// Check if Appwrite variables are set
if (!env.APPWRITE_API_ENDPOINT || !env.APPWRITE_PROJECT_ID) {
  console.warn("Appwrite environment variables not found. Authentication may not work properly.");
  // We'll still render the app, just with a warning
}

// Register the service worker for PWA support
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Add a tiny delay to ensure everything else is loaded first
      setTimeout(() => {
        const swUrl = '/serviceWorker.js';
        
        // Check if the service worker file is accessible
        fetch(swUrl)
          .then(response => {
            if (response.status === 200) {
              navigator.serviceWorker.register(swUrl)
                .then(registration => {
                  console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(error => {
                  console.error('Service Worker registration failed:', error);
                });
            } else {
              console.warn('Service Worker file not found or not accessible:', response.status);
            }
          })
          .catch(error => {
            console.warn('Failed to check Service Worker file:', error);
          });
      }, 1000);
    });
  } else {
    console.warn('Service workers are not supported by this browser');
  }
};

// Register service worker for production environments
if (env.IS_PRODUCTION) {
  registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
      <Toaster position="bottom-right" />
    </AuthProvider>
  </QueryClientProvider>
);
