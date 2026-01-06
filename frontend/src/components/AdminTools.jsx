import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Users, Settings, Activity, BarChart3, ArrowRight, CheckCircle, X, Plus, Calendar, SettingsIcon } from 'lucide-react';
import EventSetup from "./EventSetup";

export default function AdminTools() {
  const { userRole, selectedLeagueId } = useAuth();
  const { selectedEvent, events } = useEvent();
  const [view, setView] = useState('hub'); // 'hub' | 'setup'
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if we just came from deletion (optional polish panel)
  const showNextActions = location.state?.showNextActions || false;
  const deletedEventName = location.state?.deletedEvent || null;
  const [nextActionsPanelDismissed, setNextActionsPanelDismissed] = useState(false);

  // 1. Access Control
  if (userRole !== 'organizer') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">Admin Access Required</h2>
            <p className="text-gray-600 mb-6">You do not have permission to view this page. Organizer access required.</p>
            
            <div className="space-y-3">
              <Link
                to="/players?tab=analyze"
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-3 rounded-xl transition block"
              >
                Analyze Rankings
              </Link>
              <Link
                to="/dashboard"
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition block"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Event Selection Check
  if (!selectedEvent || !selectedEvent.id) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-brand-primary/30">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-brand-primary" />
            </div>
            <h2 className="text-2xl font-bold text-brand-primary mb-4">No Event Selected</h2>
            <p className="text-gray-600 mb-6">Click on "Select Event" in the header above to choose an event to manage.</p>
            <button
              onClick={() => window.location.href = '/select-league'}
              className="bg-brand-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-brand-secondary transition"
            >
              Select Event
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Render Event Setup View
  if (view === 'setup') {
    return <EventSetup onBack={() => setView('hub')} />;
  }

  // 4. Render Hub View
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-lg mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-l-4 border-brand-primary flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
            <p className="text-gray-600">Managing: <strong>{selectedEvent.name}</strong></p>
          </div>
          <div className="hidden sm:block">
            <span className="bg-brand-primary/10 text-brand-primary text-xs font-semibold px-2.5 py-0.5 rounded border border-brand-primary/20">Organizer Mode</span>
          </div>
        </div>

        {/* OPTIONAL POLISH: "What's Next?" Panel (Post-Delete) */}
        {showNextActions && !nextActionsPanelDismissed && (
          <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-6 mb-8 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-800">
                    Event Deleted Successfully
                  </h3>
                  {deletedEventName && (
                    <p className="text-sm text-green-700 mt-1">
                      "{deletedEventName}" has been removed. Recovery available for 30 days via support.
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setNextActionsPanelDismissed(true)}
                className="flex-shrink-0 text-green-600 hover:text-green-800 transition"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-t border-green-200 pt-4 mt-4">
              <p className="text-sm font-semibold text-green-800 mb-3">
                What would you like to do next?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Create New Event */}
                <button
                  onClick={() => {
                    setNextActionsPanelDismissed(true);
                    setView('setup');
                  }}
                  className="flex items-center gap-2 bg-white hover:bg-green-50 border-2 border-green-200 hover:border-green-400 text-green-800 font-medium px-4 py-3 rounded-lg transition"
                >
                  <Plus className="w-5 h-5" />
                  Create a New Event
                </button>

                {/* Select Another Event */}
                {events && events.length > 0 && (
                  <button
                    onClick={() => {
                      setNextActionsPanelDismissed(true);
                      // Event selector in navigation header will handle selection
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 bg-white hover:bg-green-50 border-2 border-green-200 hover:border-green-400 text-green-800 font-medium px-4 py-3 rounded-lg transition"
                  >
                    <Calendar className="w-5 h-5" />
                    Select Another Event
                  </button>
                )}

                {/* Manage League Settings */}
                <button
                  onClick={() => {
                    setNextActionsPanelDismissed(true);
                    navigate('/select-league');
                  }}
                  className="flex items-center gap-2 bg-white hover:bg-green-50 border-2 border-green-200 hover:border-green-400 text-green-800 font-medium px-4 py-3 rounded-lg transition"
                >
                  <SettingsIcon className="w-5 h-5" />
                  Manage League Settings
                </button>

                {/* Manage Players (only if event exists) */}
                {selectedEvent?.id && (
                  <button
                    onClick={() => {
                      setNextActionsPanelDismissed(true);
                      navigate('/players');
                    }}
                    className="flex items-center gap-2 bg-white hover:bg-green-50 border-2 border-green-200 hover:border-green-400 text-green-800 font-medium px-4 py-3 rounded-lg transition"
                  >
                    <Users className="w-5 h-5" />
                    Manage Players
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main 3 Areas */}
        <div className="space-y-4">
          
          {/* Card 1: Event Setup */}
          <button 
            onClick={() => setView('setup')}
            className="w-full group bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-brand-primary/50 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6 text-brand-primary" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-brand-primary transition-colors">Event Setup</h2>
            <p className="text-sm text-gray-600 mb-4">
              Configure details, manage drills, upload roster, and invite staff.
            </p>
            <div className="flex items-center text-brand-primary font-medium text-sm">
              Manage Setup <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 2: Live Entry Mode */}
          <Link 
            to="/live-entry"
            className="block group bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-brand-primary/50 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-semantic-success/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6 text-semantic-success" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-semantic-success transition-colors">Live Entry Mode</h2>
            <p className="text-sm text-gray-600 mb-4">
              High-speed data entry for the field. Mobile-optimized & fast.
            </p>
            <div className="flex items-center text-semantic-success font-medium text-sm">
              Launch Live Entry <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Results & Export */}
          <Link 
            to="/players?tab=analyze"
            className="block group bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-brand-primary/50 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-brand-secondary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6 text-brand-secondary" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-brand-secondary transition-colors">Results & Export</h2>
            <p className="text-sm text-gray-600 mb-4">
              View rankings, analyze performance, and export CSV/PDF reports.
            </p>
            <div className="flex items-center text-brand-secondary font-medium text-sm">
              View Results <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Quick Links / Footer Info */}
        <div className="mt-8 bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">
          Need help? Check the <a href="/docs" className="text-brand-primary hover:underline">documentation</a> or contact support.
        </div>

      </div>
    </div>
  );
}
