import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

const EventContext = createContext();

const API = import.meta.env.VITE_API_URL;

export function EventProvider({ children }) {
  const { selectedLeagueId } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [noLeague, setNoLeague] = useState(false);

  // Load events from backend
  useEffect(() => {
    async function fetchEvents() {
      if (!selectedLeagueId) {
        setNoLeague(true);
        return;
      }
      setNoLeague(false);
      try {
        const url = `${API}/events?league_id=${selectedLeagueId}`;
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
  }, [selectedLeagueId]);

  // Sync selectedEvent to localStorage
  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem("selectedEventId", selectedEvent.id);
    }
  }, [selectedEvent]);

  // Fallback UI for missing league
  function LeagueFallback() {
    const navigate = useNavigate();
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto text-center border-2 border-yellow-200">
          <h2 className="text-2xl font-bold text-yellow-600 mb-4">No League Selected</h2>
          <p className="text-cmf-secondary mb-4">Please join or create a league to continue.</p>
          <div className="flex gap-4 justify-center">
            <button
              className="bg-cmf-primary text-white px-4 py-2 rounded font-semibold"
              onClick={() => navigate('/create-league')}
            >
              Create League
            </button>
            <button
              className="bg-cmf-secondary text-white px-4 py-2 rounded font-semibold"
              onClick={() => navigate('/join')}
            >
              Join League
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EventContext.Provider value={{ events, selectedEvent, setSelectedEvent, setEvents, noLeague, LeagueFallback }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  return useContext(EventContext);
} 