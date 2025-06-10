import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import EventSelector from "../components/EventSelector";
import EventJoinCode from "../components/EventJoinCode";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import WelcomeLayout from "../components/layouts/WelcomeLayout";

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
      <WelcomeLayout
        contentClassName="min-h-screen"
        hideHeader={true}
        showOverlay={false}
      >
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <EventJoinCode event={createdEvent} league={selectedLeague} />
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleContinueToAdmin}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] w-full"
            >
              Continue to Import Players
            </button>
          </div>
        </div>
      </WelcomeLayout>
    );
  }

  return (
    <WelcomeLayout
      contentClassName="min-h-screen"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Select or Create an Event</h1>
        <p className="mb-6 text-gray-600">Choose an existing event or create a new combine event for your league.</p>
        <EventSelector onEventSelected={handleEventCreated} />
        
        {selectedEvent && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              Selected: <strong>{selectedEvent.name}</strong>
            </p>
            <button
              onClick={handleContinueToAdmin}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] w-full"
            >
              Continue to Import Players
            </button>
          </div>
        )}
      </div>
    </WelcomeLayout>
  );
} 