/**
 * Basic validation tests for performance optimizations
 * These are simple functional tests to ensure optimizations work correctly
 */

import { calculateOptimizedRankings, clearDrillRangeCache } from '../optimizedScoring';
import { dataCache } from '../dataCache';
import { debounce } from '../debounce';

// Mock player data for testing
const mockPlayers = [
  {
    id: '1',
    name: 'Player 1',
    age_group: 'U12',
    '40m_dash': 6.0,
    'vertical_jump': 20,
    'catching': 85,
    'throwing': 75,
    'agility': 8.5
  },
  {
    id: '2', 
    name: 'Player 2',
    age_group: 'U12',
    '40m_dash': 5.5,
    'vertical_jump': 25,
    'catching': 90,
    'throwing': 80,
    'agility': 7.8
  },
  {
    id: '3',
    name: 'Player 3', 
    age_group: 'U14',
    '40m_dash': 5.2,
    'vertical_jump': 28,
    'catching': 88,
    'throwing': 82,
    'agility': 7.2
  }
];

const mockWeights = {
  '40m_dash': 20,
  'vertical_jump': 20,
  'catching': 20,
  'throwing': 20,
  'agility': 20
};

/**
 * Test optimized scoring calculations
 */
export function testOptimizedScoring() {
  
  try {
    // Clear cache to start fresh
    clearDrillRangeCache();
    
    // Test ranking calculation
    const rankings = calculateOptimizedRankings(mockPlayers, mockWeights);
    
    // Validate results
    if (!Array.isArray(rankings)) {
      throw new Error('Rankings should return an array');
    }
    
    if (rankings.length === 0) {
      throw new Error('Rankings should not be empty with valid players');
    }
    
    // Check that all players have composite scores
    const hasScores = rankings.every(player => 
      typeof player.compositeScore === 'number' && player.compositeScore >= 0
    );
    
    if (!hasScores) {
      throw new Error('All players should have valid composite scores');
    }
    
    // Check that rankings are sorted
    const isSorted = rankings.every((player, index) => 
      index === 0 || rankings[index - 1].compositeScore >= player.compositeScore
    );
    
    if (!isSorted) {
      throw new Error('Rankings should be sorted by composite score');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Optimized scoring test failed:', error.message);
    return false;
  }
}

/**
 * Test data cache functionality
 */
export function testDataCache() {
  
  try {
    const testKey = 'test-key';
    const testData = { test: 'data', timestamp: Date.now() };
    
    // Test cache set/get
    dataCache.set(testKey, testData, 1000); // 1 second TTL
    const cachedData = dataCache.get(testKey);
    
    if (JSON.stringify(cachedData) !== JSON.stringify(testData)) {
      throw new Error('Cached data should match original data');
    }
    
    // Test cache expiration (simulate)
    if (!dataCache.has(testKey)) {
      throw new Error('Cache should contain recently set data');
    }
    
    // Test cache invalidation
    dataCache.invalidate(testKey);
    if (dataCache.has(testKey)) {
      throw new Error('Cache should not contain invalidated data');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Data cache test failed:', error.message);
    return false;
  }
}

/**
 * Test debounce functionality
 */
export function testDebounce() {
  
  return new Promise((resolve) => {
    try {
      let callCount = 0;
      const testFunction = () => {
        callCount++;
      };
      
      const debouncedFunction = debounce(testFunction, 100);
      
      // Call multiple times rapidly
      debouncedFunction();
      debouncedFunction();
      debouncedFunction();
      
      // Check that it hasn't been called yet
      if (callCount !== 0) {
        throw new Error('Debounced function should not have been called immediately');
      }
      
      // Wait for debounce to execute
      setTimeout(() => {
        if (callCount !== 1) {
          console.error('❌ Debounce test failed: Expected 1 call, got', callCount);
          resolve(false);
        } else {
          resolve(true);
        }
      }, 150);
      
    } catch (error) {
      console.error('❌ Debounce test failed:', error.message);
      resolve(false);
    }
  });
}

/**
 * Run all optimization tests
 */
export async function runOptimizationTests() {
  
  const results = {
    optimizedScoring: testOptimizedScoring(),
    dataCache: testDataCache(),
    debounce: await testDebounce()
  };
  
  const allPassed = Object.values(results).every(result => result === true);
  
  if (!allPassed) {
    console.error('⚠️ Some optimization tests failed:', results);
  }
  
  return results;
}

// Export individual test functions for manual testing
export default {
  runOptimizationTests,
  testOptimizedScoring,
  testDataCache,
  testDebounce
};