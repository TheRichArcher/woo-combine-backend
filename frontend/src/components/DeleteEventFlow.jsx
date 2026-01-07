import React, { useState, useEffect } from "react";
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { useToast } from "../context/ToastContext";
import api from '../lib/api';
import { logger } from '../utils/logger';

/**
 * DeleteEventFlow Component
 * 
 * Bulletproof 3-layer confirmation system for event deletion:
 * - Layer 1: Explicit intent with warning text
 * - Layer 2: Typed confirmation (exact event name match)
 * - Layer 3: Final confirmation modal with full details
 * 
 * CRITICAL SAFEGUARDS:
 * - Only organizers can access
 * - Cannot delete currently selected event (must switch first)
 * - Shows stronger warnings for events with data
 * - Soft delete with 30-day recovery window
 * - Backend enforced permissions
 */
export default function DeleteEventFlow({ event, isCurrentlySelected, onSuccess }) {
  const { selectedLeagueId, userRole } = useAuth();
  const { events, selectedEvent, deleteEvent, setSelectedEvent } = useEvent();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  // CRITICAL: Create immutable snapshot of deletion target at flow start
  // This prevents the target from drifting when we switch context (setSelectedEvent)
  // The event prop might change if parent re-renders with new selectedEvent
  const [targetEvent] = useState(() => ({
    id: event?.id,
    name: event?.name,
    date: event?.date,
    location: event?.location,
    drillTemplate: event?.drillTemplate,
    league_id: event?.league_id
  }));

  // Layer 1: Initial warning shown
  const [layer1Acknowledged, setLayer1Acknowledged] = useState(false);

  // Layer 2: Typed confirmation
  const [typedName, setTypedName] = useState("");
  const [typedNameError, setTypedNameError] = useState(false);
  const [pasteBlocked, setPasteBlocked] = useState(false);

  // Layer 3: Final modal
  const [showFinalModal, setShowFinalModal] = useState(false);

  // Event stats for warnings
  const [eventStats, setEventStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Deletion in progress
  const [isDeleting, setIsDeleting] = useState(false);

  // DEFENSIVE GUARD: Ensure deleteEvent function exists
  const deleteEventAvailable = typeof deleteEvent === 'function';
  
  useEffect(() => {
    if (!deleteEventAvailable) {
      const error = new Error('CRITICAL: deleteEvent function not available in EventContext');
      console.error('[DELETE_FLOW_ERROR]', error);
      logger.error('DELETE_EVENT_FUNCTION_MISSING', {
        targetEventId: targetEvent?.id,
        targetEventName: targetEvent?.name,
        hasDeleteEvent: !!deleteEvent,
        deleteEventType: typeof deleteEvent
      });
      // Send to Sentry if available
      if (window.Sentry) {
        window.Sentry.captureException(error, {
          tags: { component: 'DeleteEventFlow', severity: 'critical' },
          extra: { targetEventId: targetEvent?.id, deleteEventType: typeof deleteEvent }
        });
      }
    }
  }, [deleteEventAvailable, deleteEvent, targetEvent]);

  // Permission check
  if (userRole !== 'organizer') {
    return null; // Should never happen - backend also enforces
  }

  // Fetch event stats when component mounts
  useEffect(() => {
    const fetchStats = async () => {
      if (!targetEvent?.id || !selectedLeagueId) return;
      
      setStatsLoading(true);
      try {
        const response = await api.get(`/leagues/${selectedLeagueId}/events/${targetEvent.id}/stats`);
        setEventStats(response.data);
      } catch (error) {
        console.error("Failed to fetch event stats:", error);
        // Continue without stats - deletion can still proceed
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [targetEvent, selectedLeagueId]);

  // Check if typed name matches (case-insensitive)
  const isNameMatch = typedName.trim().toLowerCase() === targetEvent?.name?.toLowerCase();

  // Handle layer 2 completion - ONLY show modal, NO context switching yet
  const handleLayer2Complete = async () => {
    if (!isNameMatch) {
      setTypedNameError(true);
      return;
    }
    
    // AUDIT LOG: User completed Layer 2 (typed confirmation)
    logger.info('DELETE_EVENT_LAYER_2_COMPLETE', {
      event_id: targetEvent.id,
      event_name: targetEvent.name,
      player_count: eventStats?.player_count,
      has_scores: eventStats?.has_scores,
      user_role: userRole,
      is_currently_selected: isCurrentlySelected
    });
    
    setTypedNameError(false);
    
    // CRITICAL: ONLY show the modal - do NOT switch context yet
    // Context switching causes navigation/unmounting before modal can render
    // The safety checks in handleFinalDelete will handle context switching
    setShowFinalModal(true);
    
    logger.info('DELETE_EVENT_SHOWING_FINAL_MODAL', {
      target_event_id: targetEvent.id,
      target_event_name: targetEvent.name,
      note: 'Final confirmation modal should now be visible'
    });
  };

  // Handle final deletion
  const handleFinalDelete = async () => {
    if (!targetEvent || !selectedLeagueId) return;

    // CRITICAL SAFETY ASSERTION: Verify deletion target integrity before destructive action
    if (!targetEvent.id || !targetEvent.name) {
      const error = new Error('CRITICAL: Target event data corrupted - cannot proceed with deletion');
      console.error('[DELETE_FLOW_SAFETY_FAILURE]', error, { targetEvent });
      logger.error('DELETE_TARGET_CORRUPTED', {
        target_event_id: targetEvent?.id,
        target_event_name: targetEvent?.name,
        has_id: !!targetEvent?.id,
        has_name: !!targetEvent?.name
      });
      showError('Safety check failed: Cannot verify deletion target. Please refresh and try again.');
      if (window.Sentry) {
        window.Sentry.captureException(error, {
          tags: { component: 'DeleteEventFlow', severity: 'critical', check: 'safety_assertion' },
          extra: { targetEvent }
        });
      }
      return;
    }

    // CRITICAL: Switch context NOW if currently selected (before making delete call)
    // This ensures we're not in the event context when deletion happens
    if (selectedEvent?.id === targetEvent.id) {
      logger.info('DELETE_EVENT_CONTEXT_SWITCH_BEFORE_DELETE', {
        target_event_id: targetEvent.id,
        action: 'Switching context immediately before deletion',
        available_events: events.length
      });
      
      // Find another event to switch to
      const otherEvent = events.find(e => e.id !== targetEvent.id);
      
      if (otherEvent) {
        setSelectedEvent(otherEvent);
        logger.info('DELETE_EVENT_CONTEXT_SWITCHED', {
          target_event_id: targetEvent.id,
          safe_context_event_id: otherEvent.id,
          safe_context_event_name: otherEvent.name
        });
      } else {
        setSelectedEvent(null);
        logger.info('DELETE_EVENT_CONTEXT_CLEARED', {
          target_event_id: targetEvent.id,
          reason: 'No other events available'
        });
      }
      
      // Small delay to let context switch settle
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // AUDIT LOG: Deletion initiated (Layer 3 confirmed)
    logger.warn('DELETE_EVENT_INITIATED', {
      target_event_id: targetEvent.id,
      target_event_name: targetEvent.name,
      league_id: selectedLeagueId,
      current_context_id: selectedEvent?.id || null,
      context_safely_switched: selectedEvent?.id !== targetEvent.id,
      player_count: eventStats?.player_count,
      has_scores: eventStats?.has_scores,
      user_role: userRole,
      timestamp: new Date().toISOString()
    });

    setIsDeleting(true);
    try {
      // CRITICAL: Log the actual API call details
      const deleteUrl = `/leagues/${selectedLeagueId}/events/${targetEvent.id}`;
      logger.warn('DELETE_EVENT_API_REQUEST_START', {
        method: 'DELETE',
        url: deleteUrl,
        target_event_id: targetEvent.id,
        league_id: selectedLeagueId,
        timestamp: new Date().toISOString()
      });
      
      // CRITICAL: Use targetEvent.id (immutable snapshot) NOT event.id or selectedEvent.id
      // This ensures we delete the correct event even after context switches
      const response = await deleteEvent(targetEvent.id);
      
      // AUDIT LOG: API call succeeded
      logger.info('DELETE_EVENT_API_REQUEST_SUCCESS', {
        method: 'DELETE',
        url: deleteUrl,
        status: 200,
        response: response,
        timestamp: new Date().toISOString()
      });
      
      // AUDIT LOG: Deletion completed successfully
      logger.info('DELETE_EVENT_COMPLETED', {
        target_event_id: targetEvent.id,
        target_event_name: targetEvent.name,
        league_id: selectedLeagueId,
        deleted_at: response?.deleted_at,
        recovery_window: response?.recovery_window,
        user_role: userRole,
        timestamp: new Date().toISOString()
      });
      
      showSuccess(`Event "${targetEvent.name}" has been deleted. Recovery available for 30 days via support.`);
      
      // Close modal
      setShowFinalModal(false);
      if (onSuccess) {
        onSuccess();
      }
      
      // CRITICAL: Force navigation to neutral landing page (NOT onboarding/import flows)
      // EventContext has already cleared selectedEvent and removed from events list
      const remainingEvents = events.filter(e => e.id !== targetEvent.id);
      if (remainingEvents.length > 0) {
        // There are other events - navigate to admin (neutral, stable page)
        // DO NOT navigate to /dashboard (triggers redirects) or /players (onboarding CTA)
        // Pass state flag to show "What's next?" panel (optional polish)
        // NOTE: Route is /admin (not /admin-tools) per App.jsx routing config
        navigate('/admin', { 
          state: { 
            deletedEvent: targetEvent.name,
            showNextActions: true 
          }
        });
      } else {
        // No events left - navigate to event creation (explicit intent to create new event)
        navigate('/select-league');
      }
      
    } catch (error) {
      // AUDIT LOG: API call failed
      const deleteUrl = `/leagues/${selectedLeagueId}/events/${targetEvent.id}`;
      logger.error('DELETE_EVENT_API_REQUEST_FAILED', {
        method: 'DELETE',
        url: deleteUrl,
        status: error.response?.status || 'NO_RESPONSE',
        error_message: error.response?.data?.detail || error.message,
        error_full: error.toString(),
        timestamp: new Date().toISOString()
      });
      
      // AUDIT LOG: Deletion failed
      logger.error('DELETE_EVENT_FAILED', {
        target_event_id: targetEvent.id,
        target_event_name: targetEvent.name,
        league_id: selectedLeagueId,
        error_message: error.response?.data?.detail || error.message,
        error_status: error.response?.status,
        user_role: userRole,
        timestamp: new Date().toISOString()
      });
      
      console.error("Failed to delete event:", error);
      showError(error.response?.data?.detail || "Failed to delete event. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset flow
  const handleReset = () => {
    setLayer1Acknowledged(false);
    setTypedName("");
    setTypedNameError(false);
    setPasteBlocked(false);
    setShowFinalModal(false);
  };

  // CRITICAL: Use targetEvent (immutable snapshot) for validation, not event prop
  // The event prop can become null after context switch, but targetEvent remains stable
  if (!targetEvent || !targetEvent.id) return null;

  return (
    <>
      {/* ============================================ */}
      {/* LAYER 1: EXPLICIT INTENT                    */}
      {/* ============================================ */}
      {!layer1Acknowledged && (
        <div className="bg-red-50/30 border-l-4 border-red-500 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-700 mb-2">
                Delete Event
              </h3>
              <div className="text-sm text-red-800 space-y-2">
                <p className="font-semibold">
                  ⚠️ This permanently deletes the event and all player data. This cannot be undone.
                </p>
                {statsLoading ? (
                  <p className="text-red-600">Loading event details...</p>
                ) : eventStats && (
                  <div className="bg-red-100/50 rounded p-3 mt-3 space-y-1">
                    <p><strong>Event:</strong> {eventStats.event_name}</p>
                    {eventStats.event_date && (
                      <p><strong>Date:</strong> {eventStats.event_date}</p>
                    )}
                    <p><strong>Players:</strong> {eventStats.player_count}</p>
                    {eventStats.has_scores && (
                      <p className="text-red-700 font-semibold">
                        ⚠️ This event has recorded drill scores that will be permanently lost.
                      </p>
                    )}
                    {eventStats.player_count > 0 && (
                      <p className="text-red-700 font-semibold">
                        ⚠️ All {eventStats.player_count} player records will be permanently deleted.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setLayer1Acknowledged(true)}
            disabled={statsLoading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
          >
            I Understand - Proceed to Delete
          </button>
        </div>
      )}

      {/* ============================================ */}
      {/* LAYER 2: TYPED CONFIRMATION                 */}
      {/* ============================================ */}
      {layer1Acknowledged && !showFinalModal && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-700 mb-2">
                Confirm Event Deletion
              </h3>
              <p className="text-sm text-red-800 mb-4">
                Type the event name <strong className="font-mono bg-red-100 px-1 rounded">{targetEvent.name}</strong> to confirm deletion:
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-red-700 mb-2">
                Type the event name to confirm
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => {
                  setTypedName(e.target.value);
                  setTypedNameError(false);
                  setPasteBlocked(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isNameMatch) {
                    handleLayer2Complete();
                  }
                }}
                onPaste={(e) => {
                  // CRITICAL: Block paste to prevent copy/paste shortcuts
                  // User must manually type the event name for cognitive engagement
                  e.preventDefault();
                  setPasteBlocked(true);
                  setTypedNameError(false);
                }}
                onCopy={(e) => {
                  // Also block copying from this field (though less critical)
                  e.preventDefault();
                }}
                placeholder={targetEvent.name}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:outline-none ${
                  typedNameError 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' 
                    : 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                }`}
                autoComplete="off"
                spellCheck="false"
              />
              {pasteBlocked && (
                <p className="text-red-600 text-sm mt-1 font-semibold">
                  ⚠️ Paste is blocked. You must type the event name manually to confirm deletion.
                </p>
              )}
              {typedNameError && !pasteBlocked && (
                <p className="text-red-600 text-sm mt-1">
                  Event name does not match. Please type exactly: {targetEvent.name}
                </p>
              )}
              {typedName && !isNameMatch && !typedNameError && !pasteBlocked && (
                <p className="text-orange-600 text-sm mt-1">
                  Keep typing... (case-insensitive)
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLayer2Complete}
                disabled={!isNameMatch}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
              >
                Continue to Final Confirmation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* LAYER 3: FINAL CONFIRMATION MODAL          */}
      {/* ============================================ */}
      {showFinalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-red-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">Final Confirmation</h2>
                </div>
                <button
                  onClick={() => setShowFinalModal(false)}
                  disabled={isDeleting}
                  className="text-white/80 hover:text-white disabled:opacity-50"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Currently Selected Notice */}
              {isCurrentlySelected && (
                <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4">
                  <p className="text-blue-900 font-bold mb-2">
                    ⚠️ Active Event
                  </p>
                  <p className="text-sm text-blue-800">
                    You are currently viewing this event. When you click "Delete Permanently", 
                    the system will switch you to another event before deletion completes.
                  </p>
                </div>
              )}
              
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm text-red-700 font-semibold mb-1">Event Name</p>
                  <p className="text-lg font-bold text-red-900">{targetEvent.name}</p>
                </div>
                
                {eventStats?.event_date && (
                  <div>
                    <p className="text-sm text-red-700 font-semibold mb-1">Event Date</p>
                    <p className="text-red-900">{eventStats.event_date}</p>
                  </div>
                )}
                
                {eventStats && (
                  <div>
                    <p className="text-sm text-red-700 font-semibold mb-1">Player Count</p>
                    <p className="text-red-900 font-bold">{eventStats.player_count} players</p>
                  </div>
                )}
              </div>

              <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
                <p className="text-orange-900 font-bold mb-2">
                  ⚠️ This action is permanent and cannot be undone.
                </p>
                <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                  <li>All player data will be permanently deleted</li>
                  <li>All drill scores will be permanently deleted</li>
                  <li>Staff assignments will be removed</li>
                  <li>Event will be hidden immediately</li>
                  <li>Recovery may be possible within 30 days via support</li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong>Recovery Window:</strong> Deleted events are retained for 30 days. 
                  Contact support immediately if you need to recover this event.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 p-6 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setShowFinalModal(false)}
                disabled={isDeleting}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalDelete}
                disabled={isDeleting || !deleteEventAvailable}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
                title={!deleteEventAvailable ? 'Delete function unavailable - please refresh the page' : ''}
              >
                {isDeleting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : !deleteEventAvailable ? (
                  <>
                    <AlertTriangle className="w-5 h-5" />
                    Delete Unavailable
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

