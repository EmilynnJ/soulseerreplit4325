import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useMutation,
  UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { account, createAccount, login, logout, getCurrentUser } from "@/lib/appwrite";
import { Models } from "appwrite";

// Define the AppwriteUser type based on Appwrite's Models.User
type AppwriteUser = Models.User<Models.Preferences>;

// Define the User type that will be used throughout the app
type User = {
  id: string;
  email: string;
  name: string;
  role: "client" | "reader";
  // Add any other user properties needed by the app
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  email: string;
  password: string;
  name: string;
  role?: "client" | "reader";
};

// Helper function to convert Appwrite user to our app's User type
const convertAppwriteUser = (appwriteUser: AppwriteUser): User => {
  return {
    id: appwriteUser.$id,
    email: appwriteUser.email,
    name: appwriteUser.name,
    // Default to client role, can be updated later if needed
    role: "client",
  };
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Check if user is already logged in on component mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        setIsLoading(true);
        const appwriteUser = await getCurrentUser();
        if (appwriteUser) {
          setUser(convertAppwriteUser(appwriteUser));
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Error checking user:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const session = await login(credentials.email, credentials.password);
      const appwriteUser = await getCurrentUser();
      if (!appwriteUser) {
        throw new Error("Failed to get user after login");
      }
      return convertAppwriteUser(appwriteUser);
    },
    onSuccess: (user: User) => {
      setUser(user);
      toast({
        title: "Welcome back!",
        description: `You're now logged in as ${user.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const session = await createAccount(userData.email, userData.password, userData.name);
      const appwriteUser = await getCurrentUser();
      if (!appwriteUser) {
        throw new Error("Failed to get user after registration");
      }
      return convertAppwriteUser(appwriteUser);
    },
    onSuccess: (user: User) => {
      setUser(user);
      toast({
        title: "Registration successful!",
        description: `Welcome to SoulSeer, ${user.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await logout();
    },
    onSuccess: () => {
      setUser(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
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
