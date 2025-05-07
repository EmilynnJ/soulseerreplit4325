import React, { createContext, useContext, useState, useEffect } from "react";
import { getUser, logout, login } from "../api/auth";
import { Client, Account, ID } from 'appwrite';

// Initialize Appwrite
const client = new Client();
client
  .setEndpoint('https://nyc.cloud.appwrite.io/v1')
  .setProject('681831b30038fbc171cf');

const account = new Account(client);

export type User = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  bio: string;
  specialties: string[];
  pricing: number | null;
  rating: number | null;
  verified: boolean;
  profileImage: string;
  created_at?: string;
  updated_at?: string;
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  loginWithAppwrite: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUser();
        setUser(userData);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const refreshUser = async () => {
    try {
      const userData = await getUser();
      setUser(userData);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  const loginUser = async (username: string, password: string) => {
    try {
      const userData = await login(username, password);
      setUser(userData);
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const loginWithAppwrite = async () => {
    try {
      // Redirect to Appwrite OAuth
      await account.createOAuth2Session('google', 
        `${window.location.origin}/callback`, // Success URL
        `${window.location.origin}/login`     // Failure URL
      );
    } catch (error) {
      console.error("Appwrite login error:", error);
      throw error;
    }
  };

  const logoutUser = async () => {
    try {
      await logout();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login: loginUser,
        loginWithAppwrite,
        logout: logoutUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}; 