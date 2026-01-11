import React, { useState, useCallback, useEffect } from "react";
import { useEvent } from "../context/EventContext";
import api from '../lib/api';
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { logger } from '../utils/logger';
import { formatEventDate, formatEventDateLong } from '../utils/dateUtils';
import { ChevronDown, Calendar, MapPin, Users, Trophy, CheckCircle, Clock } from 'lucide-react';
import EventFormModal from "./EventFormModal";

const EventSelector = React.memo(function EventSelector({ onEventSelected }) {
  const { events, selectedEvent, setSelectedEvent, setEvents, loading, eventsLoaded, error, refreshEvents } = useEvent();
  const { selectedLeagueId, user: _user, setSelectedLeagueId } = useAuth();
  const [showModal, setShowModal] = useState(false);
  
  // CRITICAL FIX: Only auto-show modal when events fetch has completed AND no events exist
  // This prevents the modal from showing during login before events are fetched
  useEffect(() => {
    if (eventsLoaded && !loading && Array.isArray(events) && events.length === 0 && selectedLeagueId && selectedLeagueId.trim() !== '' && !showModal) {
      setShowModal(true);
    }
  }, [eventsLoaded, loading, events, selectedLeagueId, showModal]);
  
  // Missing state variables restoration
  const [playerCount, setPlayerCount] = useState(0);
  const [creatingLeague, setCreatingLeague] = useState(false);
  const [createError, setCreateError] = useState(null);

  const handleSelect = useCallback((e) => {
    if (!Array.isArray(events)) return;
    // CRITICAL: Defensive filter - never allow selection of soft-deleted events
    const ev = events.find(ev => ev.id === e.target.value && !ev.deleted_at && !ev.deletedAt);
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

  // Helper: ensure we have a league before opening the create-event modal
  const ensureLeagueThenOpenModal = useCallback(async () => {
    // If league already selected, just open the modal
    if (selectedLeagueId && selectedLeagueId.trim() !== '') {
      setShowModal(true);
      return;
    }

    // Otherwise create a lightweight default league and proceed
    try {
      setCreatingLeague(true);
      const defaultName = 'My First League';
      const res = await api.post('/leagues', { name: defaultName });
      const newLeagueId = res?.data?.league_id;
      if (newLeagueId) {
        setSelectedLeagueId(newLeagueId);
        setShowModal(true);
      }
    } catch (err) {
      setCreateError(err.response?.data?.detail || err.message || 'Failed to prepare league for event creation');
    } finally {
      setCreatingLeague(false);
    }
  }, [selectedLeagueId, setSelectedLeagueId]);

  // Handle successful event creation from EventFormModal
  const handleEventCreated = useCallback((newEvent) => {
    setShowModal(false);
    setSelectedEvent(newEvent);
    if (onEventSelected) onEventSelected(newEvent);
  }, [setSelectedEvent, onEventSelected]);

  // Deprecated create-league pathway removed from UI. Using ensureLeagueThenOpenModal instead.

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
      {Array.isArray(events) && events.length === 0 ? (
        // No events available - simplified message (modal auto-shows)
        <div className="text-center">
          <div className="text-gray-500 text-sm py-2 mb-4">
            Setting up your first event...
          </div>
          <button
            onClick={ensureLeagueThenOpenModal}
            className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition disabled:opacity-50"
            disabled={creatingLeague}
          >
            {creatingLeague ? 'Preparing…' : 'Create Event'}
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
                {/* CRITICAL: Defensive filter - never render soft-deleted events */}
                {events.filter(ev => !ev.deleted_at && !ev.deletedAt).map(ev => {
                  const dateLabel = formatEventDate(ev.date);
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
              onClick={ensureLeagueThenOpenModal}
              disabled={creatingLeague}
              className="bg-cmf-primary text-white font-bold px-4 py-3 rounded-lg shadow hover:bg-cmf-secondary transition disabled:opacity-50 whitespace-nowrap"
            >
              {creatingLeague ? 'Preparing…' : 'Create New Event'}
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
                    {formatEventDateLong(selectedEvent.date)}
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

      {/* Create Event Modal - CANONICAL COMPONENT */}
      <EventFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        mode="create"
        onSuccess={handleEventCreated}
      />
    </div>
  );
});

export default EventSelector; 