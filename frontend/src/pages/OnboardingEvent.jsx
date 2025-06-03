import React from "react";
import { useNavigate } from "react-router-dom";
import EventSelector from "../components/EventSelector";
import { useEvent } from "../context/EventContext";

export default function OnboardingEvent() {
  const navigate = useNavigate();
  const { selectedEvent } = useEvent();

  React.useEffect(() => {
    if (selectedEvent && selectedEvent.id) {
      navigate("/admin#player-upload-section");
    }
  }, [selectedEvent, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cmf-light">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Select or Create an Event</h1>
        <p className="mb-6 text-cmf-secondary">Before importing players, you'll need to select or create an event for your league.</p>
        <EventSelector onEventSelected={() => navigate("/admin#player-upload-section")} />
      </div>
    </div>
  );
} 