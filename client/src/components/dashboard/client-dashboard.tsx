import { DashboardLayout } from "./dashboard-layout";
import { ReadingHistory } from "./reading-history";
import { AccountBalance } from "./account-balance";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CalendarClock, MessageCircle, Video } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ClientDashboard() {
  try {
    return (
      <DashboardLayout title="Client Dashboard">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2">
            <Card className="glow-card">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Link href="/readings/new">
                    <Button className="w-full" variant="default">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Chat Reading
                    </Button>
                  </Link>
                  <Link href="/readings/new?type=voice">
                    <Button className="w-full" variant="default">
                      <CalendarClock className="mr-2 h-4 w-4" />
                      Voice Reading
                    </Button>
                  </Link>
                  <Link href="/readings/new?type=video">
                    <Button className="w-full" variant="default">
                      <Video className="mr-2 h-4 w-4" />
                      Video Reading
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="md:col-span-1">
            <AccountBalance />
          </div>
        </div>
        
        <ReadingHistory />
      </DashboardLayout>
    );
  } catch (error) {
    console.error("Client dashboard error:", error);
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