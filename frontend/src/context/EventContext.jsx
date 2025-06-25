import React, { createContext, useContext, useEffect, useState, lazy, Suspense } from "react";
import { useAuth } from "./AuthContext";
import api from '../lib/api';
import { useLocation } from 'react-router-dom';

// Dynamic import to avoid circular dependency
const LeagueFallback = lazy(() => import('./LeagueFallback.jsx'));

const EventContext = createContext();

export function EventProvider({ children }) {
  const authContext = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [noLeague, setNoLeague] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const location = useLocation();

  // Defensive destructuring with fallbacks to prevent temporal dead zone errors
  const selectedLeagueId = authContext?.selectedLeagueId || '';
  const user = authContext?.user || null;
  const authChecked = authContext?.authChecked || false;
  const roleChecked = authContext?.roleChecked || false;

  // CRITICAL FIX: Add onboarding route to exempt pages so guided setup works
  const noLeagueRequiredPages = [
    '/welcome', 
    '/login', 
    '/signup', 
    '/verify-email', 
    '/select-role', 
    '/select-league', 
    '/claim', 
    '/create-league', 
    '/join',
    '/onboarding/event'  // CRITICAL: Exempt guided setup from league requirements
  ];
  
  // Check if current path is a join-event route (which also shouldn't show LeagueFallback)
  const isJoinEventRoute = location?.pathname?.startsWith('/join-event') || false;

  // Load events from backend
  useEffect(() => {
    async function fetchEvents() {
      // DEFENSIVE: Early exit if authContext is not available
      if (!authContext) {
        console.info('[EVENT-CONTEXT] AuthContext not available yet');
        return;
      }

      // CRITICAL FIX: Don't set noLeague=true until AuthContext has finished initializing
      // This prevents the flashing between "Welcome to Woo Combine" and "No League Selected"
      if (!authChecked || !roleChecked) {
        // AuthContext is still initializing - don't change noLeague state yet
        console.info('[EVENT-CONTEXT] AuthContext still initializing');
        return;
      }

      // GUIDED SETUP FIX: Don't attempt to fetch events with empty/null league ID
      // More defensive checks with optional chaining
      if (!selectedLeagueId || 
          typeof selectedLeagueId !== 'string' ||
          selectedLeagueId.trim() === '' || 
          !user) {
        console.info(`[EVENT-CONTEXT] Skipping event fetch - selectedLeagueId: "${selectedLeagueId}", user: ${!!user}`);
        setNoLeague(true);
        setEvents([]);
        setSelectedEvent(null);
        return;
      }
      
      setNoLeague(false);
      setLoading(true);
      setError(null);
      
      try {
        const url = `/leagues/${selectedLeagueId}/events`;
        console.info(`[EVENT-CONTEXT] Fetching events from: ${url}`);
        
        // Simplified API call without AbortController to avoid temporal dead zone issues
        const response = await api.get(url, {
          timeout: 20000, // 20 second timeout
          retry: 2 // Add retry attempts
        });
        
        // Defensive access to response data
        const data = response?.data || {};
        const eventsList = data.events || [];
        setEvents(Array.isArray(eventsList) ? eventsList : []);
        
        // Auto-select from localStorage or default to first event
        const stored = localStorage.getItem("selectedEventId");
        const found = Array.isArray(eventsList) ? eventsList.find(e => e?.id === stored) : null;
        if (found) {
          setSelectedEvent(found);
        } else if (Array.isArray(eventsList) && eventsList.length > 0) {
          setSelectedEvent(eventsList[0]);
        } else {
          setSelectedEvent(null);
        }
        
        setError(null);
      } catch (error) {
        // Event fetch failed
        console.error(`[EVENT-CONTEXT] Failed to fetch events for league ${selectedLeagueId}:`, error);
        setEvents([]);
        setSelectedEvent(null);
        
        if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
          setError('Request timed out. Please try again.');
        } else if (error?.response?.status === 401) {
          setError('Authentication failed. Please refresh the page.');
        } else {
          setError(error?.response?.data?.detail || error?.message || 'Failed to load events');
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchEvents();
  }, [authContext, selectedLeagueId, user, authChecked, roleChecked]);

  // Sync selectedEvent to localStorage
  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem("selectedEventId", selectedEvent.id);
    }
  }, [selectedEvent]);

  // Refresh function for error recovery
  const refreshEvents = async () => {
    // DEFENSIVE: Early exit if authContext is not available
    if (!authContext) {
      console.info('[EVENT-CONTEXT] AuthContext not available for refresh');
      return;
    }

    // GUIDED SETUP FIX: Don't attempt refresh with empty/null league ID
    if (!selectedLeagueId || 
        typeof selectedLeagueId !== 'string' ||
        selectedLeagueId.trim() === '' || 
        !user) {
      console.info(`[EVENT-CONTEXT] Skipping event refresh - selectedLeagueId: "${selectedLeagueId}", user: ${!!user}`);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const url = `/leagues/${selectedLeagueId}/events`;
      console.info(`[EVENT-CONTEXT] Refreshing events from: ${url}`);
      
      const response = await api.get(url, { retry: 2 });
      
      // Defensive access to response data
      const data = response?.data || {};
      const eventsList = data.events || [];
      setEvents(Array.isArray(eventsList) ? eventsList : []);
      setError(null);
    } catch (error) {
      console.error(`[EVENT-CONTEXT] Failed to refresh events for league ${selectedLeagueId}:`, error);
      // Event refresh failed
      setError(error?.response?.data?.detail || error?.message || 'Failed to refresh events');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Only show LeagueFallback after AuthContext initialization is complete
  // Also exclude join-event routes to allow automatic league joining
  // DEFENSIVE: Add null checks for all variables
  const shouldShowLeagueFallback = authChecked && 
                                   roleChecked && 
                                   noLeague && 
                                   location?.pathname && 
                                   !noLeagueRequiredPages.includes(location.pathname) && 
                                   !isJoinEventRoute;

  return (
    <EventContext.Provider value={{ 
      events, 
      selectedEvent, 
      setSelectedEvent, 
      setEvents, 
      noLeague, 
      loading, 
      error, 
      refreshEvents
    }}>
      {shouldShowLeagueFallback ? (
        <Suspense fallback={<div>Loading LeagueFallback...</div>}>
          <LeagueFallback />
        </Suspense>
      ) : children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  return useContext(EventContext);
} 