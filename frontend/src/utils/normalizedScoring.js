/**
 * Normalized Scoring Utilities
 * 
 * This provides a consistent, normalized scoring system across all components.
 * Scores are normalized within the dataset to a 0-100 scale for fair comparison.
 */

import { DRILLS } from '../constants/players';

/**
 * Calculate normalized composite score for a single player
 * This matches the method used in Players.jsx for consistency
 */
export function calculateNormalizedCompositeScore(player, allPlayers, weights, drillList = DRILLS) {
  if (!player || !allPlayers || allPlayers.length === 0) return 0;
  
  // Filter players with at least one drill score for normalization
  const playersWithScores = allPlayers.filter(player => 
    (drillList || DRILLS).some(drill => player[drill.key] != null && typeof player[drill.key] === 'number')
  );
  
  if (playersWithScores.length === 0) return 0;
  
  // Calculate min/max for each drill for normalization
  const drillRanges = {};
  (drillList || DRILLS).forEach(drill => {
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

  // Calculate normalized weighted score for this player
  let totalWeightedScore = 0;
  
  (drillList || DRILLS).forEach(drill => {
    const rawScore = player[drill.key];
    const weight = weights[drill.key] || 0;
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
      
      // Apply weight to normalized score (weights are expected in percentage format)
      totalWeightedScore += normalizedScore * (weight / 100);
    }
  });
  
  return totalWeightedScore;
}

/**
 * Calculate normalized composite scores for multiple players
 * Returns array of players with compositeScore added
 */
export function calculateNormalizedCompositeScores(players, weights, drillList = DRILLS) {
  if (!players || players.length === 0) return [];
  
  // Filter players with at least one drill score
  const playersWithScores = players.filter(player => 
    (drillList || DRILLS).some(drill => player[drill.key] != null && typeof player[drill.key] === 'number')
  );
  
  if (playersWithScores.length === 0) return [];
  
  // Calculate min/max for each drill for normalization
  const drillRanges = {};
  (drillList || DRILLS).forEach(drill => {
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
  return playersWithScores.map(player => {
    let totalWeightedScore = 0;
    
    (drillList || DRILLS).forEach(drill => {
      const rawScore = player[drill.key];
      const weight = weights[drill.key] || 0;
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
        
        // Apply weight to normalized score (weights are expected in percentage format)
        totalWeightedScore += normalizedScore * (weight / 100);
      }
    });
    
    return {
      ...player,
      compositeScore: totalWeightedScore
    };
  });
}