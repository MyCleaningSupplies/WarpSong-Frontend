import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/api';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Create socket connection
    const socketInstance = io(SOCKET_URL);
    
    socketInstance.on('connect', () => {
      console.log('✅ Socket connected');
    });
    
    socketInstance.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });
    
    setSocket(socketInstance);
    
    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);
  
  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
