import { getDrillsFromTemplate } from '../constants/drillTemplates';
import {
  calculateNormalizedDrillScore,
  calculateOptimizedRankings
} from './optimizedScoring';

describe('football agility direction', () => {
  test('40-yard and agility both use lower-is-better', () => {
    const footballDrills = getDrillsFromTemplate('football');
    const forty = footballDrills.find((d) => d.key === '40m_dash');
    const agility = footballDrills.find((d) => d.key === 'agility');

    expect(forty?.lowerIsBetter).toBe(true);
    expect(agility?.lowerIsBetter).toBe(true);
  });

  test('normalization inverts timed drills so lower values score higher', () => {
    const range = { min: 5, max: 10 };

    const lowerTime = calculateNormalizedDrillScore(6, range, 'agility', true);
    const higherTime = calculateNormalizedDrillScore(9, range, 'agility', true);

    expect(lowerTime).toBeGreaterThan(higherTime);
    expect(lowerTime).toBeCloseTo(80, 5);
    expect(higherTime).toBeCloseTo(20, 5);
  });

  test('agility now ranks and contributes like 40-yard dash', () => {
    const drills = [
      { key: '40m_dash', min: 5, max: 10, lowerIsBetter: true },
      { key: 'agility', min: 5, max: 10, lowerIsBetter: true }
    ];
    const weights = { '40m_dash': 50, agility: 50 };
    const players = [
      {
        id: 'p_fast',
        age_group: 'U12',
        scores: { '40m_dash': 6, agility: 6 }
      },
      {
        id: 'p_slow',
        age_group: 'U12',
        scores: { '40m_dash': 9, agility: 9 }
      }
    ];

    const rankings = calculateOptimizedRankings(players, weights, drills);
    const fast = rankings.find((p) => p.id === 'p_fast');
    const slow = rankings.find((p) => p.id === 'p_slow');

    expect(fast.rank).toBe(1);
    expect(slow.rank).toBe(2);
    expect(fast.compositeScore).toBeGreaterThan(slow.compositeScore);
    expect(fast.compositeScore).toBeCloseTo(80, 5);
    expect(slow.compositeScore).toBeCloseTo(20, 5);
  });
});
