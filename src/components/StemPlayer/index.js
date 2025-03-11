import React, { useState, useRef, useCallback } from "react";
import * as Tone from "tone";
import Header from "./Header";
import SessionControls from "./SessionControls";
import Visualizer from "./Visualizer";
import StemTypeSelection from "./StemTypeSelection";
import StemSelectionModal from "./StemSelectionModal";
import ReadyModal from "./ReadyModal";
import ActionButtons from "./ActionButtons";

const StemPlayer = () => {
  // SIMULATED SESSION MANAGEMENT (collaboration disabled)
  const [isInSession, setIsInSession] = useState(true);
  const [sessionCode, setSessionCode] = useState("SIMU"); // dummy session code
  const [connectedUsers, setConnectedUsers] = useState(["localUser"]);
  const [readyUsers, setReadyUsers] = useState(["localUser"]);
  const [showReadyModal, setShowReadyModal] = useState(false);

  // SIMULATED AUDIO ENGINE & PLAYBACK STATE
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(130);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(true);

  // SIMULATED STEM MANAGEMENT (using local state)
  // Pre-load dummy stems for a couple of types:
  const [currentStems, setCurrentStems] = useState({
    DRUMS: { identifier: "drum1", name: "Drums 1", fileUrl: "/audio/drum1.mp3" },
    BASS: { identifier: "bass1", name: "Bass 1", fileUrl: "/audio/bass1.mp3" },
    // MELODIE and VOCALS could be added similarly if needed.
  });
  const [loadingStems, setLoadingStems] = useState({});
  const [preloadProgress, setPreloadProgress] = useState(100);
  const [modalOpen, setModalOpen] = useState(false);

  // Tone.js initialization simulation
  const toneInitialized = useRef(false);
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

  // Play/Pause handler without socket (local simulation)
  const handlePlayPause = useCallback(async () => {
    if (!toneInitialized.current) {
      const success = await initializeAudio();
      if (!success) return;
    }
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    if (newPlayingState) {
      console.log("Starting Tone.Transport...");
      Tone.Transport.start("+0.01");
    } else {
      console.log("Stopping Tone.Transport...");
      Tone.Transport.stop();
      Tone.Transport.position = 0;
    }
  }, [isPlaying]);

  const decreaseBpm = () => setBpm((prev) => Math.max(60, prev - 1));
  const increaseBpm = () => setBpm((prev) => Math.min(200, prev + 1));

  // Stem selection: update local state
  const handleStemSelection = (stem, type) => {
    console.log("Selected stem:", stem, "for type:", type);
    setCurrentStems((prev) => ({ ...prev, [type]: stem }));
    setModalOpen(false);
  };

  // "I'm Ready!" handler for the ready modal (simulated)
  const handleReadyClick = async () => {
    await initializeAudio();
    // Simulate that the local user is ready.
    setReadyUsers(["localUser"]);
    setShowReadyModal(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(260,20%,10%)] p-6">
      <Header />

      {/* Simulated Session Controls */}
      <SessionControls 
        isInSession={isInSession}
        sessionCode={sessionCode}
        joinSession={() => {}}
        createSessionHandler={() => {}}
        leaveSession={() => {}}
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
            decreaseBpm={decreaseBpm}
            increaseBpm={increaseBpm}
            sessionCode={sessionCode}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {["DRUMS", "BASS", "MELODIE", "VOCALS"].map((type) => (
              <StemTypeSelection
                key={type}
                type={type}
                typeConfig={{ name: type, color: "#EC4899" }}
                currentStems={currentStems}
                loadingStems={loadingStems}
                preloadComplete={true}
                handleOpenModal={() => setModalOpen(true)}
              />
            ))}
          </div>

          <StemSelectionModal
            modalOpen={modalOpen}
            selectedStemType={"DRUMS"} // You can adjust this based on your UI
            handleCloseModal={() => setModalOpen(false)}
            STEM_TYPES={{
              DRUMS: { name: "Drums" },
              BASS: { name: "Bass" },
              MELODIE: { name: "Melodie" },
              VOCALS: { name: "Vocals" },
            }}
            filterStemsByType={(type) => {
              // Return a dummy list for each type
              return [
                { identifier: type.toLowerCase() + "1", name: type + " 1", artist: "Artist" },
                { identifier: type.toLowerCase() + "2", name: type + " 2", artist: "Artist" },
              ];
            }}
            loadingStems={loadingStems}
            currentStems={currentStems}
            handleStemSelection={handleStemSelection}
            sessionCode={sessionCode}
          />

          <ActionButtons
            selectedStems={Object.values(currentStems)}
            sessionCode={sessionCode}
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-2xl text-white/70 mb-4">
            Join or create a session to start mixing
          </div>
          <div className="text-white/50">
            Collaborate with friends in real-time
          </div>
          <button 
            onClick={initializeAudio}
            className="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition"
          >
            Initialize Audio
          </button>
        </div>
      )}

      {/* Old Ready Modal */}
      <ReadyModal
        showReadyModal={showReadyModal}
        sessionCode={sessionCode}
        handleReadyClick={handleReadyClick}
        connectedUsers={connectedUsers}
        readyUsers={readyUsers}
        allUsersReady={readyUsers.length === connectedUsers.length}
        setShowReadyModal={setShowReadyModal}
        socket={{ id: "localUser" }} // Dummy socket object for modal purposes
      />
    </div>
  );
};

export default StemPlayer;