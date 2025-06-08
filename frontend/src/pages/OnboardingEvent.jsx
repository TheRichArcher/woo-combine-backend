import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import EventSelector from "../components/EventSelector";
import EventJoinCode from "../components/EventJoinCode";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";

export default function OnboardingEvent() {
  const navigate = useNavigate();
  const { selectedEvent } = useEvent();
  const { leagues, selectedLeagueId } = useAuth();
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [createdEvent, setCreatedEvent] = useState(null);

  const selectedLeague = leagues?.find(l => l.id === selectedLeagueId);

  const handleEventCreated = (event) => {
    setCreatedEvent(event);
    setShowJoinCode(true);
  };

  const handleContinueToAdmin = () => {
    navigate("/admin#player-upload-section");
  };

  // If showing join code, display that instead
  if (showJoinCode && createdEvent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-cmf-light px-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
          <EventJoinCode event={createdEvent} league={selectedLeague} />
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleContinueToAdmin}
              className="bg-cmf-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-cmf-secondary transition w-full"
            >
              Continue to Import Players
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cmf-light px-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Select or Create an Event</h1>
        <p className="mb-6 text-cmf-secondary">Choose an existing event or create a new combine event for your league.</p>
        <EventSelector onEventSelected={handleEventCreated} />
        
        {selectedEvent && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              Selected: <strong>{selectedEvent.name}</strong>
            </p>
            <button
              onClick={handleContinueToAdmin}
              className="bg-cmf-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-cmf-secondary transition w-full"
            >
              Continue to Import Players
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 