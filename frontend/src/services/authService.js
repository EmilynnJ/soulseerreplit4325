// c:\Users\emily\soulseerreplit4325-1\frontend\src\services\authService.js
import apiClient from './api';
import appwriteClient from './appwriteClient'; // Appwrite SDK client
import { Account, ID } from 'appwrite';

const account = new Account(appwriteClient);

// Appwrite handles most auth client-side.
// This service could be for backend interactions related to auth,
// like syncing Appwrite user to your backend DB or custom backend JWTs.

export const appwriteLogin = async (email, password) => {
  return account.createEmailSession(email, password);
};

export const appwriteRegister = async (email, password, name) => {
  return account.create(ID.unique(), email, password, name);
};

export const appwriteLogout = async () => {
  return account.deleteSession('current');
};

export const appwriteGetCurrentUser = async () => {
  try {
    return await account.get();
  } catch (error) {
    return null; // No user logged in or error
  }
};

// Example: If you need to notify your backend after Appwrite registration
export const syncUserToBackend = async (userData) => {
  try {
    // const response = await apiClient.post('/auth/sync-user', userData);
    // return response.data;
    console.log("Placeholder: Sync user to backend", userData);
    return { success: true, message: "User sync placeholder" };
  } catch (error) {
    console.error("Error syncing user to backend:", error);
    throw error;
  }
};
