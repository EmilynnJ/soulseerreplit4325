import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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


);
