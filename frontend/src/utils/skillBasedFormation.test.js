import { createSkillBasedTeams } from './skillBasedFormation';
import { calculateNormalizedDrillScore } from './optimizedScoring';

// Mock dependencies
jest.mock('./optimizedScoring', () => ({
  getCachedDrillRanges: jest.fn(() => ({
    'drill_1': { min: 4, max: 10 },
    'drill_2': { min: 10, max: 20 },
    'drill_3': { min: 0, max: 100 }
  })),
  calculateNormalizedDrillScore: jest.fn((val, range, key, lowerIsBetter) => {
    if (val === null || val === undefined) return 0;
    // Simple linear mock: 50 is mid
    return 50 + (val - (range.min + range.max)/2); 
  })
}));

describe('Skill Based Team Formation', () => {
  const mockDrills = [
    { key: 'drill_1', label: 'Speed', category: 'Speed', lowerIsBetter: true },
    { key: 'drill_2', label: 'Agility', category: 'Agility', lowerIsBetter: true },
    { key: 'drill_3', label: 'Power', category: 'Power', lowerIsBetter: false }
  ];

  const mockPlayers = [
    { id: 'p1', name: 'Player 1', age_group: 'U12', scores: { drill_1: 5, drill_2: 15, drill_3: 50 } },
    { id: 'p2', name: 'Player 2', age_group: 'U12', scores: { drill_1: 6, drill_2: 16, drill_3: 60 } },
    { id: 'p3', name: 'Player 3', age_group: 'U12', scores: { drill_1: 7, drill_2: 14, drill_3: 40 } },
    { id: 'p4', name: 'Player 4', age_group: 'U12', scores: { drill_1: 5.5, drill_2: 15.5, drill_3: 55 } },
    { id: 'p5', name: 'Player 5 (Missing Data)', age_group: 'U12', scores: { drill_1: 5 } }, // Missing drill_2, drill_3
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create specified number of teams', () => {
    const result = createSkillBasedTeams(mockPlayers, 2, mockDrills);
    expect(result.teams).toHaveLength(2);
  });

  test('should include all players including those with missing data', () => {
    const result = createSkillBasedTeams(mockPlayers, 2, mockDrills);
    const allAssigned = result.teams.flat();
    expect(allAssigned).toHaveLength(mockPlayers.length);
    expect(allAssigned.map(p => p.id)).toContain('p5');
  });

  test('should return stats with categories', () => {
    const result = createSkillBasedTeams(mockPlayers, 2, mockDrills);
    expect(result.stats).toBeDefined();
    expect(result.stats.categories).toContain('Speed');
    expect(result.stats.categories).toContain('Agility');
    expect(result.stats.categories).toContain('Power');
  });

  test('should balance teams (basic check)', () => {
    // With 5 players and 2 teams, sizes should be 3 and 2
    const result = createSkillBasedTeams(mockPlayers, 2, mockDrills);
    const sizes = result.teams.map(t => t.length).sort();
    expect(sizes).toEqual([2, 3]);
  });
});
