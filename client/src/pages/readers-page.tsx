import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { User } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Star, Search, Clock, Filter, CheckCircle } from "lucide-react";

export default function ReadersPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  // Fetch all readers
  const { data: readers, isLoading: isLoadingReaders, error } = useQuery<Omit<User, 'password'>[]>({
    queryKey: ['/api/readers'],
  });

  // Fetch online readers
  const { data: onlineReaders, isLoading: isLoadingOnlineReaders } = useQuery<Omit<User, 'password'>[]>({
    queryKey: ['/api/readers/online'],
  });

  // Error handling
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load readers. Please try again later.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Filter readers based on search query and specialty
  const filterReaders = (readers: Omit<User, 'password'>[] | undefined, isOnline: boolean = false) => {
    if (!readers) return [];
    
    let filteredReaders = readers;
    
    // Filter by online status
    if (activeTab === "online" && !isOnline) {
      filteredReaders = onlineReaders || [];
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredReaders = filteredReaders.filter(reader => 
        reader.fullName.toLowerCase().includes(query) || 
        reader.username.toLowerCase().includes(query) ||
        (reader.bio && reader.bio.toLowerCase().includes(query))
      );
    }
    
    // Filter by specialty
    if (selectedSpecialty) {
      filteredReaders = filteredReaders.filter(reader => 
        reader.specialties && reader.specialties.includes(selectedSpecialty)
      );
    }
    
    return filteredReaders;
  };

  // Extract all unique specialties from readers
  const extractSpecialties = () => {
    const specialtiesSet = new Set<string>();
    
    if (readers) {
      readers.forEach(reader => {
        if (reader.specialties) {
          reader.specialties.forEach(specialty => {
            specialtiesSet.add(specialty);
          });
        }
      });
    }
    
    return Array.from(specialtiesSet).sort();
  };

  const specialties = extractSpecialties();
  
  // Format price from cents to dollars
  const formatPrice = (cents: number | null | undefined) => {
    if (!cents) return "$0.00";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const displayedReaders = activeTab === "online" 
    ? filterReaders(onlineReaders, true) 
    : filterReaders(readers);

  return (
    <div className="container mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-12 cosmic-bg p-8 rounded-lg">
        <h1 className="text-4xl md:text-5xl font-alex-brush text-accent mb-4">Our Psychic Readers</h1>
        <p className="text-light/80 font-playfair max-w-3xl mx-auto">
          Connect with our gifted psychic readers for personalized spiritual guidance, tarot readings, and intuitive insights.
        </p>
      </div>
      
      {/* Filters and Search */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-primary-dark/30 border-accent/20 text-light"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedSpecialty || ""}
              onChange={e => setSelectedSpecialty(e.target.value || null)}
              className="px-3 py-2 bg-primary-dark/30 border border-accent/20 text-light rounded-md focus:outline-none focus:ring-2 focus:ring-accent/40"
              aria-label="Filter by specialty"
            >
              <option value="">All Specialties</option>
              {specialties.map(specialty => (
                <option key={specialty} value={specialty}>{specialty}</option>
              ))}
            </select>
            
            {selectedSpecialty && (
              <CelestialButton 
                variant="secondary" 
                onClick={() => setSelectedSpecialty(null)}
                className="whitespace-nowrap"
              >
                Clear Filter
              </CelestialButton>
            )}
          </div>
        </div>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-primary-dark/50">
            <TabsTrigger value="all" className="font-cinzel">All Readers</TabsTrigger>
            <TabsTrigger value="online" className="font-cinzel">Online Now</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Readers Grid */}
      {(isLoadingReaders || isLoadingOnlineReaders) ? (
        <div className="text-center py-12">
          <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-light/80 font-playfair">Loading readers...</p>
        </div>
      ) : displayedReaders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedReaders.map(reader => (
            <Link key={reader.id} href={`/readers/${reader.id}`}>
              <Card className={`glow-card overflow-hidden h-full bg-primary-dark/40 border-accent/20 hover:border-accent/40 transition-all cursor-pointer ${reader.isOnline ? 'ring-2 ring-green-500/50' : ''}`}>
                <div className="relative">
                  {reader.profileImage ? (
                    <img 
                      src={reader.profileImage} 
                      alt={reader.fullName}
                      className="w-full h-48 object-cover object-center object-top"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                      <span className="text-5xl font-playfair text-accent/50">{reader.fullName.charAt(0)}</span>
                    </div>
                  )}
                  
                  {reader.isOnline && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center">
                      <span className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
                      Online
                    </div>
                  )}
                  
                  {reader.verified && (
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/40">
                        <CheckCircle className="w-3 h-3 mr-1" /> Verified
                      </Badge>
                    </div>
                  )}
                </div>
                
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-cinzel text-accent text-xl">{reader.fullName}</CardTitle>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-500 mr-1" />
                      <span className="text-light/80">{reader.rating || "New"}</span>
                    </div>
                  </div>
                  <CardDescription className="text-light/70">
                    <div className="flex items-center mt-1">
                      <Clock className="w-4 h-4 text-accent/60 mr-1" />
                      <span>{formatPrice(reader.pricing)}/min</span>
                    </div>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-3">
                  {reader.specialties && reader.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {reader.specialties.slice(0, 3).map(specialty => (
                        <Badge key={specialty} variant="outline" className="bg-primary-dark/50 text-accent/80 border-accent/20">
                          {specialty}
                        </Badge>
                      ))}
                      {reader.specialties.length > 3 && (
                        <Badge variant="outline" className="bg-primary-dark/50 text-accent/80 border-accent/20">
                          +{reader.specialties.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <p className="text-light/80 line-clamp-2">
                    {reader.bio || "This reader has not added a bio yet."}
                  </p>
                </CardContent>
                
                <CardFooter>
                  <CelestialButton className="w-full">
                    View Profile
                  </CelestialButton>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 cosmic-bg p-8 rounded-lg">
          <p className="text-light/80 font-playfair mb-2">No readers found matching your criteria.</p>
          {searchQuery || selectedSpecialty ? (
            <CelestialButton 
              variant="secondary" 
              onClick={() => {
                setSearchQuery("");
                setSelectedSpecialty(null);
              }}
            >
              Clear Filters
            </CelestialButton>
          ) : (
            <p className="text-light/50 font-playfair">Please check back later or adjust your filters.</p>
          )}
        </div>
      )}
    </div>
  );
}