// src/context/StemPlayerContext.js
import React, { createContext, useContext, useEffect } from 'react';
import { useSocket } from './SocketContext';
import useAudioEngine from '../hooks/useAudioEngine';
import useStemManagement from '../hooks/useStemManagement';
import useSessionManagement from '../hooks/useSessionManagement';
import usePlaybackControls from '../hooks/usePlaybackControls';
import useVisualization from '../hooks/useVisualization';

const StemPlayerContext = createContext();

export const StemPlayerProvider = ({ children }) => {
  const { socket } = useSocket();
  
  // Initialize hooks
  const audioEngine = useAudioEngine();
  
  // Create hooks with circular dependencies carefully
  const stemManagement = useStemManagement({ 
    audioEngine, 
    socket,
    // We'll pass these in after initialization
    isInSession: false,
    sessionCode: ''
  });
  
  const sessionManagement = useSessionManagement({ 
    socket, 
    audioEngine, 
    stemManagement 
  });
  
  // Update stem management with session info
  stemManagement.isInSession = sessionManagement.isInSession;
  stemManagement.sessionCode = sessionManagement.sessionCode;
  
  const playbackControls = usePlaybackControls({
    audioEngine,
    currentStems: stemManagement.currentStems,
    socket,
    isInSession: sessionManagement.isInSession,
    sessionCode: sessionManagement.sessionCode
  });
  
  const visualization = useVisualization({ 
    mainAnalyzer: audioEngine.mainAnalyzer, 
    isPlaying: audioEngine.isPlaying 
  });

  // Enhance the stemManagement object with a method that handles remote stem selection
  const enhancedStemManagement = {
    ...stemManagement,
    // Override handleStemSelection to accept isRemote flag
    handleStemSelection: (stem, type, isRemote = false) => {
      console.log(`Handling stem selection: ${stem?.name} for ${type}, isRemote: ${isRemote}`);
      // Make sure type is defined before proceeding
      if (!type) {
        console.error('❌ Stem type is undefined in handleStemSelection');
        return;
      }
      // Call the original method but don't emit socket events if it's a remote selection
      stemManagement.handleStemSelection(stem, type);
    }
  };

  // Enhance playbackControls with methods that handle remote operations
  const enhancedPlaybackControls = {
    ...playbackControls,
    // Override handlePlayPause to accept isRemote flag
    handlePlayPause: (isRemote = false) => {
      console.log(`Handling play/pause, isRemote: ${isRemote}`);
      // Call the original method
      playbackControls.handlePlayPause();
    },
    // Add setBpm method to handle remote BPM changes
    setBpm: (newBpm, isRemote = false) => {
      console.log(`Setting BPM to ${newBpm}, isRemote: ${isRemote}`);
      // Implement BPM setting logic
      if (audioEngine.transport) {
        audioEngine.transport.bpm.value = newBpm;
      }
    }
  };

  const value = {
    audioEngine,
    stemManagement: enhancedStemManagement,
    sessionManagement,
    playbackControls: enhancedPlaybackControls,
    visualization,
    socket
  };

  return (
    <StemPlayerContext.Provider value={value}>
      {children}
    </StemPlayerContext.Provider>
  );
};

export const useStemPlayer = () => {
  const context = useContext(StemPlayerContext);
  if (context === undefined) {
    throw new Error('useStemPlayer must be used within a StemPlayerProvider');
  }
  return context;
};

// Add this helper function to your context
const ensureValidAudioUrl = (url) => {
  if (!url) return null;
  
  // If it's already a valid URL, return it
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a relative path, make it absolute
  if (url.startsWith('/')) {
    return `${process.env.PUBLIC_URL}${url}`;
  }
  
  // Default case - assume it's a filename and construct a path
  return `${process.env.PUBLIC_URL}/audio/${url}.mp3`;
};
