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
    // Immediate local update for smooth UI
    const newWeights = { ...modalLocalWeights, [drillKey]: value };
    setModalLocalWeights(newWeights);
    
    // Propagate change to parent (which updates sliderWeights)
    if (handleWeightChange) {
       handleWeightChange(drillKey, value);
    }
  }, [modalLocalWeights, handleWeightChange]);
  
  // Use local weights for calculation to ensure immediate responsiveness during drag
  const weights = modalLocalWeights;

  // DEBUG: Log weights and score calculation for QA
  if (player) {
     // const sumWeights = Object.values(weights).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
     // const drillKeys = drills.map(d => d.key);
     // console.log('[PlayerDetails] weights', weights, 'sum', sumWeights);
     // console.log('[PlayerDetails] drillKeys', drillKeys);
  }

  const drillRankings = useMemo(() => {
    if (!player || !allPlayers || allPlayers.length === 0) return {};
    
    const rankings = {};
    drills.forEach(drill => {
      try {
        const validPlayers = allPlayers.filter(p => 
          p && 
          p.id && 
          p.age_group === player.age_group && 
          (p.scores?.[drill.key] ?? p[drill.key]) != null && 
          typeof (p.scores?.[drill.key] ?? p[drill.key]) === 'number'
        );
        
        if (validPlayers.length === 0) {
          rankings[drill.key] = null;
          return;
        }
        
        const sortedPlayers = validPlayers.sort((a, b) => {
          const valA = a.scores?.[drill.key] ?? a[drill.key];
          const valB = b.scores?.[drill.key] ?? b[drill.key];
          
          if (drill.lowerIsBetter) {
            return valA - valB;
          }
          return valB - valA;
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
      drills.some(drill => (p.scores?.[drill.key] ?? p[drill.key]) != null && typeof (p.scores?.[drill.key] ?? p[drill.key]) === 'number')
    );
    
    const drillRanges = {};
    drills.forEach(drill => {
      const values = ageGroupPlayers
        .map(p => p.scores?.[drill.key] ?? p[drill.key])
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
        const rawScoreValue = player.scores?.[drill.key] ?? player[drill.key];
        const rawScore = rawScoreValue != null && typeof rawScoreValue === 'number' 
          ? rawScoreValue 
          : null;
        const weight = weights[drill.key] || 0;
        let weightedScore = 0;
        let normalizedScore = 0;
        let debugInfo = {};
        
        if (rawScore != null && drillRanges[drill.key]) {
          const range = drillRanges[drill.key];
          
          if (range.max === range.min) {
            normalizedScore = 50;
          } else if (drill.lowerIsBetter) {
            normalizedScore = ((range.max - rawScore) / (range.max - range.min)) * 100;
          } else {
            normalizedScore = ((rawScore - range.min) / (range.max - range.min)) * 100;
          }
          
          weightedScore = normalizedScore * (weight / 100);

          if (player.name === 'Evan Echevarria') {
             debugInfo = {
                drillKey: drill.key,
                raw: rawScore,
                min: range.min,
                max: range.max,
                lowerIsBetter: drill.lowerIsBetter,
                normalized: normalizedScore,
                weight: weight,
                contrib: weightedScore
             };
             // console.log('[PlayerDetails] Drill Calc:', debugInfo);
          }
        }
        
        return {
          ...drill,
          rawScore,
          weight,
          weightedScore,
          normalizedScore,
          rank: drillRankings[drill.key]
        };
      } catch {
        return {
          ...drill,
          rawScore: null,
          weight: weights[drill.key] || 0,
          weightedScore: 0,
          normalizedScore: 0,
          rank: null
        };
      }
    });
  }, [drillRankings, player, weights, allPlayers, drills]);

  if (!player || !allPlayers || allPlayers.length === 0) return null;

  const totalWeightedScore = weightedBreakdown.reduce((sum, item) => sum + (item.weightedScore || 0), 0);

  // DEBUG: Log calculated values
  if (player) {
      // console.log('[PlayerDetails] composite', totalWeightedScore);
      // console.log('[PlayerDetails] contribs', weightedBreakdown.map(d => ({ label: d.label, contrib: d.weightedScore })));
  }

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
        drills.some(drill => (p.scores?.[drill.key] ?? p[drill.key]) != null && typeof (p.scores?.[drill.key] ?? p[drill.key]) === 'number')
      );
      
      const drillRanges = {};
      drills.forEach(drill => {
        const values = playersWithAnyScore
          .map(p => p.scores?.[drill.key] ?? p[drill.key])
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
            const drillScore = p.scores?.[drill.key] ?? p[drill.key];
            if (drillScore == null || typeof drillScore !== 'number') return sum;
            
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
    <div className="flex-1 h-full min-h-0">
      <div className="flex flex-col lg:flex-row h-full">
        {/* Main Content - Weight Controls */}
        <div className="flex-1 p-3 min-h-0">
          <div className="h-full flex flex-col">
            
            {/* Total Score Header (moved to top of main column for hierarchy) */}
            <div className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-200 flex-shrink-0">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 text-xs">Total Composite Score</span>
                <span className="text-base font-bold text-brand-primary">
                  {totalWeightedScore.toFixed(2)} pts <span className="text-xs font-normal text-gray-600">(Rank #{currentRank})</span>
                </span>
              </div>
            </div>

            <h3 className="text-xs font-semibold text-gray-900 mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-brand-primary" />
              Ranking Weight Controls
            </h3>
      
            <div className="grid grid-cols-1 gap-1 flex-1 min-h-0">
              {weightedBreakdown.map(drill => {
                const isMissing = drill.rawScore == null || Number.isNaN(drill.rawScore);
                const isZeroImpact = !isMissing && drill.normalizedScore === 0;

                return (
                <div key={drill.key} className="bg-gray-50 rounded p-1.5 border border-gray-200">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline">
                            <h4 className="font-semibold text-gray-900 text-xs truncate pr-1">{drill.label}</h4>
                            <div className="text-[10px] text-gray-600 whitespace-nowrap flex items-center">
                                <span className="mr-1">Contrib:</span>
                                <span className="font-bold text-brand-secondary">{drill.weightedScore.toFixed(2)}</span>
                                
                                {isMissing && (
                                  <span 
                                    className="ml-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 cursor-help"
                                    title="No result recorded for this drill, so it isn’t included in the composite score."
                                  >
                                    No score · Not included
                                  </span>
                                )}

                                {isZeroImpact && (
                                  <span 
                                    className="ml-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 cursor-help"
                                    title="This player is currently the lowest on this drill for the selected group, so it contributes 0 points to their total at any weight. Changing this weight can still affect rankings vs other players."
                                  >
                                    No impact
                                  </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-brand-primary">
                              {drill.rawScore != null ? drill.rawScore + ' ' + drill.unit : 'No score'}
                            </span>
                            {drill.rank && (
                              <span className="bg-brand-primary text-white px-1 rounded-[3px] text-[9px] font-medium leading-none py-0.5">
                                #{drill.rank}
                              </span>
                            )}
                          </div>
                          
                          {!isMissing && drill.normalizedScore != null && (
                            <span className="text-[10px] text-gray-400">
                              Score: {drill.normalizedScore.toFixed(0)}/100
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
            
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[9px] font-medium text-gray-400 hidden sm:block w-8">
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
                        className="w-full h-1 rounded-lg cursor-pointer accent-brand-primary block"
                      />
                    </div>
                    <span className="text-[9px] font-medium text-gray-400 text-right hidden sm:block w-8">
                      More
                    </span>
                    <div className="text-[10px] font-bold text-brand-primary min-w-[24px] text-center">
                      {(modalLocalWeights[drill.key] || 0).toFixed(0)}%
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar - Weight Scenarios and Analysis */}
        <div className="w-full lg:w-56 bg-gray-50 p-2 border-t lg:border-t-0 lg:border-l border-gray-200 flex-shrink-0 lg:h-full overflow-y-auto">
          <div className="flex flex-col gap-2">
            <div>
              <h3 className="text-xs font-semibold text-gray-900 mb-1.5 flex items-center gap-1">
                <Settings className="w-3 h-3 text-brand-primary" />
                Weight Scenarios
              </h3>
              
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">
              {Object.entries(presets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                    className={`p-1.5 text-left rounded border transition-all ${
                      activePreset === key 
                        ? 'border-brand-primary bg-brand-primary bg-opacity-5 text-brand-primary' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-medium text-[11px] leading-tight">{preset.name}</div>
                    <div className="text-[9px] text-gray-500 truncate mt-0.5">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded p-2 border border-gray-200 flex-1 min-h-0">
              <h4 className="font-semibold text-gray-900 mb-1.5 flex items-center gap-1 text-xs">
                <Award className="w-3 h-3 text-yellow-500" />
                Ranking Analysis
              </h4>
              
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-600">Age Rank:</span>
                  <span className="font-bold text-brand-primary">#{currentRank} of {ageGroupPlayers.length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Score:</span>
                  <span className="font-bold text-brand-secondary">{totalWeightedScore.toFixed(2)}</span>
                </div>
                
                <div className="pt-1.5 border-t border-gray-100 mt-1">
                  <div className="text-[9px] text-gray-400 mb-0.5">Breakdown:</div>
                  <div className="max-h-24 overflow-y-auto pr-1">
                  {weightedBreakdown.map(drill => (
                    <div key={drill.key} className="flex justify-between text-[9px]">
                      <span className="text-gray-500 truncate pr-1">{drill.label}:</span>
                      <span className="font-mono">{drill.weightedScore.toFixed(1)}</span>
                    </div>
                  ))}
                  </div>
                </div>
                
                <div className="pt-1.5 border-t border-gray-100 mt-1">
                  <div className="text-[9px] text-gray-400 italic">
                    {activePreset && presets[activePreset] ? presets[activePreset].name : 'Custom'}
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
    prevProps.activePreset === nextProps.activePreset &&
    // Add check for sliderWeights to trigger re-renders on slider movement
    JSON.stringify(prevProps.sliderWeights) === JSON.stringify(nextProps.sliderWeights)
  );
});

export default PlayerDetailsPanel;