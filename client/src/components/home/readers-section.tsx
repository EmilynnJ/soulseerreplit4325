import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Link } from "wouter";
import { PATHS } from "@/lib/constants";
import { GlowCard } from "@/components/ui/glow-card";
import { ArrowRightIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReaderCard } from "@/components/readers/reader-card";
import { useWebSocketContext } from "@/hooks/websocket-provider";
import { useEffect, useState } from "react";

export function ReadersSection() {
  const [readers, setReaders] = useState<Omit<User, 'password'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Use a try-catch to handle the case when WebSocketProvider is not available
  const [websocket, setWebsocket] = useState<any>({
    lastMessage: null,
    status: 'closed'
  });
  
  useEffect(() => {
    try {
      const ws = require('@/hooks/websocket-provider').useWebSocketContext();
      setWebsocket(ws);
    } catch (error) {
      console.log('WebSocketProvider not available, using fallback');
    }
  }, []);
  
  const { data: fetchedReaders, isLoading: isLoadingReaders } = useQuery<Omit<User, 'password'>[]>({
    queryKey: ["/api/readers/online"],
  });
  
  // Update readers state when data is fetched
  useEffect(() => {
    if (fetchedReaders) {
      setReaders(fetchedReaders);
      setIsLoading(false);
    }
  }, [fetchedReaders]);
  
  // Listen for WebSocket messages about reader status changes
  useEffect(() => {
    if (!websocket.lastMessage) return;
    
    if (websocket.lastMessage.type === 'reader_status_change') {
      const { readerId, status, reader: readerData } = websocket.lastMessage;
      
      // When there's full reader data in the message
      if (readerData) {
        console.log(`WebSocket: Received full reader data for reader ${readerId} (${readerData.username}): ${status}`);
        
        // Update all online readers list
        setReaders(prevReaders => {
          const readerIndex = prevReaders.findIndex(r => r.id === readerId);
          
          // Handle online status
          if (status === 'online') {
            if (readerIndex === -1) {
              // Add to online readers list
              console.log(`Adding reader ${readerData.username} to online list`);
              return [...prevReaders, {...readerData, isOnline: true}];
            } else {
              // Update existing reader
              console.log(`Updating reader ${readerData.username} to online`);
              const updatedReaders = [...prevReaders];
              updatedReaders[readerIndex] = {
                ...updatedReaders[readerIndex],
                ...readerData,
                isOnline: true
              };
              return updatedReaders;
            }
          } 
          // Handle offline status - remove from online list
          else if (status === 'offline' && readerIndex !== -1) {
            console.log(`Removing reader ${readerData.username} from online list`);
            return prevReaders.filter(r => r.id !== readerId);
          }
          
          return prevReaders;
        });
      } 
      // Fall back to ID-only handling if no reader data provided
      else if (readerId) {
        console.log(`WebSocket: Received status update for reader ID ${readerId}: ${status}`);
        
        // Update by ID (find reader in local state)
        const existingReader = readers.find(r => r.id === readerId);
        if (!existingReader) {
          console.warn(`Cannot update reader ${readerId} - not found in local state`);
          return;
        }
        
        // Update readers list
        setReaders(prevReaders => {
          if (status === 'online') {
            const readerIndex = prevReaders.findIndex(r => r.id === readerId);
            if (readerIndex === -1) {
              // Add to list if online
              return [...prevReaders, {...existingReader, isOnline: true}];
            } else {
              // Update status if already in list
              return prevReaders.map(r => 
                r.id === readerId ? {...r, isOnline: true} : r
              );
            }
          } else {
            // Remove from list if offline
            return prevReaders.filter(r => r.id !== readerId);
          }
        });
      }
    }
  }, [websocket.lastMessage, readers]);
  
  // Filter online readers - add debug logs
  console.log("All readers data:", readers);
  const onlineReaders = readers.filter(reader => {
    console.log(`Reader ${reader.username} isOnline status:`, reader.isOnline);
    return reader.isOnline;
  });
  
  return (
    <div className="mb-14">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-alex text-secondary">Online Now</h2>
        <Link href={PATHS.READERS} className="text-accent hover:text-accent-dark transition duration-300 flex items-center font-playfair text-sm">
          View All
          <ArrowRightIcon className="ml-1 h-3 w-3" />
        </Link>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, index) => (
            <GlowCard key={index} className="p-4">
              <Skeleton className="h-32 w-full rounded-lg mb-3" />
              <Skeleton className="h-5 w-24 mb-1" />
              <Skeleton className="h-3 w-16 mb-1" />
              <div className="flex gap-1 mb-2">
                <Skeleton className="h-4 w-14 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-6 w-full mb-1" />
              <div className="flex space-x-1">
                <Skeleton className="h-8 flex-1 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </GlowCard>
          ))}
        </div>
      ) : onlineReaders.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {onlineReaders.slice(0, 4).map((reader) => (
            <ReaderCard key={reader.id} reader={reader} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <GlowCard className="p-5 max-w-md mx-auto">
            <p className="text-light/80 font-playfair text-base mb-1">No readers are online at the moment.</p>
            <p className="text-light/60 font-playfair text-sm mb-3">Check back later or browse all our talented psychics.</p>
            <Link href={PATHS.READERS}>
              <button className="text-accent underline hover:text-accent-dark transition-colors font-playfair text-sm">
                View All Readers
              </button>
            </Link>
          </GlowCard>
        </div>
      )}
    </div>
  );
}
