import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DRILL_TEMPLATES } from '../constants/drillTemplates';

/**
 * Unified hook for fetching drill schema.
 * Sources:
 * 1. Backend /events/:id/schema (Primary - includes custom & filtered)
 * 2. Local DRILL_TEMPLATES (Fallback/Initial)
 * 
 * This hook replaces all ad-hoc drill merging logic across the app.
 */
export function useDrills(selectedEvent, refreshTrigger = 0) {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { authChecked, user, leaguesLoading } = useAuth();

  useEffect(() => {
    // If no event, or no ID, reset
    if (!selectedEvent?.id) {
      setSchema(null);
      return;
    }

    // CRITICAL FIX: Gate fetch until auth is FULLY checked to prevent 401/403 races during cold start
    // Previous logic `(!authChecked && user)` was incorrect - it didn't wait if no user yet
    // This caused requests to fire before Firebase auth initialized, resulting in 403 errors
    if (!authChecked || leaguesLoading) {
        return;
    }

    // Gate fetch on user presence to prevent 401s during logout (endpoint is protected)
    if (!user) {
      setSchema(null);
      return;
    }

    let isMounted = true;
    
    const fetchSchema = async () => {
      setLoading(true);
      try {
        // Fetch the authoritative schema from backend
        // Use league-scoped endpoint if available for better reliability with subcollections
        const endpoint = selectedEvent.league_id 
          ? `/leagues/${selectedEvent.league_id}/events/${selectedEvent.id}/schema`
          : `/events/${selectedEvent.id}/schema`;
          
        const { data } = await api.get(endpoint);
        
        if (isMounted) {
          // CRITICAL: Merge backend drill data with local DRILL_TEMPLATES to preserve min/max validation ranges
          // Backend provides authoritative drill list, but local templates have validation metadata
          const templateId = selectedEvent.drillTemplate;
          const localTemplate = templateId ? DRILL_TEMPLATES[templateId] : null;
          
          // DEFENSIVE MERGE: Whitelist which fields backend can control to prevent validation data loss
          // Backend is allowed to override: label, unit, category, enabled status, custom drill metadata
          // Backend is NOT allowed to wipe: min, max, lowerIsBetter, defaultWeight (use local template as source of truth)
          const normalizedDrills = (data.drills || []).map(d => {
            // Find matching drill in local template to inherit min/max/validation metadata
            const localDrill = localTemplate?.drills?.find(ld => ld.key === d.key);
            
            // Start with local template (has validation metadata)
            const merged = { ...localDrill };
            
            // Overlay ONLY backend-controlled fields (whitelist approach)
            if (d.key !== undefined) merged.key = d.key;
            if (d.label !== undefined) merged.label = d.label;
            if (d.unit !== undefined) merged.unit = d.unit;
            if (d.category !== undefined) merged.category = d.category;
            if (d.isCustom !== undefined) merged.isCustom = d.isCustom;
            
            // For validation fields: backend wins IF explicitly provided, else keep local template
            // This allows future backend validation ranges while protecting against undefined overwrites
            if (d.lowerIsBetter !== undefined) merged.lowerIsBetter = d.lowerIsBetter;
            else if (d.lower_is_better !== undefined) merged.lowerIsBetter = d.lower_is_better;
            
            if (d.min !== undefined) merged.min = d.min;
            else if (d.min_value !== undefined) merged.min = d.min_value;
            
            if (d.max !== undefined) merged.max = d.max;
            else if (d.max_value !== undefined) merged.max = d.max_value;
            
            if (d.defaultWeight !== undefined) merged.defaultWeight = d.defaultWeight;
            else if (d.default_weight !== undefined) merged.defaultWeight = d.default_weight;
            
            return merged;
          });

          // Normalize presets from list (backend) to object (frontend expectation)
          let normalizedPresets = {};
          if (Array.isArray(data.presets)) {
             data.presets.forEach(p => {
               if (p.id) normalizedPresets[p.id] = p;
             });
          } else if (data.presets) {
             normalizedPresets = data.presets;
          }

          setSchema({
            ...data,
            drills: normalizedDrills,
            presets: normalizedPresets
          });
          setError(null);
        }
      } catch (err) {
        console.warn("Failed to fetch event schema, using fallback:", err);
        
        if (isMounted) {
          setError(err);
          
          // FALLBACK LOGIC: Use local template + manual filtering
          // This is only used if the backend endpoint fails/timeouts
          const templateId = selectedEvent.drillTemplate;
          const fallback = templateId ? (DRILL_TEMPLATES[templateId]) : null;
          
          if (fallback) {
            const disabled = selectedEvent.disabled_drills || [];
            const filteredDrills = fallback.drills.filter(d => !disabled.includes(d.key));
            
            // Try to merge custom drills from event object if they exist there (sometimes denormalized)
            const customDrills = (selectedEvent.custom_drills || []).map(d => ({
                key: d.id,
                label: d.name,
                unit: d.unit,
                lowerIsBetter: d.lower_is_better,
                category: d.category || 'custom',
                min: d.min_val,
                max: d.max_val,
                defaultWeight: 0,
                isCustom: true
            }));

            setSchema({
              ...fallback,
              drills: [...filteredDrills, ...customDrills]
            });
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSchema();

    return () => {
      isMounted = false;
    };
  }, [
    selectedEvent?.id, 
    selectedEvent?.league_id,
    selectedEvent?.drillTemplate, 
    // Deep compare disabled/custom lengths to trigger refetch if they change locally
    selectedEvent?.disabled_drills?.length,
    selectedEvent?.custom_drills?.length,
    refreshTrigger,
    authChecked,
    user,
    leaguesLoading
  ]);

  // Memoized derived state
  const drills = useMemo(() => schema?.drills || [], [schema]);
  const presets = useMemo(() => schema?.presets || [], [schema]);
  
  // Helper to get drill by key
  const getDrill = useMemo(() => (key) => drills.find(d => d.key === key), [drills]);

  return {
    drills,
    presets,
    loading,
    error,
    getDrill,
    schema // Access to full schema object if needed (e.g. name, sport)
  };
}

