import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import api from '../lib/api';
import LeagueFallback from './LeagueFallback.jsx';

const EventContext = createContext();

export function EventProvider({ children }) {
  const { selectedLeagueId, user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [noLeague, setNoLeague] = useState(false);

  // Load events from backend
  useEffect(() => {
    async function fetchEvents() {
      if (!selectedLeagueId || !user) {
        setNoLeague(true);
        return;
      }
      setNoLeague(false);
      try {
        const token = await user.getIdToken();
        if (!selectedLeagueId) throw new Error('No league selected');
        const url = `/leagues/${selectedLeagueId}/events`;
        const { data } = await api.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEvents(data);
        // Auto-select from localStorage or default to first event
        const stored = localStorage.getItem("selectedEventId");
        const found = data.find(e => e.id === stored);
        if (found) {
          setSelectedEvent(found);
        } else if (data.length > 0) {
          setSelectedEvent(data[0]);
        }
      } catch {
        setEvents([]);
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

  return (
    <EventContext.Provider value={{ events, selectedEvent, setSelectedEvent, setEvents, noLeague, LeagueFallback }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  return useContext(EventContext);
} 