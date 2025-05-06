// c:\Users\emily\soulseerreplit4325-1\frontend\src\contexts\SocketContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { currentUser } = useAuth(); // To potentially send auth token with connection

  const connectSocket = useCallback(() => {
    // Ensure environment variable is set for WebSocket URL
    const VITE_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    
    // Potentially pass auth token as a query parameter if your backend expects it
    // const token = localStorage.getItem('appwrite-session'); // Or your custom JWT
    // const wsUrl = token ? `${VITE_WS_URL}?token=${token}` : VITE_WS_URL;
    const wsUrl = VITE_WS_URL; // Simpler for now

    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    newSocket.onmessage = (event) => {
      console.log('WebSocket Message:', event.data);
      // Handle incoming messages, perhaps parse JSON and dispatch actions/update state
    };

    newSocket.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      setSocket(null); // Clear socket state
      // Optional: implement reconnection logic here
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    setSocket(newSocket);
  }, [currentUser]); // Reconnect if user changes, to potentially update auth token

  useEffect(() => {
    if (currentUser && !socket) { // Connect if user is logged in and socket isn't already up
      // connectSocket(); // Decide when to connect, e.g. on login, or always
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket, currentUser, connectSocket]);

  const sendMessage = (message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.error('Socket not connected or not ready.');
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, sendMessage, connectSocket }}>
      {children}
    </SocketContext.Provider>
  );
