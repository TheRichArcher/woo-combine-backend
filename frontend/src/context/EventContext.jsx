import React, { createContext, useContext, useState } from "react";

const EventContext = createContext();

export function EventProvider({ children }) {
  // Minimal state without complex dependencies
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [noLeague, setNoLeague] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Minimal refresh function
  const refreshEvents = async () => {
    // Placeholder - no actual API calls to avoid issues
    console.log('[EVENT-CONTEXT] Refresh called (minimal implementation)');
  };

  // Minimal context value
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