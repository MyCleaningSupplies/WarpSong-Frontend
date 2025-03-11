// src/components/StemPlayer/index.js
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

  // New loading state variable
  const [isLoading, setIsLoading] = useState(false);
  const [allUsersReady, setAllUsersReady] = useState(false);

  // Initialize Tone.js early
  useEffect(() => {
    const initTone = async () => {
      console.log("Initializing Tone.js...");
      if (!toneInitialized.current && Tone.context.state !== "running") {
        try {
          await Tone.start();
          toneInitialized.current = true;
          console.log("✅ Tone.js context started early");
        } catch (error) {
          console.error("Failed to initialize Tone.js:", error);
        }
      } else {
        console.log("Tone.js already initialized.");
      }
    };

    initTone();
  }, []);

  // Preload common stems
  useEffect(() => {
    const preloadCommonStems = async () => {
      if (!sessionManagement.isInSession) {
        console.log("Not preloading stems: not in session.");
        return;
      }

      const commonStems = ["makeme-drums", "testdrums123", "testbass123"]; // Use actual stems from your database
      console.log("Preloading common stems...");

      for (const stemName of commonStems) {
        try {
          if (!bufferCache[stemName]) {
            // Check if the stem exists in your database first
            const stem = stemManagement.stems.find(s => s.identifier === stemName);
            if (!stem) {
              console.log(`Stem ${stemName} not found in database, skipping preload`);
              continue;
            }
            
            // Use the actual fileUrl from your database instead of constructing a path
            const url = stem.fileUrl;
            console.log(`Preloading ${stemName}... URL: ${url}`);
            
            // Add error handling for the buffer loading
            try {
              const buffer = await Tone.Buffer.load(url);
              bufferCache[stemName] = buffer;
              console.log(`✅ Preloaded ${stemName}`);
            } catch (loadError) {
              console.error(`Failed to load buffer for ${stemName}:`, loadError);
            }
          } else {
            console.log(`Using cached buffer for ${stemName}`);
          }
        } catch (error) {
          console.error(`Failed to preload ${stemName}:`, error);
        }
      }

      console.log("Common stems preloaded");
    };

    // Ensure Tone.js is initialized before preloading
    if (toneInitialized.current && sessionManagement.isInSession) {
      console.log("Tone.js initialized, preloading stems.");
      preloadCommonStems();
    } else {
      console.log("Tone.js not initialized or not in session, skipping stem preloading.");
    }
  }, [sessionManagement.isInSession, stemManagement.stems]);

  // Debounced playback ready notification
  const debouncedNotifyPlaybackReady = useCallback(
    debounce((socket, sessionCode) => {
      console.log("🎵 Notifying server that playback is ready (debounced)");
      socket.emit("playback-ready", {
        sessionCode: sessionCode,
        userId: socket.id,
        timestamp: Date.now(),
      });
    }, 500),
    []
  );

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

  // Optimized stem loading function
  const loadStemBuffer = useCallback(async (stemName) => {
    const performanceStart = performance.now();

    if (bufferCache[stemName]) {
      console.log(`Using cached buffer for ${stemName}`);
      const performanceEnd = performance.now();
      console.log(
        `Retrieved from cache in ${performanceEnd - performanceStart}ms`
      );
      return bufferCache[stemName];
    }

    console.log(`Loading buffer for ${stemName}...`);
    try {
      // Find the stem in your database
      const stem = stemManagement.stems.find(s => s.identifier === stemName);
      if (!stem) {
        throw new Error(`Stem ${stemName} not found in database`);
      }
      
      // Use the actual fileUrl from your database
      const url = stem.fileUrl;
      console.log(`Loading stem from URL: ${url}`);
      
      const buffer = await Tone.Buffer.load(url);
      bufferCache[stemName] = buffer;

      const performanceEnd = performance.now();
      console.log(
        `✅ Buffer loaded for ${stemName} in ${performanceEnd - performanceStart}ms`
      );
      return buffer;
    } catch (error) {
      console.error(`Failed to load buffer for ${stemName}:`, error);
      throw error;
    }
  }, [stemManagement.stems]);

  // Add socket event listeners for syncing between users
  useEffect(() => {
    if (socket && sessionManagement.isInSession) {
      console.log("Setting up socket event listeners...");

      socket.on("stem-selected", (data) => {
        const { stemType, stem } = data;
        console.log(`Remote user selected stem: ${stem.name} for ${stemType}`);

        // Check if this stem is already selected for this type
        if (
          stemManagement.currentStems[stemType]?.identifier === stem.identifier
        ) {
          console.log(
            `Stem ${stem.name} already selected for ${stemType}, skipping`
          );
          return;
        }

        if (stemType && stem) {
          stemManagement.handleStemSelection(stem, stemType, true);
        } else {
          console.error("❌ Missing stem type or stem in socket event", data);
        }
      });

      socket.on("sync-playback", (data) => {
        console.log(
          `Remote playback control: ${data.isPlaying ? "play" : "pause"}`
        );

        if (data.isPlaying !== audioEngine.isPlaying) {
          if (data.timestamp) {
            const currentTime = Date.now();
            const messageDelay = currentTime - data.timestamp;
            console.log(`Message delay: ${messageDelay}ms`);
          }

          audioEngine.setIsPlaying(data.isPlaying);

          if (data.isPlaying) {
            const startTime = "+0.01";
            Tone.Transport.start(startTime);
            Object.values(audioEngine.playerRefs.current).forEach((player) => {
              if (player && player.state !== "started") {
                console.log("Start that player");
                player.start(startTime);
              }
            });
            setIsLoading(false); // Set loading to false when playback starts
          } else {
            const stopTime = "+0.01";
            Object.values(audioEngine.playerRefs.current).forEach((player) => {
              if (player && player.state === "started") {
                player.stop(stopTime);
              }
            });
            Tone.Transport.stop();
            Tone.Transport.position = 0;
            setIsLoading(false); // Set loading to false when playback stops
          }
        } else {
          console.log(
            `State already matches: ${data.isPlaying ? "play" : "pause"}`
          );
        }
      });

      socket.on("user-playback-ready", (data) => {
        console.log(`User ${data.userId} is ready for playback`);
        // If all users are ready, then set the playback, but only if it is false
        setAllUsersReady(true);
      });

      socket.on("sync-bpm", (newBpm) => {
        console.log(`Remote BPM change: ${newBpm}`);
        if (newBpm !== audioEngine.bpm) {
          playbackControls.setBpm(newBpm, true);
        }
      });

      return () => {
        console.log("Cleaning up socket event listeners...");
        socket.off("stem-selected");
        socket.off("sync-playback");
        socket.off("sync-bpm");
        socket.off("user-playback-ready");
      };
    } else {
      console.log("Socket not connected or not in session, skipping socket setup.");
    }
  }, [
    socket,
    sessionManagement.isInSession,
    stemManagement,
    playbackControls,
    audioEngine,
  ]);

  // Debounced playback ready notification
  useEffect(() => {
    if (socket && sessionManagement.isInSession && audioEngine.playbackReady) {
      console.log("🎵 Notifying server that playback is ready");
      debouncedNotifyPlaybackReady(socket, sessionManagement.sessionCode);
    }
  }, [
    socket,
    sessionManagement.isInSession,
    audioEngine.playbackReady,
    sessionManagement.sessionCode,
    debouncedNotifyPlaybackReady,
  ]);

  // Memory management - unload unused buffers periodically
  useEffect(() => {
    const unloadUnusedBuffers = () => {
      const currentlyUsedStems = Object.values(stemManagement.currentStems)
        .filter(Boolean)
        .map((stem) => stem.identifier);

      Object.keys(bufferCache).forEach((key) => {
        if (!currentlyUsedStems.includes(key)) {
          console.log(`Unloading unused buffer: ${key}`);
          bufferCache[key].dispose();
          delete bufferCache[key];
        }
      });
    };

    // Run cleanup every 5 minutes
    const cleanupInterval = setInterval(unloadUnusedBuffers, 5 * 60 * 1000);

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [stemManagement.currentStems]);

  // Optimized handleStemSelection function
  const handleOptimizedStemSelection = useCallback(
    (stem, type) => {
      // Check if this stem is already selected for this type
      if (stemManagement.currentStems[type]?.identifier === stem.identifier) {
        console.log(`Stem ${stem.name} already selected for ${type}, skipping`);
        return;
      }

      // First update local state
      stemManagement.handleStemSelection(stem, type);

      // Then emit to socket when stem is selected
      if (socket && sessionManagement.sessionCode && type) {
        console.log(`Emitting stem selection: ${stem.name} for ${type}`);
        socket.emit("select-stem", {
          sessionCode: sessionManagement.sessionCode,
          stemId: stem.identifier,
          stemType: type,
          userId: socket.id,
          stem: stem,
        });
      }
    },
    [stemManagement, socket, sessionManagement.sessionCode]
  );

  const { handleCloseModal, filterStemsByType, currentStems } = stemManagement;

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

  // Optimized play/pause handler
  const handlePlayPause = useCallback(
    (e) => {
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
            timestamp: Date.now(), // Add timestamp for better synchronization
          });
        }
      } else {
        console.log("Not all users are ready. Waiting...");
      }

      const performanceEnd = performance.now();
      console.log(
        `Play/pause operation took ${performanceEnd - performanceStart}ms`
      );
    },
    [audioEngine, socket, sessionManagement.sessionCode, allUsersReady]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(260,20%,10%)] p-6">
      <Header />

      <SessionControls {...sessionManagement} />

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

          {/* Add stem type selection grid */}
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

          {/* Add stem selection modal */}
          <StemSelectionModal
            modalOpen={stemManagement.modalOpen}
            selectedStemType={stemManagement.selectedStemType}
            handleCloseModal={handleCloseModal}
            STEM_TYPES={stemManagement.STEM_TYPES}
            filterStemsByType={filterStemsByType}
            loadingStems={stemManagement.loadingStems}
            currentStems={currentStems}
            handleStemSelection={handleOptimizedStemSelection}
            sessionCode={sessionManagement.sessionCode}
            socket={socket}
          />

          {/* Add action buttons */}
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
        </div>
      )}

      {/* Display loading indicator */}
      {isLoading && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/50 z-50">
          <div className="text-white text-2xl">Loading...</div>
        </div>
      )}

      {/* Pass socket explicitly to ReadyModal */}
      <ReadyModal {...sessionManagement} socket={socket} />
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
