/**
 * Environment variables helper for client-side
 * Provides fallbacks and validation for critical environment variables
 */

export const env = {
  // Stripe
  STRIPE_PUBLIC_KEY: import.meta.env.VITE_STRIPE_PUBLIC_KEY || '',
  
  // MUX Video
  MUX_ENV_KEY: import.meta.env.VITE_MUX_ENV_KEY || '',
  
  // API
  API_URL: import.meta.env.VITE_API_URL || '',
  
  // Feature flags - deploy safe with fallbacks
  ENABLE_WEBSOCKET: import.meta.env.VITE_ENABLE_WEBSOCKET !== 'false',
  ENABLE_LIVESTREAMS: import.meta.env.VITE_ENABLE_LIVESTREAMS !== 'false',
  ENABLE_CHECKOUT: import.meta.env.VITE_ENABLE_CHECKOUT !== 'false',
  
  // PWA features
  ENABLE_PWA: import.meta.env.VITE_ENABLE_PWA !== 'false',
  ENABLE_NOTIFICATIONS: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== 'false',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  
  // App store information
  APP_STORE_ID: import.meta.env.VITE_APP_STORE_ID || '',
  PLAY_STORE_ID: import.meta.env.VITE_PLAY_STORE_ID || '',
  APP_DOMAIN: import.meta.env.VITE_APP_DOMAIN || 'soulseer.app',
  
  // Environment
  IS_PRODUCTION: import.meta.env.PROD,
  MODE: import.meta.env.MODE,
  
  // Debug
  DEBUG: import.meta.env.DEV,
};

// Warn about missing important keys in development only
if (import.meta.env.DEV) {
  if (!env.STRIPE_PUBLIC_KEY) {
    console.warn('Missing VITE_STRIPE_PUBLIC_KEY environment variable');
  }
  
  if (!env.MUX_ENV_KEY) {
    console.warn('Missing VITE_MUX_ENV_KEY environment variable');
  }
  
  // PWA-related warnings only if PWA is enabled
  if (env.ENABLE_PWA) {
    if (!env.APP_DOMAIN) {
      console.warn('Missing VITE_APP_DOMAIN environment variable (for PWA)');
    }
    
    // Only warn about app store IDs in production mode
    if (env.IS_PRODUCTION) {
      if (!env.APP_STORE_ID) {
        console.warn('Missing VITE_APP_STORE_ID environment variable (for Apple App Store)');
      }
      
      if (!env.PLAY_STORE_ID) {
        console.warn('Missing VITE_PLAY_STORE_ID environment variable (for Google Play Store)');
      }
    }
  }
}

export default env;