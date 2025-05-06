import { storage } from '../storage';
import { Client, Account } from 'appwrite';

// Initialize Appwrite client
export const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '');

// Initialize Appwrite account
export const appwriteAccount = new Account(appwriteClient);

// Function to handle Appwrite authentication
export async function handleAppwriteAuth(userId: string, email: string, name: string, profileImage?: string) {
  try {
    // Create an Appwrite profile-like object for our existing functions
    const appwriteProfile = {
      id: userId,
      emails: [{ value: email }],
      displayName: name,
      picture: profileImage || ''
    };
    
    // Use our existing find or create function
    const user = await storage.findOrCreateUserFromAppwrite(appwriteProfile);
    
    return user;
  } catch (error) {
    console.error('Error processing Appwrite authentication:', error);
    throw error;
  }
}

// Verify Appwrite token (simplified)
export async function verifyAppwriteToken(token: string) {
  if (!token) return null;
  // In a real implementation, you would verify the JWT token here
  // For now, we're assuming the token is valid
  return true;
} 