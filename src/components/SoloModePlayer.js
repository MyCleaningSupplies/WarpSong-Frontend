import React, { useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import axios from "axios";

// Helper: Normalize identifiers
const normalizeId = (id) => id?.trim().toLowerCase();

const STEM_TYPES = {
  DRUMS: { name: "Drums", color: "#EC4899" },
  BASS: { name: "Bass", color: "#F97316" },
  MELODIE: { name: "Melodie", color: "#06B6D4" },
  VOCALS: { name: "Vocals", color: "#8B5CF6" },
};

// Map of musical keys to semitones
const keyToSemitones = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4,
  "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9,
  "A#": 10, "Bb": 10, "B": 11
};

const SoloModePlayer = () => {
  // State
  const [stems, setStems] = useState([]);
  const [currentStems, setCurrentStems] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(130);
  const [targetKey, setTargetKey] = useState(null);
  const [selectedStemType, setSelectedStemType] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Refs for Tone.js objects
  const mainMixerRef = useRef(new Tone.Gain(1).toDestination());
  const playerRefs = useRef({});
  const volumeNodeRefs = useRef({});
  const buffersRef = useRef({});

  // Calculate semitone shift for key matching
  const getSemitoneShift = (originalKey, targetKey) => {
    if (!keyToSemitones[originalKey] || !keyToSemitones[targetKey]) return 0;
    return keyToSemitones[targetKey] - keyToSemitones[originalKey];
  };

  // Fetch user's stems from backend
  useEffect(() => {
    const fetchStems = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("http://127.0.0.1:3001/api/user/my-stems", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const formattedStems = response.data.map((stem) => ({
          ...stem,
          type: stem.type || "Drums",
          name: stem.name || stem.identifier,
          artist: stem.artist || "Unknown Artist",
        }));

        setStems(formattedStems);
      } catch (error) {
        console.error("❌ Error fetching stems:", error);
      }
    };

    fetchStems();
  }, []);

  // Handle stem selection & key matching
  const switchStem = async (newStem, stemType) => {
    const key = normalizeId(newStem.identifier);
    console.log(`Switching to stem: ${key} for type: ${stemType}`);

    try {
      // Set the first selected key as target key
      if (!targetKey) {
        setTargetKey(newStem.key);
        console.log(`🎶 Target key set to: ${newStem.key}`);
      }

      // Load buffer if not cached
      let buffer = buffersRef.current[key];
      if (!buffer) {
        buffer = await new Promise((resolve, reject) => {
          const newBuffer = new Tone.Buffer(
            newStem.fileUrl,
            () => resolve(newBuffer),
            (err) => reject(err)
          );
        });
        buffersRef.current[key] = buffer;
      }

      // Create player if not cached
      let player = playerRefs.current[key];
      if (!player) {
        player = new Tone.Player({ url: buffer, loop: true }).sync();
        const volumeNode = new Tone.Volume(0);
        player.connect(volumeNode).connect(mainMixerRef.current);
        playerRefs.current[key] = player;
        volumeNodeRefs.current[key] = volumeNode;
      }

      // Apply key shift if needed
      if (targetKey) {
        const semitoneShift = getSemitoneShift(newStem.key, targetKey);
        const pitchShift = new Tone.PitchShift(semitoneShift);
        player.connect(pitchShift).toDestination();
        console.log(`🔄 Transposing ${newStem.identifier} by ${semitoneShift} semitones`);
      }

      // Update state
      setCurrentStems((prev) => ({ ...prev, [stemType]: newStem }));

      if (isPlaying) {
        player.start(0);
      }
    } catch (error) {
      console.error(`❌ Error switching to stem ${key}:`, error);
    }
  };

  // Play / Pause functionality
  const handlePlayPause = () => {
    if (!isPlaying) {
      Tone.Transport.start();
      Object.values(playerRefs.current).forEach((player) => player.start(0));
    } else {
      Tone.Transport.stop();
      Object.values(playerRefs.current).forEach((player) => player.stop());
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(260,20%,10%)] p-6 text-white">
      {/* Header */}
      <h1 className="text-2xl font-bold text-center">Solo Mode - WarpSong</h1>

      {/* Controls */}
      <div className="flex justify-center items-center my-6">
        <button onClick={handlePlayPause} className="bg-[#8B5CF6] px-6 py-3 rounded-lg cursor-pointer">
          {isPlaying ? "⏸ Stop" : "▶️ Play"}
        </button>
        <input type="range" min="60" max="200" step="1" value={bpm} 
               onChange={(e) => setBpm(parseInt(e.target.value))}
               className="ml-4 cursor-pointer" />
        <span className="ml-2">{bpm} BPM</span>
      </div>

      {/* Stem Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.keys(STEM_TYPES).map((type) => {
          const currentStem = currentStems[type];
          return (
            <div key={type} 
                 className="p-4 bg-white/10 rounded-xl cursor-pointer" 
                 onClick={() => { setSelectedStemType(type); setModalOpen(true); }}>
              <h3 className="text-lg">{STEM_TYPES[type].name}</h3>
              <p className="text-sm">{currentStem ? currentStem.name : "Select a stem"}</p>
            </div>
          );
        })}
      </div>

      {/* Modal for Selecting Stems */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-[#1e1833] rounded-xl p-6 w-96">
            <h2 className="text-xl font-bold">Select {STEM_TYPES[selectedStemType]?.name} Stem</h2>
            {stems.filter((s) => s.type === selectedStemType).map((stem) => (
              <div key={normalizeId(stem.identifier)} 
                   className="p-3 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer"
                   onClick={() => { switchStem(stem, selectedStemType); setModalOpen(false); }}>
                <h3 className="text-white">{stem.name}</h3>
                <p className="text-sm text-gray-300">{stem.artist}</p>
              </div>
            ))}
            <button onClick={() => setModalOpen(false)} className="mt-4 px-4 py-2 bg-red-500 rounded-lg cursor-pointer">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoloModePlayer;