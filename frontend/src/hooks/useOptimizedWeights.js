console.log('Loading useOptimizedWeights.js');

/*
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
import { debounce } from '../utils/debounce';
import { calculateOptimizedRankings } from '../utils/optimizedScoring';

/**
 * Custom hook for optimized weight management with performance optimizations
 * @param {Array<Object>} players - Array of player objects
 * @param {Array<Object>} drills - Array of drill definitions
 * @param {Object} presets - Weight presets configuration
 * @returns {Object} Weight management state and methods
 */
export function useOptimizedWeights(players = [], drills, presets = {}) {
  // Load initial weights from localStorage or use defaults
  const getInitialWeights = () => {
    // Try to use defaults from drills first
    const defaults = {};
    if (drills && drills.length > 0) {
      drills.forEach(d => {
        // Check if defaultWeight is provided (0-1 scale or 0-100 scale?)
        // Backend schema default_weight is usually 0.2 (float). Frontend uses 0-100 for sliders.
        // If it's < 1 assume it's decimal, otherwise assume percentage.
        const weight = d.defaultWeight !== undefined ? d.defaultWeight : 0;
        defaults[d.key] = weight <= 1 ? weight * 100 : weight;
      });
      
      // If we have valid defaults from drills, verify against localStorage
      // If localStorage keys don't match current drills, ignore localStorage
      try {
        const saved = localStorage.getItem('wooCombine:weights');
        if (saved) {
          const parsed = JSON.parse(saved);
          const savedKeys = Object.keys(parsed);
          const drillKeys = drills.map(d => d.key);
          
          // Only use saved weights if they match the current drills
          const isMatch = drillKeys.every(k => savedKeys.includes(k));
          if (isMatch) return parsed;
        }
      } catch (e) {
        console.warn('Failed to load weights from localStorage', e);
      }
      
      // If no valid saved weights, return defaults calculated from drills
      if (Object.keys(defaults).length > 0) return defaults;
    }
    
    // Fallback for initial render if drills not yet loaded
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

  // Update weights when drills change (e.g. fetching schema completed)
  useEffect(() => {
    if (drills && drills.length > 0) {
      const currentKeys = Object.keys(persistedWeights);
      const drillKeys = drills.map(d => d.key);
      
      // Check if we need to reset weights because drills changed
      const mismatch = drillKeys.some(k => !persistedWeights[k]) || 
                       (currentKeys.length > 0 && !currentKeys.includes('40m_dash') && !drillKeys.includes(currentKeys[0]));
      
      if (mismatch) {
        const newDefaults = {};
        drills.forEach(d => {
           const weight = d.defaultWeight !== undefined ? d.defaultWeight : 0;
           newDefaults[d.key] = weight <= 1 ? weight * 100 : weight;
        });
        // Normalize to ensure they sum to 100 if needed, or just use as is.
        // Our system uses relative weights so sum doesn't strictly matter for UI but usually 100 is good.
        
        setPersistedWeights(newDefaults);
        setSliderWeights(newDefaults);
      }
    }
  }, [drills]); // Deep comparison might be better but drills array ref should change on load

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
    const preset = presets[presetKey];
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
    console.log('useOptimizedWeights.js: Calculating memoizedRankings');
    if (!players || players.length === 0) return [];
    
    return calculateOptimizedRankings(players, persistedWeights, drills);
  }, [players, persistedWeights, drills]);

  // Group rankings by age group for efficient rendering
  const groupedRankings = useMemo(() => {
    console.log('useOptimizedWeights.js: Calculating groupedRankings');
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
    console.log('useOptimizedWeights.js: Calculating liveRankings');
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
    if (!presets) return null;
    
    for (const [key, preset] of Object.entries(presets)) {
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
  }, [persistedWeights, presets]);

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
