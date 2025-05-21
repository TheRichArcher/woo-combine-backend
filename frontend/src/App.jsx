import React from "react";
import TestTailwind from "./pages/TestTailwind";
import { EventProvider } from "./context/EventContext";

function App() {
  return (
    <EventProvider>
      <TestTailwind />
    </EventProvider>
  );
}

export default App;
