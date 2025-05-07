import { Client, Account, ID } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || '681831b30038fbc171cf';

if (!projectId) {
  console.error('Appwrite Project ID is not set!');
}

// Initialize Appwrite client
export const appwriteClient = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId);

// Initialize Appwrite account
export const appwriteAccount = new Account(appwriteClient);

// Authenticate with Appwrite
export async function loginWithEmail(email: string, password: string) {
  try {
    const session = await appwriteAccount.createEmailSession(email, password);
    return session;
  } catch (error) {
    console.error('Appwrite login error:', error);
    throw error;
  }
}

// Register with Appwrite
export async function registerWithEmail(email: string, password: string, name: string) {
  try {
    const user = await appwriteAccount.create(ID.unique(), email, password, name);
    return user;
  } catch (error) {
    console.error('Appwrite registration error:', error);
    throw error;
  }
}

// Logout from Appwrite
export async function logout() {
  try {
    await appwriteAccount.deleteSession('current');
    return true;
  } catch (error) {
    console.error('Appwrite logout error:', error);
    throw error;
  }
}

// Get current user
export async function getCurrentUser() {
  try {
    const user = await appwriteAccount.get();
    return user;
  } catch (error) {
    // User is not logged in
    return null;
  }
}

// Get current session
export async function getCurrentSession() {
  try {
    const session = await appwriteAccount.getSession('current');
    return session;
  } catch (error) {
    // No active session
    return null;
  }
}

// Check if user is logged in
export async function isLoggedIn() {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch {
    return false;
  }
} 