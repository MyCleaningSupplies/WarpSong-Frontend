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
import axios from "axios";
import { API_BASE_URL } from "../../config/api"; // Import API_BASE_URL

// Manual debounce implementation
const debounce = (func, wait) => {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
};

// Manual throttle implementation
const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Buffer cache to prevent reloading the same stems
const bufferCache = {};

const StemPlayerContent = () => {
  const { socket } = useSocket();
  const {
    audioEngine,
    stemManagement,
    sessionManagement,
    playbackControls,
  } = useStemPlayer();

  // Track if Tone.js has been initialized
  const toneInitialized = useRef(false);

  // State declarations
  const [isLoading, setIsLoading] = useState(false);
  const [allUsersReady, setAllUsersReady] = useState(false);
  const [error, setError] = useState(null);

  // Initialize Tone.js on user interaction
  const initializeAudio = async () => {
    if (!toneInitialized.current) {
      try {
        await Tone.start();
        console.log("✅ Audio context started");
        toneInitialized.current = true;
        return true;
      } catch (err) {
        console.error("❌ Failed to start audio context:", err);
        setError("Failed to initialize audio. Please try again.");
        return false;
      }
    }
    return true;
  };

  // Throttled BPM update
  const throttledEmitBpmChange = useCallback(
    throttle((socket, sessionCode, bpm) => {
      socket.emit("update-bpm", {
        sessionCode: sessionCode,
        bpm: bpm,
      });
    }, 200),
    []
  );

  // Optimized play/pause handler
  const handlePlayPause = useCallback(
    async (e) => {
      // Initialize audio on first interaction
      if (!toneInitialized.current) {
        const success = await initializeAudio();
        if (!success) return;
      }

      const performanceStart = performance.now();
      console.log("handlePlayPause triggered.");

      // Toggle the state locally first
      const newPlayingState = !audioEngine.isPlaying;
      audioEngine.setIsPlaying(newPlayingState);
      console.log(`Setting isPlaying to: ${newPlayingState}`);

      setIsLoading(true); // Set loading to true immediately
      console.log(`Setting isLoading to: true`);

      // Handle the actual audio playback with minimal delay
      if (allUsersReady) {
        console.log("All users are ready, starting playback.");
        if (newPlayingState) {
          console.log("Starting Tone.Transport...");
          Tone.Transport.start("+0.01"); // Faster start
          Object.values(audioEngine.playerRefs.current).forEach((player) => {
            if (player && player.state !== "started") {
              console.log(`Starting player: ${player.name}`);
              player.start("+0.01");
            }
          });
          setIsLoading(false); // Set loading to false when playback starts
          console.log(`Setting isLoading to: false (playback started)`);
        } else {
          console.log("Stopping Tone.Transport...");
          Object.values(audioEngine.playerRefs.current).forEach((player) => {
            if (player && player.state === "started") {
              console.log(`Stopping player: ${player.name}`);
              player.stop("+0.01");
            }
          });
          Tone.Transport.stop();
          Tone.Transport.position = 0;
          setIsLoading(false); // Set loading to false when playback stops
          console.log(`Setting isLoading to: false (playback stopped)`);
        }

        // Emit the new state to other clients
        if (socket && sessionManagement.sessionCode) {
          console.log("Emitting playback control event to socket...");
          socket.emit("playback-control", {
            sessionCode: sessionManagement.sessionCode,
            isPlaying: newPlayingState,
            timestamp: Date.now(),
          });
        }
      } else {
        console.log("Not all users are ready. Waiting...");
        setIsLoading(false);
      }

      const performanceEnd = performance.now();
      console.log(
        `Play/pause operation took ${performanceEnd - performanceStart}ms`
      );
    },
    [audioEngine, socket, sessionManagement.sessionCode, allUsersReady]
  );

  // Optimized BPM control functions
  const handleDecreaseBpm = useCallback(() => {
    playbackControls.decreaseBpm();
    // Emit BPM change to other users with throttling
    if (socket && sessionManagement.sessionCode) {
      throttledEmitBpmChange(
        socket,
        sessionManagement.sessionCode,
        audioEngine.bpm - 1
      );
    }
  }, [
    playbackControls,
    socket,
    sessionManagement.sessionCode,
    audioEngine.bpm,
    throttledEmitBpmChange,
  ]);

  const handleIncreaseBpm = useCallback(() => {
    playbackControls.increaseBpm();
    // Emit BPM change to other users with throttling
    if (socket && sessionManagement.sessionCode) {
      throttledEmitBpmChange(
        socket,
        sessionManagement.sessionCode,
        audioEngine.bpm + 1
      );
    }
  }, [
    playbackControls,
    socket,
    sessionManagement.sessionCode,
    audioEngine.bpm,
    throttledEmitBpmChange,
  ]);

  // Handle socket connection errors
  useEffect(() => {
    if (socket) {
      const handleError = (err) => {
        console.error("Socket error:", err);
        setError("Connection error. Please try refreshing the page.");
      };

      socket.on('connect_error', handleError);
      socket.on('error', handleError);

      return () => {
        socket.off('connect_error', handleError);
        socket.off('error', handleError);
      };
    }
  }, [socket]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(260,20%,10%)] p-6">
      <Header />

      <SessionControls 
        isInSession={sessionManagement.isInSession}
        sessionCode={sessionManagement.sessionCode}
        joinSession={sessionManagement.joinSession}
        createSessionHandler={async () => {
          console.log("Creating session...");
          try {
            // Initialize audio on first interaction
            if (!toneInitialized.current) {
              const success = await initializeAudio();
              if (!success) return;
            }
            
            setIsLoading(true);
            const response = await axios.post(
              `${API_BASE_URL}/api/remix/create`, // Use API_BASE_URL
              {},
              {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
              }
            );

            if (response.status === 200) {
              const { sessionCode } = response.data;
              console.log("✅ Created session with code:", sessionCode);
              sessionManagement.setSessionCode(sessionCode);
              socket.emit("join-session", { 
                sessionCode: sessionCode, 
                userId: socket.id 
              });
              sessionManagement.setIsInSession(true);
              sessionManagement.setShowReadyModal(true);
            }
          } catch (error) {
            console.error("❌ Error creating session:", error);
            setError("Failed to create session. Please try again.");
          } finally {
            setIsLoading(false);
          }
        }}
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
            decreaseBpm={handleDecreaseBpm}
            increaseBpm={handleIncreaseBpm}
            sessionCode={sessionManagement.sessionCode}
            socket={socket}
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(stemManagement.STEM_TYPES).map(
              ([type, typeConfig]) => (
                <StemTypeSelection
                  key={type}
                  type={type}
                  typeConfig={typeConfig}
                  currentStems={stemManagement.currentStems}
                  loadingStems={stemManagement.loadingStems}
                  preloadComplete={stemManagement.preloadComplete}
                  handleOpenModal={() => stemManagement.handleOpenModal(type)}
                />
              )
            )}
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

      <ReadyModal 
        showReadyModal={sessionManagement.showReadyModal}
        sessionCode={sessionManagement.sessionCode}
        setUserReady={sessionManagement.setUserReady}
        connectedUsers={sessionManagement.connectedUsers || []}
        readyUsers={sessionManagement.readyUsers || []}
      />

      {isLoading && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/50 z-50">
          <div className="text-white text-2xl">Loading...</div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-4 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
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
