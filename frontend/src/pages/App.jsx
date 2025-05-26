import React from "react";
import { Routes, Route } from "react-router-dom";
import ForgotPassword from "./ForgotPassword";
import SelectLeague from "./SelectLeague";

export default function App() {
  return (
    <Routes>
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/select-league" element={<SelectLeague />} />
      {/* Add other routes here as needed */}
    </Routes>
  );
}
