import React from 'react';

const StemSelectionModal = ({ 
  modalOpen, 
  selectedStemType, 
  handleCloseModal, 
  STEM_TYPES, 
  filterStemsByType, 
  loadingStems, 
  currentStems, 
  handleStemSelection 
}) => {
  if (!modalOpen || !selectedStemType) return null;
  
  const stemsForType = filterStemsByType(selectedStemType);
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#1e1833] rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Select {STEM_TYPES[selectedStemType].name}</h2>
          <button onClick={handleCloseModal} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        {stemsForType.length === 0 ? (
          <p className="text-center py-4 text-white/60">
            No {STEM_TYPES[selectedStemType].name.toLowerCase()} stems found in your collection. Try
            scanning more QR codes!
          </p>
        ) : (
          <div className="space-y-2">
            {stemsForType.map((stem) => (
              <button
                key={stem._id || stem.identifier}
                onClick={() => {
                  // Pass both stem and selectedStemType to the handler
                  handleStemSelection(stem, selectedStemType);
                }}
                className={`
                  w-full text-left p-3 rounded-lg
                  ${loadingStems[selectedStemType] ? "opacity-50" : ""}
                  ${
                    currentStems[selectedStemType]?.identifier === stem.identifier
                      ? "bg-white/20 border border-white/30"
                      : "bg-white/5 hover:bg-white/10"
                  }
                `}
                disabled={loadingStems[selectedStemType]}
              >
                <div className="font-medium">{stem.name}</div>
                <div className="text-sm text-white/70">{stem.artist}</div>
                <div className="flex justify-between text-xs text-white/50 mt-1">
                  <span>{stem.key || "Unknown key"}</span>
                  <span>{stem.bpm || "---"} BPM</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StemSelectionModal;
