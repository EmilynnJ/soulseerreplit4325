import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useUser, useAuth } from "@clerk/clerk-react";

export function ClerkProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { isLoaded, isSignedIn } = useUser();
  
  if (!isLoaded) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen cosmic-bg">
          <div className="p-8 rounded-lg bg-dark/30 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-accent" />
          </div>
        </div>
      </Route>
    );
  }

  if (!isSignedIn) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
} 