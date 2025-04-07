import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface OnlineStatusBadgeProps {
  isOnline: boolean;
  className?: string;
}

export function OnlineStatusBadge({ isOnline, className }: OnlineStatusBadgeProps) {
  // Use a local state to prevent flickering during transitions
  const [displayStatus, setDisplayStatus] = useState<boolean>(!!isOnline);
  
  useEffect(() => {
    // Update the display status when the prop changes
    setDisplayStatus(!!isOnline);
  }, [isOnline]);
  
  return (
    <div className={cn("flex items-center", className)}>
      <div 
        className={cn(
          "w-2.5 h-2.5 rounded-full mr-1.5",
          displayStatus
            ? "bg-green-500 animate-pulse shadow-sm shadow-green-400/50" 
            : "bg-gray-400"
        )}
      />
      <span className="text-sm font-playfair">
        {displayStatus ? "Online Now" : "Offline"}
      </span>
    </div>
  );
}