import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import api from '../lib/api';
import { withCache, cacheInvalidation } from '../utils/dataCache';
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
  
  // CRITICAL FIX: Track whether initial events fetch has completed
  // This prevents showing "create first event" modal before fetch finishes
  const [eventsLoaded, setEventsLoaded] = useState(false);

  // STRICT VALIDATION: Check for stale event on every render or context update
  // If we have a selectedLeagueId and a selectedEvent, they MUST match.
  // This derived check prevents "render flashes" of stale data before effects run.
  useEffect(() => {
    if (selectedLeagueId && selectedEvent && selectedEvent.league_id && selectedEvent.league_id !== selectedLeagueId) {
        logger.warn('EVENT-CONTEXT', `Mismatch detected: Event ${selectedEvent.id} (League ${selectedEvent.league_id}) != Active League ${selectedLeagueId}. Clearing.`);
        localStorage.removeItem('selectedEvent');
        setSelectedEvent(null);
    }
  }, [selectedLeagueId, selectedEvent]);

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
  const loadEvents = useCallback(async (leagueId, options = {}) => {
    if (!leagueId) {
      setEvents([]);
      setSelectedEvent(null);
      localStorage.removeItem('selectedEvent');
      setNoLeague(true);
      setEventsLoaded(true); // Mark as loaded even with no league
      return;
    }

    setLoading(true);
    setError(null);
    setNoLeague(false);

    try {
      const eventsData = await cachedFetchEvents(leagueId);
      
      // CRITICAL: Defensive filter - never show soft-deleted events
      // This provides defense-in-depth even if backend or cache has stale data
      const activeEvents = eventsData.filter(event => !event.deleted_at && !event.deletedAt);
      setEvents(activeEvents);
      
      // If refreshing and we have a selected event, update it with fresh data
      if (options.syncSelectedEvent) {
        setSelectedEvent(current => {
          if (!current?.id) return current;
          const refreshedEvent = activeEvents.find(e => e.id === current.id);
          if (refreshedEvent) {
            localStorage.setItem('selectedEvent', JSON.stringify(refreshedEvent));
            logger.info('EVENT-CONTEXT', `Synced selectedEvent after refresh: ${current.id}`);
            return refreshedEvent;
          }
          return current;
        });
      } else {
        // Auto-select first event if available and none is currently selected
        // Check current selectedEvent state instead of using it as dependency
        setSelectedEvent(current => {
          if (!current && activeEvents.length > 0) {
            const firstEvent = activeEvents[0];
            // Persist the auto-selected event
            localStorage.setItem('selectedEvent', JSON.stringify(firstEvent));
            return firstEvent;
          }
          return current;
        });
      }
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
      setEventsLoaded(true); // CRITICAL: Mark as loaded regardless of success/failure
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
          console.log(`[EventContext] Clearing stale event ${current.id} (league ${current.league_id} != ${selectedLeagueId})`);
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
      setEventsLoaded(true); // CRITICAL: Mark loaded even with no league to unblock RouteDecisionGate
    }
  }, [selectedLeagueId, authChecked, roleChecked, loadEvents]);

  // Refresh function
  const refreshEvents = useCallback(async () => {
    if (!selectedLeagueId) return;
    
    // CRITICAL: Invalidate events cache before refreshing
    // This ensures we get fresh data from backend, not stale cached data
    cacheInvalidation.eventsUpdated(selectedLeagueId);
    logger.info('EVENT-CONTEXT', `Invalidated events cache for league ${selectedLeagueId}`);
    
    // Pass syncSelectedEvent flag to update the currently selected event with fresh data
    await loadEvents(selectedLeagueId, { syncSelectedEvent: true });
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

  // Delete event function (soft delete)
  const deleteEvent = useCallback(async (eventId, options = {}) => {
    if (!selectedLeagueId) {
      throw new Error('No league selected');
    }

    try {
      // CRITICAL SERVER-SIDE VALIDATION: Include X-Delete-Target-Event-Id header
      // Backend will validate that route event_id matches declared target to prevent UI drift
      const headers = {
        'X-Delete-Target-Event-Id': eventId,
        ...options.headers
      };
      
      const response = await api.delete(`/leagues/${selectedLeagueId}/events/${eventId}`, { headers });
      
      // CRITICAL: Immediately remove from events list - DO NOT wait for refetch
      // This prevents deleted events from appearing in any UI while refetch is pending
      setEvents(prevEvents => {
        const filtered = prevEvents.filter(event => event.id !== eventId);
        logger.info(`EVENT_DELETED_FROM_CONTEXT`, {
          deleted_event_id: eventId,
          remaining_events: filtered.length,
          removed_immediately: true,
          server_validation_header: headers['X-Delete-Target-Event-Id']
        });
        return filtered;
      });
      
      // CRITICAL: Force context reset - clear selectedEvent ALWAYS
      // This prevents any references to deleted event in active context
      setSelectedEvent(null);
      localStorage.removeItem('selectedEvent');
      
      logger.info(`Event ${eventId} soft-deleted successfully and removed from context`);
      return response.data;
    } catch (error) {
      logger.error('Failed to delete event:', error);
      throw error;
    }
  }, [selectedLeagueId]);

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
    eventsLoaded, // CRITICAL: Expose to components to gate onboarding
    error,
    refreshEvents,
    updateEvent,
    deleteEvent
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