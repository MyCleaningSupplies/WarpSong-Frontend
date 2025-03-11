import React, { useState, useRef, useCallback, useEffect } from "react";
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

// Simulated Session Management: no socket, but local simulation
const StemPlayer = () => {
  // SESSION STATE (simulate hosting/joining)
  const [isInSession, setIsInSession] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [readyUsers, setReadyUsers] = useState([]);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [allUsersReady, setAllUsersReady] = useState(false);
  const [error, setError] = useState(null);

  // AUDIO & PLAYBACK STATE
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(130);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
  const toneInitialized = useRef(false);

  // STEM MANAGEMENT STATE (for user stems)
  const [stems, setStems] = useState([]);
  const [currentStems, setCurrentStems] = useState({});
  const [loadingStems, setLoadingStems] = useState({});
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  // Define stem types (as in your original code)
  const STEM_TYPES = {
    DRUMS: { name: "Drums", color: "#EC4899" },
    BASS: { name: "Bass", color: "#F97316" },
    MELODIE: { name: "Melodie", color: "#06B6D4" },
    VOCALS: { name: "Vocals", color: "#8B5CF6" },
  };

  // Initialize Tone.js Audio Context (must be triggered by a user gesture)
  const initializeAudio = async () => {
    if (!toneInitialized.current) {
      try {
        await Tone.start();
        console.log("✅ Audio context started");
        toneInitialized.current = true;
        return true;
      } catch (err) {
        console.error("❌ Failed to start audio context:", err);
        return false;
      }
    }
    return true;
  };

  // Simulated session creation: When the user clicks "Create Session"
  const createSessionHandler = async () => {
    // (Optionally, you could call an API to create a session.
    // Here we simulate it by generating a dummy code.)
    const dummyCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    setSessionCode(dummyCode);
    setIsInSession(true);
    setConnectedUsers(["localUser"]); // The host
    setShowReadyModal(true);
    console.log("✅ Created session with code:", dummyCode);
    return dummyCode;
  };

  // Simulated join: When the user enters a code and joins
  const joinSession = async (code) => {
    if (!code || code.length !== 4) {
      setError("Session code must be 4 characters");
      return false;
    }
    setSessionCode(code);
    setIsInSession(true);
    // Simulate that the session now has two users (host and joiner)
    setConnectedUsers(["host", "localUser"]);
    setShowReadyModal(true);
    console.log("✅ Joined session with code:", code);
    return true;
  };

  const leaveSession = () => {
    setSessionCode("");
    setIsInSession(false);
    setConnectedUsers([]);
    setReadyUsers([]);
    setAllUsersReady(false);
    setError(null);
  };

  // "I'm Ready!" handler: Mark the local user as ready
  const setUserReady = async () => {
    const success = await initializeAudio();
    if (!success) return;
    // In simulation, simply add "localUser" to readyUsers
    setReadyUsers((prev) => {
      const newReady = prev.includes("localUser") ? prev : [...prev, "localUser"];
      setAllUsersReady(connectedUsers.length > 0 && newReady.length === connectedUsers.length);
      return newReady;
    });
    setShowReadyModal(false);
  };

  // Load the logged in user's stems from your API
  const loadUserStems = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/api/user/my-stems`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStems(response.data);
      console.log("User stems loaded:", response.data);
      // Optionally, set preload progress to 100 immediately:
      setPreloadProgress(100);
    } catch (err) {
      console.error("Error loading stems:", err);
    }
  };

  useEffect(() => {
    loadUserStems();
  }, []);

  // Handle playback: simply toggle Tone.Transport
  const handlePlayPause = useCallback(async () => {
    if (!toneInitialized.current) {
      const success = await initializeAudio();
      if (!success) return;
    }
    const newState = !isPlaying;
    setIsPlaying(newState);
    if (newState) {
      console.log("Starting Tone.Transport...");
      Tone.Transport.start("+0.01");
    } else {
      console.log("Stopping Tone.Transport...");
      Tone.Transport.stop();
      Tone.Transport.position = 0;
    }
  }, [isPlaying]);

  // Dummy BPM adjustment functions
  const increaseBpm = () => setBpm((prev) => Math.min(200, prev + 1));
  const decreaseBpm = () => setBpm((prev) => Math.max(60, prev - 1));

  // Stem selection: update local currentStems
  const handleStemSelection = (stem, type) => {
    console.log("Stem selected:", stem, "for type:", type);
    setCurrentStems((prev) => ({ ...prev, [type]: stem }));
    setModalOpen(false);
  };

  // For this simulation, assume preload is complete (set to 100%)
  const preloadComplete = true;

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
            preloadComplete={preloadComplete}
            playbackLoading={playbackLoading}
            bpm={bpm}
            decreaseBpm={decreaseBpm}
            increaseBpm={increaseBpm}
            sessionCode={sessionCode}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.keys(STEM_TYPES).map((type) => (
              <StemTypeSelection
                key={type}
                type={type}
                typeConfig={STEM_TYPES[type]}
                currentStems={currentStems}
                loadingStems={loadingStems}
                preloadComplete={preloadComplete}
                handleOpenModal={() => setModalOpen(true)}
              />
            ))}
          </div>

          <StemSelectionModal
            modalOpen={modalOpen}
            selectedStemType={"DRUMS"} // For simulation, you can adjust this based on your UI logic
            handleCloseModal={() => setModalOpen(false)}
            STEM_TYPES={STEM_TYPES}
            filterStemsByType={(type) => {
              // Filter user's stems based on type (assumes stems have a "type" property)
              return stems.filter(
                (stem) => stem.type && stem.type.toLowerCase() === type.toLowerCase()
              );
            }}
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
        socket={{ id: "localUser" }} // Dummy socket object for modal display
      />
    </div>
  );
};

export default StemPlayer;