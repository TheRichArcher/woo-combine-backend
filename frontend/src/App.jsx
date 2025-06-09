import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { EventProvider } from "./context/EventContext";
import { AuthProvider } from "./context/AuthContext";
import Navigation from "./components/Navigation";
import Home from "./pages/Home";
import Roster from "./pages/Roster";
import Schedule from "./pages/Schedule";
import CoachDashboard from "./pages/CoachDashboard";
import Players from "./pages/Players";
import AdminTools from "./components/AdminTools";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import RequireAuth from "./context/RequireAuth";
import CreateLeague from "./pages/CreateLeague";
import JoinLeague from "./pages/JoinLeague";
import Welcome from "./pages/Welcome";
import VerifyEmail from "./pages/VerifyEmail";
import SelectLeague from "./pages/SelectLeague";
import SelectRole from "./pages/SelectRole";
import OnboardingEvent from "./pages/OnboardingEvent";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EventProvider>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<Navigate to="/welcome" replace />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <>
                      <Navigation />
                      <Home />
                    </>
                  </RequireAuth>
                }
              />
              <Route
                path="/roster"
                element={
                  <RequireAuth>
                    <Roster />
                  </RequireAuth>
                }
              />
              <Route
                path="/schedule"
                element={
                  <RequireAuth>
                    <Schedule />
                  </RequireAuth>
                }
              />
              <Route
                path="/coach-dashboard"
                element={
                  <RequireAuth>
                    <>
                      <Navigation />
                      <div className="container mx-auto px-4 py-8">
                        <CoachDashboard />
                      </div>
                    </>
                  </RequireAuth>
                }
              />
              <Route
                path="/players"
                element={
                  <RequireAuth>
                    <>
                      <Navigation />
                      <div className="container mx-auto px-4 py-8">
                        <Players />
                      </div>
                    </>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <>
                      <Navigation />
                      <div className="container mx-auto px-4 py-8">
                        <AdminTools />
                      </div>
                    </>
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/claim" element={<div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="bg-white p-8 rounded-lg shadow-lg text-center"><h2 className="text-2xl font-bold mb-4">Account Claim</h2><p className="text-gray-600 mb-4">Account claiming feature coming soon.</p><Link to="/welcome" className="text-cyan-700 hover:underline">← Back to Welcome</Link></div></div>} />
              <Route path="/create-league" element={<RequireAuth><Navigation /><div className="container mx-auto px-4 py-8"><CreateLeague /></div></RequireAuth>} />
              <Route path="/join" element={<RequireAuth><Navigation /><div className="container mx-auto px-4 py-8"><JoinLeague /></div></RequireAuth>} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/select-league" element={<RequireAuth><SelectLeague /></RequireAuth>} />
              <Route path="/select-role" element={<SelectRole />} />
              <Route path="/onboarding/event" element={<RequireAuth><OnboardingEvent /></RequireAuth>} />
            </Routes>
          </div>
        </EventProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
