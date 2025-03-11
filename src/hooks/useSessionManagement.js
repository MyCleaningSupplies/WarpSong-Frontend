import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as Tone from 'tone';
import { API_BASE_URL } from '../config/api';
import { normalizeId } from './useAudioEngine';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default function useSessionManagement({ socket, audioEngine, stemManagement }) {
  const [isInSession, setIsInSession] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [readyUsers, setReadyUsers] = useState([]);
  const [allUsersReady, setAllUsersReady] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [error, setError] = useState(null);

  // Create a new session
  const createSessionHandler = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error('No authentication token found. Please log in first.');
      }

      const response = await api.post('/api/remix/create', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const sessionId = response.data.sessionCode;
      if (!sessionId) {
        throw new Error('No session code returned from API');
      }

      console.log(`✅ Session created with code: ${sessionId}`);
      setSessionCode(sessionId);
      setIsInSession(true);
      setError(null);

      if (socket?.connected) {
        socket.emit('join-session', { 
          sessionId,
          userId: socket.id 
        });
        setShowReadyModal(true);
      } else {
        throw new Error('Socket not connected');
      }

      return sessionId;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error('❌ Error creating session:', errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [socket]);

  // Join an existing session
  const joinSession = useCallback(async (code) => {
    try {
      if (!code) {
        throw new Error('No session code provided');
      }
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error('No authentication token found');
      }
      // Use POST to the /join endpoint
      const response = await api.post(
        '/api/remix/join',
        { sessionCode: code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("✅ Joined session:", response.data);
      socket.emit("join-session", { sessionCode: code, userId: socket.id });
      setSessionCode(code);
      setIsInSession(true);
  
      const normalizeUser = (user) =>
        typeof user === "object" && user._id ? user._id.toString() : user.toString();
      setConnectedUsers(response.data.users.map(normalizeUser));
      setShowReadyModal(true);
      return true;
    } catch (error) {
      console.error("❌ Failed to join session:", error);
      setError(error.response?.data?.message || error.message);
      return false;
    }
  }, [socket]);

  // Initialize audio context
  const ensureAudioInitialized = useCallback(async () => {
    try {
      if (!audioEngine.audioInitialized) {
        await Tone.start();
        
        if (Tone.context.state !== 'running') {
          await Tone.context.resume();
        }
        
        if (Tone.Transport.state !== 'started') {
          Tone.Transport.start();
        }
      }
      return true;
    } catch (error) {
      console.error('❌ Error initializing audio:', error);
      setError('Failed to initialize audio context');
      return false;
    }
  }, [audioEngine.audioInitialized]);

  // Set user ready state
  const setUserReady = useCallback(() => {
    if (!socket?.connected || !sessionCode) {
      setError('Socket not connected or session not active');
      return;
    }
    
    socket.emit('user-ready', { 
      sessionId: sessionCode,
      userId: socket.id 
    });
    setShowReadyModal(false);
  }, [socket, sessionCode]);

  // Leave session
  const leaveSession = useCallback(() => {
    if (socket?.connected && sessionCode) {
      socket.emit('leave-session', { 
        sessionId: sessionCode,
        userId: socket.id 
      });
    }
    
    setSessionCode('');
    setIsInSession(false);
    setConnectedUsers([]);
    setReadyUsers([]);
    setAllUsersReady(false);
    setError(null);
  }, [socket, sessionCode]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
  
    const handlers = {
      'user-joined': ({ userId }) => {
        console.log(`✅ User ${userId} joined the session`);
        setConnectedUsers((prev) => 
          prev.includes(userId) ? prev : [...prev, userId]
        );
      },
      'user-left': ({ userId }) => {
        console.log(`👋 User ${userId} left the session`);
        setConnectedUsers((prev) => prev.filter((id) => id !== userId));
        setReadyUsers((prev) => prev.filter((id) => id !== userId));
      },
      'user-ready-update': ({ readyUsers: updatedReadyUsers }) => {
        console.log('✅ Ready users:', updatedReadyUsers);
        setReadyUsers(updatedReadyUsers);
        setAllUsersReady(
          connectedUsers.length > 0 && 
          updatedReadyUsers.length === connectedUsers.length
        );
      },
      'session-started': () => {
        console.log('🎵 Session started!');
        setShowReadyModal(false);
      },
      'connect': () => {
        console.log('✅ Socket connected');
      },
      'disconnect': () => {
        console.log('❌ Socket disconnected');
        setError('Connection lost');
      },
      'connect_error': (error) => {
        console.error('❌ Socket connection error:', error);
        setError('Connection error');
      }
    };
  
    // Register all event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });
  
    // Cleanup: remove handlers when the component unmounts
    return () => {
      Object.keys(handlers).forEach((event) => {
        socket.off(event);
      });
    };
  }, [socket, connectedUsers]);

  return {
    isInSession,
    setIsInSession,
    sessionCode,
    setSessionCode,
    connectedUsers,
    readyUsers,
    allUsersReady,
    showReadyModal,
    error,
    setShowReadyModal,
    createSessionHandler,
    joinSession,
    leaveSession,
    setUserReady,
    ensureAudioInitialized
  };
}
