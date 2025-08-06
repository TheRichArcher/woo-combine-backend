/**
 * Optimized Scoring Utilities for WooCombine
 * 
 * Centralized, performance-optimized scoring calculations
 * that replace the scattered scoring logic throughout the app.
 * 
 * Key optimizations:
 * - Single-pass calculations where possible
 * - Memoized drill ranges
 * - Optimized sorting algorithms
 * - Reduced object creation
 */

import { DRILLS } from '../constants/players';

/**
 * Cache for drill ranges to avoid recalculation
 */
const drillRangeCache = new Map();

/**
 * Generate cache key for drill ranges
 */
function getDrillRangeCacheKey(players, ageGroup) {
  const playerIds = players
    .filter(p => p.age_group === ageGroup)
    .map(p => p.id)
    .sort()
    .join(',');
  
  const scores = DRILLS.map(drill => {
    const values = players
      .filter(p => p.age_group === ageGroup && p[drill.key] != null)
      .map(p => p[drill.key])
      .sort()
      .join(',');
    return `${drill.key}:${values}`;
  }).join('|');
  
  return `${playerIds}_${scores}`;
}

/**
 * Calculate drill ranges with caching for performance
 * @param {Array} players - All players
 * @param {string} ageGroup - Age group to calculate ranges for
 * @returns {Object} Drill ranges { drillKey: { min, max } }
 */
function getCachedDrillRanges(players, ageGroup) {
  const cacheKey = getDrillRangeCacheKey(players, ageGroup);
  
  if (drillRangeCache.has(cacheKey)) {
    return drillRangeCache.get(cacheKey);
  }
  
  const ageGroupPlayers = players.filter(p => 
    p && p.age_group === ageGroup && 
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
  
  // Cache the result
  drillRangeCache.set(cacheKey, drillRanges);
  
  // Clear old cache entries if cache gets too large
  if (drillRangeCache.size > 50) {
    const keysToDelete = Array.from(drillRangeCache.keys()).slice(0, 25);
    keysToDelete.forEach(key => drillRangeCache.delete(key));
  }
  
  return drillRanges;
}

/**
 * Calculate normalized score for a single drill value
 * @param {number} rawScore - Raw drill score
 * @param {Object} range - { min, max } for the drill
 * @param {string} drillKey - Drill identifier
 * @returns {number} Normalized score (0-100)
 */
function calculateNormalizedDrillScore(rawScore, range, drillKey) {
  if (!range || rawScore == null) return 0;
  
  if (range.max === range.min) {
    return 50; // All players have same score
  }
  
  if (drillKey === "40m_dash") {
    // Lower time = better score (invert the scale)
    return ((range.max - rawScore) / (range.max - range.min)) * 100;
  } else {
    // Higher value = better score
    return ((rawScore - range.min) / (range.max - range.min)) * 100;
  }
}

/**
 * Calculate optimized composite score for a single player
 * @param {Object} player - Player object
 * @param {Array} allPlayers - All players for range calculation
 * @param {Object} weights - Drill weights (percentage format)
 * @returns {number} Composite score
 */
export function calculateOptimizedCompositeScore(player, allPlayers, weights) {
  if (!player || !allPlayers || allPlayers.length === 0) return 0;
  
  const drillRanges = getCachedDrillRanges(allPlayers, player.age_group);
  let totalWeightedScore = 0;
  
  DRILLS.forEach(drill => {
    const rawScore = player[drill.key];
    const weight = weights[drill.key] || 0;
    const range = drillRanges[drill.key];
    
    if (rawScore != null && typeof rawScore === 'number' && range) {
      const normalizedScore = calculateNormalizedDrillScore(rawScore, range, drill.key);
      totalWeightedScore += normalizedScore * (weight / 100);
    }
  });
  
  return totalWeightedScore;
}

/**
 * Calculate optimized rankings for a group of players
 * Single-pass algorithm with minimal object creation
 * @param {Array} players - Players to rank
 * @param {Object} weights - Drill weights
 * @returns {Array} Ranked players with scores and ranks
 */
export function calculateOptimizedRankings(players, weights) {
  if (!players || players.length === 0) return [];
  
  // Group players by age group for efficient processing
  const playersByAgeGroup = new Map();
  
  players.forEach(player => {
    const ageGroup = player.age_group || 'unknown';
    if (!playersByAgeGroup.has(ageGroup)) {
      playersByAgeGroup.set(ageGroup, []);
    }
    playersByAgeGroup.get(ageGroup).push(player);
  });
  
  const allRankedPlayers = [];
  
  // Process each age group separately
  playersByAgeGroup.forEach((ageGroupPlayers, ageGroup) => {
    // Filter players with at least one drill score
    const playersWithScores = ageGroupPlayers.filter(player => 
      DRILLS.some(drill => player[drill.key] != null && typeof player[drill.key] === 'number')
    );
    
    if (playersWithScores.length === 0) return;
    
    // Get cached drill ranges for this age group
    const drillRanges = getCachedDrillRanges(players, ageGroup);
    
    // Calculate scores in a single pass
    const playersWithCompositeScores = playersWithScores.map(player => {
      let totalWeightedScore = 0;
      
      DRILLS.forEach(drill => {
        const rawScore = player[drill.key];
        const weight = weights[drill.key] || 0;
        const range = drillRanges[drill.key];
        
        if (rawScore != null && typeof rawScore === 'number' && range) {
          const normalizedScore = calculateNormalizedDrillScore(rawScore, range, drill.key);
          totalWeightedScore += normalizedScore * (weight / 100);
        }
      });
      
      return {
        ...player,
        compositeScore: totalWeightedScore
      };
    });
    
    // Sort by composite score (highest first)
    playersWithCompositeScores.sort((a, b) => b.compositeScore - a.compositeScore);
    
    // Add rank numbers
    const rankedAgeGroupPlayers = playersWithCompositeScores.map((player, index) => ({
      ...player,
      rank: index + 1
    }));
    
    allRankedPlayers.push(...rankedAgeGroupPlayers);
  });
  
  return allRankedPlayers;
}

/**
 * Calculate drill-specific rankings for a player
 * @param {Object} player - Target player
 * @param {Array} allPlayers - All players for comparison
 * @returns {Object} Drill rankings { drillKey: rank }
 */
export function calculateDrillRankings(player, allPlayers) {
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
      
      // Sort players for this drill
      const sortedPlayers = validPlayers.sort((a, b) => {
        if (drill.key === "40m_dash") {
          return a[drill.key] - b[drill.key]; // Lower time = better
        }
        return b[drill.key] - a[drill.key]; // Higher score = better
      });
      
      const rank = sortedPlayers.findIndex(p => p.id === player.id) + 1;
      rankings[drill.key] = rank > 0 ? rank : null;
    } catch (error) {
      rankings[drill.key] = null;
    }
  });
  
  return rankings;
}

/**
 * Clear the drill range cache (useful when player data changes significantly)
 */
export function clearDrillRangeCache() {
  drillRangeCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    size: drillRangeCache.size,
    keys: Array.from(drillRangeCache.keys())
  };
}