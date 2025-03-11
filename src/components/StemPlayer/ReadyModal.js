// src/components/StemPlayer/ReadyModal.js
import React from 'react';

const ReadyModal = ({
  showReadyModal,
  sessionCode,
  handleReadyClick,
  connectedUsers = [],
  readyUsers = [],
  allUsersReady,
  setShowReadyModal,
  socket,
}) => {
  if (!showReadyModal) return null;

  const currentUserReady = readyUsers.includes(socket.id);
  const waitingForOthers = currentUserReady && !allUsersReady;
  const readyCount = readyUsers.length;
  const totalUsers = connectedUsers.length;

  console.log("Ready modal state:", { currentUserReady, waitingForOthers, readyCount, totalUsers });

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="rounded-xl p-8 bg-[#1e1833] text-center max-w-md">
        <div className="text-[#8B5CF6] text-5xl mb-4">♪♫</div>
        {!currentUserReady ? (
          <>
            <h2 className="text-2xl font-bold mb-4 text-white">Ready to Mix?</h2>
            <h3 className="text-2xl font-bold mb-4 text-white">Your session code is: {sessionCode}</h3>
            <p className="mb-6 text-white/70">
              Click the button below to initialize audio and start mixing with your friends!
            </p>
            <button
              onClick={handleReadyClick}
              className="py-3 px-8 rounded-full font-medium bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:shadow-md transition-all text-white"
            >
              I'm Ready!
            </button>
          </>
        ) : waitingForOthers ? (
          <>
            <h2 className="text-2xl font-bold mb-4 text-white">Waiting for Others</h2>
            <p className="mb-6 text-white/70">
              {readyCount} of {totalUsers} users are ready...
            </p>
            <div className="animate-pulse text-[#8B5CF6] text-2xl">⏳</div>
            <button
              onClick={() => setShowReadyModal(false)}
              className="mt-4 py-2 px-4 rounded-full text-sm bg-red-500/20 text-red-500"
            >
              Debug: Force Close
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4 text-white">Everyone's Ready!</h2>
            <p className="mb-6 text-white/70">All users are ready to start mixing!</p>
            <button
              onClick={() => setShowReadyModal(false)}
              className="py-3 px-8 rounded-full font-medium bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:shadow-md transition-all text-white"
            >
              Let's Mix!
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ReadyModal;