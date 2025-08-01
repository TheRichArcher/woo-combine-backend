import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, TrendingUp, Settings, Award } from 'lucide-react';
import { DRILLS, WEIGHT_PRESETS } from '../../constants/players';

const PlayerDetailsModal = React.memo(function PlayerDetailsModal({ 
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
  
  // Sync local weights when sliderWeights change
  useEffect(() => {
    setModalLocalWeights(sliderWeights);
  }, [sliderWeights]);
  
  // Persist weights function for modal
  const persistModalWeights = useCallback(() => {
    persistSliderWeights(modalLocalWeights);
  }, [modalLocalWeights, persistSliderWeights]);
  
  // Use persisted weights for calculations
  const weights = persistedWeights;

  const drillRankings = useMemo(() => {
    if (!player || !allPlayers || allPlayers.length === 0) return {};
    
    const rankings = {};
    DRILLS.forEach(drill => {
      try {
        const validPlayers = allPlayers.filter(p => 
          p && 
          p.id && 
          p.age_group === player.age_group && 
          p[drill.key] != null && 
          typeof p[drill.key] === 'number'
        );
        
        if (validPlayers.length === 0) {
          rankings[drill.key] = null;
          return;
        }
        
        const sortedPlayers = validPlayers.sort((a, b) => {
          if (drill.key === "40m_dash") {
            return a[drill.key] - b[drill.key];
          }
          return b[drill.key] - a[drill.key];
        });
        
        const rank = sortedPlayers.findIndex(p => p.id === player.id) + 1;
        rankings[drill.key] = rank > 0 ? rank : null;
      } catch {
        rankings[drill.key] = null;
      }
    });
    return rankings;
  }, [allPlayers, player]);

  const weightedBreakdown = useMemo(() => {
    if (!player || !allPlayers || allPlayers.length === 0) return [];
    
    // Calculate drill ranges for normalization (same age group only)
    const ageGroupPlayers = allPlayers.filter(p => 
      p && p.age_group === player.age_group && 
      DRILLS.some(drill => p[drill.key] != null && typeof p[drill.key] === 'number')
    );
    
    const drillRanges = {};
    DRILLS.forEach(drill => {
      const values = ageGroupPlayers
        .map(p => p[drill.key])
        .filter(val => val != null && typeof val === 'number');
      
      if (values.length > 0) {
        drillRanges[drill.key] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });
    
    return DRILLS.map(drill => {
      try {
        const rawScore = player[drill.key] != null && typeof player[drill.key] === 'number' 
          ? player[drill.key] 
          : null;
        const weight = weights[drill.key] || 0;
        let weightedScore = 0;
        
        if (rawScore != null && drillRanges[drill.key]) {
          const range = drillRanges[drill.key];
          let normalizedScore = 0;
          
          if (range.max === range.min) {
            // All players have same score, give them all 50 (middle score)
            normalizedScore = 50;
          } else if (drill.key === "40m_dash") {
            // For 40-yard dash: lower time = better score (invert the scale)
            normalizedScore = ((range.max - rawScore) / (range.max - range.min)) * 100;
          } else {
            // For other drills: higher value = better score
            normalizedScore = ((rawScore - range.min) / (range.max - range.min)) * 100;
          }
          
          // Apply weight as percentage to normalized score
          weightedScore = normalizedScore * (weight / 100);
        }
        
        return {
          ...drill,
          rawScore,
          weight,
          weightedScore,
          rank: drillRankings[drill.key]
        };
      } catch {
        return {
          ...drill,
          rawScore: null,
          weight: weights[drill.key] || 0,
          weightedScore: 0,
          rank: null
        };
      }
    });
  }, [drillRankings, player, weights, allPlayers]);

  // Return null after all hooks if conditions aren't met
  if (!player || !allPlayers || allPlayers.length === 0) return null;

  const totalWeightedScore = weightedBreakdown.reduce((sum, item) => sum + (item.weightedScore || 0), 0);

  let currentRank = 1;
  let ageGroupPlayers = [];
  
  try {
    ageGroupPlayers = allPlayers.filter(p => 
      p && 
      p.id && 
      p.age_group === player.age_group
    );
    
    if (ageGroupPlayers.length > 0) {
      // Calculate drill ranges for normalized scoring
      const playersWithAnyScore = ageGroupPlayers.filter(p => 
        DRILLS.some(drill => p[drill.key] != null && typeof p[drill.key] === 'number')
      );
      
      const drillRanges = {};
      DRILLS.forEach(drill => {
        const values = playersWithAnyScore
          .map(p => p[drill.key])
          .filter(val => val != null && typeof val === 'number');
        
        if (values.length > 0) {
          drillRanges[drill.key] = {
            min: Math.min(...values),
            max: Math.max(...values)
          };
        }
      });
      
      const playersWithScores = ageGroupPlayers.map(p => {
        try {
          const score = DRILLS.reduce((sum, drill) => {
            const drillScore = p[drill.key] != null && typeof p[drill.key] === 'number' ? p[drill.key] : null;
            const weight = weights[drill.key] || 0;
            const range = drillRanges[drill.key];
            
            if (drillScore != null && range) {
              let normalizedScore = 0;
              
              if (range.max === range.min) {
                normalizedScore = 50;
              } else if (drill.key === "40m_dash") {
                normalizedScore = ((range.max - drillScore) / (range.max - range.min)) * 100;
              } else {
                normalizedScore = ((drillScore - range.min) / (range.max - range.min)) * 100;
              }
              
              return sum + (normalizedScore * (weight / 100));
            }
            return sum;
          }, 0);
          return { ...p, currentScore: score };
        } catch {
          return { ...p, currentScore: 0 };
        }
      }).sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
      
      const rankIndex = playersWithScores.findIndex(p => p.id === player.id);
      currentRank = rankIndex >= 0 ? rankIndex + 1 : 1;
    }
  } catch {
    currentRank = 1;
    ageGroupPlayers = [player];
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{zIndex: 9999}} onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl lg:max-w-6xl w-full max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="bg-cmf-primary text-white px-6 py-3 rounded-t-xl flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">{player.name}</h2>
            <p className="text-cmf-light text-sm">Player #{player.number} - Age Group: {player.age_group}</p>
          </div>
          <div className="text-right mr-4">
            <div className="text-sm opacity-75">Overall Score</div>
            <div className="text-2xl font-bold text-white">{totalWeightedScore.toFixed(2)} pts</div>
            <div className="text-xs opacity-75">Rank #{currentRank} of {ageGroupPlayers.length}</div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition"
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
                              setModalLocalWeights((prev) => ({ ...prev, [drill.key]: newWeight }));
                            }}
                            onPointerUp={persistModalWeights}
                            name={drill.key}
                            className="w-full h-8 rounded-lg cursor-pointer accent-cmf-primary"
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 text-right hidden sm:block" style={{minWidth: '64px'}}>
                          More important
                        </span>
                        <div className="text-sm font-bold text-cmf-primary min-w-[40px] text-center">
                          {modalLocalWeights[drill.key] || 0}
                        </div>
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
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-cmf-primary" />
                    Weight Scenarios
                  </h3>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                    {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className={`p-2 text-left rounded-lg border-2 transition-all ${
                          activePreset === key 
                            ? 'border-cmf-primary bg-cmf-primary bg-opacity-5 text-cmf-primary' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="font-medium text-sm">{preset.name}</div>
                        <div className="text-xs text-gray-500">{preset.description}</div>
                      </button>
                    ))}
                  </div>
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
});

export default PlayerDetailsModal;