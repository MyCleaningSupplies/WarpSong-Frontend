import React, { useState, useRef, useEffect } from "react";
import * as Tone from "tone";
import axios from "axios";
import Header from "./Header";
import SessionControls from "./SessionControls";
import Visualizer from "./Visualizer";
import StemTypeSelection from "./StemTypeSelection";
import StemSelectionModal from "./StemSelectionModal";
import ReadyModal from "./ReadyModal";
import ActionButtons from "./ActionButtons";
import { API_BASE_URL } from "../../config/api";

// Helper: Normalize identifiers
const normalizeId = (id) => id?.trim().toLowerCase();

// Define stem types (with a simple match function)
const STEM_TYPES = {
  DRUMS: { 
    name: "Drums", 
    color: "#EC4899",
    match: (type) => type.toLowerCase() === "drums"
  },
  BASS: { 
    name: "Bass", 
    color: "#F97316",
    match: (type) => type.toLowerCase() === "bass"
  },
  MELODIE: { 
    name: "Melodie", 
    color: "#06B6D4",
    match: (type) => type.toLowerCase() === "melodie"
  },
  VOCALS: { 
    name: "Vocals", 
    color: "#8B5CF6",
    match: (type) => type.toLowerCase() === "vocals"
  },
};

const StemPlayer = () => {
  /* ------------------ Simulated Session State ------------------ */
  const [isInSession, setIsInSession] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [readyUsers, setReadyUsers] = useState([]);
  const [showReadyModal, setShowReadyModal] = useState(false);
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
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStemType, setSelectedStemType] = useState(null);

  /* ------------------ Tone.js Refs ------------------ */
  const mainMixerRef = useRef(null);
  const playerRefs = useRef({});
  const volumeNodeRefs = useRef({});
  const buffersRef = useRef({});
  const playbackTimeoutRef = useRef(null);

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

  /* ------------------ Update BPM ------------------ */
  useEffect(() => {
    if (toneInitialized.current) {
      Tone.Transport.bpm.value = bpm;
    }
  }, [bpm]);

  /* ------------------ Playback Ready Check ------------------ */
  useEffect(() => {
    const hasStems = Object.values(currentStems).some(Boolean);
    setPlaybackReady(hasStems);
  }, [currentStems]);

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

  /* ------------------ Preload Metadata ------------------ */
  const preloadMetadata = async () => {
    if (stems.length === 0) return;
    console.log(`Preloading metadata for ${stems.length} audio files...`);
    setPreloadProgress(0);
    let loaded = 0;
    const increment = 100 / stems.length;
    for (let i = 0; i < stems.length; i++) {
      loaded++;
      setPreloadProgress(loaded * increment);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    console.log("Preloading metadata complete!");
  };

  useEffect(() => {
    if (stems.length > 0) {
      preloadMetadata();
    }
  }, [stems]);

  /* ------------------ Load Buffer ------------------ */
  const loadBuffer = async (stem) => {
    const id = normalizeId(stem.identifier);
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

  /* ------------------ Prepare Audio Processing ------------------ */
  const prepareAudioProcessing = async () => {
    const initialized = await ensureAudioInitialized();
    if (!initialized) {
      console.error("Could not initialize audio");
      return false;
    }
    const activeStems = Object.values(currentStems).filter(Boolean);
    if (activeStems.length === 0) {
      console.log("No stems selected for playback");
      return false;
    }
    try {
      await Promise.all(
        activeStems.map((stem) => {
          const id = normalizeId(stem.identifier);
          if (!buffersRef.current[id] || !buffersRef.current[id].loaded) {
            return loadBuffer(stem);
          }
          return Promise.resolve();
        })
      );
      activeStems.forEach((stem) => {
        const key = normalizeId(stem.identifier);
        if (playerRefs.current[key]) return;
        const buffer = buffersRef.current[key];
        if (!buffer) {
          console.error(`Buffer not found for ${key}`);
          return;
        }
        // Create player without pitch shifting logic
        const player = new Tone.Player({
          url: buffer,
          loop: true,
          fadeIn: 0.05,
          fadeOut: 0.05,
          grainSize: 0.1,
          overlap: 0.05,
        }).sync();
        const volumeNode = new Tone.Volume(0);
        // Directly connect player to volume node (no key matching)
        player.connect(volumeNode);
        volumeNode.connect(mainMixerRef.current);
        playerRefs.current[key] = player;
        volumeNodeRefs.current[key] = volumeNode;
      });
      return true;
    } catch (error) {
      console.error("Error preparing audio:", error);
      return false;
    }
  };

  /* ------------------ Handle Stem Selection ------------------ */
  const handleStemSelection = (stem, type) => {
    console.log("Stem selected:", stem, "for type:", type);
    setCurrentStems((prev) => ({ ...prev, [type]: stem }));
    setModalOpen(false);
    // If already playing, immediately load buffer and start player for this stem
    if (isPlaying) {
      const id = normalizeId(stem.identifier);
      loadBuffer(stem)
        .then((buffer) => createAndStartPlayer(stem, id, buffer))
        .catch((err) => console.error(err));
    }
  };

  /* ------------------ Create and Start Player ------------------ */
  const createAndStartPlayer = async (stem, key, buffer) => {
    const player = new Tone.Player({
      url: buffer,
      loop: true,
      fadeIn: 0.05,
      fadeOut: 0.05,
      grainSize: 0.1,
      overlap: 0.05,
    }).sync();
    const volumeNode = new Tone.Volume(0);
    // Directly connect player to volume node (no pitch shifting)
    player.connect(volumeNode);
    volumeNode.connect(mainMixerRef.current);
    playerRefs.current[key] = player;
    volumeNodeRefs.current[key] = volumeNode;
    if (isPlaying) {
      player.start("+0.1");
    }
  };

  /* ------------------ Playback Control ------------------ */
  const handlePlayPause = async () => {
    if (isPlaying) {
      pausePlayback();
      return;
    }
    setPlaybackLoading(true);
    try {
      const prepared = await prepareAudioProcessing();
      if (!prepared) {
        console.error("Failed to prepare audio");
        setPlaybackLoading(false);
        return;
      }
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
    Tone.Transport.start();
    const startTime = "+0.05";
    Object.entries(currentStems).forEach(([type, stem]) => {
      if (!stem) return;
      const key = normalizeId(stem.identifier);
      const player = playerRefs.current[key];
      if (player) {
        if (player.state === "started") player.stop();
        player.start(startTime);
      }
    });
    setIsPlaying(true);
  };

  const pausePlayback = () => {
    Object.values(playerRefs.current).forEach((player) => {
      if (player && player.state === "started") player.stop();
    });
    Tone.Transport.pause();
    Tone.Transport.position = 0;
    setIsPlaying(false);
  };

  const handleBpmChange = (e) => {
    const newBpm = parseInt(e.target.value, 10);
    setBpm(newBpm);
  };

  /* ------------------ Simulated Session Management ------------------ */
  const createSessionHandler = async () => {
    const dummyCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    setSessionCode(dummyCode);
    setIsInSession(true);
    setConnectedUsers(["localUser"]);
    setShowReadyModal(true);
    console.log("Created session with code:", dummyCode);
    return dummyCode;
  };

  const joinSession = async (code) => {
    if (!code || code.length !== 4) {
      setError("Session code must be 4 characters");
      return false;
    }
    setSessionCode(code);
    setIsInSession(true);
    setConnectedUsers(["host", "localUser"]);
    setShowReadyModal(true);
    console.log("Joined session with code:", code);
    return true;
  };

  const leaveSession = () => {
    setSessionCode("");
    setIsInSession(false);
    setConnectedUsers([]);
    setReadyUsers([]);
    setShowReadyModal(false);
    setError(null);
  };

  const setUserReady = async () => {
    const success = await ensureAudioInitialized();
    if (!success) return;
    setReadyUsers(["localUser"]);
    setShowReadyModal(false);
  };

  /* ------------------ Filter Stems by Type ------------------ */
  const filterStemsByType = (type) => {
    const filtered = stems.filter((stem) => {
      const stemType = stem.type?.toLowerCase() || "";
      return STEM_TYPES[type].match(stemType);
    });
    console.log(`Filtered stems for ${type}:`, filtered);
    return filtered;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(260,20%,10%)] p-6">
      <Header />
      <SessionControls
        isInSession={isInSession}
        sessionCode={sessionCode}
        joinSession={joinSession}
        createSessionHandler={createSessionHandler}
        leaveSession={leaveSession}
        connectedUsers={connectedUsers}
      />
      {isInSession ? (
        <>
          <Visualizer
            loading={false}
            loadingStems={loadingStems}
            preloadProgress={preloadProgress}
            handlePlayPause={handlePlayPause}
            isPlaying={isPlaying}
            playbackReady={playbackReady}
            preloadComplete={true}
            playbackLoading={playbackLoading}
            bpm={bpm}
            decreaseBpm={() => setBpm((prev) => Math.max(60, prev - 1))}
            increaseBpm={() => setBpm((prev) => Math.min(200, prev + 1))}
            sessionCode={sessionCode}
            handleBpmChange={handleBpmChange}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.keys(STEM_TYPES).map((type) => (
              <StemTypeSelection
                key={type}
                type={type}
                typeConfig={STEM_TYPES[type]}
                currentStems={currentStems}
                loadingStems={loadingStems}
                preloadComplete={true}
                handleOpenModal={() => {
                  setModalOpen(true);
                  setSelectedStemType(type);
                }}
              />
            ))}
          </div>
          <StemSelectionModal
            modalOpen={modalOpen}
            selectedStemType={selectedStemType}
            handleCloseModal={() => setModalOpen(false)}
            STEM_TYPES={STEM_TYPES}
            filterStemsByType={filterStemsByType}
            loadingStems={loadingStems}
            currentStems={currentStems}
            handleStemSelection={handleStemSelection}
            sessionCode={sessionCode}
          />
          <ActionButtons
            selectedStems={Object.values(currentStems).filter(Boolean)}
            sessionCode={sessionCode}
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-2xl text-white/70 mb-4">
            Create a session to start mixing
          </div>
          <button
            onClick={createSessionHandler}
            className="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition"
          >
            Create Session
          </button>
        </div>
      )}
      <ReadyModal
        showReadyModal={showReadyModal}
        sessionCode={sessionCode}
        handleReadyClick={setUserReady}
        connectedUsers={connectedUsers}
        readyUsers={readyUsers}
        allUsersReady={readyUsers.length === connectedUsers.length}
        setShowReadyModal={setShowReadyModal}
        socket={{ id: "localUser" }}
      />
    </div>
  );
};

export default StemPlayer;