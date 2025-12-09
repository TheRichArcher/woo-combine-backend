import React, { useEffect, useMemo } from "react";
import { X } from 'lucide-react';
import PlayerDetailsPanel from './PlayerDetailsPanel';
import { calculateOptimizedCompositeScore } from '../../utils/optimizedScoring';

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

  const compositeScore = useMemo(() => {
    if (!player || !allPlayers || !drills.length) return 0;
    // Use persisted weights for the main score display to match rankings
    // Or sliderWeights for live feedback? 
    // Usually header score should reflect "current status". 
    // PlayerDetailsPanel shows live score. Let's match that.
    return calculateOptimizedCompositeScore(player, allPlayers, sliderWeights || persistedWeights, drills);
  }, [player, allPlayers, sliderWeights, persistedWeights, drills]);

  if (!player) return null;

  return (
    <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm" style={{zIndex: 9999}} onClick={onClose}>
        <div className="wc-card w-full max-w-3xl max-h-[85vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center flex-shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold leading-tight">{player.name}</h2>
              <p className="text-brand-light text-sm">#{player.number} • {player.age_group}</p>
            </div>
            <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block"></div>
            <div className="hidden sm:block">
               <div className="text-2xl font-bold text-brand-primary leading-none">
                 {compositeScore.toFixed(1)}
               </div>
               <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Score</div>
            </div>
          </div>
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