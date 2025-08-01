// Ranking and weight calculation utilities
import { 
  getDefaultFootballTemplate, 
  getDrillsFromTemplate, 
  getDefaultWeightsFromTemplate 
} from '../constants/drillTemplates.js';

// Use dynamic drills from template system
const defaultTemplate = getDefaultFootballTemplate();
export const DRILLS = defaultTemplate.drills;
export const DRILL_WEIGHTS = defaultTemplate.defaultWeights;

// Use presets from template system
export const WEIGHT_PRESETS = defaultTemplate.presets;

// Convert percentage weights to decimal weights (0-1)
export function convertPercentagesToWeights(percentages) {
  const weights = {};
  DRILLS.forEach(drill => {
    weights[drill.key] = (percentages[drill.key] || 0) / 100;
  });
  return weights;
}

// Convert decimal weights to percentages for display
export function convertWeightsToPercentages(weights) {
  const percentages = {};
  DRILLS.forEach(drill => {
    percentages[drill.key] = (weights[drill.key] || 0) * 100;
  });
  return percentages;
}

// Calculate composite score for a player
export function calculateCompositeScore(player, weights = DRILL_WEIGHTS) {
  let score = 0;
  let hasAnyScore = false;
  
  DRILLS.forEach(drill => {
    const value = player[drill.key];
    if (value !== null && value !== undefined && value !== '') {
      let drillScore = parseFloat(value);
      
      // For 40m dash, lower time is better - invert the score
      if (drill.key === '40m_dash') {
        drillScore = Math.max(0, 30 - drillScore);
      }
      
      score += drillScore * (weights[drill.key] || 0);
      hasAnyScore = true;
    }
  });
  
  return hasAnyScore ? Math.round(score * 100) / 100 : 0;
}

// Calculate live rankings for a set of players
export function calculateLiveRankings(players, weights, ageGroup = null) {
  if (!players || players.length === 0) return [];
  
  // Filter by age group if specified
  const filteredPlayers = ageGroup ? 
    players.filter(p => p.age_group === ageGroup) : 
    players;
  
  // Calculate scores and rank
  const playersWithScores = filteredPlayers.map(player => ({
    ...player,
    composite_score: calculateCompositeScore(player, weights)
  }));
  
  // Sort by composite score (highest first)
  playersWithScores.sort((a, b) => b.composite_score - a.composite_score);
  
  // Add rank
  playersWithScores.forEach((player, index) => {
    player.rank = index + 1;
  });
  
  return playersWithScores;
}

// Normalize scores within an age group (0-100 scale)
export function normalizeScoresForAgeGroup(players, ageGroup) {
  const ageGroupPlayers = players.filter(p => p.age_group === ageGroup);
  if (ageGroupPlayers.length === 0) return players;
  
  const drillStats = {};
  
  // Calculate min/max for each drill in this age group
  DRILLS.forEach(drill => {
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
    
    DRILLS.forEach(drill => {
      const value = player[drill.key];
      const stats = drillStats[drill.key];
      
      if (value !== null && value !== undefined && value !== '' && stats) {
        const numValue = parseFloat(value);
        const range = stats.max - stats.min;
        
        if (range > 0) {
          // For 40m dash, lower is better, so invert
          if (drill.key === '40m_dash') {
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