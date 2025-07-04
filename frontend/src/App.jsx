import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { EventProvider } from "./context/EventContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Navigation from "./components/Navigation";
import Home from "./pages/Home";
import Players from "./pages/Players";
import AdminTools from "./components/AdminTools";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import LiveEntry from "./pages/LiveEntry";
import RequireAuth from "./context/RequireAuth";
import CreateLeague from "./pages/CreateLeague";
import JoinLeague from "./pages/JoinLeague";
import Welcome from "./pages/Welcome";

import SelectLeague from "./pages/SelectLeague";
import SelectRole from "./pages/SelectRole";
import OnboardingEvent from "./pages/OnboardingEvent";
import WelcomeLayout from "./components/layouts/WelcomeLayout";
import JoinEvent from "./pages/JoinEvent";
import CoachDashboard from "./pages/CoachDashboard";
import Schedule from "./pages/Schedule";
import Roster from "./pages/Roster";

// Authenticated Layout Component
function AuthenticatedLayout({ children }) {
  return (
    <>
      <Navigation />
      {children}
    </>
  );
}

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
                
                {/* New Feature Routes */}
                <Route 
                  path="/coach-dashboard" 
                  element={
                    <RequireAuth>
                      <AuthenticatedLayout>
                        <CoachDashboard />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/roster" 
                  element={
                    <RequireAuth>
                      <AuthenticatedLayout>
                        <Roster />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/schedule" 
                  element={
                    <RequireAuth>
                      <AuthenticatedLayout>
                        <Schedule />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <AuthenticatedLayout>
                        <Home />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/players"
                  element={
                    <RequireAuth>
                      <AuthenticatedLayout>
                        <div className="container mx-auto px-4 py-8">
                          <Players />
                        </div>
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth>
                      <AuthenticatedLayout>
                        <div className="container mx-auto px-4 py-8">
                          <AdminTools />
                        </div>
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/live-entry"
                  element={
                    <RequireAuth>
                      <AuthenticatedLayout>
                        <LiveEntry />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
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
                      <p className="text-gray-600 mb-6">Need to claim an existing account or recover access?</p>
                      
                      <div className="space-y-3 mb-6">
                        <Link 
                          to="/join" 
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition block"
                        >
                          Join with Invite Code
                        </Link>
                      </div>
                      
                      <div className="text-sm text-gray-500 space-y-2">
                        <p>Need additional help?</p>
                        <Link to="/help" className="text-cyan-600 hover:text-cyan-700 underline font-semibold">Contact Support</Link>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <Link to="/welcome" className="text-gray-500 hover:text-gray-700 text-sm transition">← Back to Welcome</Link>
                      </div>
                    </div>
                  </WelcomeLayout>
                } />
                <Route path="/create-league" element={<RequireAuth><CreateLeague /></RequireAuth>} />
                <Route path="/join" element={<RequireAuth><AuthenticatedLayout><JoinLeague /></AuthenticatedLayout></RequireAuth>} />
                <Route path="/select-league" element={<RequireAuth><AuthenticatedLayout><SelectLeague /></AuthenticatedLayout></RequireAuth>} />
                {/* Redirect /league to /select-league for better UX */}
                <Route path="/league" element={<Navigate to="/select-league" replace />} />
                <Route path="/select-role" element={
                  <RequireAuth>
                    <SelectRole />
                  </RequireAuth>
                } />
                <Route path="/onboarding/event" element={<OnboardingEvent />} />
                <Route path="/join-event/:leagueId/:eventId/:role" element={<JoinEvent />} />
                <Route path="/join-event/:leagueId/:eventId" element={<JoinEvent />} />
                <Route path="/join-event/:eventId" element={<JoinEvent />} />
                
                <Route path="/help" element={
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
                      <h2 className="text-2xl font-bold mb-4">Need Help?</h2>
                      <p className="text-gray-600 mb-6">We're here to support you with any questions about WooCombine.</p>
                      
                      <div className="space-y-3 mb-6">
                        <a 
                          href="mailto:support@woo-combine.com" 
                          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-xl transition block"
                        >
                          📧 Email Support
                        </a>
                      </div>
                      
                      <div className="text-sm text-gray-500 space-y-2">
                        <p>Common Issues:</p>
                        <div className="text-left space-y-1">
                          <p>• Can't log in: Check email and password, or reset your password</p>
                          <p>• QR code not working: Check internet connection</p>
                          <p>• Missing players: Contact your organizer</p>
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <Link to="/welcome" className="text-gray-500 hover:text-gray-700 text-sm transition">← Back to Welcome</Link>
                      </div>
                    </div>
                  </WelcomeLayout>
                } />
                <Route path="/terms" element={
                  <WelcomeLayout
                    contentClassName="min-h-screen"
                    hideHeader={true}
                    showOverlay={false}
                  >
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8">
                      <img
                        src="/favicon/woocombine-logo.png"
                        alt="Woo-Combine Logo"
                        className="w-16 h-16 mx-auto mb-6"
                        style={{ objectFit: 'contain' }}
                      />
                      <h2 className="text-2xl font-bold mb-6 text-center">Terms of Service</h2>
                      
                      <div className="space-y-4 text-sm text-gray-700 max-h-96 overflow-y-auto">
                        <section>
                          <h3 className="font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h3>
                          <p>By using WooCombine, you agree to these terms of service. This platform is designed to help organize and manage youth sports combines and events.</p>
                        </section>
                        
                        <section>
                          <h3 className="font-semibold text-gray-900 mb-2">2. Use of Service</h3>
                          <p>WooCombine is intended for legitimate sports event management. Users must provide accurate information and respect privacy of all participants.</p>
                        </section>
                        
                        <section>
                          <h3 className="font-semibold text-gray-900 mb-2">3. Data Protection</h3>
                          <p>We take privacy seriously. Player data is used solely for event management and performance tracking. No data is shared with third parties without consent.</p>
                        </section>
                        
                        <section>
                          <h3 className="font-semibold text-gray-900 mb-2">4. Contact</h3>
                          <p>Questions about these terms? Email us at legal@woo-combine.com</p>
                        </section>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                        <Link to="/welcome" className="text-gray-500 hover:text-gray-700 text-sm transition">← Back to Welcome</Link>
                      </div>
                    </div>
                  </WelcomeLayout>
                } />
                <Route path="/privacy" element={
                  <WelcomeLayout
                    contentClassName="min-h-screen"
                    hideHeader={true}
                    showOverlay={false}
                  >
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8">
                      <img
                        src="/favicon/woocombine-logo.png"
                        alt="Woo-Combine Logo"
                        className="w-16 h-16 mx-auto mb-6"
                        style={{ objectFit: 'contain' }}
                      />
                      <h2 className="text-2xl font-bold mb-6 text-center">Privacy Policy</h2>
                      
                      <div className="space-y-4 text-sm text-gray-700 max-h-96 overflow-y-auto">
                        <section>
                          <h3 className="font-semibold text-gray-900 mb-2">Information We Collect</h3>
                          <p>We collect only the information necessary to provide our combine management services:</p>
                          <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>User account information (email, role)</li>
                            <li>Player performance data (drill results, rankings)</li>
                            <li>Event details (dates, locations, participation)</li>
                          </ul>
                        </section>
                        
                        <section>
                          <h3 className="font-semibold text-gray-900 mb-2">How We Use Information</h3>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>Manage combine events and track performance</li>
                            <li>Generate rankings and analytics</li>
                            <li>Facilitate communication between coaches and organizers</li>
                          </ul>
                        </section>
                        
                        <section>
                          <h3 className="font-semibold text-gray-900 mb-2">Data Security</h3>
                          <p>All data is encrypted and stored securely. We never sell or share personal information with third parties.</p>
                        </section>
                        
                        <section>
                          <h3 className="font-semibold text-gray-900 mb-2">Contact</h3>
                          <p>Privacy questions? Email us at privacy@woo-combine.com</p>
                        </section>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                        <Link to="/welcome" className="text-gray-500 hover:text-gray-700 text-sm transition">← Back to Welcome</Link>
                      </div>
                    </div>
                  </WelcomeLayout>
                } />
              </Routes>
            </div>
          </EventProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
