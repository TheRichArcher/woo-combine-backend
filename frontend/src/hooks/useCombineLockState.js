import { useState, useEffect, useCallback } from 'react';
import { useEvent } from '../context/EventContext';
import api from '../lib/api';
import { logger } from '../utils/logger';

/**
 * useCombineLockState Hook
 * 
 * Provides real-time combine lock state monitoring for coaches.
 * Automatically detects when an organizer locks the combine and updates UI accordingly.
 * 
 * Features:
 * - Polls event lock state every 15 seconds while page is active
 * - Re-fetches on window focus (user returns to tab)
 * - Detects 403 errors from score submissions (combine was locked mid-session)
 * - Returns lock state and helper functions
 * 
 * @returns {Object} {
 *   isLocked: boolean - Current combine lock status
 *   lockMessage: string - User-friendly lock message
 *   checkLockState: function - Manual lock state check
 *   handleSubmitError: function - Analyzes submission errors for lock-related issues
 * }
 */
export function useCombineLockState() {
  const { selectedEvent, refreshEvents } = useEvent();
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [lastCheck, setLastCheck] = useState(Date.now());

  /**
   * Check current lock state from backend
   * This fetches fresh event data and extracts the isLocked field
   */
  const checkLockState = useCallback(async () => {
    if (!selectedEvent?.id || !selectedEvent?.league_id) return;

    try {
      const response = await api.get(`/leagues/${selectedEvent.league_id}/events/${selectedEvent.id}`);
      const event = response.data;
      
      const locked = event?.isLocked || false;
      const message = locked 
        ? 'This combine has been locked by the organizer. Results are final and cannot be edited. Contact the organizer if corrections are needed.'
        : '';

      setIsLocked(locked);
      setLockMessage(message);
      setLastCheck(Date.now());
      
      logger.info('LOCK-STATE', `Checked lock state: ${locked}`);
      
      return locked;
    } catch (error) {
      logger.error('LOCK-STATE', 'Failed to check lock state', error);
      // Don't update state on error - keep last known state
      return null;
    }
  }, [selectedEvent?.id, selectedEvent?.league_id]);

  /**
   * Analyze submission errors to detect if combine was locked
   * Returns: { isLockError: boolean, userMessage: string }
   */
  const handleSubmitError = useCallback(async (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || '';

    // Check for lock-related errors (403 Forbidden with lock message)
    const isLockError = 
      status === 403 && 
      (detail.includes('locked') || 
       detail.includes('final') || 
       detail.includes('cannot be edited'));

    if (isLockError) {
      // Immediately refresh lock state
      await checkLockState();
      
      return {
        isLockError: true,
        userMessage: 'This combine has been locked. Results are final and cannot be edited. Contact the organizer if corrections are needed.'
      };
    }

    // Generic error
    return {
      isLockError: false,
      userMessage: 'Error submitting score. Please try again.'
    };
  }, [checkLockState]);

  // Poll lock state every 15 seconds while page is active
  useEffect(() => {
    if (!selectedEvent?.id) return;

    // Initial check
    checkLockState();

    // Set up polling interval
    const interval = setInterval(() => {
      checkLockState();
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [selectedEvent?.id, checkLockState]);

  // Re-check when window regains focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      // Only check if it's been more than 5 seconds since last check
      // Prevents duplicate checks when rapidly switching tabs
      if (Date.now() - lastCheck > 5000) {
        logger.info('LOCK-STATE', 'Window focused - checking lock state');
        checkLockState();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkLockState, lastCheck]);

  // Update from EventContext if it has fresher data
  useEffect(() => {
    if (selectedEvent?.isLocked !== undefined) {
      const locked = selectedEvent.isLocked || false;
      if (locked !== isLocked) {
        setIsLocked(locked);
        setLockMessage(locked 
          ? 'This combine has been locked by the organizer. Results are final and cannot be edited.'
          : ''
        );
        logger.info('LOCK-STATE', `Updated from EventContext: ${locked}`);
      }
    }
  }, [selectedEvent?.isLocked, isLocked]);

  return {
    isLocked,
    lockMessage,
    checkLockState,
    handleSubmitError
  };
}

