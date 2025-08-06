import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { useNavigate } from 'react-router-dom';
import { QrCode, Copy, ArrowLeft, Users, UserPlus } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import QRCode from 'qrcode.react';
import LoadingScreen from '../components/LoadingScreen';

export default function EventSharing() {
  const { user, userRole, selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();
  const navigate = useNavigate();
  const { showSuccess, showInfo } = useToast();
  const [selectedRole, setSelectedRole] = useState('coach');

  // Auth and role checks
  if (!user || userRole !== 'organizer') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">Organizer Access Required</h2>
            <p className="text-gray-600 mb-6">You need organizer permissions to share event QR codes.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedEvent || !selectedLeagueId) {
    return (
      <LoadingScreen 
        title="Loading event details..." 
        subtitle="Please wait while we prepare your sharing options" 
        size="large" 
      />
    );
  }

  // Generate invite links
  const baseJoinUrl = `https://woo-combine.com/join-event/${selectedLeagueId}/${selectedEvent.id}`;
  const roleJoinUrl = `${baseJoinUrl}/${selectedRole}`;
  const joinCode = selectedEvent.join_code || selectedEvent.id?.slice(-6).toUpperCase() || 'ERROR';

  // Copy to clipboard functionality
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showSuccess('📋 Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-cmf-primary transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-cmf-secondary mb-2">Share Event QR Codes</h1>
          <p className="text-gray-600">
            Share secure access links with your staff and participants for <strong>{selectedEvent.name}</strong>
          </p>
        </div>

        {/* Event Join Code Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-cmf-primary/30">
          <h2 className="text-xl font-semibold text-cmf-secondary mb-4 flex items-center gap-2">
            <QrCode className="w-6 h-6" />
            Event Join Code
          </h2>
          
          <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-4">
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Simple Join Code:</div>
              <div className="text-3xl font-mono bg-white rounded-lg p-4 inline-block border-2 border-cmf-primary/20 shadow-sm">
                {joinCode}
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Participants can enter this code at <strong>woo-combine.com/join</strong>
            </p>
          </div>
        </div>

        {/* Role-Specific QR Codes Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-cmf-primary/30">
          <h2 className="text-xl font-semibold text-cmf-secondary mb-4">Role-Based Invitations</h2>
          
          {/* Role Selection */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              onClick={() => setSelectedRole('coach')}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                selectedRole === 'coach'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              👨‍🏫 Coach Access
            </button>
            <button
              onClick={() => setSelectedRole('viewer')}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
                selectedRole === 'viewer'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              👥 Viewer Access
            </button>
          </div>

          {/* QR Code Display */}
          <div className="text-center mb-6">
            <div className="inline-block bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
              <QRCode value={roleJoinUrl} size={200} />
            </div>
            <div className="mt-3">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                selectedRole === 'coach' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              }`}>
                {selectedRole === 'coach' ? '🔵 COACH ACCESS QR CODE' : '🟢 VIEWER ACCESS QR CODE'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => copyToClipboard(roleJoinUrl)}
              className={`w-full text-white px-6 py-4 rounded-xl font-semibold transition flex items-center justify-center gap-3 text-lg ${
                selectedRole === 'coach' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <Copy className="w-5 h-5" />
              Copy {selectedRole === 'coach' ? 'Coach' : 'Viewer'} Link
            </button>
            
            <button
              onClick={() => copyToClipboard(baseJoinUrl)}
              className="w-full bg-gray-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-600 transition flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Copy General Link (No Role)
            </button>
          </div>

          {/* URL Display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="text-xs text-gray-500 mb-1">Direct Link:</div>
            <div className="text-sm font-mono text-gray-700 break-all">
              {roleJoinUrl}
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-amber-800 text-sm">
              <p className="font-medium mb-1">🔒 Security Feature:</p>
              <p>
                Role-specific QR codes prevent unauthorized access escalation. 
                Share Coach codes only with trusted staff who need scoring permissions.
              </p>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">📋 How to Use These QR Codes</h3>
          <ul className="space-y-2 text-blue-800 text-sm">
            <li className="flex items-start gap-2">
              <span className="font-medium">👨‍🏫 Coach QR:</span>
              <span>Share with referees, staff, and coaches who need to enter scores and manage drills</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium">👥 Viewer QR:</span>
              <span>Share with parents, spectators, and anyone who should only view results</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium">📱 Simple Code:</span>
              <span>Participants can manually enter the code at woo-combine.com/join</span>
            </li>
          </ul>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/players')}
            className="bg-cmf-primary text-white font-semibold py-3 px-6 rounded-xl hover:bg-cmf-secondary transition flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            Manage Players
          </button>
          <button
            onClick={() => navigate('/live-entry')}
            className="bg-green-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            ⚡ Live Entry
          </button>
        </div>
      </div>
    </div>
  );
}