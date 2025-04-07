import { cn } from "@/lib/utils";

interface OnlineStatusBadgeProps {
  isOnline: boolean;
  className?: string;
}

export function OnlineStatusBadge({ isOnline, className }: OnlineStatusBadgeProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <div 
        className={cn(
          "w-2.5 h-2.5 rounded-full mr-1.5",
          isOnline === true
            ? "bg-green-500 animate-pulse shadow-sm shadow-green-400/50" 
            : "bg-gray-400"
        )}
      />
      <span className="text-sm font-playfair">
        {isOnline === true ? "Online Now" : "Offline"}
      </span>
    </div>
  );
}