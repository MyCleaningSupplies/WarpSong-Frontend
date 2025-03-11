// src/components/StemPlayer/SessionControls.js
import React, { useState } from 'react';

const SessionControls = ({ 
  isInSession, 
  sessionCode, 
  joinSession, 
  createSessionHandler, 
  leaveSession,
  connectedUsers 
}) => {
  const [inputCode, setInputCode] = useState('');
  
  return (
    <div className="mb-6">
      {!isInSession ? (
        <div className="rounded-xl p-4 bg-white/5 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Enter 4-letter session code"
              maxLength={4}
              className="flex-1 bg-white/10 rounded-lg px-4 py-2 text-white/90"
            />
            <button
              onClick={() => joinSession(inputCode)}
              disabled={!inputCode.trim()}
              className={`px-6 py-2 rounded-lg ${
                inputCode.trim()
                  ? "bg-[#8B5CF6] text-white/90 hover:bg-[#7C3AED]"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              } transition-colors`}
            >
              Join Session
            </button>
            <button
              onClick={createSessionHandler}
              className="px-6 py-2 rounded-lg bg-[#8B5CF6] text-white/90 hover:bg-[#7C3AED] transition-colors"
            >
              Create Session
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 bg-white/5 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <div className="text-white/90">
              Session Code: <span className="font-bold">{sessionCode}</span>
            </div>
            <div className="flex gap-2">
              {connectedUsers?.map((userId, index) => (
                <div
                  key={`user-${userId}-${index}`}
                  className="px-3 py-1 rounded-full bg-white/10 text-sm"
                >
                  User {index + 1}
                </div>
              ))}
            </div>
            <button
              onClick={leaveSession}
              className="px-4 py-1 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
            >
              Leave Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionControls;
