import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import LoadingScreen from './LoadingScreen';
import { getInviteHydrationState } from '../lib/inviteHydrationState';
import { logSelectRoleRedirect } from '../lib/selectRoleRedirectDebug';

const isQrDebugEnabled = () => {
  try {
    return localStorage.getItem('debug_qr_flow') === '1';
  } catch {
    return false;
  }
};

const qrGateDebug = (message, payload) => {
  if (!isQrDebugEnabled()) return;
  console.log(`[QR_FLOW][RouteDecisionGate] ${message}`, payload);
};

const LAST_REDIRECT_KEY = 'debug_qr_last_redirect_reason';

const writeLastRedirectReason = (reasonPayload) => {
  try {
    const serialized = JSON.stringify(reasonPayload);
    localStorage.setItem(LAST_REDIRECT_KEY, serialized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('qr-flow-redirect-reason', { detail: reasonPayload }));
    }
  } catch {
    // best-effort debug write
  }
};

const getStorageSnapshot = () => {
  try {
    return {
      selectedLeagueId: localStorage.getItem('selectedLeagueId') || null,
      selectedEventRaw: localStorage.getItem('selectedEvent') || null
    };
  } catch {
    return {
      selectedLeagueId: null,
      selectedEventRaw: null
    };
  }
};

const getPendingJoinPath = () => {
  try {
    const pendingEventJoin = localStorage.getItem('pendingEventJoin');
    if (!pendingEventJoin) return null;
    const safePath = pendingEventJoin
      .split('/')
      .map(part => encodeURIComponent(part))
      .join('/');
    return `/join-event/${safePath}`;
  } catch {
    return null;
  }
};

const isInviteJoinHydrating = () => {
  try {
    return localStorage.getItem('inviteJoinInProgress') === '1';
  } catch {
    return false;
  }
};

  const hasPendingJoin = () => Boolean(getPendingJoinPath());

/**
 * RouteDecisionGate - Centralized routing logic to prevent flicker
 *
 * This component waits for ALL app state to hydrate before rendering route children.
 * It makes ONE routing decision instead of allowing multiple components to navigate
 * independently during initialization, which causes screen flashing.
 *
 * State Dependencies:
 * - authChecked: Firebase auth initialized
 * - roleChecked: User role fetched from backend
 * - leaguesLoading: Leagues fetch completed (or determined empty)
 * - eventsLoaded: Events fetch completed (or determined empty)
 *
 * Safety:
 * - 30s timeout: if eventsLoaded never resolves, route to /login to avoid endless spinner
 */
export default function RouteDecisionGate({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    user, 
    userRole, 
    authChecked, 
    roleChecked, 
    initializing,
    selectedLeagueId,
    leagues,
    leaguesLoading 
  } = useAuth();
  const { 
    selectedEvent, 
    eventsLoaded, 
    loading: eventsLoading,
    noLeague 
  } = useEvent();
  
  const [isReady, setIsReady] = useState(false);
  const [decisionMade, setDecisionMade] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  // Timeout state: true = gate timed out, route to login
  const [gateTimedOut, setGateTimedOut] = useState(false);
  const navigationAttempted = useRef(false);
  const targetRoute = useRef(null);
  const gateTimeoutRef = useRef(null);
  const logPrefix = '[RouteDecisionGate]';
  const inviteHydrationRole = getInviteHydrationState()?.role || null;
  const effectiveUserRole = userRole || inviteHydrationRole || null;
  const hasSelectedEventContext = Boolean(selectedLeagueId && selectedEvent);
  const isViewerEventContext = effectiveUserRole === 'viewer' && !!selectedEvent;

  const buildDecisionState = () => ({
    pathname: location.pathname,
    userRole: effectiveUserRole || null,
    selectedLeagueId: selectedLeagueId || null,
    selectedEventId: selectedEvent?.id || null,
    leaguesLength: leagues?.length || 0,
    noLeague,
    hasSelectedEventContext,
    isViewerEventContext
  });

  // Routes that are always allowed (public/auth routes)
  const publicRoutes = [
    '/welcome',
    '/login',
    '/signup',
    '/verify-email',
    '/forgot-password',
    '/email-action',
    '/__/auth/action',
    '/__auth/action',
    '/help',
    '/terms',
    '/privacy',
    '/claim',
    '/workflow-demo'
  ];

  // Routes that need auth but not full state (role selection, join flows)
  const authOnlyRoutes = [
    '/select-role',
    '/mfa-enroll',
    '/coach-event-required'
  ];

  // Join event routes need special handling
  const isJoinEventRoute = location.pathname.startsWith('/join-event/');
  
  // Check if current route bypasses the gate
  const bypassGate = publicRoutes.includes(location.pathname) || 
                     authOnlyRoutes.includes(location.pathname) ||
                     isJoinEventRoute;

  // Comprehensive state logging
  useEffect(() => {
    qrGateDebug('Decision inputs', {
      ...buildDecisionState(),
      user: !!user,
      authChecked,
      roleChecked,
      initializing,
      leaguesLoading,
      eventsLoaded,
      eventsLoading,
      bypassGate,
      isReady,
      decisionMade,
      gateTimedOut
    });
    console.log(`${logPrefix} STATE:`, {
      ...buildDecisionState(),
      user: !!user,
      authChecked,
      roleChecked,
      initializing,
      leaguesLoading,
      eventsLoaded,
      eventsLoading,
      bypassGate,
      isReady,
      decisionMade,
      gateTimedOut
    });
  }, [
    location.pathname,
    user,
    effectiveUserRole,
    authChecked,
    roleChecked,
    initializing,
    selectedLeagueId,
    leagues,
    leaguesLoading,
    selectedEvent,
    eventsLoaded,
    eventsLoading,
    noLeague,
    bypassGate,
    isReady,
    decisionMade,
    gateTimedOut
  ]);

  // SAFETY TIMEOUT: If the gate is still waiting after 30s, give up and route to /login.
  // This prevents the app from spinning forever when eventsLoaded never resolves
  // due to repeated 401s, network issues, or other auth failures on startup.
  useEffect(() => {
    if (bypassGate || isReady || gateTimedOut) {
      if (gateTimeoutRef.current) {
        clearTimeout(gateTimeoutRef.current);
        gateTimeoutRef.current = null;
      }
      return;
    }

    // Only start the timeout once auth has at least completed its initial check
    if (!authChecked) return;

    if (gateTimeoutRef.current) return; // already armed

    console.log(`${logPrefix} TIMEOUT_ARMED: 30s safety timeout started`);
    gateTimeoutRef.current = setTimeout(() => {
      console.error(`${logPrefix} TIMEOUT_FIRED: Gate waited >30s for [eventsLoaded]. Routing to /login to prevent infinite spinner.`);
      setGateTimedOut(true);
      setIsReady(true); // unblock the gate
    }, 30000);

    return () => {
      if (gateTimeoutRef.current) {
        clearTimeout(gateTimeoutRef.current);
        gateTimeoutRef.current = null;
      }
    };
  }, [bypassGate, isReady, gateTimedOut, authChecked]);

  // Determine if all required state is ready
  useEffect(() => {
    // Always allow bypass routes immediately
    if (bypassGate) {
      console.log(`${logPrefix} BYPASS: Route ${location.pathname} bypasses gate`);
      setIsReady(true);
      setDecisionMade(true);
      return;
    }

    // CRITICAL FIX: Check minimal state first - if user has no role, don't wait for events
    const minimalStateReady = 
      authChecked &&
      roleChecked &&
      !initializing;

    if (minimalStateReady && !user) {
      console.log(`${logPrefix} MINIMAL_STATE_READY: No user, can redirect to welcome`);
      setIsReady(true);
      return;
    }

    if (minimalStateReady && !effectiveUserRole && isInviteJoinHydrating()) {
      console.log(`${logPrefix} MINIMAL_STATE_WAIT: Invite join hydration in progress, suppressing no-role redirect`);
      return;
    }

    if (minimalStateReady && !effectiveUserRole && !hasPendingJoin()) {
      console.log(`${logPrefix} MINIMAL_STATE_READY: No role and no invite, can redirect to select-role`);
      setIsReady(true);
      return;
    }

    if (minimalStateReady && !effectiveUserRole && hasPendingJoin()) {
      console.log(`${logPrefix} MINIMAL_STATE_READY: No role but pending invite exists, can redirect to join flow`);
      setIsReady(true);
      return;
    }

    // If user has a role, wait for full state including leagues and events
    const allStateReady = 
      minimalStateReady &&
      !leaguesLoading &&
      eventsLoaded;

    if (allStateReady) {
      console.log(`${logPrefix} ALL_STATE_READY: Proceeding with route decision`);
      setIsReady(true);
    } else {
      const waiting = [];
      if (!authChecked) waiting.push('authChecked');
      if (!roleChecked) waiting.push('roleChecked');
      if (initializing) waiting.push('!initializing');
      if (effectiveUserRole && leaguesLoading) waiting.push('!leaguesLoading');
      if (effectiveUserRole && !eventsLoaded) waiting.push('eventsLoaded');
      
      console.log(`${logPrefix} WAITING: Still waiting for [${waiting.join(', ')}]`);
    }
  }, [
    bypassGate, 
    authChecked, 
    roleChecked, 
    initializing, 
    leaguesLoading, 
    eventsLoaded,
    user,
    effectiveUserRole,
    location.pathname
  ]);

  // Make ONE routing decision when ready
  useEffect(() => {
    if (!isReady || decisionMade || navigationAttempted.current) {
      if (!isReady) {
        console.log(`${logPrefix} DECISION_BLOCKED: !isReady`);
      } else if (decisionMade) {
        console.log(`${logPrefix} DECISION_BLOCKED: decisionMade=true`);
      } else if (navigationAttempted.current) {
        console.log(`${logPrefix} DECISION_BLOCKED: navigationAttempted=true`);
      }
      return;
    }

    if (bypassGate) {
      console.log(`${logPrefix} DECISION_BLOCKED: bypassGate=true`);
      return;
    }

    console.log(`${logPrefix} ROUTE_DECISION: Making routing decision for ${location.pathname}`);
    const decisionState = buildDecisionState();
    const storageSnapshot = getStorageSnapshot();
    qrGateDebug('Evaluating route decision', {
      ...decisionState,
      storageSnapshot
    });
    console.log(`${logPrefix} ROUTE_DECISION_SNAPSHOT:`, {
      ...decisionState,
      storageSnapshot
    });

    const performNavigation = (to, reason) => {
      const redirectPayload = {
        reason,
        to,
        from: location.pathname,
        ...decisionState,
        storageSnapshot,
        timestamp: new Date().toISOString()
      };
      qrGateDebug('Redirect decision', redirectPayload);
      writeLastRedirectReason(redirectPayload);
      console.log(`${logPrefix} NAV_FROM: RouteDecisionGate → ${to} (${reason})`);
      navigationAttempted.current = true;
      targetRoute.current = to;
      setIsNavigating(true);
      navigate(to, { replace: true });
      setDecisionMade(true);
    };

    // TIMEOUT FALLBACK: gate gave up waiting — route safely based on auth state.
    if (gateTimedOut) {
      if (user) {
        console.warn(`${logPrefix} TIMEOUT_REDIRECT: Authenticated session timed out waiting for context, routing to /dashboard`);
        performNavigation('/dashboard', 'gate timeout with authenticated user');
      } else {
        console.warn(`${logPrefix} TIMEOUT_REDIRECT: Anonymous session timed out waiting for context, routing to /welcome`);
        performNavigation('/welcome', 'gate timeout without authenticated user');
      }
      return;
    }

    // Unauthenticated users → welcome
    if (!user) {
      performNavigation('/welcome', 'no user');
      return;
    }

    // Unverified email → verify page
    if (!user.emailVerified) {
      performNavigation('/verify-email', 'unverified');
      return;
    }

    // Invite-first sequencing: pending invite must route into join flow
    // before role-selection fallback to avoid onboarding dead-ends.
    const pendingJoinPath = getPendingJoinPath();
    if (pendingJoinPath && !location.pathname.startsWith('/join-event/')) {
      performNavigation(pendingJoinPath, 'pending invite requires join flow');
      return;
    }

    if (!effectiveUserRole && isInviteJoinHydrating()) {
      qrGateDebug('Suppressing no-role fallback during invite join hydration', buildDecisionState());
      return;
    }

    // No role + no invite → role selection
    if (!effectiveUserRole) {
      logSelectRoleRedirect({
        source: 'RouteDecisionGate',
        reason: 'no role and no pending invite',
        pathname: location.pathname,
        userRole: effectiveUserRole,
        leaguesLength: leagues?.length || 0,
        selectedLeagueId: selectedLeagueId || null,
        selectedEventId: selectedEvent?.id || null
      });
      performNavigation('/select-role', 'no role and no pending invite');
      return;
    }

    // Viewer context guard: never send viewer into staff-oriented /coach fallback shell.
    if (effectiveUserRole === 'viewer' && !selectedEvent) {
      if (!location.pathname.startsWith('/live-standings')) {
        performNavigation('/live-standings', 'viewer missing event context');
        return;
      }
    }

    // Coach onboarding guard: deny access to staff shell unless an event
    // context is selected. Coaches with no assigned events must join via invite.
    if (
      effectiveUserRole === 'coach' &&
      selectedLeagueId &&
      !selectedEvent &&
      location.pathname !== '/coach-event-required'
    ) {
      const pendingJoinPath = getPendingJoinPath();
      if (pendingJoinPath) {
        performNavigation(pendingJoinPath, 'coach missing event context, recover pending join');
        return;
      }
      performNavigation('/coach-event-required', 'coach missing event context');
      return;
    }

    // No league context → needs league selection or creation (staff roles only)
    if (effectiveUserRole !== 'viewer' && !hasSelectedEventContext && !isViewerEventContext && (!selectedLeagueId || noLeague || !leagues || leagues.length === 0)) {
      const protectedRoutes = ['/dashboard', '/players', '/admin', '/live-entry', '/coach', '/analytics', '/scorecards', '/team-formation', '/evaluators', '/sport-templates', '/event-sharing', '/live-standings', '/schedule'];
      
      if (protectedRoutes.some(route => location.pathname.startsWith(route))) {
        const pendingJoinPath = getPendingJoinPath();
        if (pendingJoinPath) {
          performNavigation(pendingJoinPath, 'recover pending QR join with missing context');
          return;
        }
        if (effectiveUserRole === 'coach') {
          performNavigation('/coach-event-required', 'coach missing required event assignment');
          return;
        }
        performNavigation('/select-league', 'no league selected');
        return;
      }
    }

    // Has league, check for event requirement
    if (selectedLeagueId && !selectedEvent) {
      const needsEvent = ['/players', '/admin', '/live-entry', '/scorecards', '/analytics'].some(
        route => location.pathname.startsWith(route)
      );
      
      if (needsEvent) {
        performNavigation('/coach', 'no event selected');
        return;
      }
    }

    qrGateDebug('Route valid; no redirect', buildDecisionState());
    console.log(`${logPrefix} ROUTE_VALID: ${location.pathname} is valid, rendering content`);
    setDecisionMade(true);

  }, [
    isReady, 
    decisionMade, 
    bypassGate,
    gateTimedOut,
    user,
    effectiveUserRole,
    selectedLeagueId,
    noLeague,
    leagues,
    selectedEvent,
    location.pathname,
    navigate
  ]);

  // Detect when navigation completes
  useEffect(() => {
    if (isNavigating && targetRoute.current && location.pathname === targetRoute.current) {
      console.log(`${logPrefix} NAVIGATION_COMPLETE: Reached target route ${targetRoute.current}`);
      setIsNavigating(false);
      targetRoute.current = null;
    }
  }, [location.pathname, isNavigating]);

  // Show loading screen while waiting for state OR while navigating
  if (!isReady || !decisionMade || isNavigating) {
    return (
      <LoadingScreen
        title="Loading Dashboard..."
        subtitle="Preparing your workspace"
        size="large"
        showProgress={true}
      />
    );
  }

  console.log(`${logPrefix} RENDER_CHILDREN: Rendering route children for ${location.pathname}`);
  return children;
}
