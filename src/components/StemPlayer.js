import React, { useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";

// Helper: Normalize identifiers for consistent key usage.
const normalizeId = (id) => id?.trim().toLowerCase();

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
  const navigate = useNavigate();
  const [stems, setStems] = useState([]);
  const [currentStems, setCurrentStems] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(130);
  const [loading, setLoading] = useState(true);
  const [mainAnalyzer, setMainAnalyzer] = useState(null);
  const [selectedStemType, setSelectedStemType] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [readyUsers, setReadyUsers] = useState([]);
  const [allUsersReady, setAllUsersReady] = useState(false);
  const [loadingStems, setLoadingStems] = useState({});
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [selectedStems, setSelectedStems] = useState([]); // Track selected stems
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);

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
  const playbackTimeoutRef = useRef(null);

  // Function to ensure audio is initialized
  const ensureAudioInitialized = async () => {
    if (!audioInitialized) {
      try {
        console.log("Initializing audio context...");
        await Tone.start();

        // Ensure it's running
        if (Tone.context.state !== "running") {
          await Tone.context.resume();
        }

        // Create main mixer with limiter to prevent clipping
        const limiter = new Tone.Limiter(-3);
        const mixer = new Tone.Gain(0.8);
        mixer.connect(limiter);
        limiter.toDestination();
        mainMixerRef.current = mixer;

        // Set initial BPM
        Tone.Transport.bpm.value = bpm;

        const mainAnalyz = new Tone.Analyser("waveform", 1024);
        mixer.connect(mainAnalyz);
        setMainAnalyzer(mainAnalyz);
        setAudioInitialized(true);
        console.log("✅ Audio system initialized with mixer");
        return true;
      } catch (error) {
        console.error("❌ Error initializing audio:", error);
        return false;
      }
    }
    return true;
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

        setConnectedUsers(
          response.data.users ? response.data.users.map(normalizeUser) : [socket.id]
        );
        setShowReadyModal(true);

        console.log(`✅ Directly joined session after creation: ${sessionCode}`);
      } else {
        console.error("❌ Failed to create session:", response.data);
      }
    } catch (error) {
      console.error("❌ Error creating session:", error);
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
        volume: 0,
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

  const stopAllPlayers = async () => {
    console.log("Stopping all players...");

    // First stop the transport
    Tone.Transport.stop();

    // Use a safe future time for stopping
    const safeStopTime = Tone.now() + 0.1;

    // Then stop all players with a safe approach
    const stopPromises = Object.entries(playerRefs.current).map(([key, player]) => {
      return new Promise((resolve) => {
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

  // Play / Pause functionality
  const handlePlayPause = async () => {
    if (isPlaying) {
      pausePlayback();
      return;
    }

    // Show loading indicator
    setPlaybackLoading(true);

    try {
      // Prepare audio processing
      const prepared = await prepareAudioProcessing();
      if (!prepared) {
        console.error("Failed to prepare audio");
        setPlaybackLoading(false);
        return;
      }

      // Start playback with a short timeout to allow UI to update
      playbackTimeoutRef.current = setTimeout(() => {
        startPlayback();
        setPlaybackLoading(false);
      }, 100);
    } catch (error) {
      console.error("Error starting playback:", error);
      setPlaybackLoading(false);
    }
  };

  const startPlayback = () => {
    // Start transport first
    Tone.Transport.start();

    // Start all active players with a slight delay
    const startTime = "+0.05"; // Reduced delay
    Object.entries(currentStems).forEach(([type, stem]) => {
      if (!stem) return;

      const key = normalizeId(stem.identifier);
      const player = playerRefs.current[key];

      if (player) {
        // Make sure player is in stopped state
        if (player.state === "started") {
          player.stop();
        }
        player.start(startTime);
      }
    });

    setIsPlaying(true);
    if (socket && isInSession) {
      socket.emit("playback-control", { sessionCode, isPlaying: true });
    }
  };

  const pausePlayback = () => {
    // Stop all players first
    Object.values(playerRefs.current).forEach((player) => {
      if (player && player.state === "started") {
        player.stop();
      }
    });

    // Then stop transport
    Tone.Transport.pause();
    Tone.Transport.position = 0; // Reset position

    setIsPlaying(false);
    if (socket && isInSession) {
      socket.emit("playback-control", { sessionCode, isPlaying: false });
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
      setLoadingStems((prev) => ({ ...prev, [normalizedStemId]: true }));

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
          setLoadingStems((prev) => ({ ...prev, [normalizedStemId]: false }));

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
          setLoadingStems((prev) => ({ ...prev, [normalizedStemId]: false }));
        }
      } else {
        // Buffer already exists, just start the player if needed
        setLoadingStems((prev) => ({ ...prev, [normalizedStemId]: false }));

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

            console.log(
              `Starting existing player for ${normalizedStemId} at position ${loopPosition}`
            );
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
  }, [
    socket,
    connectedUsers,
    audioInitialized,
    currentStems,
    readyUsers,
    isPlaying,
    isInSession,
  ]);

  useEffect(() => {
    const hasStems = Object.values(currentStems).some(Boolean);
    setPlaybackReady(hasStems);
  }, [currentStems]);

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
  }, [audioInitialized, currentStems, isPlaying]);


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

        // Populate stemMapRef
        const stemMap = {};
        formattedStems.forEach((stem) => {
          const key = normalizeId(stem.identifier);
          stemMap[key] = stem;
        });
        stemMapRef.current = stemMap;
        console.log("Stem Map Populated:", stemMapRef.current);

        // Kick off preload
        if (formattedStems.length > 0) {
          preloadMetadata(formattedStems);
        }
      } catch (error) {
        console.error("❌ Error fetching stems:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStems();
  }, []);

  // Preload metadata only
  const preloadMetadata = async (stemsToPreload) => {
    if (!stemsToPreload || stemsToPreload.length === 0) {
      console.log("No stems to preload metadata for.");
      setPreloadComplete(true);
      return;
    }

    console.log(`Preloading metadata for ${stemsToPreload.length} audio files...`);
    setPreloadProgress(0);

    // Just mark as complete without loading full files
    let loaded = 0;
    const increment = 100 / stemsToPreload.length;

    // Simulate loading progress without actually loading full files
    for (let i = 0; i < stemsToPreload.length; i++) {
      loaded++;
      setPreloadProgress(loaded * increment);
      // Small delay to show progress
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log("Preloading metadata complete!");
    setPreloadComplete(true);
  };

  // Load a specific buffer when needed
  const loadBuffer = async (stem) => {
    const id = normalizeId(stem.identifier);

    // Return cached buffer if available
    if (buffersRef.current[id] && buffersRef.current[id].loaded) {
      console.log(`Using cached buffer for ${id}`);
      return buffersRef.current[id];
    }

    console.log(`Loading buffer for ${id}...`);
    return new Promise((resolve, reject) => {
      const buffer = new Tone.Buffer(
        stem.fileUrl,
        () => {
          console.log(`✅ Buffer loaded for ${id}`);
          buffersRef.current[id] = buffer;
          resolve(buffer);
        },
        (err) => {
          console.error(`Error loading buffer for ${id}:`, err);
          reject(err);
        }
      );
    });
  };

  // Pre-process audio for faster playback start
  const prepareAudioProcessing = async () => {
    // Initialize audio if needed
    const initialized = await ensureAudioInitialized();
    if (!initialized) {
      console.error("Could not initialize audio");
      return false;
    }

    // Load all active stems if needed
    const activeStems = Object.values(currentStems).filter(Boolean);

    if (activeStems.length === 0) {
      console.log("No stems selected for playback");
      return false;
    }

    // Load all buffers in parallel
    try {
      await Promise.all(
        activeStems.map((stem) => {
          const id = normalizeId(stem.identifier);
          // Only load if not already loaded
          if (!buffersRef.current[id] || !buffersRef.current[id].loaded) {
            return loadBuffer(stem);
          }
          return Promise.resolve();
        })
      );

      // Pre-create all audio nodes
      activeStems.forEach((stem) => {
        const key = normalizeId(stem.identifier);

        // Skip if player already exists
        if (playerRefs.current[key]) {
          return;
        }

        const buffer = buffersRef.current[key];
        if (!buffer) {
          console.error(`Buffer not found for ${key}`);
          return;
        }

        // Create player with optimized settings
        const player = new Tone.Player({
          url: buffer,
          loop: true,
          fadeIn: 0.05,
          fadeOut: 0.05,
          // Lower quality for faster processing
          grainSize: 0.1,
          overlap: 0.05,
        }).sync();

        // Create volume node
        const volumeNode = new Tone.Volume(0);

        player.connect(volumeNode);

        // Connect to main mixer
        volumeNode.connect(mainMixerRef.current);

        // Store references
        playerRefs.current[key] = player;
        volumeNodeRefs.current[key] = volumeNode;
      });

      return true;
    } catch (error) {
      console.error("Error preparing audio:", error);
      return false;
    }
  };

  // Animation for main visualizer canvas
  useEffect(() => {
    if (!mainAnalyzer) return;
    const mainInterval = setInterval(drawMainVisualizer, 50);
    return () => clearInterval(mainInterval);
  }, [mainAnalyzer, currentStems]);

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

  const filterStemsByType = (type) => stems.filter((stem) => STEM_TYPES[type].match(stem.type));

  const handleStemSelection = async (stem) => {
    console.log(`✅ Stem selected ${stem.identifier}`);
    setModalOpen(false);
    if (!selectedStemType) {
      console.error("❌ No stem type selected.");
      return;
    }

    setSelectedStems((prevStems) => [...prevStems, stem]); // ✅ Track selected stems
    await switchStem(stem, selectedStemType);
  };

  const handleOpenModal = async (type) => {
    // Initialize audio on first interaction
    if (!audioInitialized) {
      const initialized = await ensureAudioInitialized();
      if (!initialized) {
        console.error("Could not initialize audio");
        return;
      }
    }
    setSelectedStemType(type);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedStemType(null);
  };

  const handleSaveMashup = async () => {
    try {
      if (!selectedStems.length) {
        console.error("❌ At least one stem is required to save a mashup.");
        return;
      }

      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:3001/api/mashup/save",
        {
          name: "My Mashup", // Implement mashup name later
          stemIds: selectedStems.map((stem) => stem._id),
          isPublic: true, // Adjust as needed
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      navigate("/mashup-success");
    } catch (error) {
      console.error("❌ Error saving mashup:", error);
    }
  };

  const switchStem = async (newStem, stemType) => {
    //Ensure audio context was initialized
    const initialized = await ensureAudioInitialized();
    if (!initialized) {
      console.error("Could not initialize audio");
      return false;
    }

    const key = normalizeId(newStem.identifier);
    console.log(`Switching to stem: ${key} for type: ${stemType}`);

    // Set loading state for this stem
    setLoadingStems((prev) => ({ ...prev, [stemType]: true }));

    try {
      // Stop previous stem of this type if exists
      const prevStem = currentStems[stemType];
      if (prevStem) {
        const prevKey = normalizeId(prevStem.identifier);
        if (playerRefs.current[prevKey]) {
          if (playerRefs.current[prevKey].state === "started") {
            playerRefs.current[prevKey].stop();
          }
          playerRefs.current[prevKey].dispose();
          delete playerRefs.current[prevKey];
        }

        if (analyzerRefs.current[prevKey]) {
          analyzerRefs.current[prevKey].dispose();
          delete analyzerRefs.current[prevKey];
        }

        if (volumeNodeRefs.current[prevKey]) {
          volumeNodeRefs.current[prevKey].dispose();
          delete volumeNodeRefs.current[prevKey];
        }
      }

      // Load buffer for this stem
      const buffer = await loadBuffer(newStem);

      // Create and start the player for the new stem
      await createAndStartPlayer(newStem, key, buffer);

      // Update state first to show the stem is selected
      setCurrentStems((prev) => ({ ...prev, [stemType]: newStem }));

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
    } catch (error) {
      console.error(`❌ Error switching to stem ${key}:`, error);
    } finally {
      setLoadingStems((prev) => ({ ...prev, [stemType]: false }));
    }
  };

  // Create and start a player for a stem
  const createAndStartPlayer = async (stem, key, buffer) => {
    // Create a new player
    const player = new Tone.Player({
      url: buffer,
      loop: true,
      fadeIn: 0.05,
      fadeOut: 0.05,
      // Lower quality for faster processing
      grainSize: 0.1,
      overlap: 0.05,
    }).sync();

    // Create volume node
    const volumeNode = new Tone.Volume(0);
    const analyzer = new Tone.Analyser("waveform", 1024);
    volumeNode.connect(analyzer);
    volumeNode.connect(mainMixerRef.current);

    player.connect(volumeNode);

    // Store references
    playerRefs.current[key] = player;
    volumeNodeRefs.current[key] = volumeNode;
    analyzerRefs.current[key] = analyzer;

    // Start the player if we're currently playing
    if (isPlaying) {
      player.start("+0.1");
    }
  };

  // --- Render Functions ---
  const renderHeader = () => (
    <header className="rounded-xl p-4 mb-8 flex items-center justify-between bg-white/5 backdrop-blur-sm">
      <button onClick={() => navigate(-1)} className="hover:scale-105 transition-transform">
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
              <div
                key={`user-${userId}-${index}`}
                className="px-3 py-1 rounded-full bg-white/10 text-sm"
              >
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
          {Object.values(loadingStems).some((loading) => loading) && (
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
        <button
          onClick={handlePlayPause}
          className={`w-14 h-14 rounded-full flex items-center justify-center ${
            isPlaying
              ? "bg-red-500 hover:bg-red-600"
              : playbackReady
              ? "bg-green-500 hover:bg-green-600"
              : "bg-gray-500"
          }`}
          disabled={!preloadComplete || playbackLoading || (!isPlaying && !playbackReady)}
        >
          {playbackLoading ? (
            <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div>
          ) : (
            isPlaying ? (
              <span className="text-2xl">⏸️</span>
            ) : (
              <span className="text-2xl">▶️</span>
            )
          )}
        </button>
        <div className="rounded-xl p-2 bg-white/10 backdrop-blur-sm flex flex-col items-center">
          <div className="flex items-center gap-2">
            <button onClick={decreaseBpm} className="hover:scale-105 transition-transform">
              -
            </button>
            <span className="font-bold">{bpm}</span>
            <button onClick={increaseBpm} className="hover:scale-105 transition-transform">
              +
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span>⏰</span>
            <span className="text-xs">BPM</span>
          </div>
        </div>
        {/* Target Key Display */}
        <div className="bg-white/10 px-3 py-1 rounded-full text-sm">Key: Auto</div>
      </div>
    </div>
  );

  const renderStemTypeSection = (type) => {
    const typeConfig = STEM_TYPES[type];
    const currentStem = currentStems[type];
    const id = currentStem ? normalizeId(currentStem.identifier) : null;
    const isLoading = id ? loadingStems[type] : false;

    return (
      <button
        key={type}
        onClick={async () => {
          await handleOpenModal(type);
        }}
        className={`
                p-4 rounded-xl flex flex-col items-center justify-center
                ${currentStems[type] ? `bg-${typeConfig.color}/20` : "bg-white/5"}
                hover:bg-white/10 transition-colors
                ${loadingStems[type] ? "relative" : ""}
              `}
        style={{
          borderColor: currentStems[type] ? typeConfig.color : "transparent",
          borderWidth: currentStems[type] ? "1px" : "0px",
        }}
        disabled={!preloadComplete || loadingStems[type]}
      >
        {loadingStems[type] && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
            <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div>
          </div>
        )}
        <span className="text-lg mb-1">{typeConfig.name}</span>
        {currentStems[type] ? (
          <span className="text-xs opacity-70">{currentStems[type].name}</span>
        ) : (
          <span className="text-xs opacity-50">None selected</span>
        )}
      </button>
    );
  };

  const renderModal = () => {
    if (!modalOpen || !selectedStemType) return null;
    const stemsForType = filterStemsByType(selectedStemType);
    const typeConfig = STEM_TYPES[selectedStemType];
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-[#1e1833] rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Select {STEM_TYPES[selectedStemType].name}</h2>
            <button onClick={handleCloseModal} className="text-white/50 hover:text-white">
              ✕
            </button>
          </div>

          {stemsForType.length === 0 ? (
            <p className="text-center py-4 text-white/60">
              No {STEM_TYPES[selectedStemType].name.toLowerCase()} stems found in your collection. Try
              scanning more QR codes!
            </p>
          ) : (
            <div className="space-y-2">
              {stemsForType.map((stem) => (
                <button
                  key={stem._id || stem.identifier}
                  onClick={() => {
                    handleStemSelection(stem);
                  }}
                  className={`
                        w-full text-left p-3 rounded-lg
                        ${loadingStems[selectedStemType] ? "opacity-50" : ""}
                        ${
                          currentStems[selectedStemType]?.identifier === stem.identifier
                            ? "bg-white/20 border border-white/30"
                            : "bg-white/5 hover:bg-white/10"
                        }
                      `}
                  disabled={loadingStems[selectedStemType]}
                >
                  <div className="font-medium">{stem.name}</div>
                  <div className="text-sm text-white/70">{stem.artist}</div>
                  <div className="flex justify-between text-xs text-white/50 mt-1">
                    <span>{stem.key || "Unknown key"}</span>
                    <span>{stem.bpm || "---"} BPM</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderActionButtons = () => (
    <div className="mt-auto flex flex-col md:flex-row gap-4 pt-4">
      <button
        onClick={handleSaveMashup}
        className="mt-4 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg"
      >
        💾 Save Mashup
      </button>
      <button
        onClick={() => console.log("Navigate to Share screen")}
        className="rounded-full py-3 flex-1 flex items-center justify-center bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:shadow-lg transition-all"
      >
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
    console.log("Ready modal state:", {
      currentUserReady,
      waitingForOthers,
      readyCount,
      totalUsers,
    });
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="rounded-xl p-8 bg-[#1e1833] text-center max-w-md">
          <div className="text-[#8B5CF6] text-5xl mb-4">♪♫</div>
          {!currentUserReady ? (
            <>
              <h2 className="text-2xl font-bold mb-4 text-white">Ready to Mix?</h2>
              <h3 className="text-2xl font-bold mb-4 text-white">Your session code is: {sessionCode}</h3>
              <p className="mb-6 text-white/70">
                Click the button below to initialize audio and start mixing with your friends!
              </p>
              <button
                onClick={handleReadyClick}
                className="py-3 px-8 rounded-full font-medium bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:shadow-md transition-all text-white"
              >
                I'm Ready!
              </button>
            </>
          ) : waitingForOthers ? (
            <>
              <h2 className="text-2xl font-bold mb-4 text-white">Waiting for Others</h2>
              <p className="mb-6 text-white/70">
                {readyCount} of {totalUsers} users are ready...
              </p>
              <div className="animate-pulse text-[#8B5CF6] text-2xl">⏳</div>
              <button
                onClick={() => setShowReadyModal(false)}
                className="mt-4 py-2 px-4 rounded-full text-sm bg-red-500/20 text-red-500"
              >
                Debug: Force Close
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-4 text-white">Everyone's Ready!</h2>
              <p className="mb-6 text-white/70">All users are ready to start mixing!</p>
              <button
                onClick={() => setShowReadyModal(false)}
                className="py-3 px-8 rounded-full font-medium bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:shadow-md transition-all text-white"
              >
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
          {/* Preload overlay */}
          {!preloadComplete && stems.length > 0 && (
            <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
              <div className="text-2xl mb-4">Loading Stems...</div>
              <div className="w-64 h-4 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{ width: `${preloadProgress}%` }}
                />
              </div>
              <div className="mt-2">{Math.round(preloadProgress)}%</div>
            </div>
          )}
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
