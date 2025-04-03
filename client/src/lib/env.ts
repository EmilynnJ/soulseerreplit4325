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
  ENABLE_WEBSOCKET: getBoolEnvVar('VITE_ENABLE_WEBSOCKET', false),
  ENABLE_LIVESTREAMS: getBoolEnvVar('VITE_ENABLE_LIVESTREAMS', true),
  ENABLE_CHECKOUT: getBoolEnvVar('VITE_ENABLE_CHECKOUT', true),
  
  // External services
  STRIPE_PUBLIC_KEY: getEnvVar('VITE_STRIPE_PUBLIC_KEY', ''),
  MUX_ENV_KEY: getEnvVar('VITE_MUX_ENV_KEY', ''),
  
  // PWA configuration
  ENABLE_PWA: getBoolEnvVar('VITE_ENABLE_PWA', true),
  ENABLE_NOTIFICATIONS: getBoolEnvVar('VITE_ENABLE_NOTIFICATIONS', false),
  APP_VERSION: getEnvVar('VITE_APP_VERSION', '1.0.0'),
  APP_DOMAIN: getEnvVar('VITE_APP_DOMAIN', 'soulseer.app'),
  APP_STORE_ID: getEnvVar('VITE_APP_STORE_ID', ''),
  PLAY_STORE_ID: getEnvVar('VITE_PLAY_STORE_ID', ''),
};

export default env;