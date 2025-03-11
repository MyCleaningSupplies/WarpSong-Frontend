import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Connect = ({ createSessionHandler, joinSession }) => {
  const [sessionCode, setSessionCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();

  const handleCreateSession = async () => {
    const sessionId = await createSessionHandler();
    if (sessionId) {
      navigate("/session");
    }
  };

  const handleJoinSession = async () => {
    if (!sessionCode.trim()) return;
    
    const success = await joinSession(sessionCode);
    if (success) {
      navigate("/session");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gray-900 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6">Connect</h2>
      
      <div className="text-center mb-6">
        <p className="text-gray-300 mb-2">Join or create a session to start mixing</p>
        <p className="text-gray-300">Collaborate with friends in real-time</p>
      </div>
      
      <div className="w-full space-y-4">
        <button
          onClick={handleCreateSession}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold transition-colors"
        >
          Create New Session
        </button>
        
        <div className="flex items-center">
          <div className="flex-grow h-px bg-gray-700"></div>
          <span className="px-4 text-gray-500">or</span>
          <div className="flex-grow h-px bg-gray-700"></div>
        </div>
        
        <div className="space-y-2">
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            placeholder="Enter session code"
            className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          
          <button
            onClick={handleJoinSession}
            disabled={!sessionCode.trim()}
            className={`w-full py-3 rounded-lg font-bold transition-colors ${
              sessionCode.trim()
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            Join Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default Connect;
