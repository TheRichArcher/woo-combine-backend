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

  const contextValue = {
    events,
    selectedEvent,
    setSelectedEvent,
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