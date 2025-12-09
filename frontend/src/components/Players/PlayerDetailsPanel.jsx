import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { TrendingUp, Settings, Award } from 'lucide-react';

const PlayerDetailsPanel = React.memo(function PlayerDetailsPanel({ 
  player, 
  allPlayers, 
  persistedWeights, 
  sliderWeights, 
  persistSliderWeights,
  handleWeightChange, 
  activePreset, 
  applyPreset,
  drills = [],
  presets = {}
}) {
  const modalSliderRefs = useRef({});
  const [modalLocalWeights, setModalLocalWeights] = useState(sliderWeights);
  
  // Sync local weights when sliderWeights change
  useEffect(() => {
    setModalLocalWeights(sliderWeights);
    
    // Update slider DOM elements directly since they are uncontrolled
    Object.keys(sliderWeights).forEach(key => {
      if (modalSliderRefs.current[key]) {
        modalSliderRefs.current[key].value = sliderWeights[key];
      }
    });
  }, [sliderWeights]);
  
  // Persist weights function for modal
  const persistModalWeights = useCallback(() => {
    persistSliderWeights(modalLocalWeights);
  }, [modalLocalWeights, persistSliderWeights]);

  // Handle live slider changes
  const onSliderChange = useCallback((drillKey, value) => {
    const newWeights = { ...modalLocalWeights, [drillKey]: value };
    setModalLocalWeights(newWeights);
    
    if (handleWeightChange) {
       handleWeightChange(drillKey, value);
    }
  }, [modalLocalWeights, handleWeightChange]);
  
  // Use persisted weights for calculations
  const weights = persistedWeights;

  const drillRankings = useMemo(() => {
    if (!player || !allPlayers || allPlayers.length === 0) return {};
    
    const rankings = {};
    drills.forEach(drill => {
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
          if (drill.lowerIsBetter) {
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
  }, [allPlayers, player, drills]);

  const weightedBreakdown = useMemo(() => {
    if (!player || !allPlayers || allPlayers.length === 0) return [];
    
    // Calculate drill ranges for normalization (same age group only)
    const ageGroupPlayers = allPlayers.filter(p => 
      p && p.age_group === player.age_group && 
      drills.some(drill => p[drill.key] != null && typeof p[drill.key] === 'number')
    );
    
    const drillRanges = {};
    drills.forEach(drill => {
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
    
    return drills.map(drill => {
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
            normalizedScore = 50;
          } else if (drill.lowerIsBetter) {
            normalizedScore = ((range.max - rawScore) / (range.max - range.min)) * 100;
          } else {
            normalizedScore = ((rawScore - range.min) / (range.max - range.min)) * 100;
          }
          
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
  }, [drillRankings, player, weights, allPlayers, drills]);

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
        drills.some(drill => p[drill.key] != null && typeof p[drill.key] === 'number')
      );
      
      const drillRanges = {};
      drills.forEach(drill => {
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
          const score = drills.reduce((sum, drill) => {
            const drillScore = p[drill.key] != null && typeof p[drill.key] === 'number' ? p[drill.key] : null;
            const weight = weights[drill.key] || 0;
            const range = drillRanges[drill.key];
            
            if (drillScore != null && range) {
              let normalizedScore = 0;
              
              if (range.max === range.min) {
                normalizedScore = 50;
              } else if (drill.lowerIsBetter) {
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
    <div className="flex-1 overflow-hidden h-full">
      <div className="h-full flex flex-col lg:flex-row">
        {/* Main Content - Weight Controls */}
        <div className="flex-1 p-3 min-h-0">
          <div className="h-full flex flex-col">
            
            {/* Total Score Header (moved to top of main column for hierarchy) */}
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border-2 border-blue-200 flex-shrink-0">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 text-sm">Total Composite Score</span>
                <span className="text-lg font-bold text-brand-primary">
                  {totalWeightedScore.toFixed(2)} pts <span className="text-sm font-normal text-gray-600">(Rank #{currentRank})</span>
                </span>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-primary" />
              Ranking Weight Controls
            </h3>
            
            <div className="grid grid-cols-1 gap-2 flex-1 overflow-y-auto pr-1">
              {weightedBreakdown.map(drill => (
                <div key={drill.key} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline">
                            <h4 className="font-semibold text-gray-900 text-sm truncate pr-2">{drill.label}</h4>
                            <div className="text-xs text-gray-600 whitespace-nowrap">
                                Contribution: <span className="font-bold text-brand-secondary">{drill.weightedScore.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-bold text-brand-primary">
                            {drill.rawScore != null ? drill.rawScore + ' ' + drill.unit : 'No score'}
                          </span>
                          {drill.rank && (
                            <span className="bg-brand-primary text-white px-1.5 rounded text-[10px] font-medium">
                              #{drill.rank}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
            
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] font-medium text-gray-500 hidden sm:block w-12">
                      Less
                    </span>
                    <div className="touch-none flex-1">
                      <input
                        type="range"
                        ref={(el) => (modalSliderRefs.current[drill.key] = el)}
                        defaultValue={modalLocalWeights[drill.key] ?? 50}
                        min={0}
                        max={100}
                        step={0.1}
                        onInput={(e) => {
                          const newWeight = parseFloat(e.target.value);
                          onSliderChange(drill.key, newWeight);
                        }}
                        onPointerUp={persistModalWeights}
                        name={drill.key}
                        className="w-full h-1.5 rounded-lg cursor-pointer accent-brand-primary"
                      />
                    </div>
                    <span className="text-[10px] font-medium text-gray-500 text-right hidden sm:block w-12">
                      More
                    </span>
                    <div className="text-xs font-bold text-brand-primary min-w-[32px] text-center">
                      {(modalLocalWeights[drill.key] || 0).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar - Weight Scenarios and Analysis */}
        <div className="w-full lg:w-72 bg-gray-50 p-3 border-t lg:border-t-0 lg:border-l border-gray-200 max-h-64 lg:max-h-full overflow-y-auto">
          <div className="h-full flex flex-col">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Settings className="w-4 h-4 text-brand-primary" />
                Weight Scenarios
              </h3>
              
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {Object.entries(presets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                    className={`p-2 text-left rounded-lg border transition-all ${
                      activePreset === key 
                        ? 'border-brand-primary bg-brand-primary bg-opacity-5 text-brand-primary' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium text-xs">{preset.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-3 border border-gray-200 flex-1 min-h-0">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2 text-sm">
                <Award className="w-4 h-4 text-yellow-500" />
                Ranking Analysis
              </h4>
              
              <div className="space-y-2 text-xs overflow-y-auto">
                <div className="flex justify-between">
                  <span className="text-gray-600">Age Group Rank:</span>
                  <span className="font-bold text-brand-primary">#{currentRank} of {ageGroupPlayers.length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Overall Score:</span>
                  <span className="font-bold text-brand-secondary">{totalWeightedScore.toFixed(2)} pts</span>
                </div>
                
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-[10px] text-gray-500 mb-1">Score Breakdown:</div>
                  {weightedBreakdown.map(drill => (
                    <div key={drill.key} className="flex justify-between text-[10px]">
                      <span className="text-gray-600 truncate pr-2">{drill.label}:</span>
                      <span className="font-mono">{drill.weightedScore.toFixed(2)} pts</span>
                    </div>
                  ))}
                </div>
                
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-[10px] text-gray-500">
                    {activePreset && presets[activePreset] ? 'Using ' + presets[activePreset].name : 'Custom weights'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.player?.id === nextProps.player?.id &&
    prevProps.player?.updated_at === nextProps.player?.updated_at &&
    prevProps.allPlayers?.length === nextProps.allPlayers?.length &&
    JSON.stringify(prevProps.persistedWeights) === JSON.stringify(nextProps.persistedWeights) &&
    prevProps.activePreset === nextProps.activePreset
  );
});

export default PlayerDetailsPanel;