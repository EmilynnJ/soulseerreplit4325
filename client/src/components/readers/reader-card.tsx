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
  // Use a hardcoded static image path that always exists
  const defaultImage = "https://static.vecteezy.com/system/resources/thumbnails/008/302/490/small/user-icon-set-avatar-user-icon-isolated-black-simple-line-vector.jpg";
  
  // Determine profile image with fallback
  const profileImage = reader.profileImage || defaultImage;
  
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
      {/* Extra tall portrait layout with larger image area */}
      <div className="relative h-[320px] bg-primary-light/20">
        {profileImage && (
          <img 
            src={profileImage} 
            alt={`${reader.fullName} - Psychic Reader`}
            className="w-full h-full object-cover object-center object-top"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null; // Prevent infinite loop
              target.src = "https://static.vecteezy.com/system/resources/thumbnails/008/302/490/small/user-icon-set-avatar-user-icon-isolated-black-simple-line-vector.jpg";
            }}
          />
        )}
        
        {/* Online status - moved to top corner for better visibility */}
        <div className="absolute top-2 right-2">
          <OnlineStatusBadge isOnline={reader.isOnline || false} className="bg-primary-dark/70 backdrop-blur-sm px-2 py-1 text-xs rounded-full shadow-md" />
        </div>
        
        {/* Reader name overlay at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary-dark/90 to-transparent p-3 pt-8">
          <h3 className="text-xl font-alex text-accent drop-shadow-md">{reader.fullName}</h3>
        </div>
      </div>
      
      {/* Card content section - more compact to emphasize portrait image */}
      <div className="p-2 flex flex-col flex-grow">
        {/* Rating and Price in single row */}
        <div className="flex items-center justify-between">
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
        </div>
        
        {/* Specialties in compact format */}
        {Array.isArray(specialties) && specialties.length > 0 && (
          <div className="my-1.5">
            <div className="flex flex-wrap gap-1">
              {specialties.slice(0, 2).map((specialty: string, index: number) => (
                <span 
                  key={index} 
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-light/20 text-light/80 font-playfair"
                >
                  {specialty}
                </span>
              ))}
              {specialties.length > 2 && (
                <span className="text-[10px] bg-primary-light/10 px-1.5 py-0.5 rounded-full text-light/70">+{specialties.length - 2}</span>
              )}
            </div>
          </div>
        )}
        
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