import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useEvent } from './EventContext';
import { useDrills } from '../hooks/useDrills';
import { useOptimizedWeights } from '../hooks/useOptimizedWeights';
import PlayerDetailsModal from '../components/Players/PlayerDetailsModal';

const PlayerDetailsContext = createContext();

export function usePlayerDetails() {
  const context = useContext(PlayerDetailsContext);
  if (!context) {
    throw new Error('usePlayerDetails must be used within a PlayerDetailsProvider');
  }
  return context;
}

export function PlayerDetailsProvider({ children }) {
  const { selectedEvent } = useEvent();
  const { drills, presets } = useDrills(selectedEvent);
  
  // Local weight management for the global modal
  // This ensures we have weights even if the page doesn't provide them
  // We pass empty players array because we don't need rankings calculation in the context
  const {
    persistedWeights,
    sliderWeights,
    setSliderWeights, // Need this to initialize state from page
    setPersistedWeights, // Need this too
    persistSliderWeights,
    activePreset,
    setActivePreset, // Need this
    applyPreset,
    handleWeightChange
  } = useOptimizedWeights([], drills, presets);

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [contextData, setContextData] = useState({});

  const openDetails = useCallback((player, data = {}) => {
    setSelectedPlayer(player);
    // contextData can override weights if provided by the calling page
    setContextData(data);
    
    // Initialize internal state from passed data if available
    if (data.sliderWeights) {
        setSliderWeights(data.sliderWeights);
    }
    if (data.persistedWeights) {
        // If strict sync needed (but persistedWeights usually come from persistence)
        // setPersistedWeights(data.persistedWeights); 
    }
    if (data.activePreset) {
        setActivePreset(data.activePreset);
    }
  }, [setSliderWeights, setActivePreset]);

  const closeDetails = useCallback(() => {
    setSelectedPlayer(null);
    setContextData({});
  }, []);

  // Prepare props for the modal
  const modalProps = useMemo(() => {
    // If the caller provided weights/presets, use them. Otherwise use our local ones.
    const effectivePersistedWeights = contextData.persistedWeights || persistedWeights;
    
    // Crucial: Use internal sliderWeights (reactive) instead of contextData snapshot
    // But initialize it from contextData in openDetails
    const effectiveSliderWeights = sliderWeights; 
    
    const effectivePersistSliderWeights = contextData.persistSliderWeights || persistSliderWeights;
    // Use internal activePreset to reflect changes
    const effectiveActivePreset = activePreset; 
    
    // Wrapper for applyPreset to update internal state
    const effectiveApplyPreset = applyPreset; 
    
    const effectiveDrills = contextData.drills || drills;
    const effectivePresets = contextData.presets || presets;
    const effectiveAllPlayers = contextData.allPlayers || (selectedPlayer ? [selectedPlayer] : []);
    
    // Wrapper for handleWeightChange: update internal state + call page handler
    const effectiveHandleWeightChange = (key, value) => {
        handleWeightChange(key, value); // Updates internal state
        if (contextData.handleWeightChange) {
            contextData.handleWeightChange(key, value); // Updates page state
        }
    };
    
    return {
      player: selectedPlayer,
      allPlayers: effectiveAllPlayers,
      persistedWeights: effectivePersistedWeights,
      sliderWeights: effectiveSliderWeights,
      persistSliderWeights: effectivePersistSliderWeights,
      handleWeightChange: effectiveHandleWeightChange,
      activePreset: effectiveActivePreset,
      applyPreset: effectiveApplyPreset,
      drills: effectiveDrills,
      presets: effectivePresets,
      onClose: closeDetails
    };
  }, [
    selectedPlayer, contextData, 
    persistedWeights, sliderWeights, persistSliderWeights, handleWeightChange, activePreset, applyPreset, 
    drills, presets, closeDetails
  ]);

  return (
    <PlayerDetailsContext.Provider value={{ selectedPlayer, openDetails, closeDetails }}>
      {children}
      {selectedPlayer && !contextData.suppressGlobalModal && (
        <PlayerDetailsModal {...modalProps} />
      )}
    </PlayerDetailsContext.Provider>
  );
}
