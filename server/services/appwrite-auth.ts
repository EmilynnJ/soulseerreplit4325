import { storage } from '../storage';
import { Client, Account } from 'appwrite';

// Initialize Appwrite client
export const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '681831b30038fbc171cf')
  .setKey(process.env.APPWRITE_API || 'standard_31cbb4cd916d4b64842d4241add0e5f83ef8e030128be966f6bcb0ec59219a11121b8f027c60bb5da16167650b1076ad762809563804448d39c38ce85a5e0e2dbf5de2dc209988170a12c40037b9fea2527c8556ae1b287c7e66a165df8f2bd32f220280e6537bd16c8e357bec3f539490ad27632f8ffa3fd7b4a19dabe384df');

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