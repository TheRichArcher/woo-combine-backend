import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { auth } from '../firebase';
import api from '../lib/api';
import { withCache, cacheInvalidation } from '../utils/dataCache';
import { logger } from '../utils/logger';
import { getViewerInviteEventLock } from '../lib/viewerInviteContext';

const EventContext = createContext();

const isQrDebugEnabled = () => {
  try {
    return localStorage.getItem('debug_qr_flow') === '1';
  } catch {
    return false;
  }
};

const qrEventDebug = (message, payload) => {
  if (!isQrDebugEnabled()) return;
  console.log(`[QR_FLOW][EventContext] ${message}`, payload);
};

const writeLastContextClear = (reason, payload = {}) => {
  const snapshot = {
    reason,
    ...payload,
    timestamp: new Date().toISOString()
  };
  qrEventDebug('Context clear snapshot', snapshot);
  try {
    localStorage.setItem('debug_qr_last_context_clear', JSON.stringify(snapshot));
  } catch {
    // best-effort debug write
  }
};

export function EventProvider({ children }) {
  const { selectedLeagueId, authChecked, roleChecked, userRole } = useAuth();
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
  const prevNoLeagueRef = useRef(noLeague);

  // Safety timeout ref — ensures eventsLoaded is never stuck false forever
  const eventsLoadedTimeoutRef = useRef(null);

  // STRICT VALIDATION: Check for stale event on every render or context update
  useEffect(() => {
    if (selectedLeagueId && selectedEvent && selectedEvent.league_id && selectedEvent.league_id !== selectedLeagueId) {
        logger.warn('EVENT-CONTEXT', `Mismatch detected: Event ${selectedEvent.id} (League ${selectedEvent.league_id}) != Active League ${selectedLeagueId}. Clearing.`);
        qrEventDebug('Clearing selectedEvent due to league mismatch', {
          selectedLeagueId,
          selectedEventId: selectedEvent?.id,
          selectedEventLeagueId: selectedEvent?.league_id
        });
        localStorage.removeItem('selectedEvent');
        setSelectedEvent(null);
    }
  }, [selectedLeagueId, selectedEvent]);

  useEffect(() => {
    qrEventDebug('State snapshot', {
      selectedLeagueId: selectedLeagueId || null,
      selectedEvent: selectedEvent ? { id: selectedEvent.id, name: selectedEvent.name } : null,
      eventsLength: events.length,
      noLeague
    });
  }, [selectedLeagueId, selectedEvent, events.length, noLeague]);

  useEffect(() => {
    if (prevNoLeagueRef.current !== noLeague) {
      qrEventDebug('noLeague transition', {
        from: prevNoLeagueRef.current,
        to: noLeague,
        selectedLeagueId: selectedLeagueId || null
      });
      prevNoLeagueRef.current = noLeague;
    }
  }, [noLeague, selectedLeagueId]);

  // Cached events fetcher: TTL 120s
  // NOTE: Does NOT retry on 401/403 — those require token refresh handled by loadEvents
  const cachedFetchEvents = useCallback(
    withCache(
      async (leagueId) => {
        const attempt = async () => (await api.get(`/leagues/${leagueId}/events`)).data?.events || [];
        try {
          return await attempt();
        } catch (e1) {
          // Do NOT retry auth errors — they need token refresh, not blind retry
          if (e1?.response?.status === 401 || e1?.response?.status === 403) {
            throw e1;
          }
          await new Promise(r => setTimeout(r, 800));
          try { return await attempt(); } catch (e2) {
            if (e2?.response?.status === 401 || e2?.response?.status === 403) {
              throw e2;
            }
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

  // Load events when league is selected.
  // On 401: forces Firebase token refresh and retries once before giving up.
  const loadEvents = useCallback(async (leagueId, options = {}) => {
    if (!leagueId) {
      qrEventDebug('Clearing events + selectedEvent: no leagueId in loadEvents', {
        leagueId
      });
      writeLastContextClear('loadEvents:no-leagueId', { selectedLeagueId: selectedLeagueId || null });
      setEvents([]);
      setSelectedEvent(null);
      localStorage.removeItem('selectedEvent');
      setNoLeague(true);
      setEventsLoaded(true);
      return;
    }

    setLoading(true);
    setError(null);
    setNoLeague(false);

    const fetchAndApply = async () => {
      const eventsData = await cachedFetchEvents(leagueId);
      const activeEvents = eventsData.filter(event => !event.deleted_at && !event.deletedAt);
      const viewerInviteLock = getViewerInviteEventLock();
      const shouldScopeToInviteEvent = Boolean(
        viewerInviteLock?.eventId &&
        (!viewerInviteLock.leagueId || viewerInviteLock.leagueId === leagueId)
      );
      const scopedEvents = shouldScopeToInviteEvent
        ? activeEvents.filter(event => event.id === viewerInviteLock.eventId)
        : activeEvents;
      setEvents(scopedEvents);
      
      if (options.syncSelectedEvent) {
        setSelectedEvent(current => {
          if (shouldScopeToInviteEvent) {
            const lockedEvent = scopedEvents.find(e => e.id === viewerInviteLock.eventId);
            if (lockedEvent) {
              localStorage.setItem('selectedEvent', JSON.stringify(lockedEvent));
              return lockedEvent;
            }
            if (current?.id === viewerInviteLock.eventId) return current;
            localStorage.removeItem('selectedEvent');
            return null;
          }

          if (!current?.id) return current;
          const refreshedEvent = scopedEvents.find(e => e.id === current.id);
          if (refreshedEvent) {
            localStorage.setItem('selectedEvent', JSON.stringify(refreshedEvent));
            logger.info('EVENT-CONTEXT', `Synced selectedEvent after refresh: ${current.id}`);
            return refreshedEvent;
          }
          return current;
        });
      } else {
        setSelectedEvent(current => {
          if (shouldScopeToInviteEvent) {
            const lockedEvent = scopedEvents.find(e => e.id === viewerInviteLock.eventId);
            if (lockedEvent) {
              localStorage.setItem('selectedEvent', JSON.stringify(lockedEvent));
              return lockedEvent;
            }
            if (current?.id === viewerInviteLock.eventId) return current;
            localStorage.removeItem('selectedEvent');
            return null;
          }

          if (!current && scopedEvents.length > 0) {
            const firstEvent = scopedEvents[0];
            localStorage.setItem('selectedEvent', JSON.stringify(firstEvent));
            return firstEvent;
          }
          return current;
        });
      }
    };

    let finalErr = null;
    try {
      await fetchAndApply();
    } catch (err) {
      // 401: force Firebase token refresh and retry once
      if (err?.response?.status === 401) {
        logger.warn('EVENT-CONTEXT', `Got 401 loading events for league ${leagueId} — forcing token refresh and retrying`);
        try {
          const firebaseUser = auth.currentUser;
          if (firebaseUser) {
            await firebaseUser.getIdToken(true); // force refresh
          }
          // Invalidate cache so we don't return stale pre-refresh data
          cacheInvalidation.eventsUpdated(leagueId);
          await fetchAndApply();
          // Success after refresh — return without setting error
          return;
        } catch (retryErr) {
          logger.error('EVENT-CONTEXT', 'Events fetch failed after token refresh', retryErr);
          finalErr = retryErr;
        }
      } else {
        finalErr = err;
      }

      logger.error('EVENT-CONTEXT', 'Failed to load events', finalErr);
      
      let errorMessage = 'Failed to load events';
      if (finalErr?.code === 'ECONNABORTED' || finalErr?.message?.includes('timeout')) {
        errorMessage = 'Server is starting up. Please wait a moment and try again.';
      } else if (finalErr?.message?.includes('Network Error')) {
        errorMessage = 'Network connection issue. Please check your internet connection.';
      } else if (finalErr?.response?.status >= 500) {
        errorMessage = 'Server is temporarily unavailable. Please try again in a moment.';
      } else if (finalErr?.response?.data?.detail) {
        errorMessage = finalErr.response.data.detail;
      }
      
      setError(errorMessage);
      qrEventDebug('Clearing events + selectedEvent: loadEvents failure branch', {
        leagueId,
        errorMessage,
        status: finalErr?.response?.status
      });
      writeLastContextClear('loadEvents:error', {
        leagueId,
        status: finalErr?.response?.status || null,
        errorMessage
      });
      setEvents([]);
      setSelectedEvent(null);
      localStorage.removeItem('selectedEvent');
    } finally {
      setLoading(false);
      setEventsLoaded(true); // CRITICAL: Mark as loaded regardless of success/failure
    }
  }, [cachedFetchEvents, selectedLeagueId, userRole]); // FIXED: No selectedEvent dep to prevent circular dependency

  // Load events when league changes, restoring previous selection if still valid
  useEffect(() => {
    // Only load events after auth is complete
    if (!authChecked || !roleChecked) return;

    // BUG FIX: Removed window.location.pathname path-check gate.
    // The old check caused eventsLoaded to never become true when:
    //   1. Effect fires on /welcome (early return — eventsLoaded never set)
    //   2. User navigates to /dashboard but selectedLeagueId doesn't change
    //   3. Effect never re-runs → eventsLoaded stuck false → infinite spinner
    // AuthContext already skips league fetching on /login etc., so by the time
    // roleChecked=true we are safe to proceed with event loading.
    
    if (selectedLeagueId) {
      // Guard against stale selections from another league
      setSelectedEvent(current => {
        if (current && current.league_id && current.league_id !== selectedLeagueId) {
          console.log(`[EventContext] Clearing stale event ${current.id} (league ${current.league_id} != ${selectedLeagueId})`);
          qrEventDebug('Clearing selectedEvent during league change guard', {
            selectedLeagueId,
            staleEventId: current?.id,
            staleEventLeagueId: current?.league_id
          });
          localStorage.removeItem('selectedEvent');
          return null;
        }
        return current;
      });

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
      qrEventDebug('Clearing events + selectedEvent: selectedLeagueId missing in effect', {
        selectedLeagueId: selectedLeagueId || null
      });
      writeLastContextClear('effect:missing-selectedLeagueId', {
        selectedLeagueId: selectedLeagueId || null
      });
      setEvents([]);
      setSelectedEvent(null);
      localStorage.removeItem('selectedEvent');
      setNoLeague(true);
      setEventsLoaded(true); // CRITICAL: Unblock RouteDecisionGate even with no league
    }
  }, [selectedLeagueId, authChecked, roleChecked, loadEvents]);

  // SAFETY NET: If eventsLoaded never becomes true within 35s after auth completes,
  // force it true so RouteDecisionGate doesn't spin forever.
  useEffect(() => {
    if (!authChecked || !roleChecked || eventsLoaded) return;

    if (eventsLoadedTimeoutRef.current) clearTimeout(eventsLoadedTimeoutRef.current);
    eventsLoadedTimeoutRef.current = setTimeout(() => {
      logger.warn('EVENT-CONTEXT', 'eventsLoaded safety timeout fired after 35s — forcing true to unblock RouteDecisionGate');
      setEventsLoaded(true);
    }, 35000);

    return () => {
      if (eventsLoadedTimeoutRef.current) clearTimeout(eventsLoadedTimeoutRef.current);
    };
  }, [authChecked, roleChecked, eventsLoaded]);

  // Refresh function
  const refreshEvents = useCallback(async () => {
    if (!selectedLeagueId) return;
    cacheInvalidation.eventsUpdated(selectedLeagueId);
    logger.info('EVENT-CONTEXT', `Invalidated events cache for league ${selectedLeagueId}`);
    await loadEvents(selectedLeagueId, { syncSelectedEvent: true });
  }, [selectedLeagueId, loadEvents]);

  // Update event function
  const updateEvent = useCallback(async (eventId, updatedData) => {
    if (!selectedLeagueId) {
      throw new Error('No league selected');
    }
    try {
      const response = await api.put(`/leagues/${selectedLeagueId}/events/${eventId}`, updatedData);
      if (selectedEvent && selectedEvent.id === eventId) {
        const updatedEvent = { ...selectedEvent, ...updatedData };
        setSelectedEvent(updatedEvent);
      }
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
      const headers = {
        'X-Delete-Target-Event-Id': eventId,
        ...options.headers
      };
      const response = await api.delete(`/leagues/${selectedLeagueId}/events/${eventId}`, { headers });
      setEvents(prevEvents => {
        const filtered = prevEvents.filter(event => event.id !== eventId);
        logger.info(`EVENT_DELETED_FROM_CONTEXT`, {
          deleted_event_id: eventId,
          remaining_events: filtered.length,
          removed_immediately: true,
        });
        return filtered;
      });
      setSelectedEvent(null);
      localStorage.removeItem('selectedEvent');
      qrEventDebug('Clearing selectedEvent after deleteEvent', {
        eventId,
        selectedLeagueId: selectedLeagueId || null
      });
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
      qrEventDebug('Persisting selectedEvent', {
        selectedEventId: event?.id || null,
        selectedEventLeagueId: event?.league_id || null,
        selectedLeagueId: selectedLeagueId || null
      });
      localStorage.setItem('selectedEvent', JSON.stringify(event));
    } else {
      writeLastContextClear('setSelectedEvent:explicit-null', {
        selectedLeagueId: selectedLeagueId || null
      });
      localStorage.removeItem('selectedEvent');
    }
  }, [selectedLeagueId]);

  const contextValue = {
    events,
    selectedEvent,
    setSelectedEvent: setSelectedEventWithPersistence,
    setEvents,
    noLeague,
    loading,
    eventsLoaded,
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
