import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ChatRoom } from '@/components/chat/chat-room';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, PlusCircle, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWebSocketContext } from '@/hooks/websocket-provider';

// Define chat room interface
interface ChatRoomInfo {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  category: string;
  isPrivate: boolean;
}

// Mock chat rooms data - in production, this would come from an API
const availableRooms: ChatRoomInfo[] = [
  {
    id: 'general',
    name: 'General Discussion',
    description: 'Chat about anything spiritual or mystical',
    memberCount: 42,
    category: 'general',
    isPrivate: false
  },
  {
    id: 'tarot',
    name: 'Tarot Circle',
    description: 'Discuss tarot readings and interpretations',
    memberCount: 28,
    category: 'readings',
    isPrivate: false
  },
  {
    id: 'psychic-development',
    name: 'Psychic Development',
    description: 'Share tips and experiences on developing psychic abilities',
    memberCount: 19,
    category: 'spiritual',
    isPrivate: false
  },
  {
    id: 'astrology',
    name: 'Astrology Lounge',
    description: 'Discuss birth charts, transits, and cosmic events',
    memberCount: 34,
    category: 'readings',
    isPrivate: false
  },
  {
    id: 'crystals',
    name: 'Crystal Healing',
    description: 'Share knowledge about crystals and their properties',
    memberCount: 23,
    category: 'spiritual',
    isPrivate: false
  }
];

export default function CommunityChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { status } = useWebSocketContext();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  
  // Filter rooms based on search query and category
  const filteredRooms = availableRooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         room.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter ? room.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });
  
  // Handle room selection
  const selectRoom = (roomId: string) => {
    setSelectedRoom(roomId);
  };
  
  // Handle category filter selection
  const handleCategoryFilter = (category: string | null) => {
    setCategoryFilter(category === categoryFilter ? null : category);
  };
  
  // Handle creating a new room
  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      toast({
        title: 'Room name required',
        description: 'Please enter a name for your chat room',
        variant: 'destructive',
      });
      return;
    }
    
    // In a real app, this would call an API to create the room
    toast({
      title: 'Room Created',
      description: `Your room "${newRoomName}" has been created successfully!`,
    });
    
    // Reset form
    setNewRoomName('');
    setIsCreatingRoom(false);
  };
  
  // Generate categories from room data
  const categories = Array.from(new Set(availableRooms.map(room => room.category)));
  
  // Get selected room details
  const currentRoom = availableRooms.find(room => room.id === selectedRoom);
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-12 cosmic-bg p-8 rounded-lg">
        <h1 className="text-4xl font-alex-brush text-accent mb-4">SoulSeer Community Chat</h1>
        <p className="font-playfair max-w-3xl mx-auto text-light/80">
          Connect with other spiritual seekers in real-time to share experiences, ask questions, and build meaningful connections.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar with room list */}
        <div className={`${selectedRoom ? 'hidden lg:block' : ''}`}>
          <Card className="bg-primary-dark/40 border-accent/20 h-full">
            <CardHeader className="space-y-1 pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="font-cinzel text-xl text-accent">Chat Rooms</CardTitle>
                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                  <div className={`mr-1.5 h-2 w-2 rounded-full ${status === 'open' ? 'bg-green-500' : 'bg-red-500'}`} />
                  {status === 'open' ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <CardDescription className="text-light/70">
                Join a room to start chatting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and filters */}
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search rooms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-primary-dark/30 border-accent/20 text-light pl-8"
                  />
                  <MessageSquare className="absolute left-2.5 top-2.5 h-4 w-4 text-light/50" />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => (
                    <Badge
                      key={category}
                      variant={categoryFilter === category ? "default" : "outline"}
                      className={`cursor-pointer ${
                        categoryFilter === category 
                          ? 'bg-accent text-primary-dark' 
                          : 'bg-transparent text-accent border-accent/30 hover:border-accent/60'
                      }`}
                      onClick={() => handleCategoryFilter(category)}
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Room list */}
              <ScrollArea className="h-[400px] pr-4 -mr-4">
                <div className="space-y-3">
                  {filteredRooms.length > 0 ? (
                    filteredRooms.map(room => (
                      <Card 
                        key={room.id} 
                        className={`cursor-pointer hover:bg-accent/5 transition-colors ${
                          selectedRoom === room.id ? 'border-accent bg-accent/10' : 'border-accent/20 bg-primary-dark/20'
                        }`}
                        onClick={() => selectRoom(room.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-cinzel text-accent">{room.name}</h3>
                            {room.isPrivate && (
                              <Badge variant="outline" className="text-xs bg-transparent border-amber-500/30 text-amber-500">
                                Private
                              </Badge>
                            )}
                          </div>
                          <p className="text-light/70 text-sm line-clamp-2 mb-2">{room.description}</p>
                          <div className="flex items-center text-xs text-light/60">
                            <Users className="h-3 w-3 mr-1" />
                            <span>{room.memberCount} members</span>
                            <Badge variant="outline" className="ml-2 text-xs py-0 px-1.5 h-5 bg-transparent border-accent/20 text-accent">
                              {room.category}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-light/50">
                      No chat rooms found matching your criteria
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              {/* Create new room */}
              {isCreatingRoom ? (
                <Card className="border-accent/30 bg-primary-dark/10">
                  <CardContent className="p-3 space-y-3">
                    <h3 className="font-cinzel text-accent">Create New Room</h3>
                    <Input
                      type="text"
                      placeholder="Room name"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="bg-primary-dark/30 border-accent/20 text-light"
                    />
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsCreatingRoom(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={handleCreateRoom}
                      >
                        Create
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreatingRoom(true)}
                  className="w-full border-accent/30 text-accent hover:bg-accent/10"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create New Room
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Chat room */}
        <div className={`lg:col-span-2 ${selectedRoom ? '' : 'hidden lg:block'}`}>
          {selectedRoom ? (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center lg:hidden mb-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedRoom(null)}
                  className="border-accent/30 text-accent"
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Change Room
                </Button>
              </div>
              
              <ChatRoom 
                roomId={selectedRoom}
                title={currentRoom?.name || 'Chat Room'}
                className="h-[600px] w-full"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <Card className="max-w-md mx-auto text-center border-accent/20 bg-primary-dark/40">
                <CardContent className="pt-6 pb-6">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-accent opacity-70" />
                  <h3 className="text-xl font-cinzel text-accent mb-2">Select a Chat Room</h3>
                  <p className="text-light/70 mb-6">
                    Choose a room from the list on the left to start chatting with the community
                  </p>
                  <div className="lg:hidden">
                    <Button 
                      onClick={() => selectRoom('general')}
                      className="bg-accent text-primary-dark hover:bg-accent/90"
                    >
                      Join General Chat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}