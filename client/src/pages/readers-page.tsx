import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { CelestialButton } from "@/components/ui/celestial-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter } from "lucide-react";
import { ReaderCard } from "@/components/readers/reader-card";

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
    <div className="max-w-6xl mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-12 cosmic-bg p-8 rounded-lg">
        <h1 className="text-4xl md:text-5xl font-alex-brush text-accent mb-4">Our Psychic Readers</h1>
        <p className="text-light/80 font-playfair max-w-3xl mx-auto">
          Connect with our gifted psychic readers for personalized spiritual guidance, tarot readings, and intuitive insights.
        </p>
      </div>
      
      {/* Filters and Search */}
      <div className="mb-8 bg-primary-dark/30 rounded-lg p-4 shadow-md">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full mb-4">
          <TabsList className="grid w-full grid-cols-2 bg-primary-dark/50">
            <TabsTrigger value="all" className="font-cinzel">All Readers</TabsTrigger>
            <TabsTrigger value="online" className="font-cinzel">Online Now</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-accent/60" />
            <Input
              placeholder="Search by name or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-primary-dark/40 border-accent/30 text-light focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
              <select
                value={selectedSpecialty || ""}
                onChange={e => setSelectedSpecialty(e.target.value || null)}
                className="px-3 py-2 h-10 min-w-[150px] bg-primary-dark/40 border border-accent/30 text-light rounded-md focus:outline-none focus:ring-1 focus:ring-accent/30"
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
                  className="whitespace-nowrap py-1 px-2 h-10"
                  size="sm"
                >
                  Clear
                </CelestialButton>
              )}
            </div>
            
            {searchQuery && (
              <CelestialButton 
                variant="outline" 
                onClick={() => setSearchQuery("")}
                className="whitespace-nowrap py-1 px-2 h-10"
                size="sm"
              >
                Clear Search
              </CelestialButton>
            )}
          </div>
        </div>
        
        {/* Filter summary */}
        {(searchQuery || selectedSpecialty) && (
          <div className="mt-4 flex items-center flex-wrap gap-2">
            <span className="text-sm text-light/70">Filters:</span>
            {searchQuery && (
              <Badge className="bg-accent/20 text-accent hover:bg-accent/30">
                Search: {searchQuery}
              </Badge>
            )}
            {selectedSpecialty && (
              <Badge className="bg-accent/20 text-accent hover:bg-accent/30">
                Specialty: {selectedSpecialty}
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {/* Readers Grid */}
      {(isLoadingReaders || isLoadingOnlineReaders) ? (
        <div className="text-center py-12">
          <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-light/80 font-playfair">Loading readers...</p>
        </div>
      ) : displayedReaders.length > 0 ? (
        <div className="flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
            {displayedReaders.map(reader => (
              <div key={reader.id} className="h-[340px] w-full flex justify-center">
                <ReaderCard reader={reader} />
              </div>
            ))}
          </div>
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