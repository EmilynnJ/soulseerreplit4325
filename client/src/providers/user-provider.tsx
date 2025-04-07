import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Define user type
export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'client' | 'reader' | 'admin';
  profileImage: string | null;
  isOnline: boolean;
  bio?: string | null;
  specialties?: string[] | null;
  [key: string]: any; // For any additional user properties
}

// Create context with default values
interface UserContextType {
  user: User | null;
  isLoading: boolean;
  error: unknown;
  refetchUser: () => void;
  updateUser: (userData: Partial<User>) => void;
  logOut: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: false,
  error: null,
  refetchUser: () => {},
  updateUser: () => {},
  logOut: () => {}
});

// Hook for using the user context
export const useUserContext = () => useContext(UserContext);

// User provider component
export function UserProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [localUser, setLocalUser] = useState<User | null>(null);
  
  // Fetch user data from API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/users/me'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/users/me');
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      }
    }
  });
  
  // Update local user state when data changes
  useEffect(() => {
    if (data && !error) {
      setLocalUser(data);
    }
  }, [data, error]);

  // Function to update user data
  const updateUser = async (userData: Partial<User>) => {
    if (!localUser) return;
    
    try {
      const response = await fetch('/api/users/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      if (response.ok) {
        setLocalUser({ ...localUser, ...userData });
        toast({
          title: 'Success',
          description: 'Your profile has been updated',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      });
    }
  };

  // Function to log out
  const logOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      setLocalUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out:', error);
      toast({
        title: 'Error',
        description: 'Failed to log out',
        variant: 'destructive'
      });
    }
  };

  return (
    <UserContext.Provider
      value={{
        user: localUser,
        isLoading,
        error,
        refetchUser: refetch,
        updateUser,
        logOut
      }}
    >
      {children}
    </UserContext.Provider>
  );
}