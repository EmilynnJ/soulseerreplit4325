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
}

export default env;