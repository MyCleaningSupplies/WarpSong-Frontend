import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import AuthContext from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:3001/api/admin";

const AdminPanel = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stems, setStems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddStemModal, setShowAddStemModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [newStem, setNewStem] = useState({
    name: "",
    artist: "",
    identifier: "",
    bpm: "",
    key: "",
    type: "",
  });

  useEffect(() => {
    fetchStems();
  }, []);

  const fetchStems = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/get-stems`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStems(response.data);
      setLoading(false);
    } catch (error) {
      console.error("❌ Error fetching stems:", error);
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert("Please select an audio file");
      return;
    }
  
    if (!newStem.type || !newStem.name || !newStem.artist || !newStem.identifier) {
      alert("Please fill in all required fields (Name, Artist, Identifier, and Type)");
      return;
    }
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    const stemData = {
      ...newStem,
      type: newStem.type.toLowerCase(),
    };
  
    console.log("Uploading stem with data:", stemData);
  
    Object.keys(stemData).forEach((key) => {
      formData.append(key, stemData[key]);
    });
  
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/add-stem`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
  
      setNewStem({
        name: "",
        artist: "",
        identifier: "",
        bpm: "",
        key: "",
        type: "",
      });
      setSelectedFile(null);
      setShowAddStemModal(false);
  
      setTimeout(() => fetchStems(), 2000);
    } catch (error) {
      console.error("❌ Error uploading stem:", error);
      alert("Error uploading stem. Please try again.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="bg-[#1a1429] text-white p-6 min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="text-[#8B5CF6] text-5xl mb-2">♪♫</div>
        <h1 className="text-2xl font-medium text-center">Admin Panel</h1>
      </div>

      <button onClick={handleLogout} className="absolute top-4 right-4 bg-red-500 px-4 py-2 rounded">
        Logout
      </button>

      <button
        onClick={() => setShowAddStemModal(true)}
        className="w-10 h-10 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] flex items-center justify-center hover:shadow-[0_0_15px_rgba(139,92,246,0.5)] transition-all"
      >
        <span className="text-xl">+</span>
      </button>

      {loading ? (
        <p>Loading stems...</p>
      ) : (
        <div>
          {stems.map((stem) => (
            <div key={stem.identifier} className="bg-[#1e1833] p-4 rounded-xl my-2">
              <p>{stem.artist} - {stem.name} | Identifier: {stem.identifier} </p>
            </div>
          ))}
        </div>
      )}

      {/* ✅ MODAL FOR ADDING STEMS */}
      {showAddStemModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#1e1833] rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-medium text-white/90">Add New Stem</h2>
              <button onClick={() => setShowAddStemModal(false)} className="text-white/50 hover:text-white transition-colors">
                ×
              </button>
            </div>

            {/* ✅ FULL FORM FOR UPLOADING STEMS */}
            <div className="space-y-4">
              <label className="block text-white/70 mb-2">Stem Name *</label>
              <input
                type="text"
                className="w-full bg-[#1a1429] rounded-lg p-3 border border-white/10 focus:border-[#8B5CF6] outline-none"
                placeholder="Enter stem name"
                value={newStem.name}
                onChange={(e) => setNewStem({ ...newStem, name: e.target.value })}
              />

              <label className="block text-white/70 mb-2">Artist *</label>
              <input
                type="text"
                className="w-full bg-[#1a1429] rounded-lg p-3 border border-white/10 focus:border-[#8B5CF6] outline-none"
                placeholder="Artist name"
                value={newStem.artist}
                onChange={(e) => setNewStem({ ...newStem, artist: e.target.value })}
              />

              <label className="block text-white/70 mb-2">Identifier *</label>
              <input
                type="text"
                className="w-full bg-[#1a1429] rounded-lg p-3 border border-white/10 focus:border-[#8B5CF6] outline-none"
                placeholder="Unique identifier (e.g., loop123)"
                value={newStem.identifier}
                onChange={(e) => setNewStem({ ...newStem, identifier: e.target.value })}
              />

              <label className="block text-white/70 mb-2">BPM</label>
              <input
                type="number"
                className="w-full bg-[#1a1429] rounded-lg p-3 border border-white/10 focus:border-[#8B5CF6] outline-none"
                placeholder="Tempo"
                value={newStem.bpm}
                onChange={(e) => setNewStem({ ...newStem, bpm: e.target.value })}
              />

              <label className="block text-white/70 mb-2">Key</label>
              <input
                type="text"
                className="w-full bg-[#1a1429] rounded-lg p-3 border border-white/10 focus:border-[#8B5CF6] outline-none"
                placeholder="e.g., C, A#, Bmin"
                value={newStem.key}
                onChange={(e) => setNewStem({ ...newStem, key: e.target.value })}
              />

              <label className="block text-white/70 mb-2">Type *</label>
              <select
                className="w-full bg-[#1a1429] rounded-lg p-3 border border-white/10 focus:border-[#8B5CF6] outline-none"
                value={newStem.type}
                onChange={(e) => setNewStem({ ...newStem, type: e.target.value })}
              >
                <option value="">Select Type</option>
                <option value="Drums">Drums</option>
                <option value="Bass">Bass</option>
                <option value="Melodie">Melodie</option>
                <option value="Vocals">Vocals</option>
              </select>

              <label className="block text-white/70 mb-2">Upload Audio File *</label>
              <input type="file" accept="audio/*" onChange={(e) => setSelectedFile(e.target.files[0])} />

              <button onClick={handleFileUpload} className="py-2 px-4 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]">
                Upload Stem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;