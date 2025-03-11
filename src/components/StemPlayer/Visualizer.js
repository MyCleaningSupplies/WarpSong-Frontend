import React from 'react';

const Visualizer = ({ 
  loading, 
  loadingStems, 
  preloadProgress, 
  handlePlayPause, 
  isPlaying, 
  playbackReady, 
  preloadComplete, 
  playbackLoading, 
  bpm, 
  decreaseBpm, 
  increaseBpm 
}) => {
  return (
    <div className="rounded-3xl p-6 mb-8 relative bg-white/5 backdrop-blur-sm">
      {loading ? (
        <div className="flex justify-center items-center h-60">
          <div className="text-xl text-white/70 animate-pulse">Loading stems...</div>
        </div>
      ) : (
        <div className="h-60 flex items-center justify-center relative">
          <canvas id="mainVisualizer" width="1200" height="240" className="w-full h-full" />
          {Object.values(loadingStems).some((loading) => loading) && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
              <div className="text-white mb-2">Loading stems...</div>
              <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]"
                  style={{ width: `${preloadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
      <div className="absolute top-4 left-0 right-0 flex justify-center items-center gap-4">
        <button
          onClick={handlePlayPause}
          className={`w-14 h-14 rounded-full flex items-center justify-center ${
            isPlaying
              ? "bg-red-500 hover:bg-red-600"
              : playbackReady
              ? "bg-green-500 hover:bg-green-600"
              : "bg-gray-500"
          }`}
          disabled={!preloadComplete || playbackLoading || (!isPlaying && !playbackReady)}
        >
          {playbackLoading ? (
            <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div>
          ) : (
            isPlaying ? (
              <span className="text-2xl">⏸️</span>
            ) : (
              <span className="text-2xl">▶️</span>
            )
          )}
        </button>
        <div className="rounded-xl p-2 bg-white/10 backdrop-blur-sm flex flex-col items-center">
          <div className="flex items-center gap-2">
            <button onClick={decreaseBpm} className="hover:scale-105 transition-transform">
              -
            </button>
            <span className="font-bold">{bpm}</span>
            <button onClick={increaseBpm} className="hover:scale-105 transition-transform">
              +
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span>⏰</span>
            <span className="text-xs">BPM</span>
          </div>
        </div>
        {/* Target Key Display */}
        <div className="bg-white/10 px-3 py-1 rounded-full text-sm">Key: Auto</div>
      </div>
    </div>
  );
};

export default Visualizer;
