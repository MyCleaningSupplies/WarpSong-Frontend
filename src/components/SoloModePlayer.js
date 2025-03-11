import React, { useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

// Helper: Normalize identifiers
const normalizeId = (id) => id?.trim().toLowerCase();

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

// Map of musical keys to semitones
const keyToSemitones = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4,
  "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9,
  "A#": 10, "Bb": 10, "B": 11
};

const SoloModePlayer = () => {
  const navigate = useNavigate();
  
  // State
  const [stems, setStems] = useState([]);
  const [currentStems, setCurrentStems] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(130);
  const [targetKey, setTargetKey] = useState(null);
  const [selectedStemType, setSelectedStemType] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [loadingStems, setLoadingStems] = useState({});
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);

  // Refs for Tone.js objects
  const mainMixerRef = useRef(null);
  const playerRefs = useRef({});
  const volumeNodeRefs = useRef({});
  const pitchShifterRefs = useRef({});
  const buffersRef = useRef({});
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
  
  // Initialize audio context
  useEffect(() => {
    // Clean up function
    return () => {
      // Clear any pending timeouts
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }
      
      // Clean up Tone.js resources
      Tone.Transport.stop();
      
      Object.values(playerRefs.current).forEach(player => {
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
      
      Object.values(volumeNodeRefs.current).forEach(node => {
        if (node) {
          try {
            node.dispose();
          } catch (err) {
            console.warn("Error disposing volume node:", err);
          }
        }
      });
      
      Object.values(pitchShifterRefs.current).forEach(shifter => {
        if (shifter) {
          try {
            shifter.dispose();
          } catch (err) {
            console.warn("Error disposing pitch shifter:", err);
          }
        }
      });
      
      if (mainMixerRef.current) {
        try {
          mainMixerRef.current.dispose();
        } catch (err) {
          console.warn("Error disposing main mixer:", err);
        }
      }
    };
  }, []);

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
    // Update any API calls in this component
    // For example, if there's a fetchStems function:
    const fetchStems = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE_URL}/api/user/my-stems`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStems(response.data);
      } catch (error) {
        console.error("❌ Error fetching stems:", error);
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
      await new Promise(resolve => setTimeout(resolve, 50));
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
      await Promise.all(activeStems.map(stem => {
        const id = normalizeId(stem.identifier);
        // Only load if not already loaded
        if (!buffersRef.current[id] || !buffersRef.current[id].loaded) {
          return loadBuffer(stem);
        }
        return Promise.resolve();
      }));
      
      // Pre-create all audio nodes
      activeStems.forEach(stem => {
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
          overlap: 0.05
        }).sync();
        
        // Create volume node
        const volumeNode = new Tone.Volume(0);
        
        // Apply key shift if needed
        if (targetKey && stem.key) {
          const semitoneShift = getSemitoneShift(stem.key, targetKey);
          if (semitoneShift !== 0) {
            // Create optimized pitch shifter
            const pitchShifter = new Tone.PitchShift({
              pitch: semitoneShift,
              windowSize: 0.05, // Smaller window size for faster processing
              delayTime: 0,
              feedback: 0
            });
            
            // Connect player -> pitchShifter -> volume -> output
            player.connect(pitchShifter);
            pitchShifter.connect(volumeNode);
            
            // Store reference
            pitchShifterRefs.current[key] = pitchShifter;
          } else {
            // No pitch shift needed
            player.connect(volumeNode);
          }
        } else {
          // No key information
          player.connect(volumeNode);
        }
        
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

  // Calculate semitone shift for key matching
  const getSemitoneShift = (originalKey, targetKey) => {
    if (!originalKey || !targetKey || !keyToSemitones[originalKey] || !keyToSemitones[targetKey]) return 0;
    return keyToSemitones[targetKey] - keyToSemitones[originalKey];
  };

  // Handle stem selection & key matching
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
    setLoadingStems(prev => ({ ...prev, [stemType]: true }));

    try {
      // Set the first selected key as target key
      if (!targetKey && newStem.key) {
        setTargetKey(newStem.key);
        console.log(`🎶 Target key set to: ${newStem.key}`);
      }

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
        
        if (pitchShifterRefs.current[prevKey]) {
          pitchShifterRefs.current[prevKey].dispose();
          delete pitchShifterRefs.current[prevKey];
        }
        
        if (volumeNodeRefs.current[prevKey]) {
          volumeNodeRefs.current[prevKey].dispose();
          delete volumeNodeRefs.current[prevKey];
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
        await createAndStartPlayer(newStem, key, buffer);
      }
    } catch (error) {
      console.error(`❌ Error switching to stem ${key}:`, error);
    } finally {
      setLoadingStems(prev => ({ ...prev, [stemType]: false }));
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
      overlap: 0.05
    }).sync();
    
    // Create volume node
    const volumeNode = new Tone.Volume(0);
    
    // Apply key shift if needed using PitchShift
    if (targetKey && stem.key) {
      const semitoneShift = getSemitoneShift(stem.key, targetKey);
      if (semitoneShift !== 0) {
        console.log(`🔄 Transposing ${stem.identifier} by ${semitoneShift} semitones`);
        
        // Create optimized pitch shifter
        const pitchShifter = new Tone.PitchShift({
          pitch: semitoneShift,
          windowSize: 0.05, // Smaller window size for faster processing
          delayTime: 0,
          feedback: 0
        });
        
        // Connect player -> pitchShifter -> volume -> output
        player.connect(pitchShifter);
        pitchShifter.connect(volumeNode);
        
        // Store reference to pitch shifter
        pitchShifterRefs.current[key] = pitchShifter;
      } else {
        // No pitch shift needed, connect directly
        player.connect(volumeNode);
      }
    } else {
      // No key information, connect directly
      player.connect(volumeNode);
    }
    
    // Connect volume to main mixer
    volumeNode.connect(mainMixerRef.current);
    
    // Store references
    playerRefs.current[key] = player;
    volumeNodeRefs.current[key] = volumeNode;

    // Start the player if we're currently playing
    if (isPlaying) {
      player.start("+0.1");
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
  };
  
  const pausePlayback = () => {
    // Stop all players first
    Object.values(playerRefs.current).forEach(player => {
      if (player && player.state === "started") {
        player.stop();
      }
    });
    
    // Then stop transport
    Tone.Transport.pause();
    Tone.Transport.position = 0; // Reset position
    
    setIsPlaying(false);
  };

  // Handle BPM change
  const handleBpmChange = (e) => {
    const newBpm = parseInt(e.target.value, 10);
    setBpm(newBpm);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1429] to-[#06001F] text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => navigate("/")} 
            className="text-white/70 hover:text-white"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold">Solo Mode</h1>
          <div></div> {/* Empty div for flex spacing */}
        </div>
        
        {/* Main controls */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                isPlaying 
                  ? "bg-red-500 hover:bg-red-600" 
                  : playbackReady ? "bg-green-500 hover:bg-green-600" : "bg-gray-500"
              }`}
              disabled={!preloadComplete || playbackLoading || (!isPlaying && !playbackReady)}
            >
              {playbackLoading ? (
                <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div>
              ) : (
                isPlaying ? "⏸" : "▶"
              )}
            </button>
            
            {/* BPM Slider */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-sm">BPM:</span>
              <input
                type="range"
                min="60"
                max="200"
                value={bpm}
                onChange={handleBpmChange}
                className="flex-1"
              />
              <span className="text-sm font-mono w-8">{bpm}</span>
            </div>
            
            {/* Target Key Display */}
            <div className="bg-white/10 px-3 py-1 rounded-full text-sm">
              Key: {targetKey || "Auto"}
            </div>
          </div>
        </div>
        
        {/* Stem Type Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(STEM_TYPES).map(([type, data]) => (
            <button
              key={type}
              onClick={async () => {
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
              }}
              className={`
                p-4 rounded-xl flex flex-col items-center justify-center
                ${currentStems[type] ? `bg-${data.color}/20` : "bg-white/5"}
                hover:bg-white/10 transition-colors
                ${loadingStems[type] ? 'relative' : ''}
              `}
              style={{ 
                borderColor: currentStems[type] ? data.color : "transparent",
                borderWidth: currentStems[type] ? "1px" : "0px"
              }}
              disabled={!preloadComplete || loadingStems[type]}
            >
              {loadingStems[type] && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                  <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div>
                </div>
              )}
              <span className="text-lg mb-1">{data.name}</span>
              {currentStems[type] ? (
                <span className="text-xs opacity-70">
                  {currentStems[type].name}
                </span>
              ) : (
                <span className="text-xs opacity-50">None selected</span>
              )}
            </button>
          ))}
        </div>
        
        {/* Loading indicator */}
        {loading && !preloadComplete && (
          <div className="flex justify-center my-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
        
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
        
        {/* Stem Selection Modal */}
        {modalOpen && selectedStemType && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#1e1833] rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  Select {STEM_TYPES[selectedStemType].name}
                </h2>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              {filterStemsByType(selectedStemType).length === 0 ? (
                <p className="text-center py-4 text-white/60">
                  No {STEM_TYPES[selectedStemType].name.toLowerCase()} stems found in your collection.
                  Try scanning more QR codes!
                </p>
              ) : (
                <div className="space-y-2">
                  {filterStemsByType(selectedStemType).map((stem) => (
                    <button
                      key={stem._id || stem.identifier}
                      onClick={() => {
                        switchStem(stem, selectedStemType);
                        setModalOpen(false);
                      }}
                      className={`
                        w-full text-left p-3 rounded-lg
                        ${loadingStems[selectedStemType] ? 'opacity-50' : ''}
                        ${currentStems[selectedStemType]?.identifier === stem.identifier 
                          ? 'bg-white/20 border border-white/30' 
                          : 'bg-white/5 hover:bg-white/10'}
                      `}
                      disabled={loadingStems[selectedStemType]}
                    >
                      <div className="font-medium">{stem.name}</div>
                      <div className="text-sm text-white/70">{stem.artist}</div>
                      <div className="flex justify-between text-xs text-white/50 mt-1">
                        <span>{stem.key || 'Unknown key'}</span>
                        <span>{stem.bpm || '---'} BPM</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoloModePlayer;
