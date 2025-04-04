import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { ClientDashboard } from "./client-dashboard";
import { ReaderDashboard } from "./reader-dashboard";
import { AdminDashboard } from "./admin-dashboard";
import { Loader2, RefreshCw } from "lucide-react";

export function Dashboard() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return null; // The protected route component will handle redirection
  }
  
  try {
    // Render the appropriate dashboard based on user role
    switch (user.role) {
      case "admin":
        return <AdminDashboard />;
      case "reader":
        return <ReaderDashboard />;
      case "client":
      default:
        return <ClientDashboard />;
    }
  } catch (error) {
    console.error("Dashboard rendering error:", error);
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="bg-primary-dark/30 backdrop-blur-md p-8 rounded-lg border border-accent/30 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Dashboard Error</h2>
          <p className="mb-4">There was a problem loading your dashboard. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-accent text-primary-dark rounded-md hover:bg-accent/80 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
}