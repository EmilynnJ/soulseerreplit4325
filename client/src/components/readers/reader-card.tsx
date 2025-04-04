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
    <GlowCard className="p-0 flex flex-col h-full overflow-hidden">
      {/* Portrait layout with larger image area */}
      <div className="relative h-64 bg-primary-light/20">
        {profileImage && (
          <img 
            src={profileImage} 
            alt={`${reader.fullName} - Psychic Reader`}
            className="w-full h-full object-cover object-center"
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
      
      {/* Card content section */}
      <div className="p-3 flex flex-col flex-grow">
        {/* Rating and Price */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center bg-primary-dark/30 px-2 py-1 rounded-full">
            <StarIcon className="h-3.5 w-3.5 text-yellow-500 mr-1" />
            <span className="text-light/90 text-xs font-playfair">{reader.rating || "-"}/5</span>
          </div>
          
          {reader.pricing && (
            <p className="text-secondary text-xs font-cinzel bg-primary-light/10 px-2 py-1 rounded-full">
              ${(reader.pricing / 100).toFixed(2)}/min
            </p>
          )}
        </div>
        
        {/* Specialties */}
        {Array.isArray(specialties) && specialties.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {specialties.slice(0, 3).map((specialty: string, index: number) => (
                <span 
                  key={index} 
                  className="text-xs px-2 py-0.5 rounded-full bg-primary-light/20 text-light/80 font-playfair"
                >
                  {specialty}
                </span>
              ))}
              {specialties.length > 3 && (
                <span className="text-xs bg-primary-light/10 px-2 py-0.5 rounded-full text-light/70">+{specialties.length - 3}</span>
              )}
            </div>
          </div>
        )}
        
        {/* Action buttons */}
        <div className="mt-auto flex space-x-2 pt-2">
          <Link href={`/readers/${reader.id}`} className="flex-1">
            <CelestialButton className="w-full py-2 text-sm">
              View Profile
            </CelestialButton>
          </Link>
          <CelestialButton 
            variant="secondary" 
            className="w-10 h-10 p-0 flex items-center justify-center"
          >
            <MessageCircleIcon className="h-5 w-5" />
          </CelestialButton>
        </div>
      </div>
    </GlowCard>
  );
}