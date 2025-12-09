import React, { useEffect } from "react";
import { X } from 'lucide-react';
import PlayerDetailsPanel from './PlayerDetailsPanel';

const PlayerDetailsModal = React.memo(function PlayerDetailsModal({ 
  player, 
  allPlayers, 
  onClose, 
  persistedWeights, 
  sliderWeights, 
  persistSliderWeights,
  handleWeightChange, 
  activePreset, 
  applyPreset,
  drills = [],
  presets = {}
}) {
  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!player) return null;

  return (
    <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm" style={{zIndex: 9999}} onClick={onClose}>
        <div className="wc-card max-w-4xl lg:max-w-6xl w-full max-h-[85vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-3 border-b border-gray-100 flex justify-between items-center flex-shrink-0 bg-white">
          <div>
            <h2 className="text-xl font-bold">{player.name}</h2>
            <p className="text-brand-light text-sm">Player #{player.number} - Age Group: {player.age_group}</p>
          </div>
          {/* Header Score Display - Removed here as it is inside the panel, but we can keep close button */}
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition ml-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-white">
           <PlayerDetailsPanel 
              player={player}
              allPlayers={allPlayers}
              persistedWeights={persistedWeights}
              sliderWeights={sliderWeights}
              persistSliderWeights={persistSliderWeights}
              handleWeightChange={handleWeightChange}
              activePreset={activePreset}
              applyPreset={applyPreset}
              drills={drills}
              presets={presets}
           />
        </div>
      </div>
    </div>
  );
});

export default PlayerDetailsModal;