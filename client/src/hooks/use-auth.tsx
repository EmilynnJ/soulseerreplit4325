import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role?: "client" | "reader";
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
    refetch: refetchUser,
  } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 1, // Reduce retries for faster feedback
    staleTime: 0, // Always check for fresh data
    gcTime: 1000 * 60 * 5, // 5 minutes (using gcTime instead of cacheTime for v5)
    refetchOnWindowFocus: true, // Reload when tab gets focus
    refetchOnMount: true // Reload when component mounts
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("Attempting login with credentials:", { username: credentials.username, passwordLength: credentials.password.length });
      
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
          credentials: "include"
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Login failed with status ${res.status}: ${errorText}`);
          throw new Error(errorText || "Authentication failed");
        }
        
        const userData = await res.json();
        console.log("Login successful, user data received:", { id: userData.id, username: userData.username, role: userData.role });
        return userData;
      } catch (err) {
        console.error("Login fetch error:", err);
        throw new Error("Login failed - please try again");
      }
    },
    onSuccess: (user: User) => {
      // Clear any stale cache data
      queryClient.clear();
      
      // Set the new user data
      queryClient.setQueryData(["/api/user"], user);
      console.log("User data set in query client cache");
      
      // Force a refetch to ensure we have the latest data
      setTimeout(() => {
        refetchUser();
        console.log("Triggered user data refetch after login");
      }, 500);
      
      toast({
        title: "Welcome back!",
        description: `You're now logged in as ${user.fullName}`,
      });
    },
    onError: (error: Error) => {
      console.error("Login failed:", error);
      // Clear any potentially stale user data
      queryClient.removeQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Login failed",
        description: error.message || "Authentication failed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      console.log("Attempting registration with data:", { 
        username: userData.username, 
        email: userData.email, 
        passwordLength: userData.password.length,
        fullName: userData.fullName,
        role: userData.role || "client"
      });
      
      // Set a longer timeout for the registration request (10 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
          credentials: "include",
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Registration failed with status ${res.status}: ${errorText}`);
          throw new Error(errorText || "Registration failed");
        }
        
        const user = await res.json();
        console.log("Registration successful, user data received:", { id: user.id, username: user.username, role: user.role });
        return user;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    },
    onSuccess: (user: User) => {
      // Clear any stale cache data
      queryClient.clear();
      
      // Set the new user data
      queryClient.setQueryData(["/api/user"], user);
      console.log("User data set in query client cache after registration");
      
      // Force a refetch to ensure we have the latest data
      setTimeout(() => {
        refetchUser();
        console.log("Triggered user data refetch after registration");
      }, 500);
      
      toast({
        title: "Registration successful!",
        description: `Welcome to SoulSeer, ${user.fullName}`,
      });
    },
    onError: (error: Error) => {
      console.error("Registration failed:", error);
      // Clear any potentially stale user data
      queryClient.removeQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Registration failed",
        description: error.message || "Registration failed. Please try again with a different username or email.",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("Attempting to logout");
      
      // Set a longer timeout for the logout request (5 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const res = await fetch("/api/logout", {
          method: "POST",
          credentials: "include",
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Logout failed with status ${res.status}: ${errorText}`);
          throw new Error(errorText || "Logout failed");
        }
        
        console.log("Logout successful");
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    },
    onSuccess: () => {
      // Clear all cache data to ensure clean state
      queryClient.clear();
      console.log("Query cache cleared after logout");
      
      // Set user to null explicitly
      queryClient.setQueryData(["/api/user"], null);
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      console.error("Logout failed:", error);
      toast({
        title: "Logout failed",
        description: error.message || "Failed to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Convert undefined to null for proper typing
  const safeUser: User | null = user === undefined ? null : user as User;
  
  return (
    <AuthContext.Provider
      value={{
        user: safeUser,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
