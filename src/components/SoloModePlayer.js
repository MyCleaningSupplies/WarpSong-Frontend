import React, { useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { useGamification } from "../context/GamificationContext";
import LevelUpModal from "../components/LevelUpModal";
import {
  ArrowLeft,
  Download,
  Share2,
  Music,
  Info,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";

// Helper: Normalize identifiers
const normalizeId = (id) => id?.trim().toLowerCase();

// Define stem types
const STEM_TYPES = {
  DRUMS: {
    name: "Drums",
    color: "#EC4899",
    match: (type) => type?.toLowerCase() === "drums",
  },
  BASS: {
    name: "Bass",
    color: "#F97316",
    match: (type) => type?.toLowerCase() === "bass",
  },
  MELODIE: {
    name: "Melodie",
    color: "#06B6D4",
    match: (type) => type?.toLowerCase() === "melodie",
  },
  VOCALS: {
    name: "Vocals",
    color: "#8B5CF6",
    match: (type) => type?.toLowerCase() === "vocals",
  },
};

// Custom Button Component
const FestivalButton = ({
  children,
  onClick,
  variant = "default",
  glow = false,
  disabled = false,
  className = "",
}) => {
  const baseClasses =
    "px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center justify-center";

  const variantClasses = {
    default: `bg-gradient-to-r from-purple-600 to-pink-600 text-white ${
      glow ? "shadow-lg shadow-purple-500/25" : ""
    }`,
    outline:
      "bg-white/10 backdrop-blur-sm border border-purple-500/30 text-purple-400 hover:bg-purple-500/10",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${
        disabled ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"
      } ${className}`}
    >
      {children}
    </button>
  );
};

const SoloModePlayer = () => {
  const navigate = useNavigate();
  const { updateStats } = useGamification();
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [newLevel, setNewLevel] = useState(1);

  // State
  const [stems, setStems] = useState([]);
  const [currentStems, setCurrentStems] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(130);
  const [selectedStemType, setSelectedStemType] = useState(null);
  const [showStemSelector, setShowStemSelector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [loadingStems, setLoadingStems] = useState({});
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
  const [visualizerData, setVisualizerData] = useState(Array(64).fill(0));
  const [stemVisualizerData, setStemVisualizerData] = useState({
    DRUMS: Array(5).fill(0),
    BASS: Array(5).fill(0),
    MELODIE: Array(5).fill(0),
    VOCALS: Array(5).fill(0),
  });
  const [isMuted, setIsMuted] = useState(false);

  // Refs for Tone.js objects
  const mainMixerRef = useRef(null);
  const playerRefs = useRef({});
  const volumeNodeRefs = useRef({});
  const buffersRef = useRef({});
  const playbackTimeoutRef = useRef(null);
  const mainAnalyzerRef = useRef(null);
  const stemAnalyzersRef = useRef({});
  const animationFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const loopRef = useRef(null);
  const loopStartTimeRef = useRef(0);
  const loopLengthRef = useRef(8); // Default 8 bars

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

        // Set initial mute state
        mixer.gain.value = isMuted ? 0 : 0.8; // Initial volume

        // Create main analyzer for visualization
        const analyzer = new Tone.Analyser("fft", 128);
        mainAnalyzerRef.current = analyzer;

        mixer.connect(analyzer);
        mixer.connect(limiter);
        limiter.toDestination();
        mainMixerRef.current = mixer;

        // Set initial BPM
        Tone.Transport.bpm.value = bpm;

        // Create a loop to track playback position
        const loopLength = loopLengthRef.current;
        const loop = new Tone.Loop((time) => {
          // This loop runs once per measure to keep track of position
          // We don't need to do anything here, it just keeps the transport in sync
        }, "1m").start(0);

        loopRef.current = loop;

        setAudioInitialized(true);
        console.log("✅ Audio system initialized with mixer and analyzer");
        return true;
      } catch (error) {
        console.error("❌ Error initializing audio:", error);
        return false;
      }
    }
    return true;
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const newMuteState = !prev;
      if (mainMixerRef.current) {
        mainMixerRef.current.gain.value = newMuteState ? 0 : 0.8;
      }
      return newMuteState;
    });
  };

  // Initialize audio context
  useEffect(() => {
    // Clean up function
    return () => {
      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Clear any pending timeouts
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }

      // Clean up Tone.js resources
      Tone.Transport.stop();

      if (loopRef.current) {
        loopRef.current.dispose();
      }

      Object.values(playerRefs.current).forEach((player) => {
        if (player) {
          try {
            if (player.state === "started") {
              player.stop();
            }
            player.dispose();
          } catch (err) {
            console.warn("Error disposing player:", err);
          }
        }
      });

      Object.values(volumeNodeRefs.current).forEach((node) => {
        if (node) {
          try {
            node.dispose();
          } catch (err) {
            console.warn("Error disposing volume node:", err);
          }
        }
      });

      Object.values(stemAnalyzersRef.current).forEach((analyzer) => {
        if (analyzer) {
          try {
            analyzer.dispose();
          } catch (err) {
            console.warn("Error disposing stem analyzer:", err);
          }
        }
      });

      if (mainAnalyzerRef.current) {
        try {
          mainAnalyzerRef.current.dispose();
        } catch (err) {
          console.warn("Error disposing main analyzer:", err);
        }
      }

      if (mainMixerRef.current) {
        try {
          mainMixerRef.current.dispose();
        } catch (err) {
          console.warn("Error disposing main mixer:", err);
        }
      }
    };
  }, []);

  // Update visualizer data
  const updateVisualizer = () => {
    if (!mainAnalyzerRef.current || !isPlaying) return;

    // Get frequency data from main analyzer
    const frequencyData = mainAnalyzerRef.current.getValue();

    // Process data for main visualizer
    const processedData = Array(64).fill(0);
    for (let i = 0; i < 64; i++) {
      // Map analyzer data to visualizer bars (0-63)
      const index = Math.floor((i * frequencyData.length) / 64);
      // Convert to dB scale and normalize (values are typically -100 to 0)
      const value = Math.max(0, 100 + frequencyData[index]) / 100;
      processedData[i] = value;
    }
    setVisualizerData(processedData);

    // Process data for stem visualizers
    const newStemData = { ...stemVisualizerData };

    // Update each stem's visualizer data if it has an analyzer
    Object.entries(stemAnalyzersRef.current).forEach(([type, analyzer]) => {
      if (!analyzer) return;

      const stemFreqData = analyzer.getValue();
      const stemData = Array(5).fill(0);

      for (let i = 0; i < 5; i++) {
        // Sample 5 points from the frequency data
        const index = Math.floor((i * stemFreqData.length) / 5);
        const value = Math.max(0, 100 + stemFreqData[index]) / 100;
        stemData[i] = value;
      }

      newStemData[type] = stemData;
    });

    setStemVisualizerData(newStemData);

    // Request next animation frame
    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  // Start/stop visualizer based on playback state
  useEffect(() => {
    if (isPlaying) {
      // Start visualization
      updateVisualizer();
    } else if (animationFrameRef.current) {
      // Stop visualization
      cancelAnimationFrame(animationFrameRef.current);

      // Reset visualizer data
      setVisualizerData(
        Array(64)
          .fill(0)
          .map(() => 0.1 + Math.random() * 0.2)
      );
      setStemVisualizerData({
        DRUMS: Array(5)
          .fill(0)
          .map(() => 0.1 + Math.random() * 0.2),
        BASS: Array(5)
          .fill(0)
          .map(() => 0.1 + Math.random() * 0.2),
        MELODIE: Array(5)
          .fill(0)
          .map(() => 0.1 + Math.random() * 0.2),
        VOCALS: Array(5)
          .fill(0)
          .map(() => 0.1 + Math.random() * 0.2),
      });
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Initialize canvas for visualization
  useEffect(() => {
    if (!showStemSelector && canvasRef.current) {
      // Set initial random values for visualizers when not playing
      if (!isPlaying) {
        setVisualizerData(
          Array(64)
            .fill(0)
            .map(() => 0.1 + Math.random() * 0.2)
        );
        setStemVisualizerData({
          DRUMS: Array(5)
            .fill(0)
            .map(() => 0.1 + Math.random() * 0.2),
          BASS: Array(5)
            .fill(0)
            .map(() => 0.1 + Math.random() * 0.2),
          MELODIE: Array(5)
            .fill(0)
            .map(() => 0.1 + Math.random() * 0.2),
          VOCALS: Array(5)
            .fill(0)
            .map(() => 0.1 + Math.random() * 0.2),
        });
      }
    }
  }, [showStemSelector, isPlaying]);

  // Update BPM when changed
  useEffect(() => {
    if (audioInitialized) {
      Tone.Transport.bpm.value = bpm;
    }
  }, [bpm, audioInitialized]);

  // Check if playback is ready when stems change
  useEffect(() => {
    const hasStems = Object.values(currentStems).some(Boolean);
    setPlaybackReady(hasStems);
  }, [currentStems]);

  // Fetch user's stems from backend
  useEffect(() => {
    const fetchStems = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE_URL}/api/user/my-stems`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStems(response.data);
        setLoading(false);
      } catch (error) {
        console.error("❌ Error fetching stems:", error);
        setLoading(false);
      }
    };

    fetchStems();
  }, [navigate]);

  // Preload metadata only, not full audio files
  useEffect(() => {
    if (stems.length > 0 && !preloadComplete) {
      preloadMetadata();
    }
  }, [stems, preloadComplete]);

  // Preload metadata only
  const preloadMetadata = async () => {
    if (stems.length === 0) return;

    console.log(`Preloading metadata for ${stems.length} audio files...`);
    setPreloadProgress(0);

    // Just mark as complete without loading full files
    let loaded = 0;
    const increment = 100 / stems.length;

    // Simulate loading progress without actually loading full files
    for (let i = 0; i < stems.length; i++) {
      loaded++;
      setPreloadProgress(loaded * increment);
      // Small delay to show progress
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log("Preloading metadata complete!");
    setPreloadComplete(true);

    // Set initial random values for visualizers
    setVisualizerData(
      Array(64)
        .fill(0)
        .map(() => 0.1 + Math.random() * 0.2)
    );
    setStemVisualizerData({
      DRUMS: Array(5)
        .fill(0)
        .map(() => 0.1 + Math.random() * 0.2),
      BASS: Array(5)
        .fill(0)
        .map(() => 0.1 + Math.random() * 0.2),
      MELODIE: Array(5)
        .fill(0)
        .map(() => 0.1 + Math.random() * 0.2),
      VOCALS: Array(5)
        .fill(0)
        .map(() => 0.1 + Math.random() * 0.2),
    });
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
        const stemType = Object.keys(currentStems).find(
          (type) => currentStems[type] === stem
        );

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

        // Create analyzer for this stem
        if (stemType) {
          const stemAnalyzer = new Tone.Analyser("fft", 32);
          stemAnalyzersRef.current[stemType] = stemAnalyzer;

          // Connect player to volume node to stem analyzer to main mixer
          player.connect(volumeNode);
          volumeNode.connect(stemAnalyzer);
        } else {
          // Connect player directly to volume node to main mixer
          player.connect(volumeNode);
        }
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

  // Filter stems by type
  const filterStemsByType = (type) => {
    const filtered = stems.filter((stem) => {
      const stemType = stem.type?.toLowerCase() || "";
      const matches = STEM_TYPES[type].match(stemType);
      return matches;
    });
    console.log(`Filtered stems for ${type}:`, filtered);
    return filtered;
  };

  // Handle stem selection
  const switchStem = async (newStem, stemType) => {
    const initialized = await ensureAudioInitialized();
    if (!initialized) {
      console.error("Could not initialize audio");
      return;
    }

    // Now we can be sure mainMixerRef.current exists
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

        if (volumeNodeRefs.current[prevKey]) {
          volumeNodeRefs.current[prevKey].dispose();
          delete volumeNodeRefs.current[prevKey];
        }

        // Dispose stem analyzer if exists
        if (stemAnalyzersRef.current[stemType]) {
          stemAnalyzersRef.current[stemType].dispose();
          delete stemAnalyzersRef.current[stemType];
        }
      }

      // Load buffer for this stem
      console.log(`Loading buffer for ${key}...`);
      const buffer = await loadBuffer(newStem);
      console.log(`Buffer loaded for ${key}`);

      // Update state first to show the stem is selected
      setCurrentStems((prev) => ({ ...prev, [stemType]: newStem }));

      // If we're playing, create and start the player immediately
      if (isPlaying) {
        await createAndStartPlayer(newStem, key, buffer, stemType);
      }
    } catch (error) {
      console.error(`❌ Error switching to stem ${key}:`, error);
    } finally {
      setLoadingStems((prev) => ({ ...prev, [stemType]: false }));
    }
  };

  // Create and start a player for a stem
  const createAndStartPlayer = async (stem, key, buffer, stemType) => {
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

    // Create analyzer for this stem
    if (stemType) {
      const stemAnalyzer = new Tone.Analyser("fft", 32);
      stemAnalyzersRef.current[stemType] = stemAnalyzer;

      // Connect player to volume node to stem analyzer to main mixer
      player.connect(volumeNode);
      volumeNode.connect(stemAnalyzer);
    } else {
      // Connect player directly to volume node to main mixer
      player.connect(volumeNode);
    }
    volumeNode.connect(mainMixerRef.current);

    // Store references
    playerRefs.current[key] = player;
    volumeNodeRefs.current[key] = volumeNode;

    // Start the player if we're currently playing
    // The key fix: start at the current transport position, not from the beginning
    if (isPlaying) {
      // Get current transport position
      const currentPosition = Tone.Transport.position;
      console.log(
        `Starting player at current transport position: ${currentPosition}`
      );

      // Start immediately at the current position
      player.start();
    }
  };

  // Toggle track active state
  const toggleTrack = (stemType, e) => {
    e.stopPropagation();

    const stem = currentStems[stemType];
    if (!stem) return;

    const key = normalizeId(stem.identifier);
    const player = playerRefs.current[key];

    if (player) {
      if (player.state === "started") {
        player.stop();
        console.log(`Stopped player for ${key}`);
      } else if (isPlaying) {
        // Start at current transport position
        player.start();
        console.log(
          `Started player for ${key} at position ${Tone.Transport.position}`
        );
      }
    }
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
    // Reset transport position to ensure we start from the beginning of the loop
    Tone.Transport.position = 0;
    loopStartTimeRef.current = Tone.now();

    // Start transport first
    Tone.Transport.start();

    // Start all active players
    Object.entries(currentStems).forEach(([type, stem]) => {
      if (!stem) return;

      const key = normalizeId(stem.identifier);
      const player = playerRefs.current[key];

      if (player) {
        // Make sure player is in stopped state
        if (player.state === "started") {
          player.stop();
        }
        // Start immediately - they will sync to transport
        player.start();
      }
    });

    setIsPlaying(true);
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

    setIsPlaying(false);
  };

  // Handle stem selection
  const handleSelectStem = (stem, stemType) => {
    switchStem(stem, stemType);
    setShowStemSelector(false);
    setSelectedStemType(null);
  };

  // Handle save
  const handleSave = async () => {
    try {
      const mashupData = {
        name: "My Awesome Mashup", // Get the mashup name from the user
        stemIds: stems.map((stem) => stem._id), // IDs of all selected stems
        isPublic: true, // Set visibility preference
      };

      const token = localStorage.getItem("token");

      const response = await axios.post(
        `${API_BASE_URL}/api/mashup/save`,
        mashupData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Check if the response includes gamification data and if user leveled up
      if (response.data.gamification && response.data.gamification.leveledUp) {
        setNewLevel(response.data.gamification.level);
        setLevelUpVisible(true);
      }

      // Refresh gamification stats after saving mashup
      await updateStats();

      // Redirect to success page
      navigate("/mashup-success");
    } catch (error) {
      console.error("❌ Error saving mashup:", error);
    }
  };

  // Handle share
  const handleShare = () => {
    navigate("/share");
  };

  // Handle stem type selection
  const handleStemTypeSelect = async (type) => {
    // Initialize audio on first interaction
    if (!audioInitialized) {
      const initialized = await ensureAudioInitialized();
      if (!initialized) {
        console.error("Could not initialize audio");
        return;
      }
    }

    if (showStemSelector && selectedStemType === type) {
      setShowStemSelector(false);
      setSelectedStemType(null);
    } else {
      setShowStemSelector(true);
      setSelectedStemType(type);
    }
  };

  // Increase/decrease BPM
  const increaseBpm = () => {
    setBpm((prev) => Math.min(prev + 5, 200));
  };

  const decreaseBpm = () => {
    setBpm((prev) => Math.max(prev - 5, 60));
  };

  return (
    <div className="min-h-screen bg-[hsl(260,20%,10%)] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back
        </button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
          Solo Mode Studio
        </h1>
        <div className="w-10">
          <button
            onClick={toggleMute}
            className="text-white/70 hover:text-white transition-colors"
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Visualizer */}
      <div className="mx-6 rounded-3xl bg-[#1A1429]/50 overflow-hidden relative mb-6">
        {showStemSelector ? (
          <div className="p-6 relative z-10">
            <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              Choose a {STEM_TYPES[selectedStemType]?.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[70vh]">
              {filterStemsByType(selectedStemType).length === 0 ? (
                <p className="text-center py-4 text-white/60 col-span-2">
                  No {STEM_TYPES[selectedStemType]?.name.toLowerCase()} stems
                  found in your collection. Try scanning more QR codes!
                </p>
              ) : (
                filterStemsByType(selectedStemType).map((stem) => (
                  <div
                    key={stem._id || stem.identifier}
                    onClick={() => handleSelectStem(stem, selectedStemType)}
                    className={`bg-[#1E1833]/80 p-4 rounded-lg transition-all duration-300 hover:bg-[#1E1833] text-left cursor-pointer ${
                      loadingStems[selectedStemType] ? "opacity-50" : ""
                    } ${
                      currentStems[selectedStemType]?.identifier ===
                      stem.identifier
                        ? "border border-[#8B5CF6]/50"
                        : "border border-transparent"
                    }`}
                  >
                    <div className="font-medium">{stem.name}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Info className="h-3 w-3 text-white/50" />
                      <p className="text-xs text-white/50">
                        {stem.artist || "Unknown artist"} -{" "}
                        {stem.song || "Unknown song"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 flex flex-col items-center">
            <div className="text-center mb-6">
              <Music className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-white/80">Solo Mixing</p>
              <p className="text-xs text-white/50 mt-1">
                Mix your collected stems without constraints
              </p>
            </div>

            {/* Main visualizer bars */}
            <div className="h-48 w-full flex items-end justify-center gap-1 mb-4">
              {visualizerData.map((value, i) => {
                // Calculate height based on value (0-1)
                const barHeight = Math.max(5, value * 100);
                const color =
                  i % 4 === 0
                    ? "#8B5CF6"
                    : i % 4 === 1
                    ? "#EC4899"
                    : i % 4 === 2
                    ? "#F97316"
                    : "#06B6D4";

                return (
                  <div
                    key={i}
                    className="w-2 rounded-full"
                    style={{
                      height: `${barHeight}%`,
                      background: color,
                      opacity: isPlaying ? 1 : 0.3,
                      animation: isPlaying
                        ? `pulse ${0.5 + Math.random()}s ease-in-out infinite alternate`
                        : "none",
                    }}
                  />
                );
              })}
            </div>

            {/* BPM controls */}
            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={decreaseBpm}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                -
              </button>
              <div className="text-center">
                <div className="text-xl font-bold">{bpm}</div>
                <div className="text-xs text-white/50">BPM</div>
              </div>
              <button
                onClick={increaseBpm}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Track Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 mb-6">
        {Object.entries(STEM_TYPES).map(([type, data]) => {
          const stem = currentStems[type];
          const isActive =
            !!stem &&
            isPlaying &&
            playerRefs.current[normalizeId(stem?.identifier)]?.state ===
              "started";
          const stemData = stemVisualizerData[type];

          return (
            <div
              key={type}
              onClick={() => handleStemTypeSelect(type)}
              className="bg-[#1A1429]/80 rounded-xl p-4 text-left relative cursor-pointer transition-all duration-300 hover:bg-[#1A1429]/90"
            >
              {loadingStems[type] && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                  <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="font-medium">{data.name}</span>
                {stem && (
                  <div
                    onClick={(e) => toggleTrack(type, e)}
                    className="w-5 h-5 flex items-center justify-center text-white/70 cursor-pointer hover:text-white transition-colors"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    >
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                      <path d="M17.96 6.04a9 9 0 0 1 0 12.73"></path>
                      <path d="M6.16 6.16a9 9 0 0 1 12.68 0"></path>
                      <path d="M8.59 8.59a5 5 0 0 1 7.07 0"></path>
                      <circle cx="12" cy="12" r="1"></circle>
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 mt-1">
                <Info className="h-3 w-3 text-white/50" />
                <p className="text-xs text-white/50 truncate">
                  {stem
                    ? `${stem.artist || "Unknown"} - ${stem.song || "Unknown"}`
                    : "None selected"}
                </p>
              </div>

              {/* Mini visualizer */}
              {stem && (
                <div className="h-10 flex items-end justify-center gap-1 mt-2">
                  {stemData.map((value, i) => {
                    // Calculate height based on value (0-1)
                    const barHeight = Math.max(10, value * 100);
                    const color = STEM_TYPES[type].color;

                    return (
                      <div
                        key={i}
                        className="w-1 rounded-full"
                        style={{
                          height: `${barHeight}%`,
                          background: color,
                          opacity: isActive ? 1 : 0.3,
                          animation: isActive
                            ? `pulse ${0.3 + Math.random() * 0.3}s ease-in-out infinite alternate`
                            : "none",
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 px-6 mb-6">
        <FestivalButton
          onClick={handlePlayPause}
          disabled={
            !preloadComplete ||
            playbackLoading ||
            (!isPlaying && !playbackReady)
          }
          className="flex-1 py-3 px-6"
        >
          {playbackLoading ? (
            <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
          ) : isPlaying ? (
            <>
              <Pause className="h-5 w-5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              <span>Play</span>
            </>
          )}
        </FestivalButton>

        <FestivalButton
          onClick={handleSave}
          variant="outline"
          className="flex-1 py-3 px-6 text-gray-400"
        >
          <Download className="h-5 w-5" />
          Save
        </FestivalButton>

        <FestivalButton onClick={handleShare} className="flex-1 py-3 px-6">
          <Share2 className="h-5 w-5" />
          Share
        </FestivalButton>
      </div>

      {/* Level Up Modal */}
      <LevelUpModal
        visible={levelUpVisible}
        level={newLevel}
        onClose={() => setLevelUpVisible(false)}
      />

      {/* Add animation keyframes in a style tag */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scaleY(0.7);
          }
          100% {
            transform: scaleY(1);
          }
        }
        .animate-pulse {
          animation: pulse 0.8s ease-in-out infinite alternate;
        }
      `}</style>

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
    </div>
  );
};

export default SoloModePlayer;

