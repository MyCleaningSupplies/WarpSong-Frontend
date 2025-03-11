import React from "react";
import { useNavigate } from "react-router-dom";

const MashupSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-green-500 to-blue-500 text-white p-6">
      <h1 className="text-3xl font-bold">✅ Mashup Saved!</h1>
      <p className="mt-2">Your mashup is now available in your profile.</p>
      
      <button 
        onClick={() => navigate("/profile")} 
        className="mt-6 bg-white text-black py-2 px-4 rounded-lg"
      >
        🔍 View My Mashups
      </button>
    </div>
  );
};

export default MashupSuccess;