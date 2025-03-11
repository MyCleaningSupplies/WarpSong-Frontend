import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ActionButtons = ({ selectedStems }) => {
  const navigate = useNavigate();

  const handleSaveMashup = async () => {
    try {
      if (!selectedStems.length) {
        console.error("❌ At least one stem is required to save a mashup.");
        return;
      }

      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:3001/api/mashup/save",
        {
          name: "My Mashup", // Implement mashup name later
          stemIds: selectedStems.map((stem) => stem._id),
          isPublic: true, // Adjust as needed
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      navigate("/mashup-success");
    } catch (error) {
      console.error("❌ Error saving mashup:", error);
    }
  };

  return (
    <div className="mt-auto flex flex-col md:flex-row gap-4 pt-4">
      <button
        onClick={handleSaveMashup}
        className="mt-4 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg"
      >
        💾 Save Mashup
      </button>
      <button
        onClick={() => console.log("Navigate to Share screen")}
        className="rounded-full py-3 flex-1 flex items-center justify-center bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:shadow-lg transition-all"
      >
        <span className="mr-2">↗️</span> Delen
      </button>
    </div>
  );
};

export default ActionButtons;
