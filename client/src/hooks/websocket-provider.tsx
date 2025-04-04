import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import env from '@/lib/env';

type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

interface WebSocketContextType {
  status: WebSocketStatus;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketMessage | string) => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const { user } = useAuth();
  
  // Create WebSocket connection
  const createWebSocketConnection = useCallback(() => {
    // Don't create a connection if WebSockets are disabled via environment
    if (!env.ENABLE_WEBSOCKET) {
      console.log('WebSockets are disabled via environment settings');
      setStatus('closed');
      return null;
    }
    
    if (!user) {
      return null;
    }
    
    try {
      // Check if WebSocket is available in this environment
      if (typeof WebSocket === 'undefined') {
        console.log('WebSocketProvider not available, using fallback');
        setStatus('error');
        return null;
      }
      
      // Always use secure WebSocket on Render and production
      const protocol = env.IS_PRODUCTION ? 'wss:' : (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
      const host = window.location.host;
      
      // Use the configured WebSocket URL if available, otherwise construct from current host
      const wsUrl = env.WEBSOCKET_URL || `${protocol}//${host}/ws`;
      
      // Ensure secure WebSocket for soulseer.app and onrender.com domains
      const adjustedWsUrl = (host.includes('soulseer.app') || host.includes('onrender.com') || host.includes('render.com')) 
        ? `wss://${host}/ws`
        : wsUrl;
      
      console.log(`Creating WebSocket connection to ${adjustedWsUrl}`);
      setStatus('connecting');
      
      // Create a new socket with error handling
      let newSocket: WebSocket;
      try {
        newSocket = new WebSocket(adjustedWsUrl);
      } catch (socketError) {
        console.error('Failed to create WebSocket instance:', socketError);
        setStatus('error');
        return null;
      }
      
      newSocket.onopen = () => {
        console.log('WebSocket connection established');
        setStatus('open');
        
        if (!user.id) {
          console.warn('User ID not available for WebSocket authentication');
          return;
        }
        
        // Authenticate with the server
        try {
          // Get the session token from the cookie
          const cookies = document.cookie.split(';');
          const sessionCookie = cookies.find(c => c.trim().startsWith('connect.sid='));
          const sessionToken = sessionCookie ? sessionCookie.split('=')[1] : null;

          newSocket.send(JSON.stringify({
            type: 'authenticate',
            userId: user.id,
            authToken: sessionToken
          }));
          
          // Start ping interval to keep connection alive
          const pingInterval = setInterval(() => {
            if (newSocket.readyState === WebSocket.OPEN) {
              try {
                newSocket.send(JSON.stringify({ type: 'ping' }));
              } catch (pingError) {
                console.error('Error sending ping:', pingError);
              }
            }
          }, 30000);
          
          // Store the interval ID on the socket to clear it later
          (newSocket as any).pingInterval = pingInterval;
        } catch (authError) {
          console.error('Error during WebSocket authentication:', authError);
        }
      };
      
      newSocket.onmessage = (event) => {
        try {
          // Parse JSON messages
          if (typeof event.data === 'string') {
            if (event.data === 'pong') {
              // Handle pong response
              console.log('Received pong response');
              return;
            }
            try {
              const data = JSON.parse(event.data);
              if (typeof data === 'object' && data !== null && 'type' in data) {
                setLastMessage(data as WebSocketMessage);
              } else {
                console.warn('Received malformed WebSocket message:', data);
              }
            } catch (parseError) {
              console.error('Error parsing WebSocket message:', parseError);
            }
          } else {
            console.warn('Received non-string WebSocket message:', event.data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          setLastMessage(event.data);
        }
      };
      
      newSocket.onclose = () => {
        console.log('WebSocket connection closed');
        setStatus('closed');
        clearInterval((newSocket as any).pingInterval);
      };
      
      newSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('error');
      };
      
      return newSocket;
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setStatus('error');
      return null;
    }
  }, [user]);
  
  // Function to safely close a socket
  const closeSocket = useCallback((socketToClose: WebSocket | null) => {
    if (!socketToClose) return;
    try {
      clearInterval((socketToClose as any).pingInterval);
      if (socketToClose.readyState === WebSocket.OPEN) {
        socketToClose.close();
      }
    } catch (err) {
      console.error('Error closing socket:', err);
    }
  }, []);
  
  // Function to handle reconnection
  const handleReconnect = useCallback(() => {
    closeSocket(socket);
    const newSocket = createWebSocketConnection();
    if (newSocket) {
      setSocket(newSocket);
    }
  }, [socket, closeSocket, createWebSocketConnection]);
  
  // Initialize WebSocket when user is authenticated
  useEffect(() => {
    if (user && (!socket || socket.readyState === WebSocket.CLOSED)) {
      const newSocket = createWebSocketConnection();
      if (newSocket) {
        setSocket(newSocket);
      }
    }
    
    return () => {
      closeSocket(socket);
    };
  }, [user, socket, createWebSocketConnection, closeSocket]);
  
  // Public reconnect function for the context
  const reconnect = useCallback(() => {
    handleReconnect();
  }, [handleReconnect]);
  
  // Send message through WebSocket with error handling
  const sendMessage = useCallback((message: WebSocketMessage | string) => {
    if (!env.ENABLE_WEBSOCKET) {
      console.warn('WebSockets are disabled, message not sent');
      return;
    }
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        socket.send(messageStr);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      console.warn('Cannot send message, WebSocket not connected (state:', socket?.readyState, ')');
    }
  }, [socket]);
  
  // Create value object to pass to context
  const contextValue = {
    status,
    lastMessage,
    sendMessage,
    reconnect
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}