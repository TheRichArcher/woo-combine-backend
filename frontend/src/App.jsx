import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { EventProvider } from "./context/EventContext";
import { AuthProvider } from "./context/AuthContext";
import Navigation from "./components/Navigation";
import CoachDashboard from "./pages/CoachDashboard";
import Players from "./pages/Players";
import AdminTools from "./components/AdminTools";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import RequireAuth from "./context/RequireAuth";
import CreateLeague from "./pages/CreateLeague";
import JoinLeague from "./pages/JoinLeague";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EventProvider>
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <div className="container mx-auto px-4 py-8">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <CoachDashboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/players"
                  element={
                    <RequireAuth>
                      <Players />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth>
                      <AdminTools />
                    </RequireAuth>
                  }
                />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/create-league" element={<RequireAuth><CreateLeague /></RequireAuth>} />
                <Route path="/join" element={<RequireAuth><JoinLeague /></RequireAuth>} />
              </Routes>
            </div>
          </div>
        </EventProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
