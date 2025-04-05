import { GlowCard } from "@/components/ui/glow-card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function FounderSection() {
  return (
    <div className="flex flex-col items-center text-center mb-16">
      <h1 className="text-5xl font-cinzel mb-8 text-center">
        <span className="text-accent">About</span> <span className="text-secondary">SoulSeer</span>
      </h1>
      
      <div className="mb-8">
        <Avatar className="w-48 h-48 border-4 border-secondary">
          <AvatarImage 
            src="/images/founder.jpg" 
            alt="Emily" 
            className="object-cover"
          />
          <AvatarFallback className="bg-accent text-white text-4xl">
            E
          </AvatarFallback>
        </Avatar>
      </div>
      
      <h2 className="text-2xl font-cinzel text-accent mb-2">Emily</h2>
      <p className="text-light/80 mb-12">Founder, Developer, & Reader</p>
      
      <GlowCard className="rounded-2xl p-8 max-w-3xl">
        <p className="text-light leading-relaxed mb-4">
          At SoulSeer, we are dedicated to providing ethical, compassionate, and judgment-free spiritual guidance. Our mission is twofold: to offer clients genuine, heart-centered readings and to uphold fair, ethical standards for our readers.
        </p>
        <p className="text-light leading-relaxed mb-4">
          Founded by psychic medium Emilynn, SoulSeer was created as a response to the corporate greed that dominates many psychic platforms. Unlike other apps, our readers keep the majority of what they earn and play an active role in shaping the platform.
        </p>
        <p className="text-light leading-relaxed">
          SoulSeer is more than just an app—it's a soul tribe. A community of gifted psychics united by our life's calling: to guide, heal, and empower those who seek clarity on their journey.
        </p>
      </GlowCard>
    </div>
  );
}
