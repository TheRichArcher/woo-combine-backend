import { useCallback, useMemo } from 'react';
import { DRILLS } from '../constants/players';
import { logger } from '../utils/logger';

/**
 * Custom hook for player ranking calculations and management
 * @param {Array} players - Array of all players
 * @param {Object} weights - Current weight configuration
 * @returns {Object} Ranking utilities and calculated rankings
 */
export function usePlayerRankings() {
  
  /**
   * Calculate weighted breakdown for a specific player
   */
  const calculateWeightedBreakdown = useMemo(() => {
    return (player, allPlayers, currentWeights) => {
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
      
      // Calculate drill rankings inline to avoid circular dependency
      const drillRankings = {};
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
            drillRankings[drill.key] = null;
            return;
          }
          
          const sortedPlayers = validPlayers.sort((a, b) => {
            if (drill.key === "40m_dash") {
              return a[drill.key] - b[drill.key]; // Lower time = better
            }
            return b[drill.key] - a[drill.key]; // Higher score = better
          });
          
          const rank = sortedPlayers.findIndex(p => p.id === player.id) + 1;
          drillRankings[drill.key] = rank > 0 ? rank : null;
        } catch (error) {
          if (import.meta.env.DEV) {
            logger.warn('RANKING', 'Drill ranking calculation failed', { drill: drill.key, error });
          }
          drillRankings[drill.key] = null;
        }
      });
      
      return DRILLS.map(drill => {
        try {
          const rawScore = player[drill.key] != null && typeof player[drill.key] === 'number' 
            ? player[drill.key] 
            : null;
          const weight = currentWeights[drill.key] || 0;
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
        } catch (error) {
          if (import.meta.env.DEV) {
            logger.warn('RANKING', 'Weighted breakdown calculation failed', { drill: drill.key, error });
          }
          return {
            ...drill,
            rawScore: null,
            weight: currentWeights[drill.key] || 0,
            weightedScore: 0,
            rank: null
          };
        }
      });
    };
  }, []); // Removed calculateDrillRankings dependency to avoid circular reference

  /**
   * Calculate rankings for a group of players
   */
  const calculateRankingsForGroup = useCallback((playersGroup, currentWeights) => {
    // Filter players with at least one drill score
    const playersWithScores = playersGroup.filter(player => 
      DRILLS.some(drill => player[drill.key] != null && typeof player[drill.key] === 'number')
    );
    
    if (playersWithScores.length === 0) {
      return [];
    }
    
    // Calculate min/max for each drill for normalization
    const drillRanges = {};
    DRILLS.forEach(drill => {
      const values = playersWithScores
        .map(p => p[drill.key])
        .filter(val => val != null && typeof val === 'number');
      
      if (values.length > 0) {
        drillRanges[drill.key] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });

    // Calculate normalized weighted scores for each player
    const rankedPlayers = playersWithScores.map(player => {
      let totalWeightedScore = 0;
      
      DRILLS.forEach(drill => {
        const rawScore = player[drill.key];
        const weight = currentWeights[drill.key] || 0;
        const range = drillRanges[drill.key];
        
        if (rawScore != null && typeof rawScore === 'number' && range) {
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
          
          // Apply weight to normalized score
          totalWeightedScore += normalizedScore * (weight / 100);
        }
      });
      
      return {
        ...player,
        weightedScore: totalWeightedScore
      };
    });
    
    // Sort by weighted score (highest first)
    rankedPlayers.sort((a, b) => b.weightedScore - a.weightedScore);
    
    // Add rank numbers
    return rankedPlayers.map((player, index) => ({
      ...player,
      rank: index + 1
    }));
  }, []);

  /**
   * Calculate player's current rank within age group
   */
  const calculatePlayerRank = useCallback((player, allPlayers, currentWeights) => {
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
              const weight = currentWeights[drill.key] || 0;
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
          } catch (error) {
            if (import.meta.env.DEV) {
              logger.warn('RANKING', 'Player score calculation failed', error);
            }
            return { ...p, currentScore: 0 };
          }
        }).sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
        
        const rankIndex = playersWithScores.findIndex(p => p.id === player.id);
        currentRank = rankIndex >= 0 ? rankIndex + 1 : 1;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.warn('RANKING', 'Ranking calculation failed', error);
      }
      currentRank = 1;
      ageGroupPlayers = [player];
    }

    return { currentRank, ageGroupPlayers };
  }, []);

  return {
    calculateWeightedBreakdown,
    calculateRankingsForGroup,
    calculatePlayerRank
  };
} 