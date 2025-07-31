// Ranking and weight calculation utilities

export const DRILLS = [
  { key: "40m_dash", label: "40-Yard Dash", unit: "sec" },
  { key: "vertical_jump", label: "Vertical Jump", unit: "in" },
  { key: "catching", label: "Catching", unit: "pts" },
  { key: "throwing", label: "Throwing", unit: "pts" },
  { key: "agility", label: "Agility", unit: "pts" },
];

export const DRILL_WEIGHTS = {
  "40m_dash": 0.3,
  "vertical_jump": 0.2,
  "catching": 0.15,
  "throwing": 0.15,
  "agility": 0.2,
};

export const WEIGHT_PRESETS = {
  balanced: {
    name: "Balanced",
    description: "Equal emphasis on all skills",
    weights: { "40m_dash": 20, "vertical_jump": 20, "catching": 20, "throwing": 20, "agility": 20 }
  },
  speed: {
    name: "Speed Focused",
    description: "Emphasizes speed and athleticism",
    weights: { "40m_dash": 50, "vertical_jump": 15, "catching": 10, "throwing": 10, "agility": 15 }
  },
  skills: {
    name: "Skills Focused", 
    description: "Emphasizes catching and throwing",
    weights: { "40m_dash": 10, "vertical_jump": 10, "catching": 35, "throwing": 35, "agility": 10 }
  },
  athletic: {
    name: "Athletic",
    description: "Emphasizes overall athleticism",
    weights: { "40m_dash": 30, "vertical_jump": 25, "catching": 10, "throwing": 10, "agility": 25 }
  }
};

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