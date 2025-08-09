import React, { useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import api from '../lib/api';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { useToast } from '../context/ToastContext';
import ErrorDisplay from './ErrorDisplay';
import { customValidators } from '../utils/validation';
import { cacheInvalidation } from '../utils/dataCache';

const DRILL_TYPES = [
  { value: "40m_dash", label: "40-Yard Dash" },
  { value: "vertical_jump", label: "Vertical Jump" },
  { value: "catching", label: "Catching" },
  { value: "throwing", label: "Throwing" },
  { value: "agility", label: "Agility" },
];

const DrillInputForm = React.memo(function DrillInputForm({ playerId, onSuccess }) {
  const { user: _user, selectedLeagueId: _selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();
  const [type, setType] = useState("");
  const [value, setValue] = useState("");
  
  const { showSuccess, showError } = useToast();
  const { loading, error, execute: executeSubmit } = useAsyncOperation({
    context: 'DRILL_SUBMIT',
    onSuccess: () => {
      showSuccess("Drill result submitted!");
      // Invalidate cache to ensure live standings update immediately
      if (selectedEvent?.id) {
        cacheInvalidation.playersUpdated(selectedEvent.id);
      }
      setType("");
      setValue("");
      if (onSuccess) onSuccess();
    },
    onError: (err, userMessage) => {
      showError(userMessage);
    }
  });

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!type) {
      showError("Please select a drill type.");
      return;
    }
    if (!value) {
      showError("Please enter a value.");
      return;
    }
    if (!selectedEvent) {
      showError("No event selected. Please select an event first.");
      return;
    }

    // Validate drill value using standardized validator
    const drillError = customValidators.drillValue(value, type);
    if (drillError) {
      showError(drillError);
      return;
    }

    await executeSubmit(async () => {
      return await api.post(`/drill-results/`, {
        player_id: playerId,
        type,
        value: parseFloat(value),
        event_id: selectedEvent.id
      });
    });
  }, [type, value, selectedEvent, playerId, executeSubmit, showError]);

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md mx-auto mb-6">
      <h2 className="text-xl font-bold mb-4 text-brand-primary">Submit Drill Result</h2>
      <div className="mb-4">
        <label className="block mb-1 font-semibold">Drill Type</label>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="w-full border-brand-secondary rounded px-3 py-2 focus:ring-brand-primary focus:border-brand-primary"
          required
        >
          <option value="">Select a drill</option>
          {DRILL_TYPES.map(dt => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label className="block mb-1 font-semibold">Value</label>
        <input
          type="number"
          step="any"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-full border-brand-secondary rounded px-3 py-2 focus:ring-brand-primary focus:border-brand-primary"
          required
        />
      </div>
      <ErrorDisplay error={error} className="mb-2" />
      <button
        type="submit"
        className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 rounded-lg shadow transition"
        disabled={loading}
      >
        {loading ? "Submitting..." : "Submit Result"}
      </button>
    </form>
  );
});

export default DrillInputForm; 