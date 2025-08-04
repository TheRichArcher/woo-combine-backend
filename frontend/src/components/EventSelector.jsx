import React, { useState, useCallback, useEffect } from "react";
import { useEvent } from "../context/EventContext";
import api from '../lib/api';
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { logger } from '../utils/logger';
import { ChevronDown, Calendar, MapPin, Users, Trophy, CheckCircle, Clock } from 'lucide-react';

const EventSelector = React.memo(function EventSelector({ onEventSelected }) {
  const { events, selectedEvent, setSelectedEvent, setEvents, loading, error, refreshEvents } = useEvent();
  const { selectedLeagueId, user: _user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  
  // Auto-show modal when no events exist (streamlined UX)
  useEffect(() => {
    if (!loading && events.length === 0 && selectedLeagueId && !showModal) {
      setShowModal(true);
    }
  }, [loading, events.length, selectedLeagueId, showModal]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [playerCount, setPlayerCount] = useState(0);

  const handleSelect = useCallback((e) => {
    if (!Array.isArray(events)) return;
    const ev = events.find(ev => ev.id === e.target.value);
    if (ev) {
      setSelectedEvent(ev);
      if (onEventSelected) onEventSelected(ev);
    }
  }, [events, setSelectedEvent, onEventSelected]);

  // Fetch player count for selected event
  const fetchPlayerCount = useCallback(async (eventId) => {
    if (!eventId) {
      setPlayerCount(0);
      return;
    }
    try {
      const response = await api.get(`/players?event_id=${eventId}`);
      setPlayerCount(response.data?.length || 0);
    } catch (error) {
      logger.error('Failed to fetch player count', error);
      setPlayerCount(0);
    }
  }, []);

  // Fetch player count when selected event changes
  useEffect(() => {
    if (selectedEvent?.id) {
      fetchPlayerCount(selectedEvent.id);
    } else {
      setPlayerCount(0);
    }
  }, [selectedEvent?.id, fetchPlayerCount]);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    
    // GUIDED SETUP FIX: Don't attempt to create event with empty league ID
    if (!selectedLeagueId || 
        selectedLeagueId === '' || 
        selectedLeagueId === null || 
        selectedLeagueId === undefined || 
        selectedLeagueId.trim() === '') {
      logger.error('EVENT-SELECTOR', 'Cannot create event - no selectedLeagueId available');
      setCreateError('Cannot create event: No league selected. Please select a league first.');
      setCreateLoading(false);
      return;
    }
    
    try {
      const isoDate = date ? new Date(date).toISOString().slice(0, 10) : "";
      logger.info('EVENT-SELECTOR', `Creating event in league: ${selectedLeagueId}`);
      
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
  }, [selectedLeagueId, name, date, location, setEvents, setSelectedEvent, onEventSelected]);

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
        <div className="text-center bg-red-50 rounded-lg border border-red-200 p-4">
          <div className="mb-2 text-red-600 font-medium">⚠️ Failed to load events</div>
          <div className="text-sm text-red-500 mb-4">{error}</div>
          
          <div className="space-y-2">
            <button
              onClick={refreshEvents}
              className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              🔄 Try Again
            </button>
            
            <div className="flex gap-2">
              <Link
                to="/dashboard"
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition text-sm font-medium text-center"
              >
                Dashboard
              </Link>
              <Link
                to="/select-league"
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition text-sm font-medium text-center"
              >
                Switch League
              </Link>
            </div>
          </div>
          
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            <strong>Tip:</strong> If this persists, try switching to a different league or contact support.
          </div>
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
      
      {/* Conditional rendering based on whether events exist */}
      {events.length === 0 ? (
        // No events available - simplified message (modal auto-shows)
        <div className="text-center">
          <div className="text-gray-500 text-sm py-2 mb-4">
            Setting up your first event...
          </div>
          <button
            onClick={() => setShowModal(true)}
            disabled={!selectedLeagueId || selectedLeagueId.trim() === ''}
            className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Event
          </button>
        </div>
      ) : (
        // Events available - show enhanced dropdown with preview
        <div className="space-y-4">
          {/* Dropdown + Create Button Row */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <select
                value={selectedEvent?.id || ""}
                onChange={handleSelect}
                className="w-full p-3 pr-10 border-2 rounded-lg appearance-none bg-white text-left cursor-pointer transition-all duration-200 border-gray-300 hover:border-gray-400 focus:border-cmf-primary focus:ring-2 focus:ring-cmf-primary/20"
                data-event-selector-dropdown
              >
                <option value="">Select an event...</option>
                {events.map(ev => {
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
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => setShowModal(true)}
              disabled={!selectedLeagueId || selectedLeagueId.trim() === ''}
              className="bg-cmf-primary text-white font-bold px-4 py-3 rounded-lg shadow hover:bg-cmf-secondary transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Create New Event
            </button>
          </div>

          {/* Event Preview Card */}
          {selectedEvent && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="w-6 h-6 text-blue-600" />
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-blue-900">{selectedEvent.name}</h4>
                  <p className="text-sm text-blue-700">Selected Event</p>
                </div>
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>

              {/* Event Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {/* Date */}
                <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Date</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    {selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) 
                      ? new Date(selectedEvent.date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                      : 'Date not set'
                    }
                  </div>
                </div>

                {/* Player Count */}
                <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Players</span>
                  </div>
                  <div className="text-lg font-bold text-blue-800">{playerCount}</div>
                  <div className="text-xs text-blue-600">registered</div>
                </div>
              </div>

              {/* Location & Template */}
              {(selectedEvent.location || selectedEvent.drillTemplate) && (
                <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                  <div className="space-y-2">
                    {selectedEvent.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-800">{selectedEvent.location}</span>
                      </div>
                    )}
                    {selectedEvent.drillTemplate && (
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-800">
                          {selectedEvent.drillTemplate.charAt(0).toUpperCase() + selectedEvent.drillTemplate.slice(1)} Template
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">
              {events.length === 0 ? "Create Your First Event" : "Create New Event"}
            </h3>
            {events.length === 0 && (
              <p className="text-gray-600 text-sm mb-4">
                Set up your combine event with a name, date, and location.
              </p>
            )}
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
});

export default EventSelector; 