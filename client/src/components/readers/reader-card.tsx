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
  // Default fallback image for readers without profile images
  const profileImage = reader.profileImage || "/images/default-reader.png";
  
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
    <GlowCard className="p-4 flex flex-col h-full">
      <div className="relative mb-3">
        {/* Profile image */}
        <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-primary-light/20 max-h-32">
          {profileImage && (
            <img 
              src={profileImage} 
              alt={`${reader.fullName} - Psychic Reader`}
              className="w-full h-full object-cover"
            />
          )}
        </div>
        
        {/* Online status */}
        <div className="absolute top-1 right-1">
          <OnlineStatusBadge isOnline={reader.isOnline || false} className="bg-primary-dark/70 backdrop-blur-sm px-1.5 py-0.5 text-xs rounded-full" />
        </div>
      </div>
      
      {/* Reader info */}
      <h3 className="text-xl font-alex text-accent mb-0.5">{reader.fullName}</h3>
      
      {/* Rating */}
      <div className="flex items-center space-x-2 mb-1">
        <div className="flex items-center">
          <StarIcon className="h-3 w-3 text-yellow-500 mr-0.5" />
          <span className="text-light/90 text-xs font-playfair">{reader.rating || "-"}/5</span>
        </div>
        
        {/* Pricing */}
        {reader.pricing && (
          <p className="text-secondary text-xs font-cinzel">
            ${(reader.pricing / 100).toFixed(2)}/min
          </p>
        )}
      </div>
      
      {/* Specialties */}
      {Array.isArray(specialties) && specialties.length > 0 && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-1">
            {specialties.slice(0, 2).map((specialty: string, index: number) => (
              <span 
                key={index} 
                className="text-xs px-1.5 py-0.5 rounded-full bg-primary-light/20 text-light/70 font-playfair text-xs"
              >
                {specialty}
              </span>
            ))}
            {specialties.length > 2 && (
              <span className="text-xs text-light/70">+{specialties.length - 2}</span>
            )}
          </div>
        </div>
      )}
      
      {/* Action buttons */}
      <div className="mt-auto flex space-x-1 pt-2">
        <Link href={`/readers/${reader.id}`} className="flex-1">
          <CelestialButton className="w-full text-xs py-1.5">
            View Profile
          </CelestialButton>
        </Link>
        <CelestialButton 
          variant="secondary" 
          className="w-8 h-8 p-0 flex items-center justify-center"
        >
          <MessageCircleIcon className="h-4 w-4" />
        </CelestialButton>
      </div>
    </GlowCard>
  );
}