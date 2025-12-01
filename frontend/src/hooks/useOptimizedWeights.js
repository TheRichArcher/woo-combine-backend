/**
 * Optimized Weight Management Hook
 * 
 * Replaces the complex weight management logic in Players.jsx
 * with a clean, performance-optimized solution using debouncing
 * and memoized calculations.
 * 
 * @param {Array<Object>} players - Array of player objects with drill scores
 * @param {Array<Object>} drills - Array of drill definitions (template + custom)
 * @returns {{
 *   persistedWeights: Object,
 *   sliderWeights: Object,
 *   handleWeightChange: Function,
 *   applyPreset: Function,
 *   batchUpdateWeights: Function,
 *   rankings: Array<Object>,
 *   groupedRankings: Object,
 *   liveRankings: Array<Object>,
 *   activePreset: string|null
 * }} Hook state and methods for weight management
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { WEIGHT_PRESETS } from '../constants/players';
import { debounce } from '../utils/debounce';
import { calculateOptimizedRankings } from '../utils/optimizedScoring';

/**
 * Custom hook for optimized weight management with performance optimizations
 * @param {Array<Object>} players - Array of player objects
 * @param {Array<Object>} drills - Array of drill definitions
 * @returns {Object} Weight management state and methods
 */
export function useOptimizedWeights(players = [], drills) {
  // Load initial weights from localStorage or use defaults
  const getInitialWeights = () => {
    try {
      const saved = localStorage.getItem('wooCombine:weights');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load weights from localStorage', e);
    }
    return {
      "40m_dash": 20,
      "vertical_jump": 20, 
      "catching": 20,
      "throwing": 20,
      "agility": 20
    };
  };

  // Persisted weights (the source of truth)
  const [persistedWeights, setPersistedWeights] = useState(getInitialWeights);

  // Live slider values for smooth interaction
  const [sliderWeights, setSliderWeights] = useState(persistedWeights);
  
  // Active preset tracking
  const [activePreset, setActivePreset] = useState('balanced');
  
  // Track if we're currently updating weights to prevent loops
  const isUpdating = useRef(false);

  // Sync slider weights when persisted weights change
  useEffect(() => {
    if (!isUpdating.current) {
      setSliderWeights({ ...persistedWeights });
    }
    // Persist to localStorage whenever weights change
    try {
      localStorage.setItem('wooCombine:weights', JSON.stringify(persistedWeights));
    } catch (e) {
      console.warn('Failed to save weights to localStorage', e);
    }
  }, [persistedWeights]);

  // Debounced function to persist weight changes
  const debouncedPersistWeights = useCallback(
    debounce((newWeights) => {
      isUpdating.current = true;
      setPersistedWeights({ ...newWeights });
      
      // Reset updating flag after a short delay
      setTimeout(() => {
        isUpdating.current = false;
      }, 100);
    }, 250), // 250ms debounce per requirements
    []
  );

  // Handle individual weight changes (for sliders)
  const handleWeightChange = useCallback((drillKey, value) => {
    const newWeights = {
      ...sliderWeights,
      [drillKey]: value
    };
    
    setSliderWeights(newWeights);
    setActivePreset(null); // Clear active preset when manually adjusting
    
    // Debounce the persistence
    debouncedPersistWeights(newWeights);
  }, [sliderWeights, debouncedPersistWeights]);

  // Apply preset weights
  const applyPreset = useCallback((presetKey) => {
    const preset = WEIGHT_PRESETS[presetKey];
    if (!preset) return;

    // Preset weights are defined as fractions (0-1). Convert to percentage (0-100)
    const newWeights = Object.fromEntries(
      Object.entries(preset.weights).map(([key, value]) => [key, value * 100])
    );

    setSliderWeights(newWeights);
    setPersistedWeights(newWeights);
    setActivePreset(presetKey);

    isUpdating.current = true;
    setTimeout(() => {
      isUpdating.current = false;
    }, 100);
  }, []);

  // Batch update multiple weights (for preset applications)
  const batchUpdateWeights = useCallback((newWeights) => {
    setSliderWeights({ ...newWeights });
    setPersistedWeights({ ...newWeights });
    setActivePreset(null);
    
    isUpdating.current = true;
    setTimeout(() => {
      isUpdating.current = false;
    }, 100);
  }, []);

  // Memoized rankings calculation using optimized algorithm
  const memoizedRankings = useMemo(() => {
    if (!players || players.length === 0) return [];
    
    return calculateOptimizedRankings(players, persistedWeights, drills);
  }, [players, persistedWeights, drills]);

  // Group rankings by age group for efficient rendering
  const groupedRankings = useMemo(() => {
    return memoizedRankings.reduce((acc, player) => {
      const ageGroup = player.age_group || 'unknown';
      if (!acc[ageGroup]) {
        acc[ageGroup] = [];
      }
      acc[ageGroup].push(player);
      return acc;
    }, {});
  }, [memoizedRankings]);

  // Live rankings for immediate UI feedback (using slider weights)
  const liveRankings = useMemo(() => {
    // Only recalculate if slider weights differ significantly from persisted
    const weightsChanged = Object.keys(sliderWeights).some(
      key => Math.abs(sliderWeights[key] - persistedWeights[key]) > 0.5
    );

    if (!weightsChanged || !players || players.length === 0) {
      return memoizedRankings;
    }

    return calculateOptimizedRankings(players, sliderWeights, drills);
  }, [players, sliderWeights, persistedWeights, memoizedRankings, drills]);

  // Check if weights match a preset
  const detectActivePreset = useCallback(() => {
    for (const [key, preset] of Object.entries(WEIGHT_PRESETS)) {
      // Compare against percentage scale
      const matches = Object.keys(preset.weights).every((drillKey) => {
        const expected = (preset.weights[drillKey] || 0) * 100;
        return Math.abs((persistedWeights[drillKey] || 0) - expected) < 0.1;
      });

      if (matches) {
        return key;
      }
    }
    return null;
  }, [persistedWeights]);

  // Update active preset when weights change
  useEffect(() => {
    if (!isUpdating.current) {
      const detectedPreset = detectActivePreset();
      if (detectedPreset !== activePreset) {
        setActivePreset(detectedPreset);
      }
    }
  }, [persistedWeights, detectActivePreset, activePreset]);

  // Persist slider weights function for backward compatibility
  const persistSliderWeights = useCallback((weights) => {
    setSliderWeights({ ...weights });
    debouncedPersistWeights(weights);
  }, [debouncedPersistWeights]);

  return {
    // Weight state
    persistedWeights,
    sliderWeights,
    activePreset,
    
    // Weight actions
    handleWeightChange,
    applyPreset,
    batchUpdateWeights,
    setSliderWeights, // Export for backward compatibility
    persistSliderWeights, // Export for backward compatibility
    
    // Rankings data
    rankings: memoizedRankings,
    liveRankings,
    groupedRankings,
    
    // Utility functions
    isUpdating: isUpdating.current
  };
}
