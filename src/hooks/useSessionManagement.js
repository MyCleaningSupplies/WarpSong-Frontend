// src/hooks/useSessionManagement.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as Tone from 'tone';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
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
      if (!token) throw new Error('No authentication token found.');
      const response = await api.post('/api/remix/create', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newSessionCode = response.data.sessionCode;
      if (!newSessionCode) throw new Error('No session code returned from API');

      setSessionCode(newSessionCode);
      setIsInSession(true);
      setError(null);

      if (socket?.connected) {
        socket.emit('join-session', { 
          sessionCode: newSessionCode,
          userId: socket.id 
        });
        setShowReadyModal(true);
      } else {
        throw new Error('Socket not connected');
      }
      return newSessionCode;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      console.error('❌ Error creating session:', errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [socket]);

  // Join an existing session using POST /api/remix/join
  const joinSession = useCallback(async (code) => {
    try {
      if (!code) throw new Error('No session code provided');
      const token = localStorage.getItem("token");
      if (!token) throw new Error('No authentication token found');

      const response = await api.post('/api/remix/join', { sessionCode: code }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("✅ Joined session:", response.data);

      socket.emit("join-session", { sessionCode: code, userId: socket.id });
      setSessionCode(code);
      setIsInSession(true);
      setShowReadyModal(true);
      setError(null);

      // Optionally, update connected users from API response
      const normalizeUser = (u) =>
        typeof u === "object" && u._id ? u._id.toString() : u.toString();
      setConnectedUsers(response.data.users.map(normalizeUser));

      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      console.error('❌ Failed to join session:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [socket]);

  // "I'm Ready!" handler
  const setUserReady = useCallback(async () => {
    if (!socket?.connected || !sessionCode) {
      setError('Socket not connected or session not active');
      return;
    }
    await Tone.start();
    if (Tone.context.state !== 'running') await Tone.context.resume();
    socket.emit('user-ready', { sessionCode, userId: socket.id });
    setShowReadyModal(false);
  }, [socket, sessionCode]);

  // Leave session
  const leaveSession = useCallback(() => {
    if (socket?.connected && sessionCode) {
      socket.emit('leave-session', { sessionCode, userId: socket.id });
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

    const handleUserJoined = ({ userId, users }) => {
      console.log(`✅ User ${userId} joined the session`);
      // Overwrite with the full list received from the server
      setConnectedUsers(users);
    };

    const handleUserLeft = ({ userId, users }) => {
      console.log(`👋 User ${userId} left the session`);
      setConnectedUsers(users);
      setReadyUsers((prev) => prev.filter((id) => id !== userId));
    };

    const handleUserReadyUpdate = ({ readyUsers: updated }) => {
      console.log('✅ Ready users:', updated);
      setReadyUsers(updated);
      setAllUsersReady(connectedUsers.length > 0 && updated.length === connectedUsers.length);
    };

    const handleStemSelected = ({ userId, stemId, stemType, stem }) => {
      console.log("Stem selected from user:", userId, stemId, stemType);
      // Call the stemManagement handler with isRemote = true
      if (stemManagement && stemManagement.handleStemSelection) {
        stemManagement.handleStemSelection(stem, stemType, true);
      }
    };

    const handlers = {
      'user-joined': handleUserJoined,
      'user-left': handleUserLeft,
      'user-ready-update': handleUserReadyUpdate,
      'stem-selected': handleStemSelected,
      'connect': () => console.log('✅ Socket connected'),
      'disconnect': () => {
        console.log('❌ Socket disconnected');
        setError('Connection lost');
      },
      'connect_error': (err) => {
        console.error('❌ Socket connection error:', err);
        setError('Connection error');
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach((event) => {
        socket.off(event);
      });
    };
  }, [socket, connectedUsers, stemManagement]);

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
  };
}