import { calculateOptimizedCompositeScore } from './optimizedScoring';

describe('Golden Ranking Verification', () => {
  test('Evan Echevarria calculation matches 76.63', () => {
    // 1. Setup Data
    const player = {
      id: 'evan',
      age_group: 'Varsity',
      free_throws: 95.0,
      three_point: 64.0,
      vertical_jump: 40.0,
      lane_agility: 12.26,
      scores: {
        free_throws: 95.0,
        three_point: 64.0,
        vertical_jump: 40.0,
        lane_agility: 12.26
      }
    };
    
    // Dummy array needed for dynamic fallback, though we rely on static ranges here
    const allPlayers = [player]; 
    
    // Weights (sum = 75)
    // Testing with integer "percent" weights to confirm unit agnosticism
    const weights = {
      free_throws: 20,
      three_point: 20,
      vertical_jump: 20,
      lane_agility: 15
    };
    
    // Drills with Static Ranges (mimicking drillTemplates.js / Schema)
    const drills = [
      { key: "free_throws", min: 0, max: 100, lowerIsBetter: false },
      { key: "three_point", min: 0, max: 100, lowerIsBetter: false },
      { key: "vertical_jump", min: 0, max: 50, lowerIsBetter: false },
      { key: "lane_agility", min: 8, max: 20, lowerIsBetter: true }
    ];
    
    // 2. Calculate
    const score = calculateOptimizedCompositeScore(player, allPlayers, weights, drills);
    
    // 3. Assert
    // Expected: 76.633...
    // We check to 2 decimal places to match API rounding policy
    expect(score).toBeCloseTo(76.63, 2); 
    
    // Also verify strict rounding if manually checked
    const rounded = Math.round(score * 100) / 100;
    expect(rounded).toBe(76.63);
  });
});

