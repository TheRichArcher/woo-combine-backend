console.log('Loading EventContext.jsx - START');

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import api from '../lib/api';
import { withCache } from '../utils/dataCache';
import { logger } from '../utils/logger';

const EventContext = createContext();

export function EventProvider({ children }) {
  const { selectedLeagueId, authChecked, roleChecked } = useAuth();
  const [events, setEvents] = useState([]);
  
  // Initialize selectedEvent from localStorage if available
  const [selectedEvent, setSelectedEvent] = useState(() => {
    try {
      const stored = localStorage.getItem('selectedEvent');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  
  const [noLeague, setNoLeague] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cached events fetcher: TTL 120s per requirements
  const cachedFetchEvents = useCallback(
    withCache(
      async (leagueId) => {
        // Quick retries for cold starts
        const attempt = async () => (await api.get(`/leagues/${leagueId}/events`)).data?.events || [];
        try {
          return await attempt();
        } catch (e1) {
          await new Promise(r => setTimeout(r, 800));
          try { return await attempt(); } catch (e2) {
            await new Promise(r => setTimeout(r, 1500));
            return await attempt();
          }
        }
      },
      'events',
      120 * 1000
    ),
    []
  );

  // Load events when league is selected
  const loadEvents = useCallback(async (leagueId) => {
    if (!leagueId) {
      setEvents([]);
      setSelectedEvent(null);
      localStorage.removeItem('selectedEvent');
      setNoLeague(true);
      return;
    }

    setLoading(true);
    setError(null);
    setNoLeague(false);

    try {
      const eventsData = await cachedFetchEvents(leagueId);
      setEvents(eventsData);
      
      // Auto-select first event if available and none is currently selected
      // Check current selectedEvent state instead of using it as dependency
      setSelectedEvent(current => {
        if (!current && eventsData.length > 0) {
          const firstEvent = eventsData[0];
          // Persist the auto-selected event
          localStorage.setItem('selectedEvent', JSON.stringify(firstEvent));
          return firstEvent;
        }
        return current;
      });
    } catch (err) {
      logger.error('EVENT-CONTEXT', 'Failed to load events', err);
      
      // Provide user-friendly error messages based on error type
      let errorMessage = 'Failed to load events';
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Server is starting up. Please wait a moment and try again.';
      } else if (err.message?.includes('Network Error')) {
        errorMessage = 'Network connection issue. Please check your internet connection.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server is temporarily unavailable. Please try again in a moment.';
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      }
      
      setError(errorMessage);
      setEvents([]);
      setSelectedEvent(null);
      localStorage.removeItem('selectedEvent');
    } finally {
      setLoading(false);
    }
  }, []); // FIXED: Removed selectedEvent from dependencies to prevent circular dependency

  // Load events when league changes, restoring previous selection if still valid
  useEffect(() => {
    // Only load events after auth is complete
    if (!authChecked || !roleChecked) return;
    try {
      const path = window.location?.pathname || '';
      // Skip event fetching on onboarding routes to avoid 401 spam on login
      if (['/login', '/signup', '/verify-email', '/welcome', '/'].includes(path)) {
        return;
      }
    } catch {}
    
    if (selectedLeagueId) {
      // Guard against stale selections from another league
      setSelectedEvent(current => {
        if (current && current.league_id && current.league_id !== selectedLeagueId) {
          localStorage.removeItem('selectedEvent');
          return null;
        }
        return current;
      });

      // Capture previously selectedEvent id only if it belongs to this league
      let previouslySelectedId = null;
      try {
        const stored = localStorage.getItem('selectedEvent');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.league_id && parsed.league_id === selectedLeagueId) {
            previouslySelectedId = parsed?.id || null;
          } else if (parsed?.league_id && parsed.league_id !== selectedLeagueId) {
            localStorage.removeItem('selectedEvent');
          }
        }
      } catch {
        localStorage.removeItem('selectedEvent');
      }

      (async () => {
        await loadEvents(selectedLeagueId);
        if (previouslySelectedId) {
          // After events load, if the prior event is still in the list, reselect it
          setSelectedEvent(current => {
            if (current && current.id === previouslySelectedId) return current;
            const found = events.find(e => e.id === previouslySelectedId);
            if (found) {
              localStorage.setItem('selectedEvent', JSON.stringify(found));
              return found;
            }
            return current;
          });
        }
      })();
    } else {
      setEvents([]);
      setSelectedEvent(null);
      localStorage.removeItem('selectedEvent');
      setNoLeague(true);
    }
  }, [selectedLeagueId, authChecked, roleChecked, loadEvents]);

  // Refresh function
  const refreshEvents = useCallback(async () => {
    if (selectedLeagueId) {
      await loadEvents(selectedLeagueId);
    }
  }, [selectedLeagueId, loadEvents]);

  // Update event function
  const updateEvent = useCallback(async (eventId, updatedData) => {
    if (!selectedLeagueId) {
      throw new Error('No league selected');
    }

    try {
      const response = await api.put(`/leagues/${selectedLeagueId}/events/${eventId}`, updatedData);
      
      // Update the selectedEvent if it's the one being updated
      if (selectedEvent && selectedEvent.id === eventId) {
        const updatedEvent = { ...selectedEvent, ...updatedData };
        setSelectedEvent(updatedEvent);
      }
      
      // Update the events list
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === eventId ? { ...event, ...updatedData } : event
        )
      );
      
      return response.data;
    } catch (error) {
      logger.error('Failed to update event:', error);
      throw error;
    }
  }, [selectedLeagueId, selectedEvent]);

  // Wrapper to persist selectedEvent to localStorage
  const setSelectedEventWithPersistence = useCallback((event) => {
    setSelectedEvent(event);
    if (event) {
      localStorage.setItem('selectedEvent', JSON.stringify(event));
    } else {
      localStorage.removeItem('selectedEvent');
    }
  }, []);

  const contextValue = {
    events,
    selectedEvent,
    setSelectedEvent: setSelectedEventWithPersistence,
    setEvents,
    noLeague,
    loading,
    error,
    refreshEvents,
    updateEvent
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