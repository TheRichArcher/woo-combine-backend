import { getCachedDrillRanges, calculateNormalizedDrillScore } from './optimizedScoring';

/**
 * Creates balanced teams based on skill categories using a multi-metric optimization algorithm.
 * 
 * @param {Array} players - List of players to form teams from
 * @param {number} numTeams - Number of teams to create
 * @param {Array} drills - List of drill definitions
 * @returns {Object} { teams, stats } - Formed teams and formation statistics
 */
export function createSkillBasedTeams(players, numTeams, drills) {
  if (!players || players.length === 0 || numTeams < 2) {
    return { teams: [], stats: {} };
  }

  // 1. Pre-process Data: Normalize & Impute
  const { processedPlayers, categoryAvgs, globalStats } = preprocessPlayerData(players, drills);

  // 2. Initial Assignment (Greedy Best-Fit)
  let teams = Array.from({ length: numTeams }, () => ({
    players: [],
    sums: {}, // Running sum of scores per category
    counts: {}, // Count of players contributing to each category
    size: 0
  }));

  // Initialize team stats
  const categories = Object.keys(globalStats.categoryMeans);
  teams.forEach(team => {
    categories.forEach(cat => {
      team.sums[cat] = 0;
      team.counts[cat] = 0;
    });
  });

  // 36. Sort players by "impact" (deviation from global average across all categories)
  // This helps place the most "extreme" players first when teams are empty/flexible.
  const sortedPlayers = [...processedPlayers].sort((a, b) => b.impactScore - a.impactScore);

  // SEED PHASE: Distribute first N players one-per-team to avoid empty team traps
  // This ensures no team starts empty, avoiding the "Team 2 gets 0 players" issue
  // caused by greedy cost functions preferring to stack players on the "best" mean.
  let seedIndex = 0;
  for (let i = 0; i < numTeams && seedIndex < sortedPlayers.length; i++) {
    addPlayerToTeam(teams[i], sortedPlayers[seedIndex], categories);
    seedIndex++;
  }
  
  // Assign remaining players
  for (let i = seedIndex; i < sortedPlayers.length; i++) {
    const player = sortedPlayers[i];
    let bestTeamIndex = -1;
    let minCostIncrease = Infinity;

    for (let j = 0; j < numTeams; j++) {
      const costIncrease = calculateAssignmentCost(teams[j], player, globalStats, categories);
      if (costIncrease < minCostIncrease) {
        minCostIncrease = costIncrease;
        bestTeamIndex = j;
      }
    }

    // Add to best team
    if (bestTeamIndex !== -1) {
      addPlayerToTeam(teams[bestTeamIndex], player, categories);
    } else {
      // Fallback (should ideally never happen with valid costs)
      addPlayerToTeam(teams[0], player, categories);
    }
  }

  // 3. Optimization Phase (Swapping)
  // Run a fixed number of improvement iterations
  teams = optimizeTeams(teams, globalStats, categories, 1000); // 1000 iterations cap

  // 4. Format Output
  // Extract just the original player objects (maybe with added analysis data if needed)
  const finalTeams = teams.map(t => t.players.map(p => p.originalPlayer));
  
  return {
    teams: finalTeams,
    stats: {
      categories,
      globalMeans: globalStats.categoryMeans,
      processedPlayers // Returned for debugging/analysis
    }
  };
}

/**
 * Pre-processes player data:
 * - Calculates normalized scores
 * - Imputes missing values
 * - Aggregates into categories
 */
function preprocessPlayerData(players, drills) {
  // Identify categories
  const categoryMap = {}; // drillKey -> category
  const categories = new Set();
  
  drills.forEach(drill => {
    const cat = drill.category || 'general';
    categoryMap[drill.key] = cat;
    categories.add(cat);
  });

  // Calculate global ranges (per age group logic is handled in optimizedScoring)
  // But for fairness in team formation across mixed ages, we might want global ranges?
  // Usually, we want to balance "ability relative to peer group" AND "absolute ability".
  // The existing tool uses age-group relative scoring for the composite score.
  // We will stick to the existing pattern: Use age-group relative normalized scores.
  // This ensures a 10/10 U10 player is treated similarly to a 10/10 U15 player for balancing purposes (assuming teams are mixed age).
  // If teams are age-segregated, this also works.
  
  // We need to calculate ranges for all age groups present
  const playersByAge = {};
  players.forEach(p => {
    const age = p.age_group || 'ALL';
    if (!playersByAge[age]) playersByAge[age] = [];
    playersByAge[age].push(p);
  });

  // Get ranges per age group
  const rangesByAge = {};
  Object.keys(playersByAge).forEach(age => {
    rangesByAge[age] = getCachedDrillRanges(players, age, drills);
  });

  // First pass: Collect valid scores to find medians for imputation
  const drillValues = {};
  drills.forEach(d => drillValues[d.key] = []);

  players.forEach(p => {
    const age = p.age_group || 'ALL';
    const range = rangesByAge[age];
    
    drills.forEach(d => {
      const raw = p.scores?.[d.key] ?? p[d.key];
      if (raw != null && typeof raw === 'number' && range[d.key]) {
        // Normalize immediately
        const norm = calculateNormalizedDrillScore(raw, range[d.key], d.key, d.lowerIsBetter);
        drillValues[d.key].push(norm);
      }
    });
  });

  // Calculate Medians for imputation
  const drillMedians = {};
  drills.forEach(d => {
    const vals = drillValues[d.key].sort((a, b) => a - b);
    if (vals.length === 0) {
      drillMedians[d.key] = 50; // Default neutral
    } else {
      const mid = Math.floor(vals.length / 2);
      drillMedians[d.key] = vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    }
  });

  // Second pass: Build player vectors
  const processedPlayers = players.map(player => {
    const age = player.age_group || 'ALL';
    const range = rangesByAge[age];
    const categoryScores = {};
    const categoryCounts = {};
    let missingData = false;

    // Initialize category accumulators
    categories.forEach(c => {
      categoryScores[c] = 0;
      categoryCounts[c] = 0;
    });

    drills.forEach(d => {
      const cat = categoryMap[d.key];
      const raw = player.scores?.[d.key] ?? player[d.key];
      let normScore;

      if (raw != null && typeof raw === 'number' && range[d.key]) {
        normScore = calculateNormalizedDrillScore(raw, range[d.key], d.key, d.lowerIsBetter);
      } else {
        missingData = true;
        normScore = drillMedians[d.key]; // Impute
      }

      categoryScores[cat] += normScore;
      categoryCounts[cat]++;
    });

    // Average categories
    const finalCategoryScores = {};
    let totalScore = 0;
    let catCount = 0;

    categories.forEach(c => {
      if (categoryCounts[c] > 0) {
        finalCategoryScores[c] = categoryScores[c] / categoryCounts[c];
      } else {
        finalCategoryScores[c] = 50; // Neutral if entire category is missing
      }
      totalScore += finalCategoryScores[c];
      catCount++;
    });

    const avgScore = catCount > 0 ? totalScore / catCount : 0;
    
    // Calculate impact/variance (simple sum of squared deviations from 50)
    let varianceSum = 0;
    categories.forEach(c => {
      varianceSum += Math.pow(finalCategoryScores[c] - 50, 2);
    });
    const impactScore = Math.sqrt(varianceSum); // Euclidean distance from neutral

    return {
      originalPlayer: player,
      id: player.id,
      scores: finalCategoryScores,
      missingData,
      impactScore
    };
  });

  // Calculate Global Means per Category
  const globalMeans = {};
  categories.forEach(c => {
    const sum = processedPlayers.reduce((acc, p) => acc + p.scores[c], 0);
    globalMeans[c] = sum / processedPlayers.length;
  });

  return {
    processedPlayers,
    globalStats: { categoryMeans: globalMeans },
    categoryAvgs: globalMeans
  };
}

/**
 * Calculates the cost of adding a player to a team.
 * Cost = Sum of Squared Errors from Global Means + Size Penalty
 */
function calculateAssignmentCost(team, player, globalStats, categories) {
  const currentSize = team.size;
  const newSize = currentSize + 1;
  
  let cost = 0;
  
  categories.forEach(cat => {
    const globalMean = globalStats.categoryMeans[cat];
    const currentSum = team.sums[cat];
    const newSum = currentSum + player.scores[cat];
    const newAvg = newSum / newSize;
    
    // Penalty for deviating from global mean
    cost += Math.pow(newAvg - globalMean, 2);
  });

  // Size penalty (soft constraint to keep teams balanced in size)
  // We want to discourage teams from getting too big relative to others.
  // In the greedy phase, this just helps fill teams evenly.
  // Using a larger multiplier to enforce size balance more strictly
  // Square the size to make the penalty grow non-linearly
  cost += Math.pow(newSize, 2) * 5.0;

  return cost;
}

function addPlayerToTeam(team, player, categories) {
  team.players.push(player);
  team.size++;
  categories.forEach(cat => {
    team.sums[cat] += player.scores[cat];
    team.counts[cat]++; // Assuming each player contributes 1 count to the average
  });
}

function removePlayerFromTeam(team, player, categories) {
  const idx = team.players.findIndex(p => p.id === player.id);
  if (idx === -1) return;
  
  team.players.splice(idx, 1);
  team.size--;
  categories.forEach(cat => {
    team.sums[cat] -= player.scores[cat];
    team.counts[cat]--;
  });
}

function getTeamCost(team, globalStats, categories) {
  if (team.size === 0) return 0;
  let cost = 0;
  categories.forEach(cat => {
    const avg = team.sums[cat] / team.size;
    cost += Math.pow(avg - globalStats.categoryMeans[cat], 2);
  });
  return cost;
}

/**
 * Optimizes teams by swapping players to reduce total variance
 */
function optimizeTeams(teams, globalStats, categories, iterations) {
  let currentTotalCost = teams.reduce((acc, t) => acc + getTeamCost(t, globalStats, categories), 0);
  
  for (let i = 0; i < iterations; i++) {
    // Pick two random teams
    const t1Idx = Math.floor(Math.random() * teams.length);
    let t2Idx = Math.floor(Math.random() * teams.length);
    while (t1Idx === t2Idx) t2Idx = Math.floor(Math.random() * teams.length);
    
    const team1 = teams[t1Idx];
    const team2 = teams[t2Idx];
    
    if (team1.size === 0 || team2.size === 0) continue;

    // Pick random players from each
    const p1Idx = Math.floor(Math.random() * team1.players.length);
    const p2Idx = Math.floor(Math.random() * team2.players.length);
    
    const p1 = team1.players[p1Idx];
    const p2 = team2.players[p2Idx];

    // Calculate cost if swapped
    // Temporarily swap in memory (virtually)
    
    // Current contribution of t1 and t2 to cost
    const currentPairCost = getTeamCost(team1, globalStats, categories) + getTeamCost(team2, globalStats, categories);
    
    // New sums if swapped
    const t1NewSums = {};
    const t2NewSums = {};
    categories.forEach(c => {
      t1NewSums[c] = team1.sums[c] - p1.scores[c] + p2.scores[c];
      t2NewSums[c] = team2.sums[c] - p2.scores[c] + p1.scores[c];
    });

    // Calculate new costs
    let newPairCost = 0;
    
    // Cost for T1
    let t1Cost = 0;
    categories.forEach(c => {
      const avg = t1NewSums[c] / team1.size; // Size stays same
      t1Cost += Math.pow(avg - globalStats.categoryMeans[c], 2);
    });

    // Cost for T2
    let t2Cost = 0;
    categories.forEach(c => {
      const avg = t2NewSums[c] / team2.size;
      t2Cost += Math.pow(avg - globalStats.categoryMeans[c], 2);
    });
    
    newPairCost = t1Cost + t2Cost;

    // If improvement, apply swap
    if (newPairCost < currentPairCost) {
      // Remove p1 from t1, add p2
      removePlayerFromTeam(team1, p1, categories);
      addPlayerToTeam(team1, p2, categories);
      
      // Remove p2 from t2, add p1
      removePlayerFromTeam(team2, p2, categories);
      addPlayerToTeam(team2, p1, categories);
      
      currentTotalCost = currentTotalCost - currentPairCost + newPairCost;
    }
  }
  
  return teams;
}
