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
    retry: 2 // Retry twice before giving up
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("Attempting login with credentials:", { username: credentials.username, passwordLength: credentials.password.length });
      const res = await apiRequest("POST", "/api/login", credentials);
      const userData = await res.json();
      console.log("Login successful, user data received:", { id: userData.id, username: userData.username, role: userData.role });
      return userData;
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      console.log("User data set in query client cache");
      // Force a refetch to ensure we have the latest data
      refetchUser();
      toast({
        title: "Welcome back!",
        description: `You're now logged in as ${user.fullName}`,
      });
    },
    onError: (error: Error) => {
      console.error("Login failed:", error);
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
      const res = await apiRequest("POST", "/api/register", userData);
      const user = await res.json();
      console.log("Registration successful, user data received:", { id: user.id, username: user.username, role: user.role });
      return user;
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      console.log("User data set in query client cache after registration");
      // Force a refetch to ensure we have the latest data
      refetchUser();
      toast({
        title: "Registration successful!",
        description: `Welcome to SoulSeer, ${user.fullName}`,
      });
    },
    onError: (error: Error) => {
      console.error("Registration failed:", error);
      toast({
        title: "Registration failed",
        description: error.message || "Registration failed. Please try again with a different username or email.",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Convert undefined to null for proper typing
  const safeUser = user === undefined ? null : user;
  
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
