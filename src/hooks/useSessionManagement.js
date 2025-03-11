import { useState, useEffect } from 'react';
import axios from 'axios';
import * as Tone from 'tone';
import { API_BASE_URL } from '../config/api';
import { normalizeId } from './useAudioEngine';

export default function useSessionManagement({ socket, audioEngine, stemManagement }) {
  const [isInSession, setIsInSession] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [readyUsers, setReadyUsers] = useState([]);
  const [allUsersReady, setAllUsersReady] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  
  // Reference to the current stems from stemManagement
  const { stemMapRef, currentStems, setCurrentStems } = stemManagement;

  // Create a new session
  const createSessionHandler = async () => {
    try {
      // Get the authentication token from localStorage
      const token = localStorage.getItem("token");
      
      if (!token) {
        console.error('❌ No authentication token found. Please log in first.');
        return null;
      }
      
      // Make the API call with the token in the headers
      const response = await axios.post(`${API_BASE_URL}/api/remix/create`, {}, {
        headers: { 
          Authorization: `Bearer ${token}`
        }
      });
      
      // Log the entire response to debug
      console.log('API Response:', response.data);
      
      // The API is returning sessionCode instead of sessionId
      const sessionId = response.data.sessionCode;
      
      if (!sessionId) {
        console.error('❌ No session code returned from API:', response.data);
        return null;
      }
      
      console.log(`✅ Session created with code: ${sessionId}`);
      setSessionCode(sessionId);
      console.log(`✅ Session code state updated to: ${sessionId}`);
      setIsInSession(true);
      
      // Join the socket room
      if (socket) {
        socket.emit('join-session', { sessionId });
        
        // Show the ready modal after creating a session too
        setShowReadyModal(true);
      }
      
      return sessionId;
    } catch (error) {
      console.error('❌ Error creating session: ', error);
      
      // Check if it's an authentication error
      if (error.response && error.response.status === 401) {
        console.error('Authentication failed. Please log in again.');
        // You might want to redirect to login page here
      }
      
      return null;
    }
  };

  // Join an existing session
  const joinSession = async (code) => {
    try {
      if (!code) {
        console.error('❌ No session code provided');
        return false;
      }
      
      // Get the authentication token
      const token = localStorage.getItem("token");
      
      // Validate the session code with authentication
      const response = await axios.get(`${API_BASE_URL}/api/remix/validate/${code}`, {
        headers: { 
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.valid) {
        console.log(`✅ Joining session: ${code}`);
        setSessionCode(code);
        setIsInSession(true);
        
        // Join the socket room
        if (socket) {
          socket.emit('join-session', { sessionId: code });
        }
        
        // Show the ready modal
        setShowReadyModal(true);
        
        return true;
      } else {
        console.error('❌ Invalid session code');
        return false;
      }
    } catch (error) {
      console.error('❌ Error joining session: ', error);
      return false;
    }
  };

  // Ensure audio is initialized before starting the session
  const ensureAudioInitialized = async () => {
    if (!audioEngine.audioInitialized) {
      try {
        // Initialize Tone.js if not already done
        await Tone.start();
        
        // Create a context if it doesn't exist
        if (!Tone.context.state || Tone.context.state === 'suspended') {
          await Tone.context.resume();
        }
        
        // Set up the transport
        if (!Tone.Transport.state || Tone.Transport.state === 'stopped') {
          Tone.Transport.start();
        }
        
        return true;
      } catch (error) {
        console.error('❌ Error initializing audio:', error);
        return false;
      }
    }
    return true;
  };

  // Handle user ready state
  const setUserReady = () => {
    if (!socket || !sessionCode) {
      console.error('❌ Socket not connected or not in session');
      return;
    }
    
    socket.emit('user-ready', { sessionId: sessionCode });
    setShowReadyModal(false);
  };

  // Leave the current session
  const leaveSession = () => {
    if (socket && sessionCode) {
      socket.emit('leave-session', { sessionId: sessionCode });
    }
    
    setSessionCode('');
    setIsInSession(false);
    setConnectedUsers([]);
    setReadyUsers([]);
    setAllUsersReady(false);
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
    
    // User joined event
    socket.on('user-joined', ({ users }) => {
      console.log('👤 User joined, updated users:', users);
      setConnectedUsers(users);
    });
    
    // User left event
    socket.on('user-left', ({ users }) => {
      console.log('👋 User left, updated users:', users);
      setConnectedUsers(users);
      setReadyUsers(prev => prev.filter(id => users.some(u => u.id === id)));
    });
    
    // User ready event
    socket.on('user-ready-update', ({ readyUsers: updatedReadyUsers }) => {
      console.log('✅ Ready users updated:', updatedReadyUsers);
      setReadyUsers(updatedReadyUsers);
      
      // Check if all users are ready
      if (connectedUsers.length > 0 && updatedReadyUsers.length === connectedUsers.length) {
        setAllUsersReady(true);
      } else {
        setAllUsersReady(false);
      }
    });
    
    // Session started event
    socket.on('session-started', () => {
      console.log('🎵 Session started!');
      setShowReadyModal(false);
    });
    
    return () => {
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('user-ready-update');
      socket.off('session-started');
    };
  }, [socket, connectedUsers]);

  // Make sure the return object includes sessionCode
  return {
    isInSession,
    sessionCode,  // Ensure this is included
    connectedUsers,
    readyUsers,
    allUsersReady,
    showReadyModal,
    setShowReadyModal,
    createSessionHandler,
    joinSession,
    leaveSession,
    setUserReady,
    ensureAudioInitialized
  };
}
