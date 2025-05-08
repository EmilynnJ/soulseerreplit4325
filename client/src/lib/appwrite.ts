import { Client, Account, ID, Databases, Storage, Query } from 'appwrite';
import { env } from './env';

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(env.APPWRITE_API_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID);

// Initialize Appwrite services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Helper functions for authentication
export const createAccount = async (email: string, password: string, name: string) => {
  try {
    const newAccount = await account.create(
      ID.unique(),
      email,
      password,
      name
    );
    
    if (newAccount) {
      // Login immediately after successful account creation
      return await login(email, password);
    }
    
    return newAccount;
  } catch (error) {
    console.error('Error creating account:', error);
    throw error;
  }
};

export const login = async (email: string, password: string) => {
  try {
    return await account.createEmailSession(email, password);
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    return await account.get();
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const logout = async () => {
  try {
    return await account.deleteSession('current');
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

export { ID, Query };