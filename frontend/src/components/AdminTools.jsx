import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { Link, useNavigate } from 'react-router-dom';
import { Users, Settings, Activity, BarChart3, ArrowRight } from 'lucide-react';
import EventSetup from "./EventSetup";

export default function AdminTools() {
  const { userRole, selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();
  const [view, setView] = useState('hub'); // 'hub' | 'setup'
  const navigate = useNavigate();

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
                className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-3 rounded-xl transition block"
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
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-cmf-primary/30">
            <div className="w-16 h-16 bg-cmf-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-cmf-primary" />
            </div>
            <h2 className="text-2xl font-bold text-cmf-primary mb-4">No Event Selected</h2>
            <p className="text-gray-600 mb-6">Click on "Select Event" in the header above to choose an event to manage.</p>
            <button
              onClick={() => window.location.href = '/select-league'}
              className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition"
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-l-4 border-cmf-primary flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
            <p className="text-gray-600">Managing: <strong>{selectedEvent.name}</strong></p>
          </div>
          <div className="hidden sm:block">
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-200">Organizer Mode</span>
          </div>
        </div>

        {/* Main 3 Areas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Event Setup */}
          <button 
            onClick={() => setView('setup')}
            className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-cmf-primary/50 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">Event Setup</h2>
            <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
              Configure details, manage drills, upload roster, and invite staff.
            </p>
            <div className="flex items-center text-blue-600 font-medium text-sm">
              Manage Setup <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 2: Live Entry Mode */}
          <Link 
            to="/live-entry"
            className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-cmf-primary/50 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">Live Entry Mode</h2>
            <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
              High-speed data entry for the field. Mobile-optimized & fast.
            </p>
            <div className="flex items-center text-green-600 font-medium text-sm">
              Launch Live Entry <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Results & Export */}
          <Link 
            to="/players?tab=analyze"
            className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-cmf-primary/50 transition-all duration-200"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">Results & Export</h2>
            <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
              View rankings, analyze performance, and export CSV/PDF reports.
            </p>
            <div className="flex items-center text-purple-600 font-medium text-sm">
              View Results <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Quick Links / Footer Info */}
        <div className="mt-8 bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">
          Need help? Check the <a href="/docs" className="text-blue-600 hover:underline">documentation</a> or contact support.
        </div>

      </div>
    </div>
  );
}
