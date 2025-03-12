import React, { useState, useRef, useEffect } from "react";
import * as Tone from "tone";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Users, Wand2, RefreshCw, PlusCircle, UserPlus, Check, Music, QrCode, Play } from "lucide-react";
import Header from "./Header";
import { API_BASE_URL } from "../../config/api";

// Helper: Normalize identifiers
const normalizeId = (id) => id?.trim().toLowerCase();

// Define stem types (with a simple match function)
const STEM_TYPES = {
  DRUMS: { 
    name: "Drums", 
    color: "#EC4899", // Festival pink
    match: (type) => type.toLowerCase() === "drums"
  },
  BASS: { 
    name: "Bass", 
    color: "#F97316", // Festival orange
    match: (type) => type.toLowerCase() === "bass"
  },
  MELODIE: { 
    name: "Melodie", // Keeping this as "Melodie" for backend compatibility
    color: "#06B6D4", // Festival cyan
    match: (type) => type.toLowerCase() === "melodie"
  },
  VOCALS: { 
    name: "Vocals", 
    color: "#8B5CF6", // Festival purple
    match: (type) => type.toLowerCase() === "vocals"
  },
};

// Festival Button Component
const FestivalButton = ({ children, onClick, variant = "default", glow = false, disabled = false, className = "" }) => {
  const baseClasses = "px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center justify-center";
  
  const variantClasses = {
    default: `bg-gradient-to-r from-purple-600 to-pink-600 text-white ${glow ? "shadow-lg shadow-purple-500/25" : ""}`,
    outline: "bg-white/10 backdrop-blur-sm border border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"} ${className}`}
    >
      {children}
    </button>
  );
};

const StemPlayer = () => {
  const navigate = useNavigate();
  
  /* ------------------ Session State ------------------ */
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showJoinSession, setShowJoinSession] = useState(false);
  const [showSessionLobby, setShowSessionLobby] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [sessionParticipants, setSessionParticipants] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);

  /* ------------------ Audio & Playback State ------------------ */
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(130);
  const [playbackReady, setPlaybackReady] = useState(false);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const toneInitialized = useRef(false);

  /* ------------------ Stem Management State ------------------ */
  const [stems, setStems] = useState([]);
  const [currentStems, setCurrentStems] = useState({});
  const [loadingStems, setLoadingStems] = useState({});
  const [preloadProgress, setPreloadProgress] = useState(0);

  /* ------------------ Tone.js Refs ------------------ */
  const mainMixerRef = useRef(null);
  const playerRefs = useRef({});
  const volumeNodeRefs = useRef({});
  const buffersRef = useRef({});
  const playbackTimeoutRef = useRef(null);

  // Get username from localStorage if profile exists
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      setUsername(`User${Math.floor(Math.random() * 1000)}`);
    }
  }, []);

  /* ------------------ Audio Initialization ------------------ */
  const ensureAudioInitialized = async () => {
    if (!toneInitialized.current) {
      try {
        console.log("Initializing audio context...");
        await Tone.start();
        if (Tone.context.state !== "running") {
          await Tone.context.resume();
        }
        const limiter = new Tone.Limiter(-3);
        const mixer = new Tone.Gain(0.8);
        mixer.connect(limiter);
        limiter.toDestination();
        mainMixerRef.current = mixer;
        Tone.Transport.bpm.value = bpm;
        toneInitialized.current = true;
        console.log("✅ Audio system initialized with mixer");
        return true;
      } catch (error) {
        console.error("❌ Error initializing audio:", error);
        setError("Audio initialization failed");
        return false;
      }
    }
    return true;
  };

  /* ------------------ Cleanup ------------------ */
  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      Tone.Transport.stop();
      Object.values(playerRefs.current).forEach((player) => {
        try {
          if (player.state === "started") player.stop();
          player.dispose();
        } catch (err) {
          console.warn("Error disposing player:", err);
        }
      });
      Object.values(volumeNodeRefs.current).forEach((node) => {
        try {
          node.dispose();
        } catch (err) {
          console.warn("Error disposing volume node:", err);
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

  /* ------------------ Load User Stems from API ------------------ */
  const loadUserStems = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/api/user/my-stems`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStems(response.data);
      console.log("User stems loaded:", response.data);
      setPreloadProgress(100);
    } catch (err) {
      console.error("❌ Error loading stems:", err);
      setError("Failed to load stems");
    }
  };

  useEffect(() => {
    loadUserStems();
  }, []);

  // Generate a random 4-letter code
  const generateSessionCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  };

  // Handle creating a new session
  const handleCreateSession = async () => {
    await ensureAudioInitialized();
    const code = generateSessionCode();
    setSessionCode(code);
    
    // Initialize with current user
    setSessionParticipants([
      {
        id: "user-1",
        name: username,
        ready: false,
        stemType: "Drums" // Host automatically gets drums
      }
    ]);
    
    setShowCreateSession(false);
    setShowSessionLobby(true);
  };

  // Handle joining an existing session
  const handleJoinSession = async () => {
    await ensureAudioInitialized();
    if (sessionCode.length !== 4) return;
    
    // Simulate joining a session
    setSessionParticipants([
      {
        id: "host-1",
        name: "Host User",
        ready: false,
        stemType: "Drums"
      },
      {
        id: "user-1",
        name: username,
        ready: false,
        stemType: null
      }
    ]);
    
    setShowJoinSession(false);
    setShowSessionLobby(true);
  };

  // Simulate another user joining (for demo)
  const handleAddParticipant = () => {
    if (sessionParticipants.length >= 4) return;
    
    const stemTypes = ["Drums", "Bass", "Melodie", "Vocals"];
    const availableStemTypes = stemTypes.filter(type => 
      !sessionParticipants.some(p => p.stemType === type)
    );
    
    if (availableStemTypes.length > 0) {
      setSessionParticipants([
        ...sessionParticipants,
        {
          id: `user-${sessionParticipants.length + 1}`,
          name: `User${Math.floor(Math.random() * 1000)}`,
          ready: Math.random() > 0.5, // Randomly set ready status
          stemType: availableStemTypes[0]
        }
      ]);
    }
  };

  // Toggle ready status for current user
  const toggleReady = () => {
    setIsReady(!isReady);
    
    // Update ready status in participants list
    setSessionParticipants(
      sessionParticipants.map(p => 
        p.name === username ? { ...p, ready: !isReady } : p
      )
    );

    // If user is now ready, navigate to SoloModePlayer
    if (!isReady) {
      navigate("/solo-mode");
    }
  };

  // Check if all participants are ready
  const allReady = sessionParticipants.every(p => p.ready);
  
  // Start the remix when everyone is ready
  const startRemix = () => {
    // Only proceed if all participants are ready
    if (allReady) {
      navigate("/solo-mode");
    }
  };

  // Choose a stem type for the current user
  const chooseStemType = (type) => {
    // Check if the stem type is already taken
    if (sessionParticipants.some(p => p.stemType === type && p.name !== username)) {
      return;
    }
    
    // Update the current user's stem type
    setSessionParticipants(
      sessionParticipants.map(p => 
        p.name === username ? { ...p, stemType: type } : p
      )
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in bg-gradient-to-br from-[#1A1429] via-[#211937] to-[#06001F]">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-[#8B5CF6]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-[#EC4899]/20 rounded-full blur-3xl animate-pulse" />
      </div>

      {showSessionLobby ? (
        <div className="max-w-2xl w-full bg-white/5 backdrop-blur-sm rounded-3xl p-8 space-y-8 border border-white/10 shadow-xl">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Session Lobby</h2>
            <p className="text-gray-400">Code: <span className="font-mono text-white">{sessionCode}</span></p>
            <p className="text-sm text-gray-400">Wait until everyone is ready to begin</p>
          </div>
          
          {/* Participants */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {["Drums", "Bass", "Melodie", "Vocals"].map((type) => {
              const participant = sessionParticipants.find(p => p.stemType === type);
              const stemColor = Object.values(STEM_TYPES).find(t => t.name === type)?.color || "#8B5CF6";
              
              return (
                <div 
                  key={type}
                  className={`aspect-square rounded-2xl ${
                    participant ? "bg-white/5 backdrop-blur-sm border border-white/10" : "border-2 border-dashed border-white/10"
                  } flex flex-col items-center justify-center p-4 transition-all duration-300 ${
                    !participant && sessionParticipants.some(p => p.name === username && !p.stemType)
                      ? "cursor-pointer hover:border-white/30"
                      : ""
                  }`}
                  onClick={() => {
                    if (!participant && sessionParticipants.some(p => p.name === username && !p.stemType)) {
                      chooseStemType(type);
                    }
                  }}
                >
                  {participant ? (
                    <>
                      <div className="flex flex-col items-center mb-4">
                        <span className="text-sm font-medium">{participant.name}</span>
                        <span className="text-xs" style={{ color: stemColor }}>{type}</span>
                      </div>
                      
                      <div className="h-12 flex items-end justify-center gap-1 mb-4">
                        {[...Array(4)].map((_, j) => (
                          <div
                            key={j}
                            className="w-1.5 rounded-full animate-pulse"
                            style={{
                              height: `${Math.random() * 100}%`,
                              backgroundColor: `${stemColor}`,
                              animationDelay: `${j * 0.1}s`,
                              opacity: 0.7
                            }}
                          />
                        ))}
                      </div>
                      
                      <div className={`text-xs px-3 py-1 rounded-full ${
                        participant.ready 
                          ? `bg-[${stemColor}]/20 text-[${stemColor}]` 
                          : "bg-gray-700/50 text-gray-400"
                      }`}>
                        {participant.ready ? "Ready" : "Waiting..."}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                      <span style={{ color: stemColor }}>{type}</span>
                      <span className="text-xs mt-2">Available</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {sessionParticipants.length < 4 && (
              <FestivalButton 
                onClick={handleAddParticipant}
                variant="outline"
                className="text-gray-400"
              >
                <UserPlus className="mr-2 h-5 w-5" />
                Add Participant (Demo)
              </FestivalButton>
            )}
            
            <FestivalButton
              onClick={toggleReady}
              variant={isReady ? "default" : "outline"}
              glow={isReady}
              className={isReady ? "" : "text-gray-400"}
            >
              {isReady ? (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Ready
                </>
              ) : (
                "Ready to Begin"
              )}
            </FestivalButton>
            
            <FestivalButton
              onClick={startRemix}
              disabled={!allReady}
              glow={allReady}
              className={!allReady ? "opacity-50" : ""}
            >
              <Wand2 className="mr-2 h-5 w-5" />
              Start Mixing
            </FestivalButton>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl w-full space-y-12 text-center">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Music Sessions</h2>
            <p className="text-xl text-gray-400">
              Collaborate with others to create a unique remix
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-8 justify-center">
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 flex-1 space-y-6 transition-transform hover:scale-105 border border-white/10 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/20 text-[#8B5CF6] flex items-center justify-center mx-auto">
                <PlusCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Create Session</h3>
              <p className="text-gray-400">Start a new session and invite others</p>
              <FestivalButton 
                onClick={() => setShowCreateSession(true)} 
                glow
                className="w-full py-3"
              >
                New Session
              </FestivalButton>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 flex-1 space-y-6 transition-transform hover:scale-105 border border-white/10 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-[#EC4899]/20 text-[#EC4899] flex items-center justify-center mx-auto">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">Join</h3>
              <p className="text-gray-400">Join an existing session</p>
              <FestivalButton 
                onClick={() => setShowJoinSession(true)} 
                variant="outline"
                className="w-full py-3"
              >
                Join Session
              </FestivalButton>
            </div>
          </div>
        </div>
      )}

      {/* Create Session Dialog */}
      {showCreateSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="sm:max-w-md bg-[#1A1429]/95 backdrop-blur-lg rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                Create New Session
              </h2>
              <p className="text-center mt-4 text-base text-gray-400">
                You'll get a unique code to share with others for collaboration.
              </p>
            </div>
            <div className="flex flex-col items-center mt-6 gap-6">
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl w-full text-center border border-white/10">
                <p className="text-sm text-gray-400 mb-2">Your name</p>
                <input 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="text-center font-medium bg-transparent border border-white/10 rounded-md p-2 w-full focus:border-purple-500 focus:outline-none"
                />
              </div>
              <FestivalButton 
                onClick={handleCreateSession}
                glow
                className="w-full py-3"
              >
                Create Session
              </FestivalButton>
              <button 
                onClick={() => setShowCreateSession(false)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Session Dialog */}
      {showJoinSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="sm:max-w-md bg-[#1A1429]/95 backdrop-blur-lg rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                Join Session
              </h2>
              <p className="text-center mt-4 text-base text-gray-400">
                Enter the 4-letter code you received
              </p>
            </div>
            <div className="flex flex-col items-center mt-6 gap-6">
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl w-full text-center space-y-4 border border-white/10">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Your name</p>
                  <input 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="text-center font-medium bg-transparent border border-white/10 rounded-md p-2 w-full focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-2">Session code</p>
                  <input 
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    maxLength={4}
                    placeholder="ABCD"
                    className="text-center font-mono text-xl font-medium bg-transparent border border-white/10 rounded-md p-2 w-full focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
              <FestivalButton 
                onClick={handleJoinSession}
                glow
                disabled={sessionCode.length !== 4}
                className="w-full py-3"
              >
                Join
              </FestivalButton>
              <button 
                onClick={() => setShowJoinSession(false)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add some CSS for animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s infinite;
        }
        
        .text-gradient {
          background: linear-gradient(to right, #8B5CF6, #EC4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
};

export default StemPlayer;
