import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { useToast } from "../context/ToastContext";
import api from '../lib/api';
import { getAllTemplates } from '../constants/drillTemplates';
import { cacheInvalidation } from '../utils/dataCache';

const getSportIcon = (sport) => {
  switch(sport) {
    case 'Football': return '🏈';
    case 'Soccer': return '⚽';
    case 'Basketball': return '🏀';
    case 'Baseball': return '⚾';
    case 'Track & Field': return '🏃';
    case 'Volleyball': return '🏐';
    default: return '🏆';
  }
};

/**
 * EventFormModal - CANONICAL EVENT CREATE/EDIT COMPONENT
 * 
 * Single source of truth for all event creation and editing flows.
 * 
 * CRITICAL PATTERN: Component remounts on event change via key prop
 * This eliminates useEffect race conditions and ensures clean state
 * 
 * @param {boolean} open - Whether modal is visible
 * @param {function} onClose - Callback to close modal
 * @param {string} mode - "create" | "edit"
 * @param {object} event - Event object to edit (required if mode="edit")
 * @param {function} onSuccess - Callback after successful create/edit
 */
export default function EventFormModal({ open, onClose, mode = "create", event = null, onSuccess }) {
  const { selectedLeagueId } = useAuth();
  const { setSelectedEvent, setEvents } = useEvent();
  const { showSuccess, showError } = useToast();
  
  const templates = getAllTemplates();
  
  // Initialize form state directly from props (no useEffect needed)
  const initialDate = (mode === "edit" && event?.date) ? event.date.slice(0, 10) : "";
  
  // Form state
  const [name, setName] = useState(mode === "edit" && event ? event.name || "" : "");
  const [date, setDate] = useState(initialDate);
  const [location, setLocation] = useState(mode === "edit" && event ? event.location || "" : "");
  const [notes, setNotes] = useState(mode === "edit" && event ? event.notes || "" : "");
  const [drillTemplate, setDrillTemplate] = useState(mode === "edit" && event ? event.drillTemplate || "football" : templates[0]?.id || "football");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // DEBUG: Log date state changes (remove after fixing)
  useEffect(() => {
    console.log('[EventFormModal] Date state changed:', date);
    console.log('[EventFormModal] Current mode:', mode, 'Event ID:', event?.id);
  }, [date, mode, event?.id]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      // CRITICAL: date is already in YYYY-MM-DD format from <input type="date">
      // Don't convert to Date object (causes timezone shifts), just use as-is
      const isoDate = date || null;
      const payload = {
        name,
        date: isoDate,
        location,
        notes,
        drillTemplate
      };

      if (mode === "create") {
        // CREATE MODE
        const response = await api.post(`/leagues/${selectedLeagueId}/events`, payload);
        
        const newEvent = response.data.event || {
          id: response.data.event_id,
          name: name,
          date: isoDate,
          location: location,
          notes: notes,
          league_id: selectedLeagueId,
          drillTemplate: drillTemplate,
          created_at: new Date().toISOString()
        };
        
        // Update events list
        setEvents(prev => [...prev, newEvent]);
        
        // Invalidate cache
        if (selectedLeagueId) {
          cacheInvalidation.eventsUpdated(selectedLeagueId);
        }
        
        showSuccess(`✅ Event "${name}" created successfully!`);
        
        if (onSuccess) onSuccess(newEvent);
        if (onClose) onClose();
      } else {
        // EDIT MODE
        await api.put(`/leagues/${selectedLeagueId}/events/${event.id}`, payload);
        
        const updatedEvent = {
          ...event,
          name,
          date: isoDate,
          location,
          notes,
          drillTemplate,
          updated_at: new Date().toISOString()
        };
        
        // Update events list
        setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
        
        // Update selected event if it's the one being edited
        // CRITICAL: Also update localStorage to prevent staleness on page refresh
        setSelectedEvent(prev => {
          if (prev && prev.id === event.id) {
            localStorage.setItem('selectedEvent', JSON.stringify(updatedEvent));
            return updatedEvent;
          }
          return prev;
        });
        
        // Invalidate cache
        if (selectedLeagueId) {
          cacheInvalidation.eventsUpdated(selectedLeagueId);
        }
        
        showSuccess(`✅ Event "${name}" updated successfully!`);
        
        if (onSuccess) onSuccess(updatedEvent);
        if (onClose) onClose();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || `Failed to ${mode} event`;
      setError(errorMsg);
      showError(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center wc-overlay z-50">
      <div className="wc-card p-6 w-full max-w-sm relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-brand-primary text-2xl font-bold"
          aria-label="Close"
        >
          ×
        </button>
        
        {/* Title */}
        <h2 className="text-xl font-bold mb-4 text-gray-900">
          {mode === "create" ? "Create New Event" : "Edit Event"}
        </h2>
        
        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Event Name */}
          <label className="block mb-2 font-semibold">Event Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            required
          />
          
          {/* Sport Template */}
          <label className="block mb-2 font-semibold">Sport Template</label>
          <select
            value={drillTemplate}
            onChange={e => setDrillTemplate(e.target.value)}
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            required
          >
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {getSportIcon(template.sport)} {template.name}
              </option>
            ))}
          </select>

          {/* Event Date */}
          <label className="block mb-2 font-semibold">Event Date</label>
          <input
            type="date"
            value={date}
            onChange={e => {
              console.log('[EventFormModal] Date onChange fired. New value:', e.target.value);
              setDate(e.target.value);
            }}
            onInput={e => {
              console.log('[EventFormModal] Date onInput fired. New value:', e.target.value);
            }}
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            required
          />
          
          {/* Location */}
          <label className="block mb-2 font-semibold">Location</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g., Event Location"
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />

          {/* Notes (Optional) */}
          <label className="block mb-2 font-semibold">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes about this event..."
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary h-24 resize-none"
          />

          <small className="text-gray-500 text-xs mb-4 block">
            Leave location/notes blank if not determined yet
          </small>

          {/* Error Display */}
          {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-brand-primary text-white font-medium px-4 py-2 rounded-lg shadow hover:opacity-90 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading 
                ? (mode === "create" ? "Creating..." : "Saving...") 
                : (mode === "create" ? "Create Event" : "Save Changes")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

