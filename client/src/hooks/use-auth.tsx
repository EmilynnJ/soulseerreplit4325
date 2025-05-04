import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth0 } from "@auth0/auth0-react";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  loginWithAuth0: () => void;
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
    isAuthenticated, 
    loginWithRedirect, 
    logout: auth0Logout, 
    user: auth0User,
    isLoading: isAuth0Loading 
  } = useAuth0();

  // Check if user is authenticated with Auth0
  useEffect(() => {
    if (isAuthenticated && auth0User) {
      // When a user logs in with Auth0, call the backend to create/update user
      // and establish a session
      fetch("/auth/auth0/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth0Id: auth0User.sub,
          email: auth0User.email,
          name: auth0User.name,
          picture: auth0User.picture,
        }),
        credentials: "include",
      })
        .then(response => {
          if (response.ok) {
            // Refresh user data
            refetchUser();
          }
        })
        .catch(error => {
          console.error("Error syncing Auth0 user:", error);
        });
    }
  }, [isAuthenticated, auth0User]);

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
      
      // Set the new user data immediately
      queryClient.setQueryData(["/api/user"], user);
      console.log("User data set in query client cache");
      
      // Store session ID in localStorage for authentication
      if (user && (user as any).sessionID) {
        localStorage.setItem('sessionId', (user as any).sessionID);
        console.log("Session ID stored in localStorage:", (user as any).sessionID);
      } else {
        // Store the user ID as a fallback (not as secure but usable)
        localStorage.setItem('sessionId', user.id.toString());
        console.log("No session ID found, using user ID as fallback for authentication");
      }
      
      // Force an immediate refetch
      refetchUser();
      
      // Schedule another refetch after a delay to ensure data consistency
      setTimeout(() => {
        refetchUser();
        console.log("Triggered follow-up user data refetch");
      }, 1000);
      
      toast({
        title: "Welcome back!",
        description: `You're now logged in as ${user.fullName}`,
      });
      
      return user; // Return user data for the mutation
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
      
      // Store session ID in localStorage for authentication
      if (user && (user as any).sessionID) {
        localStorage.setItem('sessionId', (user as any).sessionID);
        console.log("Session ID stored in localStorage:", (user as any).sessionID);
      } else {
        // Store the user ID as a fallback (not as secure but usable)
        localStorage.setItem('sessionId', user.id.toString());
        console.log("No session ID found, using user ID as fallback for authentication");
      }
      
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
        
        // Also logout from Auth0 if user was authenticated with Auth0
        if (isAuthenticated) {
          auth0Logout({ logoutParams: { returnTo: window.location.origin } });
        }
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    },
    onSuccess: () => {
      // Clear all cache data to ensure clean state
      queryClient.clear();
      console.log("Query cache cleared after logout");
      
      // Remove the session ID from localStorage
      localStorage.removeItem('sessionId');
      console.log("Session ID removed from localStorage");
      
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

  // Function to login with Auth0
  const loginWithAuth0 = () => {
    loginWithRedirect();
  };

  // Convert undefined to null for proper typing
  const safeUser: User | null = user === undefined ? null : user as User;
  
  return (
    <AuthContext.Provider
      value={{
        user: safeUser,
        isLoading: isLoading || isAuth0Loading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        loginWithAuth0,
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
