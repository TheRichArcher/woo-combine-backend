import React, { useState } from 'react';
import { Lock, Unlock, AlertTriangle, CheckCircle, Loader2, Shield } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { useEvent } from '../context/EventContext';

export default function CombineLockControl({ leagueId, event }) {
  const [isLocking, setIsLocking] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const { showSuccess, showError } = useToast();
  const { refreshEvents } = useEvent();

  const isLocked = event?.isLocked || false;
  const eventId = event?.id;
  const eventName = event?.name || 'this event';

  const handleToggleLock = async () => {
    if (!eventId || !leagueId) {
      showError('Missing event or league information');
      return;
    }

    // If locking, show confirmation
    if (!isLocked && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    try {
      setIsLocking(true);

      const payload = {
        isLocked: !isLocked,
        reason: lockReason || undefined
      };

      console.log('[LOCK] Sending lock toggle request:', {
        eventId,
        leagueId,
        currentState: isLocked,
        newState: !isLocked,
        endpoint: `/leagues/${leagueId}/events/${eventId}/lock`
      });

      const response = await api.patch(`/leagues/${leagueId}/events/${eventId}/lock`, payload);
      
      console.log('[LOCK] Backend response:', {
        isLocked: response.data?.isLocked,
        changed: response.data?.changed,
        verified: response.data?.verified,
        message: response.data?.message
      });

      showSuccess(
        !isLocked 
          ? 'Combine locked successfully. Only organizers can now make edits.' 
          : 'Combine unlocked. Coaches can now edit scores and players (based on their individual permissions).'
      );

      // Refresh event data
      console.log('[LOCK] Calling refreshEvents() to sync UI...');
      await refreshEvents();
      console.log('[LOCK] refreshEvents() completed');

      // Reset state
      setShowConfirmation(false);
      setLockReason('');

    } catch (err) {
      console.error('[LOCK] Failed to toggle lock:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to update combine lock status';
      showError(errorMsg);
    } finally {
      setIsLocking(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-900 mb-2">
              Lock Combine Results?
            </h3>
            <div className="text-sm text-red-800 space-y-2 mb-4">
              <p className="font-medium">This will:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Prevent <strong>all coaches</strong> from editing scores, players, or drills</li>
                <li>Make all non-organizers <strong>read-only</strong> regardless of individual permissions</li>
                <li>Signal that results are <strong>official and final</strong></li>
              </ul>
              <p className="mt-3 font-medium">
                <Shield className="w-4 h-4 inline mr-1" />
                You (organizer) will retain full access to make corrections if needed.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-red-900 mb-2">
                Reason for locking (optional):
              </label>
              <input
                type="text"
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="e.g., Combine complete, results published"
                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                maxLength={100}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleToggleLock}
                disabled={isLocking}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLocking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Locking...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Yes, Lock Combine
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setLockReason('');
                }}
                disabled={isLocking}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-2 rounded-lg p-6 ${
      isLocked 
        ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300' 
        : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full ${
          isLocked ? 'bg-red-100' : 'bg-green-100'
        }`}>
          {isLocked ? (
            <Lock className="w-6 h-6 text-red-600" />
          ) : (
            <Unlock className="w-6 h-6 text-green-600" />
          )}
        </div>
        
        <div className="flex-1">
          <h3 className={`text-lg font-bold mb-2 ${
            isLocked ? 'text-red-900' : 'text-green-900'
          }`}>
            {isLocked ? '🔒 Combine Results Locked' : '🔓 Combine Results Unlocked'}
          </h3>
          
          <div className={`text-sm mb-4 ${
            isLocked ? 'text-red-800' : 'text-green-800'
          }`}>
            {isLocked ? (
              <>
                <p className="font-medium mb-2">Current Status:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>All coaches are <strong>read-only</strong></li>
                  <li>Scores, players, and drills cannot be edited by non-organizers</li>
                  <li>Results are marked as <strong>official and final</strong></li>
                </ul>
                <p className="mt-3 flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  You can still make corrections as an organizer.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium mb-2">Current Status:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Coaches can edit based on their individual permissions</li>
                  <li>Scores and players can be modified during the combine</li>
                  <li>Results are still being collected</li>
                </ul>
                <p className="mt-3 font-medium">
                  Lock the combine when scoring is complete and results are final.
                </p>
              </>
            )}
          </div>

          <button
            onClick={handleToggleLock}
            disabled={isLocking}
            className={`w-full font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50 ${
              isLocked
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isLocking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isLocked ? 'Unlocking...' : 'Locking...'}
              </>
            ) : (
              <>
                {isLocked ? (
                  <>
                    <Unlock className="w-5 h-5" />
                    Unlock Combine Results
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Lock Combine Results
                  </>
                )}
              </>
            )}
          </button>
          
          {isLocked && event?.lock_updated_at && (
            <p className="mt-3 text-xs text-gray-600 text-center">
              Locked on {new Date(event.lock_updated_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

