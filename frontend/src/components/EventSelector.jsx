import React, { useState } from "react";
import { useEvent } from "../context/EventContext";
import api from '../lib/api';
import { useAuth } from "../context/AuthContext";

export default function EventSelector({ onEventSelected }) {
  const { events, selectedEvent, setSelectedEvent, setEvents, loading, error, refreshEvents } = useEvent();
  const { selectedLeagueId, user: _user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleSelect = (e) => {
    if (!Array.isArray(events)) return;
    const ev = events.find(ev => ev.id === e.target.value);
    if (ev) {
      setSelectedEvent(ev);
      if (onEventSelected) onEventSelected(ev);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    
    // GUIDED SETUP FIX: Don't attempt to create event with empty league ID
    if (!selectedLeagueId || 
        selectedLeagueId === '' || 
        selectedLeagueId === null || 
        selectedLeagueId === undefined || 
        selectedLeagueId.trim() === '') {
      console.error('[EVENT-SELECTOR] Cannot create event - no selectedLeagueId available');
      setCreateError('Cannot create event: No league selected. Please select a league first.');
      setCreateLoading(false);
      return;
    }
    
    try {
      const isoDate = date ? new Date(date).toISOString().slice(0, 10) : "";
      console.info(`[EVENT-SELECTOR] Creating event in league: ${selectedLeagueId}`);
      
      const response = await api.post(`/leagues/${selectedLeagueId}/events`, {
        name,
        date: isoDate,
        location
      });
      
      // Fix: Backend returns {event_id: ...}, so we need to create the full event object
      const newEvent = {
        id: response.data.event_id,
        name: name,
        date: isoDate,
        created_at: new Date().toISOString()
      };
      
      setEvents(prev => [newEvent, ...prev]);
      setSelectedEvent(newEvent);
      setShowModal(false);
      setName("");
      setDate("");
      setLocation("");
      if (onEventSelected) onEventSelected(newEvent);
    } catch (err) {
      setCreateError(err.response?.data?.detail || err.message || 'Failed to create event');
    } finally {
      setCreateLoading(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col gap-2 mb-6">
        <div className="text-center text-gray-500 py-4">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-cmf-primary rounded-full"></div>
          <div className="mt-2">Loading events...</div>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (error) {
    return (
      <div className="flex flex-col gap-2 mb-6">
        <div className="text-center text-red-500 py-4 bg-red-50 rounded-lg border border-red-200">
          <div className="mb-2">⚠️ Failed to load events</div>
          <div className="text-sm text-red-400 mb-3">{error}</div>
          <button
            onClick={refreshEvents}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mb-6" data-event-selector>
      {/* GUIDED SETUP WARNING: Show when no league is selected */}
      {(!selectedLeagueId || selectedLeagueId.trim() === '') && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-yellow-600 text-sm">⚠️</span>
            </div>
            <div>
              <p className="text-yellow-800 font-medium text-sm mb-1">No League Context</p>
              <p className="text-yellow-700 text-sm">
                Event creation is not available without a league context. Please create or select a league first.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {events.length === 0 && (
        <div className="text-center text-cmf-secondary text-lg font-semibold py-2">No events found. Please create a new event.</div>
      )}
      <div className="flex items-center gap-4">
        <select
          value={selectedEvent?.id || ""}
          onChange={handleSelect}
          className="border-cmf-secondary rounded px-3 py-2 focus:ring-cmf-primary focus:border-cmf-primary"
          disabled={!Array.isArray(events) || events.length === 0}
          data-event-selector-dropdown
        >
          <option value="">Select an event...</option>
          {Array.isArray(events) && events.map(ev => {
            let dateLabel = "Invalid Date";
            if (ev.date && !isNaN(Date.parse(ev.date))) {
              dateLabel = new Date(ev.date).toLocaleDateString();
            }
            return (
              <option key={ev.id} value={ev.id}>
                {ev.name} – {dateLabel}
              </option>
            );
          })}
        </select>
        <button
          onClick={() => setShowModal(true)}
          disabled={!selectedLeagueId || selectedLeagueId.trim() === ''}
          className="bg-cmf-primary text-white font-bold px-4 py-2 rounded-lg shadow hover:bg-cmf-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create New Event
        </button>
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Create New Event</h3>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Event Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded px-3 py-2 focus:ring-cmf-primary focus:border-cmf-primary"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Event Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border rounded px-3 py-2 focus:ring-cmf-primary focus:border-cmf-primary"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Central Park Football Field"
                  className="w-full border rounded px-3 py-2 focus:ring-cmf-primary focus:border-cmf-primary"
                />
              </div>
              {createError && <div className="text-red-500 text-sm mb-4">{createError}</div>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="bg-cmf-primary text-white px-4 py-2 rounded hover:bg-cmf-secondary transition disabled:opacity-50"
                >
                  {createLoading ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 