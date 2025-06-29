import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, TrendingUp, Award } from 'lucide-react';
import { DRILLS, WEIGHT_PRESETS } from '../../constants/players';
import { usePlayerRankings } from '../../hooks/usePlayerRankings';

/**
 * Detailed modal for viewing player stats and adjusting ranking weights
 * @param {Object} props - Component props
 * @param {Object} props.player - Selected player
 * @param {Array} props.allPlayers - All players for ranking context
 * @param {Function} props.onClose - Close modal handler
 * @param {Object} props.persistedWeights - Current persisted weights
 * @param {Object} props.sliderWeights - Current slider weights
 * @param {Function} props.persistSliderWeights - Weight persistence handler
 * @param {string} props.activePreset - Active preset key
 * @param {Function} props.applyPreset - Preset application handler
 */
function PlayerDetailsModal({ 
  player, 
  allPlayers, 
  onClose, 
  persistedWeights, 
  sliderWeights, 
  persistSliderWeights, 
  activePreset, 
  applyPreset 
}) {
  const modalSliderRefs = useRef({});
  const [modalLocalWeights, setModalLocalWeights] = useState(sliderWeights);
  
  // Initialize ranking utilities  
  const { 
    // calculateDrillRankings, // Available for future drill ranking features
    calculateWeightedBreakdown, 
    calculatePlayerRank 
  } = usePlayerRankings();
  
  // Sync local weights when sliderWeights change
  useEffect(() => {
    setModalLocalWeights(sliderWeights);
  }, [sliderWeights]);
  
  // Persist weights function for modal
  const persistModalWeights = useCallback(() => {
    persistSliderWeights(modalLocalWeights);
  }, [modalLocalWeights, persistSliderWeights]);
  
  // Return null early if no player data
  if (!player || !allPlayers || allPlayers.length === 0) return null;

  // Use persisted weights for calculations
  const weights = persistedWeights;

  // Calculate drill rankings for the player (currently unused but available for future features)
  // const drillRankings = calculateDrillRankings(player, allPlayers);

  // Calculate weighted breakdown
  const weightedBreakdown = calculateWeightedBreakdown(player, allPlayers, weights);

  // Calculate total weighted score
  const totalWeightedScore = weightedBreakdown.reduce((sum, item) => sum + (item.weightedScore || 0), 0);

  // Calculate current rank
  const { currentRank, ageGroupPlayers } = calculatePlayerRank(player, allPlayers, weights);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{zIndex: 9999}} onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl lg:max-w-6xl w-full max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-cmf-primary text-white px-6 py-3 rounded-t-xl flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">{player.name}</h2>
            <p className="text-cmf-light text-sm">Player #{player.number} • Age Group: {player.age_group}</p>
          </div>
          <div className="text-right mr-4">
            <div className="text-sm opacity-75">Overall Score</div>
            <div className="text-2xl font-bold text-white">{totalWeightedScore.toFixed(2)} pts</div>
            <div className="text-xs opacity-75">Rank #{currentRank} of {ageGroupPlayers.length}</div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col lg:flex-row">
            {/* Main Content - Weight Controls */}
            <div className="flex-1 p-4 min-h-0">
              <div className="h-full flex flex-col">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cmf-primary" />
                  Ranking Weight Controls
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Set drill priorities for ranking calculations. Higher values = more important to you.
                </p>
          
                <div className="grid grid-cols-1 gap-2 flex-1 overflow-y-auto">
                  {weightedBreakdown.map(drill => (
                    <div key={drill.key} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-gray-900 text-sm">{drill.label}</h4>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-bold text-cmf-primary">
                                {drill.rawScore != null ? drill.rawScore + ' ' + drill.unit : 'No score'}
                              </span>
                              {drill.rank && (
                                <span className="bg-cmf-primary text-white px-1.5 py-0.5 rounded-full text-xs font-medium">
                                  #{drill.rank}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className="text-xs text-gray-600">Contribution</div>
                          <div className="text-base font-bold text-cmf-secondary">{drill.weightedScore.toFixed(2)} pts</div>
                        </div>
                      </div>
                
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 hidden sm:block" style={{minWidth: '64px'}}>
                          Less important
                        </span>
                        <div className="touch-none flex-1">
                          <input
                            type="range"
                            ref={(el) => (modalSliderRefs.current[drill.key] = el)}
                            defaultValue={modalLocalWeights[drill.key] ?? 50}
                            min={0}
                            max={100}
                            step={1}
                            onInput={(e) => {
                              const newWeight = parseInt(e.target.value, 10);
                              setModalLocalWeights(prev => ({ ...prev, [drill.key]: newWeight }));
                            }}
                            onPointerUp={persistModalWeights}
                            className="w-full h-8 rounded-lg cursor-pointer accent-cmf-primary"
                            style={{
                              background: 'linear-gradient(to right, #ddd 0%, #ddd 50%, #16a34a 50%, #16a34a 100%)',
                              WebkitAppearance: 'none',
                              height: '32px',
                              borderRadius: '16px',
                              outline: 'none',
                              touchAction: 'manipulation'
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 hidden sm:block" style={{minWidth: '64px'}}>
                          More important
                        </span>
                        <span className="font-mono text-base font-bold text-cmf-primary bg-cmf-primary/10 px-2 py-1 rounded min-w-[48px] text-center">
                          {modalLocalWeights[drill.key] ?? 50}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
          
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border-2 border-blue-200 flex-shrink-0">
                  <div className="text-center sm:text-left">
                    <span className="font-semibold text-gray-900 text-sm block sm:inline">Total Composite Score: </span>
                    <span className="text-lg font-bold text-cmf-primary block sm:inline">
                      {totalWeightedScore.toFixed(2)} pts (Rank #{currentRank})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar - Weight Scenarios and Analysis */}
            <div className="w-full lg:w-80 bg-gray-50 p-4 border-t lg:border-t-0 lg:border-l border-gray-200 max-h-96 lg:max-h-full overflow-y-auto">
              <div className="h-full flex flex-col">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-500" />
                  Weight Presets
                </h4>
                
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`p-2 rounded-lg text-left transition-all text-sm ${
                        activePreset === key
                          ? 'bg-cmf-primary text-white'
                          : 'bg-white border border-gray-200 hover:border-cmf-primary text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-xs opacity-75">{preset.description}</div>
                    </button>
                  ))}
                </div>
                
                <div className="bg-white rounded-lg p-3 border border-gray-200 flex-1 min-h-0">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-500" />
                    Ranking Analysis
                  </h4>
                  
                  <div className="space-y-2 text-sm overflow-y-auto">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Age Group Rank:</span>
                      <span className="font-bold text-cmf-primary">#{currentRank} of {ageGroupPlayers.length}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Overall Score:</span>
                      <span className="font-bold text-cmf-secondary">{totalWeightedScore.toFixed(2)} pts</span>
                    </div>
                    
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-2">Score Breakdown:</div>
                      {weightedBreakdown.map(drill => (
                        <div key={drill.key} className="flex justify-between text-xs">
                          <span className="text-gray-600">{drill.label}:</span>
                          <span className="font-mono">{drill.weightedScore.toFixed(2)} pts</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        {activePreset ? 'Using ' + WEIGHT_PRESETS[activePreset].name : 'Custom weights'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500 text-center flex-shrink-0">
                  💡 Adjust sliders for real-time changes
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerDetailsModal; 