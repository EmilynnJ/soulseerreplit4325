import { GlowCard } from "@/components/ui/glow-card";
import { OnlineStatusBadge } from "./online-status-badge";
import { User } from "@shared/schema";
import { CelestialButton } from "@/components/ui/celestial-button";
import { StarIcon, MessageCircleIcon } from "lucide-react";
import { Link } from "wouter";

interface ReaderCardProps {
  reader: Omit<User, "password">;
}

export function ReaderCard({ reader }: ReaderCardProps) {
  // Parse specialties, ensuring they're always an array of strings
  const specialties: string[] = (() => {
    if (!reader.specialties) return [];
    if (Array.isArray(reader.specialties)) return reader.specialties as string[];
    if (typeof reader.specialties === 'string') {
      try {
        const parsed = JSON.parse(reader.specialties);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [reader.specialties];
      }
    }
    return [];
  })();
  
  return (
    <GlowCard className="p-0 flex flex-col h-full overflow-hidden max-w-[200px] mx-auto">
      {/* Card header with reader name and status */}
      <div className="relative p-6 bg-gradient-to-b from-primary-dark/80 to-primary-dark/40 text-center">
        {/* Online status badge */}
        <div className="absolute top-2 right-2">
          <OnlineStatusBadge isOnline={reader.isOnline || false} className="bg-primary-dark/70 backdrop-blur-sm px-2 py-1 text-xs rounded-full shadow-md" />
        </div>
        
        {/* Reader name as main focus */}
        <h3 className="text-3xl font-alex text-accent drop-shadow-md mt-4 mb-2">{reader.fullName}</h3>
      </div>
      
      {/* Card content section - ultra compact to emphasize portrait image */}
      <div className="p-2 flex flex-col flex-grow">
        {/* Rating, Price, and Specialties in a single horizontal row */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1">
            <div className="flex items-center bg-primary-dark/30 px-1.5 py-0.5 rounded-full">
              <StarIcon className="h-3 w-3 text-yellow-500 mr-0.5" />
              <span className="text-light/90 text-[10px] font-playfair">{reader.rating || "-"}/5</span>
            </div>
            
            {reader.pricing && (
              <p className="text-secondary text-[10px] font-cinzel bg-primary-light/10 px-1.5 py-0.5 rounded-full">
                ${(reader.pricing / 100).toFixed(2)}/min
              </p>
            )}
          </div>
          
          {/* Show just one specialty or count */}
          {Array.isArray(specialties) && specialties.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-light/20 text-light/80 font-playfair truncate max-w-[80px]">
              {specialties.length > 1 ? `${specialties.length} specialties` : specialties[0]}
            </span>
          )}
        </div>
        
        {/* Action buttons - simplified layout */}
        <div className="mt-auto flex pt-1.5">
          <Link href={`/readers/${reader.id}`} className="flex-1">
            <CelestialButton className="w-full py-1.5 text-xs">
              View Profile
            </CelestialButton>
          </Link>
        </div>
      </div>
    </GlowCard>
  );
}