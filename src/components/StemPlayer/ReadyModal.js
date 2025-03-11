import React from 'react';

const ReadyModal = ({ 
  showReadyModal, 
  sessionCode, 
  setUserReady, 
  connectedUsers = [], 
  readyUsers = [] 
}) => {
  if (!showReadyModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-4">Ready to Play?</h2>
        
        {sessionCode && (
          <div className="bg-gray-700 p-4 rounded-lg mb-4">
            <p className="text-gray-400 text-sm">Session Code:</p>
            <p className="text-white text-2xl font-mono tracking-wider">{sessionCode}</p>
            <p className="text-gray-400 text-xs mt-2">Share this code with others to join your session</p>
          </div>
        )}
        
        <div className="mb-4">
          <p className="text-white mb-2">Connected Users: {connectedUsers.length}</p>
          <p className="text-white mb-2">Ready Users: {readyUsers.length}</p>
        </div>
        
        <button
          onClick={setUserReady}
          className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold transition-colors"
        >
          I'm Ready!
        </button>
      </div>
    </div>
  );
};

export default ReadyModal;
