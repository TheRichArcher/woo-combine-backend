import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import LoadingScreen from './LoadingScreen';

// This component acts as a gatekeeper during the application "boot" process.
// It prevents the router from rendering any routes until all necessary contexts
// (Auth, Role, League, Events) are fully resolved.
// This prevents "flicker" where the user sees intermediate states (like Login page,
// then Dashboard with no data, then Dashboard with data) in rapid succession.
export default function BootGate({ children }) {
  const { status, user } = useAuth();
  const { loading: eventsLoading } = useEvent();
  const [longBoot, setLongBoot] = useState(false);

  // STATUS flow: IDLE -> INITIALIZING -> AUTHENTICATING -> FETCHING_CONTEXT -> READY (or UNAUTHENTICATED)
  const isAuthSettled = status === 'READY' || status === 'UNAUTHENTICATED';
  
  // If authenticated, we also want to wait for the initial event load to complete
  // so the dashboard doesn't flash "No Events" before loading them.
  // We only block on eventsLoading if we are actually logged in (status === READY).
  const isEventSettled = !user || !eventsLoading;

  const isBooting = !isAuthSettled || (status === 'READY' && !isEventSettled);

  // Debug logging for boot state
  useEffect(() => {
    if (isBooting) {
        // console.debug('[BootGate] Booting...', { status, eventsLoading });
    } else {
        // console.debug('[BootGate] Boot complete.', { status, eventsLoading });
    }
  }, [isBooting, status, eventsLoading]);

  // Handle long boot times (e.g. cold starts)
  useEffect(() => {
    let timer;
    if (isBooting) {
      timer = setTimeout(() => setLongBoot(true), 5000);
    } else {
      setLongBoot(false);
    }
    return () => clearTimeout(timer);
  }, [isBooting]);

  if (isBooting) {
    // Determine user-friendly message based on current boot stage
    let message = "Starting up...";
    if (status === 'AUTHENTICATING') message = "Verifying identity...";
    if (status === 'FETCHING_CONTEXT') message = "Loading your leagues...";
    if (status === 'READY' && eventsLoading) message = "Loading events...";
    
    // Pass showProgress for better UX during long waits
    return (
      <LoadingScreen 
        size="large" 
        message={message} 
        showProgress={longBoot || status === 'FETCHING_CONTEXT'}
        title="WooCombine"
      />
    );
  }

  // Once booted, render the children (Routes)
  return children;
}

