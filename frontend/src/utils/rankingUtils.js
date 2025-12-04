// Ranking and weight calculation utilities
import {
  getDrillsFromTemplate,
  getDefaultWeightsFromTemplate
} from '../constants/drillTemplates.js';

// Getter functions to avoid top-level calls that cause TDZ
const getDrills = (templateId) => {
  return templateId ? getDrillsFromTemplate(templateId) : [];
};

const getDrillWeights = (templateId) => {
  return templateId ? getDefaultWeightsFromTemplate(templateId) : {};
};

// Convert percentage weights to decimal weights (0-1)
export function convertPercentagesToWeights(percentages, drills = []) {
  const weights = {};
  const drillsToUse = drills.length > 0 ? drills : getDrills(); // Fallback to empty if not provided
  drillsToUse.forEach(drill => {
    weights[drill.key] = (percentages[drill.key] || 0) / 100;
  });
  return weights;
}

// Convert decimal weights to percentages for display
export function convertWeightsToPercentages(weights, drills = []) {
  const percentages = {};
  const drillsToUse = drills.length > 0 ? drills : getDrills(); // Fallback to empty
  drillsToUse.forEach(drill => {
    percentages[drill.key] = (weights[drill.key] || 0) * 100;
  });
  return percentages;
}

// Dynamic helper functions for event-specific drills and weights
export const getDrillsForEvent = (event) => {
  const templateId = event?.drillTemplate;
  return getDrillsFromTemplate(templateId);
};

export const getWeightsForEvent = (event) => {
  const templateId = event?.drillTemplate;
  return getDefaultWeightsFromTemplate(templateId);
};

// Calculate composite score for a player
export async function calculateCompositeScore(player, weights = null, event = null, explicitDrills = null) {
  let score = 0;
  let hasAnyScore = false;

  // Use explicit drills if provided, otherwise get from event
  const drillsToUse = explicitDrills || (event ? await getDrillsForEvent(event) : []);
  
  if (!drillsToUse || drillsToUse.length === 0) {
    return 0;
  }

  const weightsToUse = weights || (event ? getWeightsForEvent(event) : {});
  
  drillsToUse.forEach(drill => {
    const value = player[drill.key];
    if (value !== null && value !== undefined && value !== '') {
      let drillScore = parseFloat(value);
      
      // Handle lower-is-better drills (like times)
      if (drill.lowerIsBetter) {
        // Try to use max value from drill definition, otherwise default to 100 (safe upper bound for seconds)
        const maxVal = drill.max || 100; 
        drillScore = Math.max(0, maxVal - drillScore);
      }
      
      score += drillScore * (weightsToUse[drill.key] || 0);
      hasAnyScore = true;
    }
  });
  
  return hasAnyScore ? Math.round(score * 100) / 100 : 0;
}

// Calculate live rankings for a set of players
export async function calculateLiveRankings(players, weights, ageGroup = null, event = null) {
  if (!players || players.length === 0) return [];

  // Filter by age group if specified
  const filteredPlayers = ageGroup ?
    players.filter(p => p.age_group === ageGroup) :
    players;

  // Get drills once to avoid repeated calls
  const drills = event ? await getDrillsForEvent(event) : [];

  // Calculate scores and rank
  const playersWithScores = await Promise.all(filteredPlayers.map(async player => ({
    ...player,
    composite_score: await calculateCompositeScore(player, weights, event, drills)
  })));
  
  // Sort by composite score (highest first)
  playersWithScores.sort((a, b) => b.composite_score - a.composite_score);
  
  // Add rank
  playersWithScores.forEach((player, index) => {
    player.rank = index + 1;
  });
  
  return playersWithScores;
}

// Normalize scores within an age group (0-100 scale)
export function normalizeScoresForAgeGroup(players, ageGroup, drills = []) {
  const ageGroupPlayers = players.filter(p => p.age_group === ageGroup);
  if (ageGroupPlayers.length === 0) return players;
  
  const drillsToUse = drills.length > 0 ? drills : [];
  if (drillsToUse.length === 0) return players;

  const drillStats = {};
  
  // Calculate min/max for each drill in this age group
  drillsToUse.forEach(drill => {
    const scores = ageGroupPlayers
      .map(p => p[drill.key])
      .filter(score => score !== null && score !== undefined && score !== '')
      .map(score => parseFloat(score));
    
    if (scores.length > 0) {
      drillStats[drill.key] = {
        min: Math.min(...scores),
        max: Math.max(...scores)
      };
    }
  });
  
  // Normalize each player's scores
  return players.map(player => {
    if (player.age_group !== ageGroup) return player;
    
    const normalizedPlayer = { ...player };
    
    drillsToUse.forEach(drill => {
      const value = player[drill.key];
      const stats = drillStats[drill.key];
      
      if (value !== null && value !== undefined && value !== '' && stats) {
        const numValue = parseFloat(value);
        const range = stats.max - stats.min;
        
        if (range > 0) {
          // Use drill definition for lower-is-better check if available
          // We need to fetch the drill definition first
          if (drill.lowerIsBetter) {
            normalizedPlayer[`${drill.key}_normalized`] = 
              ((stats.max - numValue) / range) * 100;
          } else {
            normalizedPlayer[`${drill.key}_normalized`] = 
              ((numValue - stats.min) / range) * 100;
          }
        } else {
          normalizedPlayer[`${drill.key}_normalized`] = 50; // Mid-point if no variation
        }
      }
    });
    
    return normalizedPlayer;
  });
} 