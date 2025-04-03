import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

// WebSocket connection status
type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

// WebSocket context interface
interface WebSocketContextType {
  status: WebSocketStatus;
  sendMessage: (message: any) => void;
  lastMessage: any;
  reconnect: () => void;
}

// Create the context
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Provider component
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // Start with 3 seconds

  // Function to establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Clear any existing reconnect timeouts
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear ping intervals
    if (pingIntervalRef.current) {
      window.clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    try {
      setStatus('connecting');

      // Create WebSocket with correct protocol and URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostname = window.location.hostname;
      const port = window.location.port;
      const wsUrl = `${protocol}//${hostname}${port ? ':' + port : ''}/ws`;

      // Create new WebSocket connection
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      // Connection opened
      socket.addEventListener('open', () => {
        console.log('WebSocket connection established');
        setStatus('open');
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection

        // Set up ping interval to keep connection alive
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            // Send a ping message
            socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 30000); // 30 seconds

        // If user is logged in, send authentication
        if (user) {
          socket.send(JSON.stringify({
            type: 'auth',
            userId: user.id,
            username: user.username
          }));
        }
      });

      // Listen for messages
      socket.addEventListener('message', (event) => {
        try {
          // Parse message (assuming JSON format)
          const message = JSON.parse(event.data);

          // Skip processing ping responses
          if (message.type === 'pong') {
            return;
          }

          // Handle system events
          if (message.type === 'system') {
            toast({
              title: message.title || 'System Message',
              description: message.message,
              variant: message.variant || 'default',
            });
            return;
          }

          // Handle errors
          if (message.type === 'error') {
            toast({
              title: 'Error',
              description: message.message,
              variant: 'destructive',
            });
            return;
          }

          // Update state with received message for consumer components
          setLastMessage(message);
        } catch (error) {
          console.error('Error processing WebSocket message:', error, event.data);
        }
      });

      // Handle socket closing
      socket.addEventListener('close', (event) => {
        if (event.wasClean) {
          console.log(`WebSocket connection closed cleanly, code=${event.code}, reason=${event.reason}`);
        } else {
          console.error('WebSocket connection died');
        }

        setStatus('closed');

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(reconnectDelay * Math.pow(1.5, reconnectAttemptsRef.current), 60000);
          console.log(`Reconnecting in ${delay / 1000} seconds (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectWebSocket();
          }, delay);
        } else {
          console.error('Maximum reconnection attempts reached');
          toast({
            title: 'Connection Failed',
            description: 'Cannot connect to chat server. Please refresh the page to try again.',
            variant: 'destructive',
          });
        }
      });

      // Handle socket errors
      socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        setStatus('error');
      });
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      setStatus('error');
    }
  }, [toast, user]);

  // Function to send a message
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const stringifiedMessage = typeof message === 'string' ? message : JSON.stringify(message);
      socketRef.current.send(stringifiedMessage);
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
      toast({
        title: 'Connection Error',
        description: 'Cannot send message: Not connected to server',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    connectWebSocket();
  }, [connectWebSocket]);

  // Connect when the component mounts
  useEffect(() => {
    connectWebSocket();

    // Cleanup function
    return () => {
      // Close the WebSocket connection
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      // Clear any timers
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (pingIntervalRef.current) {
        window.clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Reconnect when user auth changes
  useEffect(() => {
    if (user && status === 'open' && socketRef.current?.readyState === WebSocket.OPEN) {
      // Send authentication message
      sendMessage({
        type: 'auth',
        userId: user.id,
        username: user.username
      });
    }
  }, [user, status, sendMessage]);

  // Create the context value
  const contextValue = {
    status,
    sendMessage,
    lastMessage,
    reconnect,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Custom hook to use the WebSocket context
export function useWebSocketContext(): WebSocketContextType {
  const context = useContext(WebSocketContext);

  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }

  return context;
}