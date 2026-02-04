import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { EventProvider } from "./context/EventContext";
import { PlayerDetailsProvider } from "./context/PlayerDetailsContext";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Navigation from "./components/Navigation";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Players from "./pages/Players";
import AdminTools from "./components/AdminTools";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import EmailAction from "./pages/EmailAction";
import MfaEnroll from "./pages/MfaEnroll";
import LiveEntry from "./pages/LiveEntry";
import RequireAuth from "./context/RequireAuth";
import CreateLeague from "./pages/CreateLeague";
import JoinLeague from "./pages/JoinLeague";
import Welcome from "./pages/Welcome";
import WorkflowDemo from "./pages/WorkflowDemo";
import RouteDecisionGate from "./components/RouteDecisionGate";

import SelectLeague from "./pages/SelectLeague";
import SelectRole from "./pages/SelectRole";
import OnboardingEvent from "./pages/OnboardingEvent";

import WelcomeLayout from "./components/layouts/WelcomeLayout";
import JoinEvent from "./pages/JoinEvent";
import CoachDashboard from "./pages/CoachDashboard";
import Schedule from "./pages/Schedule";

// New Advanced Feature Pages
import EvaluatorManagementPage from "./pages/EvaluatorManagement";
import TeamFormationPage from "./pages/TeamFormationPage";
import SportTemplatesPage from "./pages/SportTemplatesPage";
import ScorecardsPage from "./pages/ScorecardsPage";
import LiveStandings from "./pages/LiveStandings";
import EventSharing from "./pages/EventSharing";
import Analytics from "./pages/Analytics";

// Draft Feature Pages
import { CreateDraft, DraftSetup, DraftRoom, DraftBoard, CoachRankings } from "./pages/Draft";
import SessionExpiredGate from "./components/SessionExpiredGate";
import BootGate from "./components/BootGate";
import { NavigationLogger } from "./hooks/useTrackedNavigate";

// Authenticated Layout Component with Route Decision Gate
function AuthenticatedLayout({ children }) {
  return (
    <ErrorBoundary>
      <RouteDecisionGate>
      <Navigation />
      {children}
      </RouteDecisionGate>
    </ErrorBoundary>
  );
}

function App() {
  // Log build version on app load for deployment verification
  useEffect(() => {
    const buildInfo = {
      sha: typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'dev',
      time: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev',
      url: window.location.href
    };
    console.log('%c🚀 WooCombine Build Info', 'background: #0ea5e9; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
    console.log('Build SHA:', buildInfo.sha);
    console.log('Build Time:', buildInfo.time);
    console.log('Environment:', import.meta.env.MODE);
    
    // Also expose on window for easy access in console
    window.__WOOCOMBINE_BUILD__ = buildInfo;
  }, []);

  return (
    <BrowserRouter>
      <NavigationLogger />
      <ErrorBoundary>
        <ToastProvider>
        <AuthProvider>
          <EventProvider>
            <PlayerDetailsProvider>
            <div className="min-h-screen bg-gray-50">
              <SessionExpiredGate />
              <BootGate>
                <Routes>
                  <Route path="/" element={<Navigate to="/welcome" replace />} />
                <Route path="/welcome" element={<Welcome />} />
                            <Route path="/workflow-demo" element={<WorkflowDemo />} />
                
                {/* New Feature Routes */}
                <Route 
                  path="/coach" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <CoachDashboard />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/schedule" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <Schedule />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                
                {/* NEW ADVANCED FEATURE ROUTES */}
                <Route 
                  path="/evaluators" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <EvaluatorManagementPage />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/team-formation" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <TeamFormationPage />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                
                {/* DRAFT FEATURE ROUTES */}
                <Route 
                  path="/draft/create" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <CreateDraft />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/draft/:draftId/setup" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <DraftSetup />
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/draft/:draftId/live" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <DraftRoom />
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/draft/:draftId/board" 
                  element={
                    <DraftBoard />
                  } 
                />
                <Route 
                  path="/draft/:draftId/rankings" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <CoachRankings />
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/sport-templates" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <SportTemplatesPage />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/scorecards" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <ScorecardsPage />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/players/rankings" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <ScorecardsPage />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                <Route 
                  path="/event-sharing" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <EventSharing />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  } 
                />
                
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <Home />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />

                <Route
                  path="/players"
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <Players />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <div className="container mx-auto px-4 py-8">
                          <AdminTools />
                        </div>
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />
                {/* Redirect /admin-tools to /admin for backward compatibility */}
                <Route path="/admin-tools" element={<Navigate to="/admin" replace />} />
                <Route
                  path="/live-entry"
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <LiveEntry />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/live-standings"
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <LiveStandings />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />
                <Route 
                  path="/analytics" 
                  element={
                    <RequireAuth skipRoleCheck={true}>
                      <AuthenticatedLayout>
                        <Analytics />
                      </AuthenticatedLayout>
                    </RequireAuth>
                  }
                />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                {/* In-app handler for Firebase action links (verifyEmail, etc.) */}
                <Route path="/email-action" element={<EmailAction />} />
                {/* Support Firebase hosted action handler paths */}
                <Route path="/__/auth/action" element={<EmailAction />} />
                <Route path="/__auth/action" element={<EmailAction />} />
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
                        <Link to="/help" className="text-brand-primary hover:text-brand-secondary underline font-semibold">Contact Support</Link>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <Link to="/welcome" className="text-gray-500 hover:text-gray-700 text-sm transition">← Back to Welcome</Link>
                      </div>
                    </div>
                  </WelcomeLayout>
                } />
                <Route path="/mfa-enroll" element={
                  <WelcomeLayout
                    backLink="/dashboard"
                    backText="Back"
                  >
                    <MfaEnroll />
                  </WelcomeLayout>
                } />
                <Route path="/create-league" element={<RequireAuth skipRoleCheck={true}><AuthenticatedLayout><CreateLeague /></AuthenticatedLayout></RequireAuth>} />
                <Route path="/join" element={<RequireAuth skipRoleCheck={true}><AuthenticatedLayout><JoinLeague /></AuthenticatedLayout></RequireAuth>} />
                <Route path="/select-league" element={<RequireAuth skipRoleCheck={true}><AuthenticatedLayout><SelectLeague /></AuthenticatedLayout></RequireAuth>} />
                {/* Redirect /league to /select-league for better UX */}
                <Route path="/league" element={<Navigate to="/select-league" replace />} />
                <Route path="/select-role" element={
                  <RequireAuth>
                    <SelectRole />
                  </RequireAuth>
                } />
                <Route path="/onboarding/event" element={<RequireAuth skipRoleCheck={true}><AuthenticatedLayout><OnboardingEvent /></AuthenticatedLayout></RequireAuth>} />
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
                          className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-3 rounded-xl transition block"
                        >
                          📧 Email Support
                        </a>
                      </div>
                      
                      <div className="text-sm text-gray-500 space-y-2">
                        <p>Common Issues:</p>
                        <div className="text-left space-y-1">
                                          <p>- Can't log in: Check email and password, or reset your password</p>
                <p>- QR code not working: Check internet connection</p>
                <p>- Missing players: Contact your organizer</p>
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
              </BootGate>
            </div>
            </PlayerDetailsProvider>
          </EventProvider>
        </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
