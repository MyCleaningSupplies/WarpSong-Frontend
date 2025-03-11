import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export default function useSessionManagement({ socket, audioEngine, stemManagement }) {
  const [isInSession, setIsInSession] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [readyUsers, setReadyUsers] = useState([]);
  const [allUsersReady, setAllUsersReady] = useState(false);

  // Create a new session
  const createSessionHandler = async () => {
    try {
      // Use API_BASE_URL instead of hardcoded localhost URL
      const response = await axios.post(`${API_BASE_URL}/api/remix/create`);
      const { sessionId } = response.data;
      
      console.log(`✅ Session created with ID: ${sessionId}`);
      setSessionCode(sessionId);
      setIsInSession(true);
      
      // Join the socket room
      if (socket) {
        socket.emit('join-session', { sessionId });
      }
      
      return sessionId;
    } catch (error) {
      console.error('❌ Error creating session: ', error);
      return null;
    }
  };

  // Join an existing session
  const joinSession = async (code) => {
    if (sessionCode.length !== 4) {
      console.error("Session code must be 4 characters");
      return;
    }
    try {
      const response = await axios.post(
        "http://localhost:3001/api/remix/join",
        { sessionCode },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      console.log("✅ Joined session:", response.data);
      socket.emit("join-session", { sessionCode, userId: socket.id });
      setIsInSession(true);

      const normalizeUser = (user) =>
        typeof user === "object" && user._id ? user._id.toString() : user.toString();
      setConnectedUsers(response.data.users.map(normalizeUser));

      if (response.data.stems?.length > 0) {
        response.data.stems.forEach(({ stem, type }) => {
          const stemObj = stemMapRef.current[normalizeId(stem.identifier)];
          if (stemObj) {
            setCurrentStems((prev) => ({ ...prev, [type]: stemObj }));
          }
        });
      }
      setShowReadyModal(true);
    } catch (error) {
      console.error("❌ Failed to join session:", error);
    }
  };

  const handleReadyClick = async () => {
    try {
      // Start Tone.js audio context
      await Tone.start();
      console.log("✅ Tone.js AudioContext started:", Tone.context.state);

      // Ensure it's running
      if (Tone.context.state !== "running") {
        await Tone.context.resume();
      }

      // Initialize transport settings immediately
      Tone.Transport.bpm.value = audioEngine.bpm;

      //Ensure audio context was initialized
      const initialized = await ensureAudioInitialized();
      if (!initialized) {
        console.error("Could not initialize audio");
        return false;
      }

      // Notify server that user is ready
      if (socket && isInSession) {
        socket.emit("user-ready", { sessionCode, userId: socket.id });
        setReadyUsers((prev) => {
          const newReadyUsers = [...prev, socket.id];
          const allReady = newReadyUsers.length >= connectedUsers.length;
          setAllUsersReady(allReady);
          return newReadyUsers;
        });
      }
    } catch (error) {
      console.error("❌ Error initializing audio:", error);

      // Even if there's an error, mark as initialized so the UI can proceed
      audioEngine.setAudioInitialized(true);

      if (socket && isInSession) {
        socket.emit("user-ready", { sessionCode, userId: socket.id });
        setReadyUsers((prev) => {
          const newReadyUsers = [...prev, socket.id];
          const allReady = newReadyUsers.length >= connectedUsers.length;
          setAllUsersReady(allReady);
          return newReadyUsers;
        });
      }
    }
  };

  const leaveSession = () => {
    if (socket && isInSession) socket.emit("leave-session", { sessionCode });
    setIsInSession(false);
    setSessionCode("");
    setConnectedUsers([]);
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
    
    socket.on("user-ready", ({ userId }) => {
      console.log(`✅ User ${userId} is ready`);
      setReadyUsers((prev) => {
        if (prev.includes(userId)) return prev;
        const newReadyUsers = [...prev, userId];
        const allReady = newReadyUsers.length >= connectedUsers.length;
        setAllUsersReady(allReady);
        return newReadyUsers;
      });
    });

    socket.on("user-joined", ({ userId }) => {
      console.log(`✅ User ${userId} joined the session`);
      setConnectedUsers((prev) => {
        const newUsers = [...prev, userId];
        const allReady = newUsers.every(
          (user) => readyUsers.includes(user) || user === socket.id
        );
        setAllUsersReady(allReady);
        return newUsers;
      });
    });

    socket.on("user-left", (userId) => {
      console.log(`👋 User ${userId} left the session`);
      setConnectedUsers((prev) => {
        const newUsers = prev.filter((id) => id !== userId);
        const allReady = newUsers.every(
          (user) => readyUsers.includes(user) || user === socket.id
        );
        setAllUsersReady(allReady);
        return newUsers;
      });
      setReadyUsers((prev) => prev.filter((id) => id !== userId));
    });

    return () => {
      socket.off("user-ready");
      socket.off("user-joined");
      socket.off("user-left");
    };
  }, [socket, connectedUsers, readyUsers]);

  return {
    sessionCode,
    setSessionCode,
    connectedUsers,
    isInSession,
    showReadyModal,
    setShowReadyModal,
    readyUsers,
    allUsersReady,
    createSessionHandler,
    joinSession,
    handleReadyClick,
    leaveSession
  };
}
