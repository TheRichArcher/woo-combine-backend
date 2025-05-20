import React from "react";
import CoachDashboard from "./pages/CoachDashboard.jsx";
import { EventProvider } from "./context/EventContext";

function App() {
  return (
    <EventProvider>
      <CoachDashboard />
    </EventProvider>
  );
}

export default App;
