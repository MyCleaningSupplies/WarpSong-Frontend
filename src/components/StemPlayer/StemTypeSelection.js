import React from 'react';

const StemTypeSection = ({ 
  type, 
  typeConfig, 
  currentStems, 
  loadingStems, 
  preloadComplete, 
  handleOpenModal 
}) => {
  const currentStem = currentStems[type];
  const isLoading = loadingStems[type];

  return (
    <button
      key={type}
      onClick={async () => {
        await handleOpenModal(type);
      }}
      className={`
        p-4 rounded-xl flex flex-col items-center justify-center
        ${currentStems[type] ? `bg-${typeConfig.color}/20` : "bg-white/5"}
        hover:bg-white/10 transition-colors
        ${loadingStems[type] ? "relative" : ""}
      `}
      style={{
        borderColor: currentStems[type] ? typeConfig.color : "transparent",
        borderWidth: currentStems[type] ? "1px" : "0px",
      }}
      disabled={!preloadComplete || loadingStems[type]}
    >
      {loadingStems[type] && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
          <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div>
        </div>
      )}
      <span className="text-lg mb-1">{typeConfig.name}</span>
      {currentStems[type] ? (
        <span className="text-xs opacity-70">{currentStems[type].name}</span>
      ) : (
        <span className="text-xs opacity-50">None selected</span>
      )}
    </button>
  );
};

export default StemTypeSection;
