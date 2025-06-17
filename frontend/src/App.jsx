import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { EventProvider } from "./context/EventContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Navigation from "./components/Navigation";
import Home from "./pages/Home";
import Roster from "./pages/Roster";
import Schedule from "./pages/Schedule";
import CoachDashboard from "./pages/CoachDashboard";
import Players from "./pages/Players";
import AdminTools from "./components/AdminTools";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import LiveEntry from "./pages/LiveEntry";
import RequireAuth from "./context/RequireAuth";
import CreateLeague from "./pages/CreateLeague";
import JoinLeague from "./pages/JoinLeague";
import Welcome from "./pages/Welcome";
import VerifyEmail from "./pages/VerifyEmail";
import SelectLeague from "./pages/SelectLeague";
import SelectRole from "./pages/SelectRole";
import OnboardingEvent from "./pages/OnboardingEvent";
import WelcomeLayout from "./components/layouts/WelcomeLayout";

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <EventProvider>
            <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<Navigate to="/welcome" replace />} />
              <Route path="/welcome" element={<Welcome />} />
              
              {/* PHASE 2: Soft redirects to unified Players page */}
              <Route 
                path="/coach-dashboard" 
                element={<Navigate to="/players?tab=rankings" replace />} 
              />
              <Route 
                path="/roster" 
                element={<Navigate to="/players?tab=players" replace />} 
              />
              <Route 
                path="/schedule" 
                element={<Navigate to="/players?tab=players" replace />} 
              />
              
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
              {/* OLD ROUTES - Commented out for Phase 2, redirected above */}
              {/* 
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
              */}
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
              <Route
                path="/live-entry"
                element={
                  <RequireAuth>
                    <LiveEntry />
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/claim" element={
                <WelcomeLayout
                  contentClassName="min-h-screen"
                  hideHeader={true}
                  showOverlay={false}
                >
                  <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
                    <img
                      src="/favicon/woocombine-logo.png"
                      alt="Woo-Combine Logo"
                      className="w-16 h-16 mx-auto mb-6"
                      style={{ objectFit: 'contain' }}
                    />
                    <h2 className="text-2xl font-bold mb-4">Account Claim</h2>
                    <p className="text-gray-600 mb-6">Account claiming feature coming soon.</p>
                    <Link to="/welcome" className="text-cyan-600 hover:text-cyan-700 underline font-semibold">← Back to Welcome</Link>
                  </div>
                </WelcomeLayout>
              } />
              <Route path="/create-league" element={<RequireAuth><CreateLeague /></RequireAuth>} />
              <Route path="/join" element={<RequireAuth><JoinLeague /></RequireAuth>} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/select-league" element={<RequireAuth><SelectLeague /></RequireAuth>} />
              <Route path="/select-role" element={
                <RequireAuth>
                  <SelectRole />
                </RequireAuth>
              } />
              <Route path="/onboarding/event" element={<RequireAuth><OnboardingEvent /></RequireAuth>} />
              {/* Temporary redirect routes for missing pages */}
              <Route path="/help" element={<Navigate to="/welcome" replace />} />
              <Route path="/terms" element={<Navigate to="/welcome" replace />} />
              <Route path="/privacy" element={<Navigate to="/welcome" replace />} />
            </Routes>
          </div>
        </EventProvider>
      </AuthProvider>
    </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
