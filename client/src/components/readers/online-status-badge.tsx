import { cn } from "@/lib/utils";

interface OnlineStatusBadgeProps {
  isOnline: boolean;
  className?: string;
}

export function OnlineStatusBadge({ isOnline, className }: OnlineStatusBadgeProps) {
  // Add debugging console log so we can see what the component is receiving
  console.log(`OnlineStatusBadge rendering with isOnline=${isOnline}`);
  
  return (
    <div className={cn("flex items-center", className)}>
      <div 
        className={cn(
          "w-2.5 h-2.5 rounded-full mr-1.5",
          // The issue is that the isOnline flag from database is working correctly,
          // but we need to display it properly in the UI
          isOnline 
            ? "bg-green-500 animate-pulse shadow-sm shadow-green-400/50" 
            : "bg-gray-400"
        )}
      />
      <span className="text-sm font-playfair">
        {isOnline ? "Online Now" : "Offline"}
      </span>
    </div>
  );
}