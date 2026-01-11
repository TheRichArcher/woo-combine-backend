import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { useToast } from "../context/ToastContext";
import api from '../lib/api';
import QRCode from 'react-qr-code';
import { cacheInvalidation } from '../utils/dataCache';
import { formatEventDate } from '../utils/dateUtils';
import { UserPlus, RefreshCcw, Users, Copy, QrCode, Edit, ArrowLeft, FileText, ArrowRight, Upload } from 'lucide-react';
import CreateEventModal from "./CreateEventModal";
import EditEventModal from "./EditEventModal";
import ImportResultsModal from "./Players/ImportResultsModal";
import AddPlayerModal from "./Players/AddPlayerModal";
import { Link, useNavigate } from 'react-router-dom';
import DrillManager from "./drills/DrillManager";
import StaffManagement from "./StaffManagement";
import DeleteEventFlow from "./DeleteEventFlow";

/**
 * EventSetup Component
 * 
 * CLEAN VERSION - All orphaned CSV processing code removed
 * This component now uses ONLY canonical components for imports/adds:
 * - ImportResultsModal: canonical player import (CSV/Excel)
 * - AddPlayerModal: canonical manual player add
 * 
 * Cleanup Date: January 8, 2026
 * Removed: ~400 lines of unused CSV parsing, drag/drop, field mapping, and upload code
 */
export default function EventSetup({ onBack }) {
  const { user, userRole, selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();
  const { notifyError, showSuccess, showInfo } = useToast();
  const navigate = useNavigate();

  // CRITICAL: Use selectedEvent directly for reactive updates
  // eventSnapshot is ONLY for deletion flow to prevent unmount
  // For display, always use latest selectedEvent
  const eventSnapshot = selectedEvent;

  // Reset tool state
  const [confirmInput, setConfirmInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  // Import modal state (canonical importer)
  const [showImportModal, setShowImportModal] = useState(false);

  // Add player modal state (canonical manual add)
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  
  // Players list for AddPlayerModal (empty array is fine, modal will work)
  const [players, setPlayers] = useState([]);

  // Player count state
  const [playerCount, setPlayerCount] = useState(0);
  const [playerCountLoading, setPlayerCountLoading] = useState(false);

  // Invite to League section state
  const [showQr, setShowQr] = useState(false); // false | 'coach' | 'viewer'
  
  // Generate consistent invite links
  const inviteLink = (() => {
    if (!selectedEvent || !selectedLeagueId) {
      return '';
    }
    
    // Always use the new format: /join-event/{leagueId}/{eventId}
    return `https://woo-combine.com/join-event/${selectedLeagueId}/${selectedEvent.id}`;
  })();
    
  // Edit Event Modal state
  const [showEditEventModal, setShowEditEventModal] = useState(false);

  // Scroll to player upload section if hash is present or changes
  useEffect(() => {
    const scrollToSection = () => {
      if (window.location.hash === '#player-upload-section' || window.location.hash === '#player-upload') {
        const section = document.getElementById('player-upload-section');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      }
    };
    scrollToSection();
    window.addEventListener('hashchange', scrollToSection);
    return () => window.removeEventListener('hashchange', scrollToSection);
  }, []);

  const handleReset = async () => {
    if (!selectedEvent || !user || !selectedLeagueId) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      await api.delete(`/players/reset?event_id=${selectedEvent.id}`);
      setStatus("success");
      setConfirmInput("");
      showSuccess(`🗑️ All player data for "${selectedEvent.name}" has been reset`);
      // Invalidate caches after destructive change
      cacheInvalidation.playersUpdated(selectedEvent.id);
      fetchPlayerCount(); // Refresh count
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Error during reset.");
      notifyError(err);
    }
  };

  // Fetch player count for summary badge
  const fetchPlayerCount = useCallback(async () => {
    if (!selectedEvent || !user || !selectedLeagueId) return;
    setPlayerCountLoading(true);
    try {
      const { data } = await api.get(`/players?event_id=${selectedEvent.id}`);
      setPlayerCount(Array.isArray(data) ? data.length : 0);
    } catch (error) {
      if (error.response?.status === 404) {
        // 404 means no players found yet - normal for new events
        setPlayerCount(0);
      } else {
        // Other errors are actual problems
        setPlayerCount(0);
      }
    } finally {
      setPlayerCountLoading(false);
    }
  }, [selectedEvent, user, selectedLeagueId]);

  useEffect(() => {
    fetchPlayerCount();
  }, [selectedEvent, user, selectedLeagueId, fetchPlayerCount]);

  // Copy functionality with notifications
  const handleCopyInviteLink = (role) => {
    const linkToCopy = role ? `${inviteLink}/${role}` : inviteLink;
    navigator.clipboard.writeText(linkToCopy);
    const roleText = role ? ` (${role.charAt(0).toUpperCase() + role.slice(1)})` : '';
    showSuccess(`📋 Invite link${roleText} copied to clipboard!`);
  };

  if (userRole !== 'organizer') {
    return (
        <div className="bg-white rounded-xl shadow-md p-6 text-center border-2 border-red-200">
            <h2 className="text-xl font-bold text-red-600 mb-2">Access Denied</h2>
            <p>You must be an organizer to view this page.</p>
        </div>
    );
  }

  // CRITICAL: Use eventSnapshot (immutable) instead of selectedEvent for validation
  // This keeps component mounted during deletion flow even after selectedEvent is cleared
  if (!eventSnapshot || !eventSnapshot.id) {
    return null; // Should be handled by parent
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-lg mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
            <button 
                onClick={onBack}
                className="bg-white p-2 rounded-full shadow-sm hover:bg-gray-50 border border-gray-200 transition"
            >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Event Setup</h1>
        </div>
        
        {/* Welcome Header */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-4 border-l-4 border-brand-primary">
          <h2 className="text-lg font-bold text-brand-secondary mb-1">
             {eventSnapshot.name}
          </h2>
          <p className="text-sm text-gray-600">
             {formatEventDate(eventSnapshot.date)} • {eventSnapshot.location || 'Location TBD'}
          </p>
        </div>

        {/* Step 1: Event Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {eventSnapshot.name}</p>
              <p><strong>Date:</strong> {formatEventDate(eventSnapshot.date)}</p>
              <p><strong>Location:</strong> {eventSnapshot.location || 'Location TBD'}</p>
              {eventSnapshot.notes && <p><strong>Notes:</strong> {eventSnapshot.notes}</p>}
            </div>
          </div>
          
          <button
            onClick={() => setShowEditEventModal(true)}
            className="bg-brand-primary hover:bg-brand-secondary text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Event Details
          </button>
        </div>

        {/* Step 2: Manage Drills */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <h2 className="text-lg font-semibold text-gray-900">Manage Drills</h2>
          </div>
          
          <DrillManager 
            event={eventSnapshot} 
            leagueId={selectedLeagueId} 
            isLiveEntryActive={eventSnapshot?.live_entry_active || false} 
          />
        </div>

        {/* Step 3: Add Players Section - MATCHES /players EMPTY STATE */}
        <div id="player-upload-section" className="bg-white rounded-2xl shadow-lg p-6 mb-4 border-2 border-blue-200">
          <h2 className="text-2xl font-bold text-cmf-secondary mb-4">
            Add Players to Your Event
          </h2>
          
          <div className="space-y-4">
            {/* Player Count Status */}
            {playerCountLoading ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-gray-600">Loading player count...</p>
              </div>
            ) : playerCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-blue-900 font-semibold">
                      {playerCount} {playerCount === 1 ? 'player' : 'players'} in roster
                    </p>
                    <p className="text-blue-700 text-sm">
                      Add more players or manage your roster on the Players page
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Primary CTA - Import Players (Full Width) */}
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-3 text-lg"
              type="button"
            >
              <Upload className="w-5 h-5" />
              Import Players from File
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Secondary CTAs - Grid of smaller actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowAddPlayerModal(true)}
                className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition border border-blue-200"
                type="button"
              >
                <UserPlus className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">Add Player</span>
              </button>
              
              <Link
                to="/players?tab=manage"
                className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition border border-blue-200"
              >
                <Users className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">View Roster</span>
              </Link>
            </div>

            {/* Helper Text */}
            <p className="text-sm text-gray-600 text-center">
              Import CSV/Excel files for bulk uploads, or add players one at a time.
            </p>
          </div>
        </div>

        {/* Step 4: Invite Coaches & Share */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
            <h2 className="text-lg font-semibold text-gray-900">Invite People to Event</h2>
          </div>
          
          <div className="space-y-6">
            {/* Coach Invitations */}
            <div className="bg-brand-light/20 border-l-4 border-brand-primary rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-brand-primary text-lg">👨‍🏫</span>
                <h3 className="text-lg font-semibold text-brand-secondary">Coach Invitations</h3>
                <span className="bg-brand-primary/20 text-brand-primary text-xs px-2 py-1 rounded-full font-medium">Read/Write Access</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-brand-primary mb-1">Coach Invitation Link</label>
                  <div className="bg-white border border-brand-primary/20 rounded-lg p-3 text-sm text-center break-all">
                    {inviteLink ? `${inviteLink}/coach` : 'Loading...'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyInviteLink('coach')}
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-medium px-3 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    disabled={!inviteLink}
                  >
                    <Copy className="w-4 h-4" />
                    Copy Coach Link
                  </button>
                  <button
                    onClick={() => {
                      setShowQr(showQr === 'coach' ? false : 'coach');
                      if (showQr !== 'coach') showInfo('📱 Coach QR code displayed');
                    }}
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-medium px-3 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                  >
                    <QrCode className="w-4 h-4" />
                    Coach QR
                  </button>
                </div>
                
                {showQr === 'coach' && (
                  <div className="bg-white rounded-lg p-4 text-center border border-brand-primary/20">
                    <QRCode key={`${inviteLink}/coach`} value={`${inviteLink}/coach`} size={150} className="mx-auto mb-2" />
                    <p className="text-xs text-brand-primary font-medium">🔵 COACH ACCESS QR CODE</p>
                  </div>
                )}
              </div>
            </div>

            {/* Viewer Invitations */}
            <div className="bg-semantic-success/10 border-l-4 border-semantic-success rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-semantic-success text-lg">👥</span>
                <h3 className="text-lg font-semibold text-semantic-success">Viewer Invitations</h3>
                <span className="bg-semantic-success/20 text-semantic-success text-xs px-2 py-1 rounded-full font-medium">Read-Only Access</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-semantic-success mb-1">Viewer Invitation Link</label>
                  <div className="bg-white border border-semantic-success/30 rounded-lg p-3 text-sm text-center break-all">
                    {inviteLink ? `${inviteLink}/viewer` : 'Loading...'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyInviteLink('viewer')}
                    className="bg-semantic-success hover:bg-green-700 text-white font-medium px-3 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    disabled={!inviteLink}
                  >
                    <Copy className="w-4 h-4" />
                    Copy Viewer Link
                  </button>
                  <button
                    onClick={() => {
                      setShowQr(showQr === 'viewer' ? false : 'viewer');
                      if (showQr !== 'viewer') showInfo('📱 Viewer QR code displayed');
                    }}
                    className="bg-semantic-success hover:bg-green-700 text-white font-medium px-3 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                  >
                    <QrCode className="w-4 h-4" />
                    Viewer QR
                  </button>
                </div>
                
                {showQr === 'viewer' && (
                  <div className="bg-white rounded-lg p-4 text-center border border-semantic-success/30">
                    <QRCode key={`${inviteLink}/viewer`} value={`${inviteLink}/viewer`} size={150} className="mx-auto mb-2" />
                    <p className="text-xs text-semantic-success font-medium">🟢 VIEWER ACCESS QR CODE</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step 5: Staff & Access Control */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">5</div>
            <h2 className="text-lg font-semibold text-gray-900">Staff & Access Control</h2>
          </div>
          
          <StaffManagement leagueId={selectedLeagueId} currentUser={user} />
        </div>

        {/* Step 6: Danger Zone - Advanced Options */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-red-300 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">⚠️</div>
            <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
          </div>
          
          <p className="text-sm text-gray-600 mb-6">
            These actions are destructive and cannot be easily undone. Use with extreme caution.
          </p>

          <div className="space-y-6">
            {/* Reset Player Data Section */}
            <div className="bg-orange-50/50 border border-orange-200 rounded-lg p-4">
              <h3 className="font-medium text-orange-700 mb-2 flex items-center gap-2">
                <RefreshCcw className="w-4 h-4 text-orange-600" />
                Reset Player Data
              </h3>
              <p className="text-orange-700/90 text-sm mb-3">
                ⚠️ This will permanently delete all player data for this event. The event itself will remain. Use only for testing or starting over.
              </p>
              
              <div className="space-y-3">
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type 'RESET' to confirm"
                  className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                
                <button
                  onClick={handleReset}
                  disabled={confirmInput !== "RESET" || status === "loading"}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition"
                >
                  {status === "loading" ? "Resetting..." : "Reset Player Data Only"}
                </button>
                
                {status === "success" && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
                    ✅ Player data has been reset successfully.
                  </div>
                )}
                
                {status === "error" && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    ❌ {errorMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-red-200"></div>

            {/* Delete Entire Event Section */}
            <div className="bg-red-50/50 border-2 border-red-300 rounded-lg p-4">
              <h3 className="font-bold text-red-700 mb-2 flex items-center gap-2 text-lg">
                🗑️ Delete Entire Event
              </h3>
              <p className="text-red-700 text-sm mb-4">
                <strong>EXTREME CAUTION:</strong> This permanently deletes the entire event including all players, scores, and settings. This action is intentionally difficult to prevent accidents.
              </p>
              
              <DeleteEventFlow 
                event={eventSnapshot}
                isCurrentlySelected={true}  // Always true when in Event Setup
                onSuccess={() => {
                  // Navigate away after successful deletion
                  if (onBack) onBack();
                }}
              />
            </div>
          </div>
        </div>

        {/* Edit Event Modal */}
        {showEditEventModal && (
          <EditEventModal
            open={showEditEventModal}
            event={eventSnapshot}
            onClose={() => setShowEditEventModal(false)}
            onUpdated={() => {
              setShowEditEventModal(false);
              // Refresh event data if needed
            }}
          />
        )}

        {/* Import Results Modal - SINGLE CANONICAL IMPORTER */}
        {showImportModal && (
          <ImportResultsModal
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              setShowImportModal(false);
              cacheInvalidation.playersUpdated(selectedEvent.id);
              fetchPlayerCount();
              showSuccess(`✅ Players imported successfully!`);
              // Redirect to Players page
              setTimeout(() => {
                navigate('/players?tab=manage');
              }, 1500);
            }}
            // Guided flow: Show "Import Goal" selector first (default showModeSwitch=true)
            // initialMode="create_or_update" is the default
            // intent="roster_and_scores" is the default
            // availableDrills will be fetched from server automatically
          />
        )}

        {/* Add Player Modal - SINGLE CANONICAL MANUAL ADD */}
        {showAddPlayerModal && (
          <AddPlayerModal
            allPlayers={players}
            onClose={() => setShowAddPlayerModal(false)}
            onSave={() => {
              setShowAddPlayerModal(false);
              cacheInvalidation.playersUpdated(selectedEvent.id);
              fetchPlayerCount();
            }}
          />
        )}
      </div>
    </div>
  );
}
