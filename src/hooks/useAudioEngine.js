import { useState, useRef, useEffect } from 'react';
import * as Tone from 'tone';

// Helper: Normalize identifiers for consistent key usage.
export const normalizeId = (id) => id?.trim().toLowerCase();

export default function useAudioEngine() {
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [mainAnalyzer, setMainAnalyzer] = useState(null);
  const [bpm, setBpm] = useState(130);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
  
  // Refs for Tone.js objects
  const mainMixerRef = useRef(null);
  const playerRefs = useRef({});
  const volumeNodeRefs = useRef({});
  const analyzerRefs = useRef({});
  const buffersRef = useRef({});
  const playbackTimeoutRef = useRef(null);
  
  const REFERENCE_BPM = 130;

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

  // Optimized player creation for faster startup
  const createReliablePlayer = (key, buffer) => {
    // Safely dispose of any existing player
    if (playerRefs.current[key]) {
      try {
        if (playerRefs.current[key].state === "started") {
          playerRefs.current[key].stop("+0.01"); // Faster stop time
        }
        playerRefs.current[key].dispose();
      } catch (error) {
        console.warn(`Error disposing player ${key}:`, error);
      }
    }

    try {
      // Create a new player with optimized settings for faster startup
      const player = new Tone.Player({
        url: buffer,
        loop: true,
        fadeIn: 0.01, // Reduced from 0.05
        fadeOut: 0.01, // Reduced from 0.05
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

  // Optimized stop function for faster response
  const stopAllPlayers = async () => {
    console.log("Stopping all players...");

    // First stop the transport
    Tone.Transport.stop();

    // Use a faster stop time
    const safeStopTime = Tone.now() + 0.01; // Reduced from 0.1

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

  // Optimized buffer loading with faster timeout and caching
  const loadBuffer = async (stem) => {
    const id = normalizeId(stem.identifier);

    // Return cached buffer if available
    if (buffersRef.current[id] && buffersRef.current[id].loaded) {
      console.log(`Using cached buffer for ${id}`);
      return buffersRef.current[id];
    }

    console.log(`Loading buffer for ${id}...`);
    return new Promise((resolve, reject) => {
      // Use lower quality settings for faster loading
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
      
      // Set a shorter timeout to force resolve if loading takes too long
      setTimeout(() => {
        if (!buffer.loaded) {
          console.warn(`Buffer load timeout for ${id}, continuing anyway`);
          buffersRef.current[id] = buffer;
          resolve(buffer);
        }
      }, 3000); // Reduced from 5000 to 3000ms
    });
  };

  // Optimized audio preparation for faster playback
  const prepareAudioProcessing = async (currentStems) => {
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

    // Set loading state
    setPlaybackLoading(true);

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

      // Pre-create all audio nodes with optimized settings
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

        // Create player with optimized settings for faster startup
        const player = new Tone.Player({
          url: buffer,
          loop: true,
          fadeIn: 0.01, // Reduced from 0.05
          fadeOut: 0.01, // Reduced from 0.05
          // Lower quality for faster processing
          grainSize: 0.05, // Reduced from 0.1
          overlap: 0.01, // Reduced from 0.05
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

      // Set ready state immediately
      setPlaybackLoading(false);
      setPlaybackReady(true);
      
      // Notify that we're ready for playback
      console.log("✅ Audio processing prepared, ready for playback");
      
      return true;
    } catch (error) {
      console.error("Error preparing audio:", error);
      setPlaybackLoading(false);
      return false;
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

  const handleBpmChange = (newBpm) => {
    setBpm(newBpm);
    Tone.Transport.bpm.value = newBpm;
    Object.values(playerRefs.current).forEach((player) => {
      player.playbackRate = newBpm / REFERENCE_BPM;
    });
    return newBpm;
  };

  // Optimized play/pause handler for faster response
  const handlePlayPause = (isRemote = false, socket = null, sessionCode = null) => {
    console.log(`Handling play/pause, isRemote: ${isRemote}`);
    
    // If we're not ready to play, don't do anything
    if (!playbackReady) {
      console.log("Playback not ready yet");
      return;
    }

    // Prevent multiple executions for the same state
    const newPlayingState = !isPlaying;
    if (isPlaying === newPlayingState) {
      console.log("Playback state already matches requested state");
      return;
    }
    
    // Update state and handle Tone.js transport
    setIsPlaying(newPlayingState);
    
    if (newPlayingState) {
      // Start playback with minimal delay
      const startTime = "+0.01"; // Reduced from 0.1 to 0.01
      Tone.Transport.start(startTime);
      Object.values(playerRefs.current).forEach(player => {
        if (player && player.state !== "started") {
          player.start(startTime);
        }
      });
    } else {
      // Stop playback with minimal delay
      const stopTime = "+0.01"; // Reduced from 0.1 to 0.01
      Object.values(playerRefs.current).forEach(player => {
        if (player && player.state === "started") {
          player.stop(stopTime);
        }
      });
      Tone.Transport.stop();
      Tone.Transport.position = 0;
    }
    
    // Only emit socket event if this is a local action and socket is provided
    if (!isRemote && socket && sessionCode) {
      socket.emit("playback-control", {
        sessionCode,
        isPlaying: newPlayingState,
        timestamp: Date.now() // Add timestamp for better synchronization
      });
    }
  };

  // Add a function to notify when playback is ready
  const notifyPlaybackReady = (socket, sessionCode) => {
    if (socket && sessionCode && playbackReady) {
      console.log("🎵 Notifying server that playback is ready");
      socket.emit('playback-ready', {
        sessionCode,
        userId: socket.id,
        timestamp: Date.now()
      });
    }
  };

  return {
    audioInitialized,
    setAudioInitialized,
    mainAnalyzer,
    bpm,
    setBpm,
    isPlaying,
    setIsPlaying,
    playbackLoading,
    setPlaybackLoading,
    playbackReady,
    setPlaybackReady,
    mainMixerRef,
    playerRefs,
    volumeNodeRefs,
    analyzerRefs,
    buffersRef,
    playbackTimeoutRef,
    ensureAudioInitialized,
    createReliablePlayer,
    stopAllPlayers,
    loadBuffer,
    prepareAudioProcessing,
    handleVolumeChange,
    handleMute,
    handleBpmChange,
    handlePlayPause,
    notifyPlaybackReady, // New function to notify server
  };
}
