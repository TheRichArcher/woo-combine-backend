import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';

/**
 * Custom hook for managing drill weight adjustments and presets
 * @param {Function} onWeightsChange - Callback when weights are persisted
 * @returns {Object} Weight management utilities and state
 */
export function useWeightManagement(onWeightsChange) {
  // Persisted weights (used for actual calculations)
  const [persistedWeights, setPersistedWeights] = useState(getDefaultWeights());
  
  // Live slider values for smooth interaction
  const [sliderWeights, setSliderWeights] = useState(getDefaultWeights());
  
  // Track current weights during drag operations
  const currentWeights = useRef({ ...getDefaultWeights() });
  
  // Timer for debouncing weight persistence
  const timer = useRef(null);
  
  // Active preset state
  const [activePreset, setActivePreset] = useState('balanced');

  // Sync ref and sliderWeights when persisted weights change (from presets, etc.)
  useEffect(() => {
    currentWeights.current = { ...persistedWeights };
    setSliderWeights({ ...persistedWeights });
  }, [persistedWeights]);

  /**
   * Apply a weight preset
   */
  const applyPreset = useCallback((presetKey) => {
    if (!getDefaultWeightPresets()[presetKey]) {
      if (import.meta.env.DEV) {
        logger.warn('WEIGHT_MANAGEMENT', 'Invalid preset key', { presetKey });
      }
      return;
    }

    const preset = getDefaultWeightPresets()[presetKey];
    const newWeights = { ...preset.weights };
    
    // Update all states
    setPersistedWeights(newWeights);
    setSliderWeights(newWeights);
    setActivePreset(presetKey);
    currentWeights.current = { ...newWeights };
    
    // Clear any pending timer
    if (timer.current) clearTimeout(timer.current);
    
    // Notify parent of weight change
    if (onWeightsChange) {
      onWeightsChange(newWeights);
    }
  }, [onWeightsChange]);

  /**
   * Handle individual weight changes (during slider drag)
   */
  const handleWeightChange = useCallback((drillKey, value) => {
    // Update ref immediately (no re-render, no lag during drag)
    currentWeights.current[drillKey] = value;

    // Cancel previous timer
    if (timer.current) clearTimeout(timer.current);

    // Debounce persistence to avoid snapback
    timer.current = setTimeout(() => {
      // Persist to state (this causes re-render but after drag ends)
      const newWeights = { ...currentWeights.current };
      setPersistedWeights(newWeights);
      
      // Clear active preset after manual adjustment
      setActivePreset('');
      
      // Notify parent of weight change
      if (onWeightsChange) {
        onWeightsChange(newWeights);
      }
    }, 300);
  }, [onWeightsChange]);

  /**
   * Persist slider weights (for use with onPointerUp events)
   */
  const persistSliderWeights = useCallback((weights) => {
    if (timer.current) clearTimeout(timer.current);
    
    timer.current = setTimeout(() => {
      // Persist to state
      setPersistedWeights({ ...weights });
      
      // Clear active preset after calculation
      setActivePreset('');
      
      // Notify parent of weight change
      if (onWeightsChange) {
        onWeightsChange(weights);
      }
    }, 100);
  }, [onWeightsChange]);

  /**
   * Update slider weights for smooth UI feedback
   */
  const updateSliderWeights = useCallback((weights) => {
    setSliderWeights({ ...weights });
  }, []);

  /**
   * Reset weights to default
   */
  const resetWeights = useCallback(() => {
    applyPreset('balanced');
  }, [applyPreset]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return {
    // State
    persistedWeights,
    sliderWeights,
    activePreset,
    
    // Actions
    applyPreset,
    handleWeightChange,
    persistSliderWeights,
    updateSliderWeights,
    resetWeights,
    
    // Internal refs (expose if needed for advanced usage)
    currentWeights: currentWeights.current
  };
} 