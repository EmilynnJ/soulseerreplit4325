import { useState, useEffect, useRef } from 'react';
import { useWebSocketContext } from '@/hooks/websocket-provider';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SendHorizontal, AlertCircle, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  message: string;
  timestamp: number;
  roomId?: string;
}

interface ChatRoomProps {
  roomId: string;
  title?: string;
  recipientId?: number;
  onClose?: () => void;
  className?: string;
}

export function ChatRoom({ roomId, title, recipientId, onClose, className }: ChatRoomProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { status, sendMessage, lastMessage, reconnect } = useWebSocketContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Generate a unique message ID
  const generateMessageId = () => {
    return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  };
  
  // Subscribe to the room when component mounts
  useEffect(() => {
    if (status === 'open' && user) {
      console.log(`Subscribing to chat room: ${roomId}`);
      sendMessage({
        type: 'subscribe',
        channel: `chat_${roomId}`
      });
      
      // Send a system message to indicate connection
      setMessages(prev => [
        ...prev,
        {
          id: generateMessageId(),
          senderId: 0, // 0 for system messages
          senderName: 'System',
          message: 'Connected to chat room.',
          timestamp: Date.now(),
          roomId
        }
      ]);
    }
  }, [status, user, roomId, sendMessage]);
  
  // Process incoming messages
  useEffect(() => {
    if (!lastMessage || !user) return;
    
    try {
      // Handle message types related to chat
      if (typeof lastMessage === 'object' && 
          (lastMessage.type === 'chat_message' || lastMessage.type === 'message') && 
          (lastMessage.roomId === roomId || !lastMessage.roomId)) {
        
        // Check for duplicate messages (sometimes WebSocket can deliver messages multiple times)
        const isDuplicate = messages.some(msg => 
          msg.message === lastMessage.message && 
          msg.senderId === lastMessage.senderId &&
          Math.abs(msg.timestamp - lastMessage.timestamp) < 5000 // Within 5 seconds
        );
        
        if (!isDuplicate) {
          const newMsg: ChatMessage = {
            id: lastMessage.id || generateMessageId(),
            senderId: lastMessage.senderId,
            senderName: lastMessage.senderName,
            message: lastMessage.message,
            timestamp: lastMessage.timestamp || Date.now(),
            roomId
          };
          
          setMessages(prev => [...prev, newMsg]);
        }
      }
      
      // Handle connection status changes
      if (lastMessage.type === 'connection_status' && lastMessage.status) {
        toast({
          title: `User ${lastMessage.status === 'online' ? 'Online' : 'Offline'}`,
          description: `${lastMessage.userName} is now ${lastMessage.status}`,
          variant: lastMessage.status === 'online' ? 'default' : 'secondary',
        });
      }
    } catch (error) {
      console.error('Error processing chat message:', error);
    }
  }, [lastMessage, user, messages, roomId, toast]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Format message timestamp
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };
  
  // Handle sending a new message
  const handleSendMessage = () => {
    if (!newMessage.trim() || !user || status !== 'open') return;
    
    // Create the message object
    const messageObj = {
      type: 'chat_message',
      id: generateMessageId(),
      senderId: user.id,
      senderName: user.fullName || user.username,
      recipientId: recipientId, // Optional, for direct messages
      roomId,
      message: newMessage.trim(),
      timestamp: Date.now()
    };
    
    // Send via WebSocket
    sendMessage(messageObj);
    
    // Add to local state immediately for responsive UI
    setMessages(prev => [
      ...prev,
      {
        id: messageObj.id,
        senderId: user.id,
        senderName: user.fullName || user.username,
        message: newMessage.trim(),
        timestamp: Date.now(),
        roomId
      }
    ]);
    
    // Clear input
    setNewMessage('');
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };
  
  // Get initial messages
  const getInitialMessages = async () => {
    // This would typically fetch previous messages from an API
    // For now, we'll just use the WebSocket connection
    setIsLoading(true);
    
    try {
      // Request message history through WebSocket
      sendMessage({
        type: 'get_message_history',
        roomId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error getting message history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat history. Try reconnecting.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Connection status indicator
  const ConnectionStatus = () => {
    if (status === 'connecting') {
      return (
        <div className="flex items-center text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Connecting...
        </div>
      );
    }
    
    if (status === 'error' || status === 'closed') {
      return (
        <div className="flex items-center text-xs text-destructive cursor-pointer" onClick={reconnect}>
          <AlertCircle className="h-3 w-3 mr-1" />
          Disconnected (click to reconnect)
        </div>
      );
    }
    
    return (
      <div className="flex items-center text-xs text-green-500">
        <div className="h-2 w-2 rounded-full bg-green-500 mr-1"></div>
        Connected
      </div>
    );
  };
  
  return (
    <Card className={`flex flex-col ${className || 'w-full max-w-md h-[500px]'}`}>
      <CardHeader className="p-4 pb-2 flex-shrink-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{title || `Chat Room: ${roomId}`}</CardTitle>
          <ConnectionStatus />
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pb-0 flex-grow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full py-8 text-muted-foreground text-center">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex ${msg.senderId === user?.id ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 max-w-[80%]`}>
                      {msg.senderId !== 0 && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{msg.senderName[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      
                      <div className="flex flex-col gap-1">
                        <div 
                          className={`px-3 py-2 rounded-lg ${
                            msg.senderId === 0
                              ? 'bg-muted text-muted-foreground text-sm italic'
                              : msg.senderId === user?.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          {msg.message}
                        </div>
                        
                        <div className={`text-xs text-muted-foreground ${msg.senderId === user?.id ? 'text-right' : 'text-left'}`}>
                          {msg.senderId !== 0 && `${msg.senderId === user?.id ? 'You' : msg.senderName} • `}
                          {formatTimestamp(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-2 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 w-full">
          <Input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={status !== 'open'}
            className="flex-grow"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={status !== 'open' || !newMessage.trim()}
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}