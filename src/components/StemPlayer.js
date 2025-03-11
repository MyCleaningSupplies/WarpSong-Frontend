import React, { useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import axios from "axios";
import { useSocket } from "../context/SocketContext";

// Helper: Normalize identifiers for consistent key usage.
const normalizeId = (id) => id?.trim().toLowerCase();
console.log("Normalized ID:", normalizeId("BassLoop"));

const STEM_TYPES = {
  DRUMS: {
    name: "Drums",
    gradient: "from-[#EC4899] to-[#8B5CF6]",
    color: "#EC4899",
    match: (type) => type?.toLowerCase() === "drums",
  },
  BASS: {
    name: "Bass",
    gradient: "from-[#F97316] to-[#EC4899]",
    color: "#F97316",
    match: (type) => type?.toLowerCase() === "bass",
  },
  MELODIE: {
    name: "Melodie",
    gradient: "from-[#06B6D4] to-[#F97316]",
    color: "#06B6D4",
    match: (type) => type?.toLowerCase() === "melodie",
  },
  VOCALS: {
    name: "Vocals",
    gradient: "from-[#06B6D4] to-[#8B5CF6]",
    color: "#8B5CF6",
    match: (type) => type?.toLowerCase() === "vocals",
  },
};

const StemPlayer = () => {
  // Basic state variables
  const [stems, setStems] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(130);
  const [loading, setLoading] = useState(true);
  const [mainAnalyzer, setMainAnalyzer] = useState(null);
  const [selectedStemType, setSelectedStemType] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentStems, setCurrentStems] = useState({});
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [_masterVolume, setMasterVolume] = useState(0);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [readyUsers, setReadyUsers] = useState([]);
  const [allUsersReady, setAllUsersReady] = useState(false);
  const [loadingStems, setLoadingStems] = useState({});
  const [_preloadComplete, setPreloadComplete] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);


  // Collaborative features state
  const [sessionCode, setSessionCode] = useState("");
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [isInSession, setIsInSession] = useState(false);
  const { socket } = useSocket();

  const REFERENCE_BPM = 130;

  // Refs for Tone.js objects
  const mainMixerRef = useRef(null);
  const playerRefs = useRef({});
  const volumeNodeRefs = useRef({});
  const analyzerRefs = useRef({});
  const buffersRef = useRef({});
  const stemMapRef = useRef({});

  // Navigation handler for the back button
  const handleBack = () => {
    console.log("Navigating back to Connect screen");
    // Insert your navigation logic here (e.g., window.location or React Router)
  };

  // Session management functions
  const createSessionHandler = async () => {
    try {
      const response = await axios.post(
        "http://localhost:3001/api/remix/create",
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      if (response.status === 200) {
        const { sessionCode } = response.data;
        console.log("✅ Created session with code:", sessionCode);
        setSessionCode(sessionCode);

        socket.emit("join-session", { sessionCode, userId: socket.id });
        setIsInSession(true);

        const normalizeUser = (user) =>
          typeof user === "object" && user._id ? user._id.toString() : user.toString();

        setConnectedUsers(response.data.users ? response.data.users.map(normalizeUser) : [socket.id]);
        setShowReadyModal(true);

        console.log(`✅ Directly joined session after creation: ${sessionCode}`);
      } else {
        console.error("❌ Failed to create session:", response.data);
      }
    } catch (error) {
      console.error("❌ Error creating session:", error);
    }
  };

  // Add this to your component
const bufferCache = {};

const getBuffer = async (url) => {
  if (bufferCache[url]) {
    return bufferCache[url];
  }
  
  return new Promise((resolve, reject) => {
    const buffer = new Tone.Buffer(
      url,
      () => {
        bufferCache[url] = buffer;
        resolve(buffer);
      },
      (err) => reject(err)
    );
  });
};

const warmupAudioEngine = async () => {
  console.log("Warming up audio engine...");
  
  try {
    // Make sure Tone.js context is running
    if (Tone.context.state !== "running") {
      await Tone.context.resume();
    }
    
    // Create a silent buffer for warming up the audio engine
    const silentBuffer = Tone.context.createBuffer(1, 44100, 44100);
    const source = Tone.context.createBufferSource();
    source.buffer = silentBuffer;
    
    // Connect to destination safely
    try {
      source.connect(Tone.context.destination);
    } catch (error) {
      console.warn("Could not connect source to destination:", error);
    }
    
    // Start and stop the source
    source.start();
    source.stop(Tone.now() + 0.001);
    
    // Create main mixer if it doesn't exist
    if (!mainMixerRef.current) {
      mainMixerRef.current = new Tone.Gain(1).toDestination();
      
      // Create main analyzer
      const mainAnalyz = new Tone.Analyser("waveform", 1024);
      mainMixerRef.current.connect(mainAnalyz);
      setMainAnalyzer(mainAnalyz);
    }
    
    // Pre-create volume nodes and analyzers only if we have stems
    if (Object.values(currentStems).some(stem => stem)) {
      Object.entries(currentStems).forEach(([type, stem]) => {
        if (!stem) return;
        
        const key = normalizeId(stem.identifier);
        
        // Create volume node if needed
        if (!volumeNodeRefs.current[key]) {
          volumeNodeRefs.current[key] = new Tone.Volume(0);
        }
        
        // Create analyzer if needed
        if (!analyzerRefs.current[key]) {
          analyzerRefs.current[key] = new Tone.Analyser("waveform", 1024);
        }
        
        // Connect volume node to analyzer and main mixer safely
        try {
          if (!volumeNodeRefs.current[key].connected) {
            volumeNodeRefs.current[key].connect(analyzerRefs.current[key]);
            volumeNodeRefs.current[key].connect(mainMixerRef.current);
          }
        } catch (error) {
          console.warn(`Could not connect nodes for ${key}:`, error);
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error in warmupAudioEngine:", error);
    // Return true anyway to allow the process to continue
    return true;
  }
};

  
const createReliablePlayer = (key, buffer) => {
  // Safely dispose of any existing player
  if (playerRefs.current[key]) {
    try {
      if (playerRefs.current[key].state === "started") {
        playerRefs.current[key].stop("+0.01");
      }
      playerRefs.current[key].dispose();
    } catch (error) {
      console.warn(`Error disposing player ${key}:`, error);
    }
  }
  
  try {
    // Create a new player with optimized settings
    const player = new Tone.Player({
      url: buffer,
      loop: true,
      fadeIn: 0.01,
      fadeOut: 0.01,
      volume: 0
    }).sync();
    
    // Explicitly set loop points
    player.loopStart = 0;
    player.loopEnd = buffer.duration;
    
    // Create or get volume node
    let volumeNode = volumeNodeRefs.current[key];
    if (!volumeNode) {
      volumeNode = new Tone.Volume(0);
      volumeNodeRefs.current[key] = volumeNode;
    }
    
    // Connect player to volume node
    player.connect(volumeNode);
    volumeNode.toDestination();
    
    // Connect to analyzer
    let analyzer = analyzerRefs.current[key];
    if (!analyzer) {
      analyzer = new Tone.Analyser("waveform", 1024);
      analyzerRefs.current[key] = analyzer;
    }
    
    volumeNode.connect(analyzer);
    volumeNode.connect(mainMixerRef.current);
    
    // Store the player
    playerRefs.current[key] = player;
    
    return player;
  } catch (error) {
    console.error(`Error creating player for ${key}:`, error);
    return null;
  }
};


const preloadStems = async () => {
  // Get all current stem IDs that need to be preloaded
  const currentStemIds = Object.values(currentStems)
    .filter(Boolean)
    .map(stem => normalizeId(stem.identifier));
  
  if (currentStemIds.length === 0) {
    console.log("No stems to preload");
    setPreloadComplete(true);
    return true;
  }
  
  console.log(`Preloading ${currentStemIds.length} stems...`);
  setPreloadProgress(0);
  
  // Check which stems are already loaded
  const stemsToLoad = currentStemIds.filter(id => {
    const buffer = buffersRef.current[id];
    return !buffer || !buffer.loaded;
  });
  
  if (stemsToLoad.length === 0) {
    console.log("All stems already loaded, skipping preload");
    setPreloadProgress(100);
    setPreloadComplete(true);
    return true;
  }
  
  console.log(`Need to load ${stemsToLoad.length} stems`);
  
  // Set a timeout to prevent hanging forever
  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => {
      console.warn("Preload timed out after 5 seconds, continuing anyway");
      resolve(false);
    }, 5000);
  });
  
  // Create load promises for each stem
  const loadPromises = stemsToLoad.map(id => {
    return new Promise(resolve => {
      const buffer = buffersRef.current[id];
      
      if (!buffer) {
        console.warn(`Buffer not found for stem ${id}`);
        resolve(false);
        return;
      }
      
      if (buffer.loaded) {
        setPreloadProgress(prev => prev + (1 / stemsToLoad.length) * 100);
        resolve(true);
        return;
      }
      
      // Set up onload handler
      const originalOnload = buffer.onload;
      buffer.onload = () => {
        console.log(`✅ Stem ${id} loaded`);
        setPreloadProgress(prev => prev + (1 / stemsToLoad.length) * 100);
        if (originalOnload) buffer.onload = originalOnload;
        resolve(true);
      };
      
      // Set up error handler
      const originalOnerror = buffer.onerror;
      buffer.onerror = (err) => {
        console.error(`❌ Error loading stem ${id}:`, err);
        setPreloadProgress(prev => prev + (1 / stemsToLoad.length) * 100);
        if (originalOnerror) buffer.onerror = originalOnerror;
        resolve(false);
      };
    });
  });
  
  // Race against timeout
  try {
    const results = await Promise.race([
      Promise.all(loadPromises),
      timeoutPromise
    ]);
    
    setPreloadComplete(true);
    setPreloadProgress(100);
    
    if (Array.isArray(results)) {
      return results.every(result => result === true);
    } else {
      // This is the timeout case
      return false;
    }
  } catch (error) {
    console.error("Error during preload:", error);
    setPreloadComplete(true);
    setPreloadProgress(100);
    return false;
  }
};



const stopAllPlayers = async () => {
  console.log("Stopping all players...");
  
  // First stop the transport
  Tone.Transport.stop();
  
  // Use a safe future time for stopping
  const safeStopTime = Tone.now() + 0.1;
  
  // Then stop all players with a safe approach
  const stopPromises = Object.entries(playerRefs.current).map(([key, player]) => {
    return new Promise(resolve => {
      if (player) {
        try {
          // Only stop if actually started
          if (player.state === "started") {
            player.stop(safeStopTime);
          }
        } catch (error) {
          console.warn(`Error stopping player ${key}:`, error);
        }
      }
      // Resolve immediately to not block
      resolve();
    });
  });
  
  // Wait for all stop operations to complete
  await Promise.all(stopPromises);
  
  // Reset transport position
  Tone.Transport.position = 0;
  
  return true;
};



const handlePlayPause = async () => {
  if (!audioInitialized) {
    console.log("Cannot play - audio not initialized");
    setShowReadyModal(true);
    return;
  }
  
  try {
    if (!isPlaying) {
      console.log("Starting playback...");
      
      // Set playing state immediately for UI responsiveness
      setIsPlaying(true);
      
      // First, ensure all players are stopped
      await stopAllPlayers();
      
      // Start transport with a small delay
      Tone.Transport.start("+0.1");
      
      // Use a safe future time for scheduling
      const safeStartTime = Tone.now() + 0.2;
      
      // Start all players with a slight delay
      Object.entries(currentStems).forEach(([type, stem]) => {
        if (!stem) return;
        
        const key = normalizeId(stem.identifier);
        const player = playerRefs.current[key];
        
        if (!player) {
          console.warn(`Player not found for stem ${key}`);
          return;
        }
        
        try {
          // Unmute and set volume
          const volumeNode = volumeNodeRefs.current[key];
          if (volumeNode) {
            volumeNode.mute = false;
          }
          
          // Make sure player is stopped first
          if (player.state === "started") {
            player.stop("+0.01");
          }
          
          // Start at a safe future time with explicit offset of 0
          player.start(safeStartTime, 0);
        } catch (error) {
          console.warn(`Error starting player ${key}:`, error);
        }
      });
      
      if (socket && isInSession) {
        socket.emit("playback-control", { sessionCode, isPlaying: true });
      }
    } else {
      console.log("Stopping playback...");
      
      // Set playing state immediately for UI responsiveness
      setIsPlaying(false);
      
      await stopAllPlayers();
      
      if (socket && isInSession) {
        socket.emit("playback-control", { sessionCode, isPlaying: false });
      }
    }
  } catch (error) {
    console.error("Error in play/pause:", error);
    // Reset state if there was an error
    setIsPlaying(false);
  }
};

  const joinSession = async () => {
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
      Tone.Transport.bpm.value = bpm;
      
      try {
        // Warm up the audio engine
        await warmupAudioEngine();
      } catch (warmupError) {
        console.warn("Warmup error, continuing anyway:", warmupError);
      }
      
      // Set audio as initialized even if there were errors
      setAudioInitialized(true);
      
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
      setAudioInitialized(true);
      
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


// Find the socket.on("sync-playback") handler in your useEffect and replace it with this:
socket.on("sync-playback", async (isPlaying) => {
  console.log("Sync Playback", isPlaying);
  if (!audioInitialized) {
    console.warn("Cannot sync playback - audio not initialized");
    if (isPlaying) localStorage.setItem("pendingPlayback", "true");
    return;
  }
  
  try {
    // Always stop everything first
    Tone.Transport.stop();
    
    // Safely stop all players
    Object.entries(playerRefs.current).forEach(([key, player]) => {
      if (player && player.state === "started") {
        try {
          player.stop("+0.01");
        } catch (error) {
          console.warn(`Error stopping player ${key}:`, error);
        }
      }
    });
    
    // Reset transport position
    Tone.Transport.position = 0;
    
    if (isPlaying) {
      // Start transport first
      Tone.Transport.start("+0.1");
      
      // Use a safe approach to start players
      const safeStartTime = Tone.now() + 0.2;
      
      Object.entries(currentStems).forEach(([type, stem]) => {
        if (!stem) return;
        
        const key = normalizeId(stem.identifier);
        const player = playerRefs.current[key];
        
        if (!player) {
          console.warn(`Player not found for stem ${key}`);
          return;
        }
        
        const volumeNode = volumeNodeRefs.current[key];
        if (volumeNode) {
          volumeNode.mute = false;
        }
        
        try {
          // Make sure player is stopped first
          if (player.state === "started") {
            player.stop("+0.01");
          }
          
          // Start at a safe future time with offset 0
          player.start(safeStartTime, 0);
        } catch (error) {
          console.warn(`Error starting player ${key}:`, error);
        }
      });
      
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  } catch (error) {
    console.error("Error during playback sync:", error);
  }
});


const warmupAudioEngine = async () => {
  console.log("Warming up audio engine...");
  
  // Create a silent buffer for warming up the audio engine
  const silentBuffer = Tone.context.createBuffer(1, 44100, 44100);
  const source = Tone.context.createBufferSource();
  source.buffer = silentBuffer;
  source.connect(Tone.context.destination);
  source.start();
  source.stop(Tone.now() + 0.001);
  
  // Pre-create volume nodes and analyzers
  Object.entries(currentStems).forEach(([type, stem]) => {
    if (!stem) return;
    
    const key = normalizeId(stem.identifier);
    
    // Create volume node if needed
    if (!volumeNodeRefs.current[key]) {
      volumeNodeRefs.current[key] = new Tone.Volume(0);
    }
    
    // Create analyzer if needed
    if (!analyzerRefs.current[key]) {
      analyzerRefs.current[key] = new Tone.Analyser("waveform", 1024);
    }
  });
  
  // Force garbage collection if possible
  if (window.gc) window.gc();
  
  return true;
};

    

    socket.on("update-stems", ({ stems }) => {
      console.log("Received shared stems:", stems);
      stems.forEach(({ stem }) => {
        const key = normalizeId(stem.identifier);
        stemMapRef.current[key] = stem;
      });
      console.log("Updated Stem Map:", stemMapRef.current);
    });

    socket.on("stem-selected", async ({ userId, stemId, stemType, stem }) => {
      console.log("Stem selected", userId, stemId, stemType);
      const normalizedStemId = normalizeId(stemId);
      
      if (!stem.fileUrl) {
        console.error(`❌ No fileUrl for remote stem ${stemId}`);
        return;
      }
      
      stemMapRef.current[normalizedStemId] = stem;
      
      // First update the UI state
      setCurrentStems((prev) => ({ ...prev, [stemType]: stem }));
      
      // Mark as loading
      setLoadingStems(prev => ({ ...prev, [normalizedStemId]: true }));
      
      if (!buffersRef.current[normalizedStemId]) {
        try {
          console.log(`Loading buffer for remote stem ${stemId}...`);
          
          // Create a promise to track buffer loading
          const bufferLoadPromise = new Promise((resolve, reject) => {
            const buffer = new Tone.Buffer(
              stem.fileUrl,
              () => {
                console.log(`✅ Buffer loaded for remote stem ${stemId}`);
                resolve(buffer);
              },
              (error) => {
                console.error(`❌ Error loading buffer for remote stem ${stemId}:`, error);
                reject(error);
              }
            );
          });
          
          // Wait for buffer to load
          const buffer = await bufferLoadPromise;
          buffersRef.current[normalizedStemId] = buffer;
          
          // Create player with improved configuration
          const player = createReliablePlayer(normalizedStemId, buffer);
          
          // Mark as no longer loading
          setLoadingStems(prev => ({ ...prev, [normalizedStemId]: false }));
          
          // Start player if we're already playing
          if (isPlaying && audioInitialized) {
            console.log(`Starting newly loaded player for ${normalizedStemId}`);
            
            // Get current transport position to sync with other players
            const currentPosition = Tone.Transport.seconds;
            
            // Calculate the correct start position within the loop
            const loopPosition = currentPosition % buffer.duration;
            
            // Make sure player is in stopped state
            if (player.state !== "stopped") {
              player.stop();
            }
            
            // Start the player at the current position in the loop
            player.start("+0.1", loopPosition);
          }
        } catch (error) {
          console.error(`❌ Error creating buffer for remote stem ${stemId}:`, error);
          setLoadingStems(prev => ({ ...prev, [normalizedStemId]: false }));
        }
      } else {
        // Buffer already exists, just start the player if needed
        setLoadingStems(prev => ({ ...prev, [normalizedStemId]: false }));
        
        if (isPlaying && audioInitialized) {
          const player = playerRefs.current[normalizedStemId];
          const buffer = buffersRef.current[normalizedStemId];
          
          if (player && buffer) {
            // Get current transport position to sync with other players
            const currentPosition = Tone.Transport.seconds;
            
            // Calculate the correct start position within the loop
            const loopPosition = currentPosition % buffer.duration;
            
            if (player.state === "started") {
              player.stop();
            }
            
            console.log(`Starting existing player for ${normalizedStemId} at position ${loopPosition}`);
            player.start("+0.1", loopPosition);
          }
        }
      }
    });
    
    
    

    socket.on("sync-bpm", (newBpm) => {
      setBpm(newBpm);
      Tone.Transport.bpm.value = newBpm;
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
      socket.off("sync-playback");
      socket.off("update-stems");
      socket.off("stem-selected");
      socket.off("sync-bpm");
      socket.off("user-joined");
      socket.off("user-left");
    };
  }, [socket, connectedUsers, audioInitialized, currentStems, readyUsers]);

  useEffect(() => {
    if (audioInitialized) {
      const pendingPlayback = localStorage.getItem("pendingPlayback");
      if (pendingPlayback === "true") {
        console.log("Applying pending playback after initialization");
        localStorage.removeItem("pendingPlayback");
        setTimeout(() => {
          Object.entries(currentStems).forEach(([type, stem]) => {
            if (stem) {
              const key = normalizeId(stem.identifier);
              const player = playerRefs.current[key];
              if (player) {
                const volumeNode = volumeNodeRefs.current[key];
                if (volumeNode) {
                  volumeNode.mute = false;
                  volumeNode.volume.value = 0;
                }
                console.log(`Starting player for ${key} from pending playback`);
                player.start(0);
              }
            }
          });
          Tone.Transport.start();
          setIsPlaying(true);
        }, 500);
      }
    }
  }, [audioInitialized, currentStems]);

  useEffect(() => {
    if (allUsersReady && showReadyModal) {
      console.log("All users are ready, preloading stems...");
      preloadStems().then(() => {
        console.log("Preload complete, closing ready modal in 2 seconds");
        const timer = setTimeout(() => {
          setShowReadyModal(false);
        }, 2000);
        return () => clearTimeout(timer);
      });
    }
  }, [allUsersReady, showReadyModal]);

  useEffect(() => {
    const fetchStems = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("http://127.0.0.1:3001/api/user/my-stems", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const formattedStems = response.data.map((stem) => ({
          ...stem,
          type: stem.type || "Drums",
          name: stem.name || stem.identifier,
          artist: stem.artist || "Unknown Artist",
        }));
        setStems(formattedStems);
        const stemMap = {};
        formattedStems.forEach((stem) => {
          const key = normalizeId(stem.identifier);
          stemMap[key] = stem;
        });
        stemMapRef.current = stemMap;
        console.log("Stem Map Populated:", stemMapRef.current);
        console.log("Stem Map Keys:", Object.keys(stemMapRef.current));
      } catch (error) {
        console.error("❌ Error fetching stems:", error);
      }
    };
    fetchStems();
  }, []);



  useEffect(() => {
    if (!mainMixerRef.current) {
      const mainMixer = new Tone.Gain(1);
      mainMixer.toDestination();
      mainMixerRef.current = mainMixer;
      const mainAnalyz = new Tone.Analyser("waveform", 1024);
      mainMixer.connect(mainAnalyz);
      setMainAnalyzer(mainAnalyz);
    }
    return () => {
      if (mainMixerRef.current) {
        mainMixerRef.current.disconnect();
        mainMixerRef.current.dispose();
      }
      if (mainAnalyzer) {
        mainAnalyzer.dispose();
      }
      Object.values(playerRefs.current).forEach((player) => {
        if (player) player.dispose();
      });
      Object.values(volumeNodeRefs.current).forEach((vol) => {
        if (vol) vol.dispose();
      });
      Object.values(analyzerRefs.current).forEach((analyzer) => {
        if (analyzer) analyzer.dispose();
      });
      playerRefs.current = {};
      volumeNodeRefs.current = {};
      analyzerRefs.current = {};
      buffersRef.current = {};
    };
  }, []);

  // Load buffers for stems
// Look for this useEffect in your code
useEffect(() => {
  if (stems.length === 0) return;
  setLoading(true);
  const loadedBuffers = {};
  const loadBuffer = (stem) => {
    return new Promise((resolve, reject) => {
      try {
        if (!stem.fileUrl) {
          console.error(`❌ No fileUrl for stem ${stem.identifier}`);
          reject(new Error(`No fileUrl for stem ${stem.identifier}`));
          return;
        }
        const buffer = new Tone.Buffer(
          stem.fileUrl,
          () => {
            console.log(`✅ Buffer loaded for ${stem.identifier}`);
            const key = normalizeId(stem.identifier);
            loadedBuffers[key] = buffer;
            resolve(buffer);
          },
          (error) => {
            console.error(`❌ Error loading buffer for ${stem.identifier}:`, error);
            reject(error);
          }
        );
      } catch (error) {
        console.error(`❌ Error creating buffer for ${stem.identifier}:`, error);
        reject(error);
      }
    });
  };
  Promise.allSettled(stems.map(loadBuffer))
    .then((results) => {
      buffersRef.current = loadedBuffers;
      Object.entries(loadedBuffers).forEach(([key, buffer]) => {
        try {
          const player = new Tone.Player({ url: buffer, loop: true, volume: 0 }).sync();
          const volumeNode = new Tone.Volume(0);
          player.connect(volumeNode);
          volumeNode.toDestination();
          const analyzer = new Tone.Analyser("waveform", 1024);
          volumeNode.connect(analyzer);
          volumeNode.connect(mainMixerRef.current);
          playerRefs.current[key] = player;
          volumeNodeRefs.current[key] = volumeNode;
          analyzerRefs.current[key] = analyzer;
          console.log(`✅ Player created for ${key}, state:`, player.state);
        } catch (error) {
          console.error(`❌ Error creating player for ${key}:`, error);
        }
      });
      setLoading(false);
      console.log("✅ All stems loaded and players created");
    })
    .catch((error) => {
      console.error("❌ Error loading stems:", error);
      setLoading(false);
    });
}, [stems]);


  const initializeAudio = async () => {
    if (audioInitialized) return true;
    
    try {
      // Start audio context
      await Tone.start();
      console.log("✅ Tone.js AudioContext started:", Tone.context.state);
      
      // Ensure it's running
      if (Tone.context.state !== "running") {
        console.log("Attempting to resume AudioContext...");
        await Tone.context.resume();
        console.log("AudioContext state after resume:", Tone.context.state);
      }
      
      // Set up transport
      Tone.Transport.bpm.value = bpm;
      
      // Create main mixer if needed
      if (!mainMixerRef.current) {
        const mainMixer = new Tone.Gain(1);
        mainMixer.toDestination();
        mainMixerRef.current = mainMixer;
        
        const mainAnalyz = new Tone.Analyser("waveform", 1024);
        mainMixer.connect(mainAnalyz);
        setMainAnalyzer(mainAnalyz);
      }
      
      setAudioInitialized(true);
      return true;
    } catch (error) {
      console.error("❌ Error initializing audio:", error);
      return false;
    }
  };
  

  // Add this function to your component
const ensureBufferLoaded = async (stemId, fileUrl) => {
  // Check if buffer already exists and is loaded
  if (buffersRef.current[stemId] && buffersRef.current[stemId].loaded) {
    return buffersRef.current[stemId];
  }
  
  console.log(`Loading buffer for stem ${stemId}...`);
  
  // Create a promise with timeout
  const bufferPromise = new Promise((resolve, reject) => {
    const buffer = new Tone.Buffer(
      fileUrl,
      () => {
        console.log(`✅ Buffer loaded for stem ${stemId}`);
        resolve(buffer);
      },
      (error) => {
        console.error(`❌ Error loading buffer for stem ${stemId}:`, error);
        reject(error);
      }
    );
    
    // Add timeout to prevent hanging
    setTimeout(() => {
      if (!buffer.loaded) {
        console.warn(`Buffer load timeout for stem ${stemId}`);
        resolve(buffer); // Resolve anyway to prevent blocking
      }
    }, 3000);
  });
  
  try {
    const buffer = await bufferPromise;
    buffersRef.current[stemId] = buffer;
    return buffer;
  } catch (error) {
    console.error(`Failed to load buffer for ${stemId}:`, error);
    return null;
  }
};


  // Playback Controls
 
  
  // Helper function to stop all players

  // Add this function to your component
const logPlaybackState = () => {
  if (!isPlaying) return;
  
  console.log("--- Playback State ---");
  console.log(`Transport state: ${Tone.Transport.state}`);
  console.log(`Transport position: ${Tone.Transport.position}`);
  
  Object.entries(currentStems).forEach(([type, stem]) => {
    if (!stem) return;
    
    const key = normalizeId(stem.identifier);
    const player = playerRefs.current[key];
    
    if (player) {
      console.log(`${type} (${key}): state=${player.state}, muted=${volumeNodeRefs.current[key]?.mute}`);
    }
  });
  console.log("---------------------");
};

// Call this periodically
// Call this periodically
useEffect(() => {
  if (!isPlaying) return;
  
  // Log every 30 seconds instead of 5 seconds
  const logInterval = setInterval(logPlaybackState, 30000);
  
  return () => clearInterval(logInterval);
}, [isPlaying, currentStems]);


  
  const handleBpmChange = (e) => {
    const newBpm = parseInt(e.target.value);
    setBpm(newBpm);
    Tone.Transport.bpm.value = newBpm;
    if (socket && isInSession) {
      socket.emit("bpm-change", { sessionCode, bpm: newBpm });
    }
    Object.values(playerRefs.current).forEach((player) => {
      player.playbackRate = newBpm / REFERENCE_BPM;
    });
  };

  const increaseBpm = () => {
    if (bpm < 200) {
      setBpm((prev) => {
        const newBpm = prev + 1;
        Tone.Transport.bpm.value = newBpm;
        if (socket && isInSession) {
          socket.emit("bpm-change", { sessionCode, bpm: newBpm });
        }
        Object.values(playerRefs.current).forEach((player) => {
          player.playbackRate = newBpm / REFERENCE_BPM;
        });
        return newBpm;
      });
    }
  };

  const decreaseBpm = () => {
    if (bpm > 60) {
      setBpm((prev) => {
        const newBpm = prev - 1;
        Tone.Transport.bpm.value = newBpm;
        if (socket && isInSession) {
          socket.emit("bpm-change", { sessionCode, bpm: newBpm });
        }
        Object.values(playerRefs.current).forEach((player) => {
          player.playbackRate = newBpm / REFERENCE_BPM;
        });
        return newBpm;
      });
    }
  };

  const handleVolumeChange = (identifier, value) => {
    const volumeNode = volumeNodeRefs.current[identifier];
    if (volumeNode) volumeNode.volume.value = parseFloat(value);
  };

  const handleMute = (identifier) => {
    const volumeNode = volumeNodeRefs.current[identifier];
    if (volumeNode) {
      volumeNode.mute = !volumeNode.mute;
      console.log(`🔇 ${identifier} ${volumeNode.mute ? "Muted" : "Unmuted"}`);
    }
  };

  const drawMainVisualizer = () => {
    const canvas = document.getElementById("mainVisualizer");
    if (!canvas || !mainAnalyzer) return;
    
    // Skip rendering if tab is not visible or not playing
    if (document.hidden || !isPlaying) return;
    
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    
    try {
      const barCount = 24;
      const barWidth = width / barCount;
      const buffer = mainAnalyzer.getValue();
      
      for (let i = 0; i < barCount; i++) {
        const start = Math.floor((i / barCount) * buffer.length);
        const end = Math.floor(((i + 1) / barCount) * buffer.length);
        let sum = 0;
        for (let j = start; j < end; j++) {
          sum += Math.abs(buffer[j]);
        }
        const avg = sum / (end - start);
        const barHeight = avg * height;
        
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, "#8B5CF6");
        gradient.addColorStop(1, "#EC4899");
        ctx.fillStyle = gradient;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth * 0.8, barHeight);
      }
    } catch (error) {
      // Silently handle any visualization errors
    }
  };
  

// Use requestAnimationFrame instead of setInterval for better performance
useEffect(() => {
  if (!mainAnalyzer) return;
  
  let animationFrame;
  const animate = () => {
    drawMainVisualizer();
    animationFrame = requestAnimationFrame(animate);
  };
  
  animate();
  
  return () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  };
}, [mainAnalyzer, currentStems]);


const drawStemWaveform = (stemType, stem) => {
  if (!stem || document.hidden || !isPlaying) return;
  
  const key = normalizeId(stem.identifier);
  const analyzer = analyzerRefs.current[key];
  if (!analyzer) return;
  
  const canvas = document.getElementById(`waveformCanvas_${key}`);
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  
  try {
    const barCount = 6;
    const barWidth = width / barCount;
    const buffer = analyzer.getValue();
    
    for (let i = 0; i < barCount; i++) {
      const start = Math.floor((i / barCount) * buffer.length);
      const end = Math.floor(((i + 1) / barCount) * buffer.length);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += Math.abs(buffer[j]);
      }
      const avg = sum / (end - start);
      const barHeight = avg * height;
      
      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, STEM_TYPES[stemType]?.color || "#8b5cf6");
      gradient.addColorStop(1, "#EC4899");
      ctx.fillStyle = gradient;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth * 0.8, barHeight);
    }
  } catch (error) {
    // Silently handle visualization errors
  }
};


  const switchStem = async (newStem, stemType) => {
    if (!newStem || !stemType) {
      console.error("❌ Invalid parameters for switchStem.");
      return;
    }
    
    const key = normalizeId(newStem.identifier);
    console.log(`Switching to stem: ${key} for type: ${stemType}`);
    
    try {
      // Mark this stem as loading
      setLoadingStems(prev => ({ ...prev, [key]: true }));
      
      // Ensure buffer is loaded
      let buffer = buffersRef.current[key];
      if (!buffer) {
        console.log(`Loading buffer for stem ${key}...`);
        buffer = await new Promise((resolve, reject) => {
          const newBuffer = new Tone.Buffer(
            newStem.fileUrl,
            () => resolve(newBuffer),
            (err) => reject(err)
          );
        });
        buffersRef.current[key] = buffer;
      }
      
      // Create player immediately after buffer is loaded
      let player = playerRefs.current[key];
      if (!player || player.state === "disposed") {
        player = createReliablePlayer(key, buffer);
      }
      
      // Update state
      setCurrentStems(prev => ({ ...prev, [stemType]: newStem }));
      
      // Handle previous stem
      const prevStem = currentStems[stemType];
      if (prevStem) {
        const prevKey = normalizeId(prevStem.identifier);
        const prevPlayer = playerRefs.current[prevKey];
        
        if (prevPlayer && prevPlayer.state === "started") {
          prevPlayer.stop();
        }
      }
      
      // Start new stem if we're playing
      if (isPlaying && audioInitialized) {
        const volumeNode = volumeNodeRefs.current[key];
        if (volumeNode) {
          volumeNode.mute = false;
          volumeNode.volume.value = 0;
        }
        
        player.start(0);
      }
      
      // Emit to socket
      if (socket && isInSession) {
        socket.emit("select-stem", {
          sessionCode,
          stemId: key,
          stemType,
          userId: socket.id,
          stem: newStem,
        });
      }
      
      // Mark as no longer loading
      setLoadingStems(prev => ({ ...prev, [key]: false }));
      
    } catch (error) {
      console.error(`❌ Error switching to stem ${key}:`, error);
      setLoadingStems(prev => ({ ...prev, [key]: false }));
    }
  };
  
  
  
  
  

  // Animation for main visualizer canvas
  useEffect(() => {
    if (!mainAnalyzer) return;
    const mainInterval = setInterval(drawMainVisualizer, 50);
    return () => clearInterval(mainInterval);
  }, [mainAnalyzer, currentStems]);

  // Animation for individual stem waveforms
  useEffect(() => {
    if (Object.keys(analyzerRefs.current).length === 0) return;
    const waveformInterval = setInterval(() => {
      Object.entries(currentStems).forEach(([type, stem]) => {
        if (stem) drawStemWaveform(type, stem);
      });
    }, 50);
    return () => clearInterval(waveformInterval);
  }, [currentStems]);

  // Debug audio state (optional)
  useEffect(() => {
    const debugInterval = setInterval(() => {
      if (isPlaying) {
        Object.entries(currentStems).forEach(([type, stem]) => {
          if (stem) {
            const key = normalizeId(stem.identifier);
            const player = playerRefs.current[key];
            if (player) {
              console.log(`Player ${key} state:`, player.state);
              console.log(`Player ${key} volume:`, volumeNodeRefs.current[key]?.volume.value);
            }
          }
        });
        console.log(`Master volume:`, Tone.Destination.volume.value);
        console.log(`AudioContext state:`, Tone.context.state);
      }
    }, 5000);
    return () => clearInterval(debugInterval);
  }, [isPlaying, currentStems]);

  const filterStemsByType = (type) => stems.filter((stem) => STEM_TYPES[type].match(stem.type));

  const handleStemSelection = async (stem) => {
    console.log(`✅ Stem selected ${stem.identifier}`);
    setModalOpen(false);
    if (!selectedStemType) {
      console.error("❌ No stem type selected.");
      return;
    }
    await switchStem(stem, selectedStemType);
  };

  const handleOpenModal = (type) => {
    setSelectedStemType(type);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedStemType(null);
  };

  // --- Render Functions ---
  const renderHeader = () => (
    <header className="rounded-xl p-4 mb-8 flex items-center justify-between bg-white/5 backdrop-blur-sm">
      <button onClick={handleBack} className="hover:scale-105 transition-transform">
        <span className="text-xl">← Terug</span>
      </button>
      <div className="w-12" /> {/* For balance */}
    </header>
  );

  const renderSessionControls = () => {
    if (!isInSession) {
      return (
        <div className="rounded-xl p-4 mb-8 bg-white/5 backdrop-blur-sm">
          <div className="flex gap-4 items-center">
            <input
              type="text"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="Enter 4-letter session code"
              maxLength={4}
              className="bg-white/10 rounded-lg px-4 py-2 text-white/90"
            />
            <button
              onClick={joinSession}
              className="px-6 py-2 rounded-lg bg-[#8B5CF6] text-white/90 hover:bg-[#7C3AED] transition-colors"
            >
              Join Session
            </button>
            <button
              onClick={createSessionHandler}
              className="px-6 py-2 rounded-lg bg-[#8B5CF6] text-white/90 hover:bg-[#7C3AED] transition-colors"
            >
              Create Session
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-xl p-4 mb-8 bg-white/5 backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <div className="text-white/90">
            Session Code: <span className="font-bold">{sessionCode}</span>
          </div>
          <div className="flex gap-2">
            {connectedUsers.map((userId, index) => (
              <div key={`user-${userId}-${index}`} className="px-3 py-1 rounded-full bg-white/10 text-sm">
                User {index + 1}
              </div>
            ))}
          </div>
          <button
            onClick={leaveSession}
            className="px-4 py-1 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
          >
            Leave Session
          </button>
        </div>
      </div>
    );
  };

  const renderVisualizer = () => (
    <div className="rounded-3xl p-6 mb-8 relative bg-white/5 backdrop-blur-sm">
      {loading ? (
        <div className="flex justify-center items-center h-60">
          <div className="text-xl text-white/70 animate-pulse">Loading stems...</div>
        </div>
      ) : (
        <div className="h-60 flex items-center justify-center relative">
          <canvas id="mainVisualizer" width="1200" height="240" className="w-full h-full" />
          {Object.values(loadingStems).some(loading => loading) && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
              <div className="text-white mb-2">Loading stems...</div>
              <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]" 
                  style={{ width: `${preloadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
      <div className="absolute top-4 left-0 right-0 flex justify-center items-center gap-4">
        <button onClick={handlePlayPause} className="rounded-full p-3 bg-white/10 backdrop-blur-sm hover:scale-105 transition-transform">
          {isPlaying ? <span className="text-2xl">⏸️</span> : <span className="text-2xl">▶️</span>}
        </button>
        <div className="rounded-xl p-2 bg-white/10 backdrop-blur-sm flex flex-col items-center">
          <div className="flex items-center gap-2">
            <button onClick={decreaseBpm} className="hover:scale-105 transition-transform">-</button>
            <span className="font-bold">{bpm}</span>
            <button onClick={increaseBpm} className="hover:scale-105 transition-transform">+</button>
          </div>
          <div className="flex items-center gap-1">
            <span>⏰</span>
            <span className="text-xs">BPM</span>
          </div>
        </div>
      </div>
    </div>
  );
  

  const renderStemTypeSection = (type) => {
    const typeConfig = STEM_TYPES[type];
    const currentStem = currentStems[type];
    const id = currentStem ? normalizeId(currentStem.identifier) : null;
    const isLoading = id ? loadingStems[id] : false;
    
    return (
      <div key={type} className="rounded-xl p-4 bg-white/5 backdrop-blur-sm hover:scale-105 transition-transform cursor-pointer" onClick={() => handleOpenModal(type)}>
        {(!loading && currentStem) ? (
          <>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium text-white/90">{typeConfig.name}</h3>
              <button onClick={(e) => { e.stopPropagation(); handleMute(id); }} className="text-white/70 hover:text-white transition-colors">
                <span>{volumeNodeRefs.current[id]?.mute ? "🔇" : "🔊"}</span>
              </button>
            </div>
            <p className="text-xs text-white/50 flex items-center gap-1">
              <span>ⓘ</span> {currentStem?.name} - {currentStem?.artist}
            </p>
            <div className="relative h-16 my-2 overflow-hidden">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="animate-pulse">Loading...</div>
                </div>
              ) : null}
              <canvas id={`waveformCanvas_${id}`} width="300" height="50" className="w-full h-full" />
            </div>
            <div className="mt-2">
              <input type="range" min="-40" max="6" step="1" defaultValue="0" onClick={(e) => e.stopPropagation()} onChange={(e) => handleVolumeChange(id, e.target.value)} className="w-full" />
            </div>
          </>
        ) : (
          <div className="opacity-50">
            <p className="text-sm text-white/50">Select a {typeConfig.name.toLowerCase()} stem to begin the mix</p>
          </div>
        )}
      </div>
    );
  };
  

  const renderModal = () => {
    if (!modalOpen || !selectedStemType) return null;
    const stemsForType = filterStemsByType(selectedStemType);
    const typeConfig = STEM_TYPES[selectedStemType];
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="rounded-xl p-6 bg-white/5 backdrop-blur-sm w-96">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white/90">{typeConfig.name} Stems</h2>
            <button onClick={handleCloseModal} className="text-white/70 hover:scale-105 transition-transform">×</button>
          </div>
          {stemsForType.length === 0 ? (
            <p className="text-sm text-white/50">No stems of this type added yet.</p>
          ) : (
            <div className="space-y-3">
              {stemsForType.map((stem) => (
                <div key={normalizeId(stem.identifier)} className="rounded-xl p-3 bg-white/5 backdrop-blur-sm cursor-pointer hover:scale-105 transition-transform" onClick={() => handleStemSelection(stem)}>
                  <h3 className="font-medium text-white/90">{stem.name}</h3>
                  <p className="text-xs text-white/50">{stem.artist}</p>
                  <span className="text-xl">＋</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActionButtons = () => (
    <div className="mt-auto flex flex-col md:flex-row gap-4 pt-4">
      <button onClick={() => console.log("Save process initiated")} className="rounded-full py-3 flex-1 flex items-center justify-center border border-white/20 hover:bg-white/5 transition-all">
        <span className="mr-2">⬇️</span> Opslaan
      </button>
      <button onClick={() => console.log("Navigate to Share screen")} className="rounded-full py-3 flex-1 flex items-center justify-center bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:shadow-lg transition-all">
        <span className="mr-2">↗️</span> Delen
      </button>
    </div>
  );

  const renderReadyModal = () => {
    if (!showReadyModal) return null;
    const currentUserReady = readyUsers.includes(socket.id);
    const waitingForOthers = currentUserReady && !allUsersReady;
    const readyCount = readyUsers.length;
    const totalUsers = connectedUsers.length;
    console.log("Ready modal state:", { currentUserReady, waitingForOthers, readyCount, totalUsers });
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="rounded-xl p-8 bg-[#1e1833] text-center max-w-md">
          <div className="text-[#8B5CF6] text-5xl mb-4">♪♫</div>
          {!currentUserReady ? (
            <>
              <h2 className="text-2xl font-bold mb-4 text-white">Ready to Mix?</h2>
              <h3 className="text-2xl font-bold mb-4 text-white">Your session code is: {sessionCode}</h3>
              <p className="mb-6 text-white/70">Click the button below to initialize audio and start mixing with your friends!</p>
              <button onClick={handleReadyClick} className="py-3 px-8 rounded-full font-medium bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:shadow-md transition-all text-white">
                I'm Ready!
              </button>
            </>
          ) : waitingForOthers ? (
            <>
              <h2 className="text-2xl font-bold mb-4 text-white">Waiting for Others</h2>
              <p className="mb-6 text-white/70">{readyCount} of {totalUsers} users are ready...</p>
              <div className="animate-pulse text-[#8B5CF6] text-2xl">⏳</div>
              <button onClick={() => setShowReadyModal(false)} className="mt-4 py-2 px-4 rounded-full text-sm bg-red-500/20 text-red-500">
                Debug: Force Close
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-4 text-white">Everyone's Ready!</h2>
              <p className="mb-6 text-white/70">All users are ready to start mixing!</p>
              <button onClick={() => setShowReadyModal(false)} className="py-3 px-8 rounded-full font-medium bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:shadow-md transition-all text-white">
                Let's Mix!
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(260,20%,10%)] p-6">
      {renderHeader()}
      {renderSessionControls()}
      {isInSession ? (
        <>
          {renderVisualizer()}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Object.keys(STEM_TYPES).map((type) => renderStemTypeSection(type))}
          </div>
          {renderModal()}
          {renderActionButtons()}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-2xl text-white/70 mb-4">Join or create a session to start mixing</div>
          <div className="text-white/50">Collaborate with friends in real-time</div>
        </div>
      )}
      {renderReadyModal()}
    </div>
  );
};

export default StemPlayer;