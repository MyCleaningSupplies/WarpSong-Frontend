import React, { useEffect, useCallback, useRef, useState } from "react";
import { StemPlayerProvider, useStemPlayer } from "../../context/StemPlayerContext";
import Header from "./Header";
import SessionControls from "./SessionControls";
import Visualizer from "./Visualizer";
import StemTypeSelection from "./StemTypeSelection";
import StemSelectionModal from "./StemSelectionModal";
import ReadyModal from "./ReadyModal";
import ActionButtons from "./ActionButtons";
import { useSocket } from "../../context/SocketContext";
import * as Tone from "tone";
import { API_BASE_URL } from "../../config/api";

// (Optional helper: throttle function)
const throttle = (func, limit) => {
  let inThrottle;
  return function (...args) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

const StemPlayerContent = () => {
  const { socket } = useSocket();
  const { audioEngine, stemManagement, sessionManagement, playbackControls } = useStemPlayer();
  const toneInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Tone.js Audio Context on a user gesture
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

  // Handle Play/Pause: toggles audio and emits playback-control via socket
  const handlePlayPause = useCallback(async () => {
    if (!toneInitialized.current) {
      const success = await initializeAudio();
      if (!success) return;
    }
    const newPlayingState = !audioEngine.isPlaying;
    audioEngine.setIsPlaying(newPlayingState);
    setIsLoading(true);

    if (sessionManagement.isInSession) {
      if (newPlayingState) {
        console.log("Starting Tone.Transport...");
        Tone.Transport.start("+0.01");
        Object.values(audioEngine.playerRefs.current).forEach((player) => {
          if (player && player.state !== "started") {
            player.start("+0.01");
          }
        });
      } else {
        console.log("Stopping Tone.Transport...");
        Object.values(audioEngine.playerRefs.current).forEach((player) => {
          if (player && player.state === "started") {
            player.stop("+0.01");
          }
        });
        Tone.Transport.stop();
        Tone.Transport.position = 0;
      }
      if (socket && sessionManagement.sessionCode) {
        socket.emit("playback-control", {
          sessionCode: sessionManagement.sessionCode,
          isPlaying: newPlayingState,
          timestamp: Date.now(),
        });
      }
    }
    setIsLoading(false);
  }, [audioEngine, socket, sessionManagement]);

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(260,20%,10%)] p-6">
      <Header />
      <SessionControls 
        isInSession={sessionManagement.isInSession}
        sessionCode={sessionManagement.sessionCode}
        joinSession={sessionManagement.joinSession}
        createSessionHandler={sessionManagement.createSessionHandler}
        leaveSession={sessionManagement.leaveSession}
        connectedUsers={sessionManagement.connectedUsers}
      />
      {sessionManagement.isInSession ? (
        <>
          <Visualizer
            loading={stemManagement.loading}
            loadingStems={stemManagement.loadingStems}
            preloadProgress={stemManagement.preloadProgress}
            handlePlayPause={handlePlayPause}
            isPlaying={audioEngine.isPlaying}
            playbackReady={audioEngine.playbackReady}
            preloadComplete={stemManagement.preloadComplete}
            playbackLoading={audioEngine.playbackLoading}
            bpm={audioEngine.bpm}
            decreaseBpm={playbackControls.decreaseBpm}
            increaseBpm={playbackControls.increaseBpm}
            sessionCode={sessionManagement.sessionCode}
            socket={socket}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(stemManagement.STEM_TYPES).map(([type, typeConfig]) => (
              <StemTypeSelection
                key={type}
                type={type}
                typeConfig={typeConfig}
                currentStems={stemManagement.currentStems}
                loadingStems={stemManagement.loadingStems}
                preloadComplete={stemManagement.preloadComplete}
                handleOpenModal={() => stemManagement.handleOpenModal(type)}
              />
            ))}
          </div>
          <StemSelectionModal
            modalOpen={stemManagement.modalOpen}
            selectedStemType={stemManagement.selectedStemType}
            handleCloseModal={stemManagement.handleCloseModal}
            STEM_TYPES={stemManagement.STEM_TYPES}
            filterStemsByType={stemManagement.filterStemsByType}
            loadingStems={stemManagement.loadingStems}
            currentStems={stemManagement.currentStems}
            handleStemSelection={stemManagement.handleStemSelection}
            sessionCode={sessionManagement.sessionCode}
            socket={socket}
          />
          <ActionButtons
            selectedStems={Object.values(stemManagement.currentStems).filter(Boolean)}
            sessionCode={sessionManagement.sessionCode}
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-2xl text-white/70 mb-4">Join or create a session to start mixing</div>
          <div className="text-white/50">Collaborate with friends in real-time</div>
          <button 
            onClick={initializeAudio}
            className="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition"
          >
            Initialize Audio
          </button>
        </div>
      )}
      <ReadyModal
        showReadyModal={sessionManagement.showReadyModal}
        sessionCode={sessionManagement.sessionCode}
        handleReadyClick={sessionManagement.setUserReady}
        connectedUsers={sessionManagement.connectedUsers}
        readyUsers={sessionManagement.readyUsers}
        allUsersReady={sessionManagement.allUsersReady}
        setShowReadyModal={sessionManagement.setShowReadyModal}
        socket={socket}
      />
    </div>
  );
};

const StemPlayer = () => {
  return (
    <StemPlayerProvider>
      <StemPlayerContent />
    </StemPlayerProvider>
  );
};

export default StemPlayer;