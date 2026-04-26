import { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';

export function useImportSchema(selectedEvent, availableDrills) {
  const [serverDrills, setServerDrills] = useState(null);
  const [schemaError, setSchemaError] = useState(null);

  useEffect(() => {
      if (selectedEvent?.id) {
          setSchemaError(null);
          api.get(`/events/${selectedEvent.id}/schema`)
             .then(res => {
                 console.log("[ImportResultsModal] Fresh schema loaded:", res.data.drills.length, "drills");
                 setServerDrills(res.data.drills);
             })
             .catch(err => {
                 console.error("[ImportResultsModal] Failed to load fresh schema:", err);
                 setSchemaError("Failed to load event configuration. Import is disabled to prevent data loss. Please refresh the page.");
             });
      }
  }, [selectedEvent?.id]);

  const effectiveDrills = useMemo(() => {
      return serverDrills || availableDrills;
  }, [serverDrills, availableDrills]);

  return { effectiveDrills, schemaError };
}
