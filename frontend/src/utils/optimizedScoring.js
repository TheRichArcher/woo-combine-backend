/*
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

/**
 * Cache for drill ranges to avoid recalculation - lazy initialized to avoid TDZ
 */
let drillRangeCache = null;

function getDrillRangeCache() {
  if (!drillRangeCache) {
    drillRangeCache = new Map();
  }
  return drillRangeCache;
}

/**
 * Generate cache key for drill ranges
 */
function getDrillRangeCacheKey(players, ageGroup, drillList) {
  const filtered = ageGroup === 'ALL'
    ? players
    : players.filter(p => p.age_group === ageGroup);

  const playerIds = filtered
    .map(p => p.id)
    .sort()
    .join(',');

  const currentDrills = drillList || [];

  const scores = currentDrills.map(drill => {
    const values = filtered
      .filter(p => (p.scores?.[drill.key] ?? p[drill.key]) != null)
      .map(p => p.scores?.[drill.key] ?? p[drill.key])
      .sort()
      .join(',');
    return `${drill.key}:${values}`;
  }).join('|');

  return `${ageGroup}|${playerIds}_${scores}`;
}

/**
 * Calculate drill ranges with caching for performance
 * @param {Array<Object>} players - All players with drill scores
 * @param {string} ageGroup - Age group to calculate ranges for
 * @param {Array<Object>} drillList - List of drills to calculate ranges for
 * @returns {Object<string, {min: number, max: number}>} Drill ranges by drill key
 */
export function getCachedDrillRanges(players, ageGroup, drillList = []) {
  const cacheKey = getDrillRangeCacheKey(players, ageGroup, drillList);
  const cache = getDrillRangeCache();

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const currentDrills = drillList || [];

  const ageGroupPlayers = (ageGroup === 'ALL' ? players : players.filter(p => p && p.age_group === ageGroup))
    .filter(p => currentDrills.some(drill => (p.scores?.[drill.key] ?? p[drill.key]) != null && typeof (p.scores?.[drill.key] ?? p[drill.key]) === 'number'));

  const drillRanges = {};

  currentDrills.forEach(drill => {
    // Use schema-defined ranges if available (and robustly valid)
    if (drill.min != null && drill.max != null && drill.min !== undefined && drill.max !== undefined) {
      drillRanges[drill.key] = {
        min: Number(drill.min),
        max: Number(drill.max)
      };
    } else {
      // Calculate from data
      const values = ageGroupPlayers
        .map(p => p.scores?.[drill.key] ?? p[drill.key])
        .filter(val => val != null && typeof val === 'number');

      if (values.length > 0) {
        drillRanges[drill.key] = {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      } else {
        // Fallback if no data and no schema range
        drillRanges[drill.key] = { min: -Infinity, max: Infinity };
      }
    }
  });

  // Cache the result
  cache.set(cacheKey, drillRanges);

  // Clear old cache entries if cache gets too large
  if (cache.size > 50) {
    const keysToDelete = Array.from(cache.keys()).slice(0, 25);
    keysToDelete.forEach(key => cache.delete(key));
  }

  return drillRanges;
}

/**
 * Calculate normalized score for a single drill value
 * @param {number} rawScore - Raw drill score
 * @param {{min: number, max: number}} range - Min/max range for the drill
 * @param {string} drillKey - Drill identifier (e.g., '40m_dash', 'vertical_jump')
 * @param {boolean} lowerIsBetter - Whether lower scores are better (optional override)
 * @returns {number} Normalized score (0-100)
 */
export function calculateNormalizedDrillScore(rawScore, range, drillKey, lowerIsBetter) {
  if (!range || rawScore == null) return 0;
  
  if (range.max === range.min) {
    return 50; // All players have same score
  }
  
  // Determine if lower is better. 
  // Use drill metadata if available, otherwise default to false (higher is better).
  // No hardcoded sport logic here.
  const isLowerBetter = lowerIsBetter === true;
  
  if (isLowerBetter) {
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
 * @param {Array} drillList - List of drills (optional)
 * @returns {number} Composite score
 */
export function calculateOptimizedCompositeScore(player, allPlayers, weights, drillList = []) {
  if (!player || !allPlayers || allPlayers.length === 0) return 0;
  
  const currentDrills = drillList || [];
  const drillRanges = getCachedDrillRanges(allPlayers, player.age_group, currentDrills);
  let totalWeightedScore = 0;
  
  // Calculate total weight for renormalization
  let totalWeight = 0;
  currentDrills.forEach(drill => {
    const w = weights[drill.key] || 0;
    if (w > 0) totalWeight += w;
  });
  
  currentDrills.forEach(drill => {
    const rawScore = player.scores?.[drill.key] ?? player[drill.key];
    const weight = weights[drill.key] || 0;
    const range = drillRanges[drill.key];
    
    if (rawScore != null && typeof rawScore === 'number' && range) {
      const normalizedScore = calculateNormalizedDrillScore(rawScore, range, drill.key, drill.lowerIsBetter);
      if (totalWeight > 0) {
        totalWeightedScore += normalizedScore * (weight / totalWeight);
      }
    }
  });
  
  return totalWeightedScore;
}

/**
 * Calculate optimized rankings for a group of players
 * Single-pass algorithm with minimal object creation
 * @param {Array} players - Players to rank
 * @param {Object} weights - Drill weights
 * @param {Array} drillList - List of drills (optional)
 * @returns {Array} Ranked players with scores and ranks
 */
export function calculateOptimizedRankings(players, weights, drillList = []) {
  if (!players || players.length === 0) return [];
  
  const currentDrills = drillList || [];
  
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
    // Filter players with at least one drill score based on CURRENT drills
    const playersWithScores = ageGroupPlayers.filter(player => 
      currentDrills.some(drill => (player.scores?.[drill.key] ?? player[drill.key]) != null && typeof (player.scores?.[drill.key] ?? player[drill.key]) === 'number')
    );
    
    if (playersWithScores.length === 0) return;
    
    // Get cached drill ranges for this age group
    const drillRanges = getCachedDrillRanges(players, ageGroup, currentDrills);
    
    // Calculate total weight for renormalization
    let totalWeight = 0;
    currentDrills.forEach(drill => {
      const w = weights[drill.key] || 0;
      if (w > 0) totalWeight += w;
    });
    
    // Calculate scores in a single pass
    const playersWithCompositeScores = playersWithScores.map(player => {
      let totalWeightedScore = 0;
      
      currentDrills.forEach(drill => {
        const rawScore = player.scores?.[drill.key] ?? player[drill.key];
        const weight = weights[drill.key] || 0;
        const range = drillRanges[drill.key];
        
        if (rawScore != null && typeof rawScore === 'number' && range) {
          const normalizedScore = calculateNormalizedDrillScore(rawScore, range, drill.key, drill.lowerIsBetter);
          if (totalWeight > 0) {
            totalWeightedScore += normalizedScore * (weight / totalWeight);
          }
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
 * Calculate optimized rankings across all players (no age-group normalization)
 * @param {Array} players
 * @param {Object} weights
 * @param {Array} drillList - List of drills (optional)
 * @returns {Array}
 */
export function calculateOptimizedRankingsAcrossAll(players, weights, drillList = []) {
  if (!players || players.length === 0) return [];
  
  const currentDrills = drillList || [];
  
  // Filter players with at least one drill score based on CURRENT drills
  const playersWithScores = players.filter(player => 
    currentDrills.some(drill => {
      const val = player.scores?.[drill.key] ?? player[drill.key];
      const isValid = val != null && typeof val === 'number';
      return isValid;
    })
  );
  
  if (playersWithScores.length === 0) return [];

  const drillRanges = getCachedDrillRanges(playersWithScores, 'ALL', currentDrills);

  // Calculate total weight for renormalization
  let totalWeight = 0;
  currentDrills.forEach(drill => {
    const w = weights[drill.key] || 0;
    if (w > 0) totalWeight += w;
  });

  const scored = playersWithScores.map(player => {
    let totalWeightedScore = 0;
    currentDrills.forEach(drill => {
      const rawScore = player.scores?.[drill.key] ?? player[drill.key];
      const weight = weights[drill.key] || 0;
      const range = drillRanges[drill.key];
      
      if (rawScore != null && typeof rawScore === 'number' && range) {
        const normalizedScore = calculateNormalizedDrillScore(rawScore, range, drill.key, drill.lowerIsBetter);
        if (totalWeight > 0) {
          totalWeightedScore += normalizedScore * (weight / totalWeight);
        }
      }
    });
    return { ...player, compositeScore: totalWeightedScore };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  return scored.map((p, idx) => ({ ...p, rank: idx + 1 }));
}

/**
 * Calculate drill-specific rankings for a player
 * @param {Object} player - Target player
 * @param {Array} allPlayers - All players for comparison
 * @param {Array} drillList - List of drills (optional)
 * @returns {Object} Drill rankings { drillKey: rank }
 */
export function calculateDrillRankings(player, allPlayers, drillList = []) {
  if (!player || !allPlayers || allPlayers.length === 0) return {};
  
  const currentDrills = drillList || [];
  const rankings = {};
  
  currentDrills.forEach(drill => {
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
      
      // Sort players for this drill
      const sortedPlayers = validPlayers.sort((a, b) => {
        const valA = a.scores?.[drill.key] ?? a[drill.key];
        const valB = b.scores?.[drill.key] ?? b[drill.key];
        const isLowerBetter = drill.lowerIsBetter === true;
          
        if (isLowerBetter) {
          return valA - valB; // Lower time = better
        }
        return valB - valA; // Higher score = better
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
  const cache = getDrillRangeCache();
  cache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  const cache = getDrillRangeCache();
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}
