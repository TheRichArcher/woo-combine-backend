import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import api from '../lib/api';
import LeagueFallback from './LeagueFallback.jsx';
import { useLocation } from 'react-router-dom';

const EventContext = createContext();

export function EventProvider({ children }) {
  const { selectedLeagueId, user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [noLeague, setNoLeague] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const location = useLocation();

  // Pages that don't require a league selection
  const noLeagueRequiredPages = ['/welcome', '/login', '/signup', '/verify-email', '/select-role', '/select-league', '/claim', '/create-league', '/join'];

  // Load events from backend
  useEffect(() => {
    async function fetchEvents() {
      if (!selectedLeagueId || !user) {
        setNoLeague(true);
        setEvents([]);
        setSelectedEvent(null);
        return;
      }
      
      setNoLeague(false);
      setLoading(true);
      setError(null);
      
      try {
        // Add timeout protection and retry logic
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout for cold starts
        
        const url = `/leagues/${selectedLeagueId}/events`;
        const { data } = await api.get(url, {
          signal: controller.signal,
          retry: 2 // Add retry attempts
        });
        
        clearTimeout(timeoutId);
        
        // Fix: Backend returns {events: [...]} not just [...]
        const eventsList = data.events || [];
        setEvents(Array.isArray(eventsList) ? eventsList : []);
        
        // Auto-select from localStorage or default to first event
        const stored = localStorage.getItem("selectedEventId");
        const found = Array.isArray(eventsList) ? eventsList.find(e => e.id === stored) : null;
        if (found) {
          setSelectedEvent(found);
        } else if (Array.isArray(eventsList) && eventsList.length > 0) {
          setSelectedEvent(eventsList[0]);
        } else {
          setSelectedEvent(null);
        }
        
        setError(null);
      } catch (error) {
        console.error('Failed to fetch events:', error);
        setEvents([]);
        setSelectedEvent(null);
        
        if (error.name === 'AbortError') {
          setError('Request timed out. Please try again.');
        } else if (error.response?.status === 401) {
          setError('Authentication failed. Please refresh the page.');
        } else {
          setError(error.response?.data?.detail || error.message || 'Failed to load events');
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchEvents();
  }, [selectedLeagueId, user]);

  // Sync selectedEvent to localStorage
  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem("selectedEventId", selectedEvent.id);
    }
  }, [selectedEvent]);

  // Refresh function for error recovery
  const refreshEvents = async () => {
    if (!selectedLeagueId || !user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const url = `/leagues/${selectedLeagueId}/events`;
      const { data } = await api.get(url, { retry: 2 });
      
      const eventsList = data.events || [];
      setEvents(Array.isArray(eventsList) ? eventsList : []);
      setError(null);
    } catch (error) {
      console.error('Failed to refresh events:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to refresh events');
    } finally {
      setLoading(false);
    }
  };

  // Only show LeagueFallback on pages that require a league
  const shouldShowLeagueFallback = noLeague && !noLeagueRequiredPages.includes(location.pathname);

  return (
    <EventContext.Provider value={{ 
      events, 
      selectedEvent, 
      setSelectedEvent, 
      setEvents, 
      noLeague, 
      loading, 
      error, 
      refreshEvents,
      LeagueFallback 
    }}>
      {shouldShowLeagueFallback ? <LeagueFallback /> : children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  return useContext(EventContext);
} 