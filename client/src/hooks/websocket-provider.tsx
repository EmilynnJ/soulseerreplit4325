import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';

type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

interface WebSocketContextType {
  status: WebSocketStatus;
  lastMessage: any;
  sendMessage: (message: any) => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>('closed');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const { user } = useAuth();
  
  // Create WebSocket connection
  const createWebSocketConnection = useCallback(() => {
    if (!user) {
      return null;
    }
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`Creating WebSocket connection to ${wsUrl}`);
      setStatus('connecting');
      
      const newSocket = new WebSocket(wsUrl);
      
      newSocket.onopen = () => {
        console.log('WebSocket connection established');
        setStatus('open');
        
        // Authenticate with the server
        newSocket.send(JSON.stringify({
          type: 'authenticate',
          userId: user.id,
          authToken: 'session-token' // In a real app, you'd use a proper token
        }));
        
        // Start ping interval to keep connection alive
        const pingInterval = setInterval(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            newSocket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
        
        // Store the interval ID on the socket to clear it later
        (newSocket as any).pingInterval = pingInterval;
      };
      
      newSocket.onmessage = (event) => {
        try {
          // Parse JSON messages
          if (typeof event.data === 'string' && event.data !== 'pong') {
            const data = JSON.parse(event.data);
            setLastMessage(data);
          } else {
            setLastMessage(event.data);
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
  
  // Initialize WebSocket when user is authenticated
  useEffect(() => {
    if (user && (!socket || socket.readyState === WebSocket.CLOSED)) {
      const newSocket = createWebSocketConnection();
      if (newSocket) {
        setSocket(newSocket);
      }
    }
    
    return () => {
      if (socket) {
        clearInterval((socket as any).pingInterval);
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      }
    };
  }, [user, socket, createWebSocketConnection]);
  
  // Send message through WebSocket
  const sendMessage = useCallback((message: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      socket.send(messageStr);
    } else {
      console.warn('Cannot send message, WebSocket not connected');
    }
  }, [socket]);
  
  // Reconnect WebSocket
  const reconnect = useCallback(() => {
    if (socket) {
      clearInterval((socket as any).pingInterval);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    }
    
    const newSocket = createWebSocketConnection();
    if (newSocket) {
      setSocket(newSocket);
    }
  }, [socket, createWebSocketConnection]);
  
  return (
    <WebSocketContext.Provider value={{ status, lastMessage, sendMessage, reconnect }}>
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