import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import api from '../lib/api';
import { logger } from '../utils/logger';

const EventContext = createContext();

export function EventProvider({ children }) {
  const { selectedLeagueId, authChecked, roleChecked } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [noLeague, setNoLeague] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load events when league is selected
  const loadEvents = useCallback(async (leagueId) => {
    if (!leagueId) {
      setEvents([]);
      setSelectedEvent(null);
      setNoLeague(true);
      return;
    }

    setLoading(true);
    setError(null);
    setNoLeague(false);

    try {
      const response = await api.get(`/leagues/${leagueId}/events`);
      const eventsData = response.data.events || [];  // ✅ Extract events array from response
      setEvents(eventsData);
      
      // Auto-select first event if available and none is currently selected
      // Check current selectedEvent state instead of using it as dependency
      setSelectedEvent(current => {
        if (!current && eventsData.length > 0) {
          return eventsData[0];
        }
        return current;
      });
    } catch (err) {
      logger.error('EVENT-CONTEXT', 'Failed to load events', err);
      setError(err.response?.data?.detail || 'Failed to load events');
      setEvents([]);
      setSelectedEvent(null);
    } finally {
      setLoading(false);
    }
  }, []); // FIXED: Removed selectedEvent from dependencies to prevent circular dependency

  // Load events when league changes
  useEffect(() => {
    // Only load events after auth is complete
    if (!authChecked || !roleChecked) return;
    
    if (selectedLeagueId) {
      loadEvents(selectedLeagueId);
    } else {
      setEvents([]);
      setSelectedEvent(null);
      setNoLeague(true);
    }
  }, [selectedLeagueId, authChecked, roleChecked, loadEvents]);

  // Refresh function
  const refreshEvents = useCallback(async () => {
    if (selectedLeagueId) {
      await loadEvents(selectedLeagueId);
    }
  }, [selectedLeagueId, loadEvents]);

  const contextValue = {
    events,
    selectedEvent,
    setSelectedEvent,
    setEvents,
    noLeague,
    loading,
    error,
    refreshEvents
  };

  return (
    <EventContext.Provider value={contextValue}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvent must be used within an EventProvider");
  }
  return context;
} 