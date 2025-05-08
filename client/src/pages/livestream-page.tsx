import { useQuery } from "@tanstack/react-query";
import { Livestream } from "@shared/schema";
import { Link } from "wouter";
import { PATHS } from "@/lib/constants";
import { GlowCard } from "@/components/ui/glow-card";
import { 
  MonitorPlay, 
  Users, 
  Clock, 
  Search, 
  Star, 
  Calendar 
} from "lucide-react";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

export default function LivestreamPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  const { data: livestreams, isLoading } = useQuery<Livestream[]>({
    queryKey: ["/api/livestreams"],
  });
  
  // Filter livestreams
  const filteredLivestreams = livestreams?.filter(stream => {
    const matchesSearch = 
      searchTerm === "" || 
      stream.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stream.description.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = 
      selectedCategory === "all" || 
      stream.category === selectedCategory;
      
    return matchesSearch && matchesCategory;
  });
  
  // Separate active and upcoming livestreams
  const activeLivestreams = filteredLivestreams?.filter(stream => stream.status === "live") || [];
  const upcomingLivestreams = filteredLivestreams?.filter(stream => stream.status === "scheduled") || [];
  const completedLivestreams = filteredLivestreams?.filter(stream => stream.status === "ended") || [];
  
  return (
    <div className="container mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-12 cosmic-bg p-8 rounded-lg">
        <h1 className="text-4xl md:text-5xl font-alex-brush text-accent mb-4">Live Streams</h1>
        <p className="text-light/80 font-playfair max-w-3xl mx-auto">
          Join our psychic readers for live spiritual sessions, readings, and community events.
        </p>
      </div>
      
      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-accent/50" />
            <Input 
              placeholder="Search livestreams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-primary-dark/30 border-accent/20"
            />
          </div>
        </div>
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full h-10 px-3 py-2 bg-primary-dark/30 border border-accent/20 text-light rounded-md focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="all">All Categories</option>
            <option value="tarot">Tarot Readings</option>
            <option value="astrology">Astrology</option>
            <option value="meditation">Meditation</option>
            <option value="spiritual">Spiritual Guidance</option>
            <option value="psychic">Psychic Readings</option>
          </select>
        </div>
      </div>
      
      {/* Live Now Section */}
      <div className="mb-16">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-alex-brush text-secondary">
            <MonitorPlay className="inline-block mr-2" /> Live Now
          </h2>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, index) => (
              <GlowCard key={index}>
                <div className="relative">
                  <Skeleton className="w-full h-48" />
                </div>
                <div className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-1" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-full rounded-full" />
                </div>
              </GlowCard>
            ))}
          </div>
        ) : activeLivestreams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeLivestreams.map((livestream) => (
              <GlowCard key={livestream.id} className="rounded-2xl overflow-hidden p-0">
                <div className="relative">
                  {livestream.playbackId ? (
                    <MuxPlayer
                      playbackId={livestream.playbackId}
                      thumbnailTime={0}
                      style={{ height: '200px', width: '100%' }}
                      streamType="on-demand"
                      placeholder={livestream.thumbnailUrl || ""}
                      autoPlay={false}
                      muted={true}
                      loop={false}
                    />
                  ) : (
                    <img
                      src={livestream.thumbnailUrl || "/images/livestream-placeholder.jpg"}
                      alt={livestream.title}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center">
                    <MonitorPlay className="mr-1 h-3 w-3" />
                    <span>LIVE</span>
                  </div>
                  <div className="absolute top-2 right-2 bg-dark/70 text-white text-xs px-2 py-1 rounded-full flex items-center">
                    <Users className="mr-1 h-3 w-3" />
                    <span>{livestream.viewerCount || 0} Viewers</span>
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="text-lg font-cinzel text-secondary mb-1">{livestream.title}</h3>
                  <p className="text-accent text-sm mb-2 font-playfair">
                    {livestream.category.charAt(0).toUpperCase() + livestream.category.slice(1)}
                  </p>
                  <p className="text-light/70 text-sm mb-4 line-clamp-2">{livestream.description}</p>
                  
                  <Link href={`${PATHS.LIVE}/${livestream.id}`}>
                    <CelestialButton
                      variant="default"
                      className="w-full bg-accent/80 hover:bg-accent"
                      size="sm"
                    >
                      Join Stream
                    </CelestialButton>
                  </Link>
                </div>
              </GlowCard>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border border-accent/10 rounded-lg bg-primary-dark/20">
            <MonitorPlay className="h-12 w-12 mx-auto mb-3 text-accent/40" />
            <p className="text-light/70 font-playfair">No live streams at the moment. Check back later or browse scheduled events.</p>
          </div>
        )}
      </div>
      
      {/* Upcoming Scheduled Section */}
      <div className="mb-16">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-alex-brush text-secondary">
            <Calendar className="inline-block mr-2" /> Upcoming Scheduled
          </h2>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, index) => (
              <GlowCard key={index}>
                <div className="relative">
                  <Skeleton className="w-full h-48" />
                </div>
                <div className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-1" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-full rounded-full" />
                </div>
              </GlowCard>
            ))}
          </div>
        ) : upcomingLivestreams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingLivestreams.map((livestream) => (
              <GlowCard key={livestream.id} className="rounded-2xl overflow-hidden p-0">
                <div className="relative">
                  <img
                    src={livestream.thumbnailUrl || "/images/livestream-placeholder.jpg"}
                    alt={livestream.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-accent/80 text-white text-xs px-2 py-1 rounded-full flex items-center">
                    <Calendar className="mr-1 h-3 w-3" />
                    <span>UPCOMING</span>
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="text-lg font-cinzel text-secondary mb-1">{livestream.title}</h3>
                  <p className="text-accent text-sm mb-2 font-playfair">
                    {livestream.category.charAt(0).toUpperCase() + livestream.category.slice(1)}
                  </p>
                  
                  <div className="flex items-center mb-3 text-light/70">
                    <Clock className="h-4 w-4 mr-1" />
                    <span className="text-sm">
                      {livestream.scheduledFor ? new Date(livestream.scheduledFor).toLocaleString() : 'Date TBA'}
                    </span>
                  </div>
                  
                  <p className="text-light/70 text-sm mb-4 line-clamp-2">{livestream.description}</p>
                  
                  <Link href={`${PATHS.LIVE}/${livestream.id}`}>
                    <CelestialButton
                      variant="secondary"
                      className="w-full"
                      size="sm"
                    >
                      Set Reminder
                    </CelestialButton>
                  </Link>
                </div>
              </GlowCard>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border border-accent/10 rounded-lg bg-primary-dark/20">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-accent/40" />
            <p className="text-light/70 font-playfair">No upcoming streams scheduled at the moment.</p>
          </div>
        )}
      </div>
      
      {/* Past Recordings Section */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-alex-brush text-secondary">
            <Star className="inline-block mr-2" /> Past Recordings
          </h2>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, index) => (
              <GlowCard key={index}>
                <div className="relative">
                  <Skeleton className="w-full h-48" />
                </div>
                <div className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-1" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-full rounded-full" />
                </div>
              </GlowCard>
            ))}
          </div>
        ) : completedLivestreams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedLivestreams.map((livestream) => (
              <GlowCard key={livestream.id} className="rounded-2xl overflow-hidden p-0">
                <div className="relative">
                  <img
                    src={livestream.thumbnailUrl || "/images/livestream-placeholder.jpg"}
                    alt={livestream.title}
                    className="w-full h-48 object-cover"
                  />
                  {livestream.duration && (
                    <div className="absolute bottom-2 right-2 bg-dark/70 text-white text-xs px-2 py-1 rounded-full">
                      <span>{Math.floor(livestream.duration / 60)}:{(livestream.duration % 60).toString().padStart(2, '0')}</span>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="text-lg font-cinzel text-secondary mb-1">{livestream.title}</h3>
                  <p className="text-accent text-sm mb-2 font-playfair">
                    {livestream.category.charAt(0).toUpperCase() + livestream.category.slice(1)}
                  </p>
                  
                  <div className="flex items-center mb-3 text-light/70">
                    <Clock className="h-4 w-4 mr-1" />
                    <span className="text-sm">
                      {livestream.endedAt ? new Date(livestream.endedAt).toLocaleDateString() : 'Date unknown'}
                    </span>
                  </div>
                  
                  <p className="text-light/70 text-sm mb-4 line-clamp-2">{livestream.description}</p>
                  
                  <Link href={`${PATHS.LIVE}/${livestream.id}`}>
                    <CelestialButton
                      variant="secondary"
                      className="w-full"
                      size="sm"
                    >
                      Watch Recording
                    </CelestialButton>
                  </Link>
                </div>
              </GlowCard>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border border-accent/10 rounded-lg bg-primary-dark/20">
            <Star className="h-12 w-12 mx-auto mb-3 text-accent/40" />
            <p className="text-light/70 font-playfair">No past recordings available at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
