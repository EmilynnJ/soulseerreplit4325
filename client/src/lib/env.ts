/**
 * Environment variables helper for client-side
 * Provides fallbacks and validation for critical environment variables
 */

// Helper function to get environment variable with fallback
const getEnvVar = (key: string, fallback: string = ''): string => {
  const value = import.meta.env[key];
  return value !== undefined ? String(value) : fallback;
};

// Helper function to convert environment variable to boolean
const getBoolEnvVar = (key: string, fallback: boolean = false): boolean => {
  const value = import.meta.env[key];
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
};

// Export environment variables with appropriate types
export const env = {
  // Core environment information
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  IS_PRODUCTION: getEnvVar('NODE_ENV') === 'production',
  IS_DEVELOPMENT: getEnvVar('NODE_ENV') === 'development',
  
  // API and service endpoints
  API_URL: getEnvVar('VITE_API_URL', ''),
  WEBSOCKET_URL: getEnvVar('VITE_WEBSOCKET_URL', ''),
  
  // Feature flags
  ENABLE_WEBSOCKET: getBoolEnvVar('VITE_ENABLE_WEBSOCKET', true),
  ENABLE_LIVESTREAMS: getBoolEnvVar('VITE_ENABLE_LIVESTREAMS', true),
  ENABLE_CHECKOUT: getBoolEnvVar('VITE_ENABLE_CHECKOUT', true),
  
  // Appwrite configuration
  APPWRITE_API_ENDPOINT: getEnvVar('VITE_APPWRITE_API_ENDPOINT', 'https://nyc.cloud.appwrite.io/v1'),
  APPWRITE_PROJECT_ID: getEnvVar('VITE_APPWRITE_PROJECT_ID', '681831b30038fbc171cf'),
  
  // External services
  STRIPE_PUBLIC_KEY: getEnvVar('VITE_STRIPE_PUBLIC_KEY', ''),
  
  // Zego Cloud configuration
  ZEGO_APP_ID: getEnvVar('VITE_ZEGO_APP_ID', ''),
  ZEGO_PHONE_APP_ID: getEnvVar('VITE_ZEGO_PHONE_APP_ID', ''),
  ZEGO_VIDEO_APP_ID: getEnvVar('VITE_ZEGO_VIDEO_APP_ID', ''),
  ZEGO_CHAT_APP_ID: getEnvVar('VITE_ZEGO_CHAT_APP_ID', ''),
  ZEGO_LIVE_STREAMING_APP_ID: getEnvVar('VITE_ZEGO_LIVE_STREAMING_APP_ID', ''),
  
  // PWA configuration
  ENABLE_PWA: getBoolEnvVar('VITE_ENABLE_PWA', true),
  ENABLE_NOTIFICATIONS: getBoolEnvVar('VITE_ENABLE_NOTIFICATIONS', false),
  APP_VERSION: getEnvVar('VITE_APP_VERSION', '1.0.0'),
  APP_DOMAIN: getEnvVar('VITE_APP_DOMAIN', 'soulseer.app'),
  APP_STORE_ID: getEnvVar('VITE_APP_STORE_ID', ''),
  PLAY_STORE_ID: getEnvVar('VITE_PLAY_STORE_ID', ''),
};

// Environment Configuration

// API Base URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

// Appwrite Config
export const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT = import.meta.env.VITE_APPWRITE_PROJECT_ID || '681831b30038fbc171cf';

// Stripe Configuration
// If not defined in environment, fetch dynamically or use a placeholder for development
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || 
  (window as any).__STRIPE_PUBLIC_KEY__ || 
  // Fallback to placeholder for non-production (will show test mode in Stripe UI)
  (import.meta.env.DEV ? 'pk_test_placeholder' : '');

// Feature Flags
export const ENABLE_PUSH_NOTIFICATIONS = import.meta.env.VITE_ENABLE_PUSH_NOTIFICATIONS === 'true';
export const ENABLE_SOCKET_DEBUGGING = import.meta.env.VITE_ENABLE_SOCKET_DEBUGGING === 'true';

// WebRTC/Real-time Config
export const ZEGO_SERVER_SECRET = import.meta.env.VITE_ZEGO_SERVER_SECRET || '';

// Development Helpers
export const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
export const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

// Fetch the Stripe public key from the server if not available
export async function ensureStripePublicKey(): Promise<string> {
  // If we already have a key, return it
  if (STRIPE_PUBLIC_KEY && STRIPE_PUBLIC_KEY !== 'pk_test_placeholder') {
    return STRIPE_PUBLIC_KEY;
  }

  try {
    // Attempt to fetch from server
    const response = await fetch(`${API_BASE_URL}/api/config/stripe-key`);
    if (response.ok) {
      const data = await response.json();
      if (data.publicKey) {
        // Store in global for future use
        (window as any).__STRIPE_PUBLIC_KEY__ = data.publicKey;
        return data.publicKey;
      }
    }
    throw new Error('Failed to fetch Stripe key');
  } catch (error) {
    console.error('Error fetching Stripe public key:', error);
    // Return the fallback in case of error
    return STRIPE_PUBLIC_KEY;
  }
}

export default env;