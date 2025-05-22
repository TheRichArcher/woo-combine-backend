import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const EventContext = createContext();

const API = import.meta.env.VITE_API_URL;

export function EventProvider({ children }) {
  const { user, selectedLeagueId } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Load events from backend
  useEffect(() => {
    async function fetchEvents() {
      try {
        let url = `${API}/events`;
        if (user && selectedLeagueId) {
          url += `?user_id=${user.uid}&league_id=${selectedLeagueId}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        setEvents(data);
        // Auto-select from localStorage or default to first event
        const stored = localStorage.getItem("selectedEventId");
        const found = data.find(e => e.id === stored);
        if (found) {
          setSelectedEvent(found);
        } else if (data.length > 0) {
          setSelectedEvent(data[0]);
        }
      } catch (err) {
        setEvents([]);
      }
    }
    fetchEvents();
  }, [user, selectedLeagueId]);

  // Sync selectedEvent to localStorage
  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem("selectedEventId", selectedEvent.id);
    }
  }, [selectedEvent]);

  return (
    <EventContext.Provider value={{ events, selectedEvent, setSelectedEvent, setEvents }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  return useContext(EventContext);
} 