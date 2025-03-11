import React from 'react';

const SessionControls = ({ 
  isInSession, 
  sessionCode, 
  setSessionCode, 
  joinSession, 
  createSessionHandler, 
  connectedUsers, 
  leaveSession 
}) => {
  if (!isInSession) {
    return (
      <div className="rounded-xl p-4 mb-8 bg-white/5 backdrop-blur-sm">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            placeholder="Enter 4-letter session code"
            maxLength={4}
            className="bg-white/10 rounded-lg px-4 py-2 text-white/90"
          />
          <button
            onClick={joinSession}
            className="px-6 py-2 rounded-lg bg-[#8B5CF6] text-white/90 hover:bg-[#7C3AED] transition-colors"
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
    );
  }
  
  return (
    <div className="rounded-xl p-4 mb-8 bg-white/5 backdrop-blur-sm">
      <div className="flex justify-between items-center">
        <div className="text-white/90">
          Session Code: <span className="font-bold">{sessionCode}</span>
        </div>
        <div className="flex gap-2">
          {connectedUsers.map((userId, index) => (
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
  );
};

export default SessionControls;
