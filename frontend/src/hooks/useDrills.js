import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { DRILL_TEMPLATES } from '../constants/drillTemplates';

/**
 * Unified hook for fetching drill schema.
 * Sources:
 * 1. Backend /events/:id/schema (Primary - includes custom & filtered)
 * 2. Local DRILL_TEMPLATES (Fallback/Initial)
 * 
 * This hook replaces all ad-hoc drill merging logic across the app.
 */
export function useDrills(selectedEvent) {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If no event, or no ID, reset
    if (!selectedEvent?.id) {
      setSchema(null);
      return;
    }

    let isMounted = true;
    
    const fetchSchema = async () => {
      setLoading(true);
      try {
        // Fetch the authoritative schema from backend
        // This endpoint now returns merged custom drills + excludes disabled drills
        const { data } = await api.get(`/events/${selectedEvent.id}/schema`);
        
        if (isMounted) {
          setSchema(data);
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
    selectedEvent?.drillTemplate, 
    // Deep compare disabled/custom lengths to trigger refetch if they change locally
    selectedEvent?.disabled_drills?.length,
    selectedEvent?.custom_drills?.length
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

