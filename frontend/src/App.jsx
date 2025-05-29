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
import Welcome from "./pages/Welcome";
import VerifyEmail from "./pages/VerifyEmail";
import SelectLeague from "./pages/SelectLeague";
import SelectRole from "./pages/SelectRole";

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
              <Route path="/create-league" element={<RequireAuth><Navigation /><div className="container mx-auto px-4 py-8"><CreateLeague /></div></RequireAuth>} />
              <Route path="/join" element={<RequireAuth><Navigation /><div className="container mx-auto px-4 py-8"><JoinLeague /></div></RequireAuth>} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/select-league" element={<RequireAuth><SelectLeague /></RequireAuth>} />
              <Route path="/select-role" element={<SelectRole />} />
            </Routes>
          </div>
        </EventProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
