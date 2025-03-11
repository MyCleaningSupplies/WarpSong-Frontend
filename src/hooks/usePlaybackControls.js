import { useEffect } from 'react';
import * as Tone from 'tone';
import { normalizeId } from './useAudioEngine';

export default function usePlaybackControls({
  audioEngine,
  currentStems,
  socket,
  isInSession,
  sessionCode
}) {
  const {
    isPlaying,
    setIsPlaying,
    playbackLoading,
    setPlaybackLoading,
    playerRefs,
    playbackTimeoutRef,
    prepareAudioProcessing,
    stopAllPlayers
  } = audioEngine;

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
      const prepared = await prepareAudioProcessing(currentStems);
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
    if (socket && isInSession) {
      socket.emit("playback-control", { sessionCode, isPlaying: true });
    }
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
    Tone.Transport.position = 0; // Reset position

    setIsPlaying(false);
    if (socket && isInSession) {
      socket.emit("playback-control", { sessionCode, isPlaying: false });
    }
  };

  const increaseBpm = () => {
    if (audioEngine.bpm < 200) {
      const newBpm = audioEngine.bpm + 1;
      audioEngine.handleBpmChange(newBpm);
      if (socket && isInSession) {
        socket.emit("bpm-change", { sessionCode, bpm: newBpm });
      }
    }
  };

  const decreaseBpm = () => {
    if (audioEngine.bpm > 60) {
      const newBpm = audioEngine.bpm - 1;
      audioEngine.handleBpmChange(newBpm);
      if (socket && isInSession) {
        socket.emit("bpm-change", { sessionCode, bpm: newBpm });
      }
    }
  };

  return {
    handlePlayPause,
    startPlayback,
    pausePlayback,
    increaseBpm,
    decreaseBpm
  };
}
