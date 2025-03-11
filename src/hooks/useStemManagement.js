import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import * as Tone from 'tone';
import { normalizeId } from './useAudioEngine';
import { API_BASE_URL } from '../config/api';

export const STEM_TYPES = {
  DRUMS: {
    name: "Drums",
    gradient: "from-[#EC4899] to-[#8B5CF6]",
    color: "#EC4899",
    match: (type) => type?.toLowerCase() === "drums",
  },
  BASS: {
    name: "Bass",
    gradient: "from-[#F97316] to-[#EC4899]",
    color: "#F97316",
    match: (type) => type?.toLowerCase() === "bass",
  },
  MELODIE: {
    name: "Melodie",
    gradient: "from-[#06B6D4] to-[#F97316]",
    color: "#06B6D4",
    match: (type) => type?.toLowerCase() === "melodie",
  },
  VOCALS: {
    name: "Vocals",
    gradient: "from-[#06B6D4] to-[#8B5CF6]",
    color: "#8B5CF6",
    match: (type) => type?.toLowerCase() === "vocals",
  },
};

export default function useStemManagement({ audioEngine, socket, isInSession, sessionCode }) {
  const [stems, setStems] = useState([]);
  const [currentStems, setCurrentStems] = useState({});
  const [selectedStemType, setSelectedStemType] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingStems, setLoadingStems] = useState({});
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [selectedStems, setSelectedStems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const stemMapRef = useRef({});

  const {
    isPlaying,
    audioInitialized,
    ensureAudioInitialized,
    playerRefs,
    analyzerRefs,
    volumeNodeRefs,
    loadBuffer
  } = audioEngine;

  useEffect(() => {
    const fetchStems = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE_URL}/api/user/my-stems`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const formattedStems = response.data.map((stem) => ({
          ...stem,
          type: stem.type || "Drums",
          name: stem.name || stem.identifier,
          artist: stem.artist || "Unknown Artist",
        }));
        setStems(formattedStems);

        // Populate stemMapRef
        const stemMap = {};
        formattedStems.forEach((stem) => {
          const key = normalizeId(stem.identifier);
          stemMap[key] = stem;
        });
        stemMapRef.current = stemMap;
        console.log("Stem Map Populated:", stemMapRef.current);

        // Kick off preload
        if (formattedStems.length > 0) {
          preloadMetadata(formattedStems);
        }
      } catch (error) {
        console.error("❌ Error fetching stems:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStems();
  }, []);

  // Preload metadata only
  const preloadMetadata = async (stemsToPreload) => {
    if (!stemsToPreload || stemsToPreload.length === 0) {
      console.log("No stems to preload metadata for.");
      setPreloadComplete(true);
      return;
    }

    console.log(`Preloading metadata for ${stemsToPreload.length} audio files...`);
    setPreloadProgress(0);

    // Just mark as complete without loading full files
    let loaded = 0;
    const increment = 100 / stemsToPreload.length;

    // Simulate loading progress without actually loading full files
    for (let i = 0; i < stemsToPreload.length; i++) {
      loaded++;
      setPreloadProgress(loaded * increment);
      // Small delay to show progress
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log("Preloading metadata complete!");
    setPreloadComplete(true);
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
      overlap: 0.05,
    }).sync();

    // Create volume node
    const volumeNode = new Tone.Volume(0);
    const analyzer = new Tone.Analyser("waveform", 1024);
    volumeNode.connect(analyzer);
    volumeNode.connect(audioEngine.mainMixerRef.current);

    player.connect(volumeNode);

    // Store references
    playerRefs.current[key] = player;
    volumeNodeRefs.current[key] = volumeNode;
    analyzerRefs.current[key] = analyzer;

    // Start the player if we're currently playing
    if (isPlaying) {
      player.start("+0.1");
    }
  };

  const switchStem = async (newStem, stemType, isRemote = false) => {
    //Ensure audio context was initialized
    const initialized = await ensureAudioInitialized();
    if (!initialized) {
      console.error("Could not initialize audio");
      return false;
    }

    const key = normalizeId(newStem.identifier);
    console.log(`Switching to stem: ${key} for type: ${stemType}`);

    // Set loading state for this stem
    setLoadingStems((prev) => ({ ...prev, [stemType]: true }));

    try {
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

        if (analyzerRefs.current[prevKey]) {
          analyzerRefs.current[prevKey].dispose();
          delete analyzerRefs.current[prevKey];
        }

        if (volumeNodeRefs.current[prevKey]) {
          volumeNodeRefs.current[prevKey].dispose();
          delete volumeNodeRefs.current[prevKey];
        }
      }

      // Load buffer for this stem
      const buffer = await loadBuffer(newStem);

      // Create and start the player for the new stem
      await createAndStartPlayer(newStem, key, buffer);

      // Update state first to show the stem is selected
      setCurrentStems(prev => ({
        ...prev,
        [stemType]: newStem
      }));

      // Set playback as ready if we have at least one stem loaded
      if (audioEngine.setPlaybackReady) {
        audioEngine.setPlaybackReady(true);
      }

      // Emit to socket
      if (socket && isInSession && !isRemote) {
        socket.emit("select-stem", {
          sessionCode,
          stemId: key,
          stemType,
          userId: socket.id,
          stem: newStem,
        });
      }
    } catch (error) {
      console.error(`❌ Error switching to stem ${key}:`, error);
    } finally {
      setLoadingStems((prev) => ({ ...prev, [stemType]: false }));
    }
  };

  // Find the function that handles stem selection and switching
  const handleStemSelection = (stem, type, isRemote = false) => {
    if (!stem) {
      console.error('❌ No stem selected.');
      return;
    }
    
    if (!type) {
      console.error('❌ No stem type selected.');
      return;
    }
    
    console.log(`✅ Stem selected ${stem.identifier}`);
    
    // Make sure we're using the correct type when switching stems
    console.log(`Switching to stem: ${stem.identifier} for type: ${type}`);
    
    // For remote selections, only update the state
    if (isRemote) {
      setCurrentStems(prev => ({
        ...prev,
        [type]: stem
      }));
      return; // Don't proceed with switchStem for remote selections
    }
    
    // For local selections, update state and switch stem
    setCurrentStems(prev => ({
      ...prev,
      [type]: stem
    }));
    
    // Only call switchStem for local selections
    switchStem(stem, type);
    
    // Close the modal after selection
    handleCloseModal();
  };

  const handleOpenModal = async (type) => {
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
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedStemType(null);
  };

  const filterStemsByType = (type) => stems.filter((stem) => STEM_TYPES[type].match(stem.type));

  return {
    stems,
    currentStems,
    setCurrentStems,
    selectedStemType,
    modalOpen,
    loadingStems,
    preloadComplete,
    preloadProgress,
    selectedStems,
    loading,
    stemMapRef,
    handleStemSelection,
    handleOpenModal,
    handleCloseModal,
    filterStemsByType,
    switchStem,
    STEM_TYPES
  };
}
