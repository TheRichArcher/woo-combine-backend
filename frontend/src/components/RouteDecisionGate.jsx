import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import LoadingScreen from './LoadingScreen';

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
  const navigationAttempted = useRef(false);
  const logPrefix = '[RouteDecisionGate]';

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
    '/mfa-enroll'
  ];

  // Join event routes need special handling
  const isJoinEventRoute = location.pathname.startsWith('/join-event/');
  
  // Check if current route bypasses the gate
  const bypassGate = publicRoutes.includes(location.pathname) || 
                     authOnlyRoutes.includes(location.pathname) ||
                     isJoinEventRoute;

  // Comprehensive state logging
  useEffect(() => {
    const state = {
      pathname: location.pathname,
      user: !!user,
      userRole,
      authChecked,
      roleChecked,
      initializing,
      selectedLeagueId,
      leaguesCount: leagues?.length || 0,
      leaguesLoading,
      selectedEvent: !!selectedEvent,
      eventsLoaded,
      eventsLoading,
      noLeague,
      bypassGate,
      isReady,
      decisionMade
    };
    
    console.log(`${logPrefix} STATE:`, state);
  }, [
    location.pathname,
    user,
    userRole,
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
    decisionMade
  ]);

  // Determine if all required state is ready
  useEffect(() => {
    // Always allow bypass routes immediately
    if (bypassGate) {
      console.log(`${logPrefix} BYPASS: Route ${location.pathname} bypasses gate`);
      setIsReady(true);
      setDecisionMade(true);
      return;
    }

    // Check if all required state is ready
    const allStateReady = 
      authChecked &&          // Firebase auth checked
      roleChecked &&          // Backend role fetched
      !initializing &&        // Auth initialization complete
      !leaguesLoading &&      // Leagues fetch complete
      eventsLoaded;           // Events fetch complete (even if empty)

    if (allStateReady) {
      console.log(`${logPrefix} ALL_STATE_READY: Proceeding with route decision`);
      setIsReady(true);
    } else {
      const waiting = [];
      if (!authChecked) waiting.push('authChecked');
      if (!roleChecked) waiting.push('roleChecked');
      if (initializing) waiting.push('!initializing');
      if (leaguesLoading) waiting.push('!leaguesLoading');
      if (!eventsLoaded) waiting.push('eventsLoaded');
      
      console.log(`${logPrefix} WAITING: Still waiting for [${waiting.join(', ')}]`);
    }
  }, [
    bypassGate, 
    authChecked, 
    roleChecked, 
    initializing, 
    leaguesLoading, 
    eventsLoaded,
    location.pathname
  ]);

  // Make ONE routing decision when ready
  useEffect(() => {
    if (!isReady || decisionMade || navigationAttempted.current) {
      return;
    }

    // Don't navigate if we're on a bypass route
    if (bypassGate) {
      return;
    }

    console.log(`${logPrefix} ROUTE_DECISION: Making routing decision for ${location.pathname}`);

    // Unauthenticated users → welcome
    if (!user) {
      console.log(`${logPrefix} NAV_FROM: RouteDecisionGate → /welcome (no user)`);
      navigationAttempted.current = true;
      navigate('/welcome', { replace: true });
      setDecisionMade(true);
      return;
    }

    // Unverified email → verify page
    if (!user.emailVerified) {
      console.log(`${logPrefix} NAV_FROM: RouteDecisionGate → /verify-email (unverified)`);
      navigationAttempted.current = true;
      navigate('/verify-email', { replace: true });
      setDecisionMade(true);
      return;
    }

    // No role → role selection
    if (!userRole) {
      console.log(`${logPrefix} NAV_FROM: RouteDecisionGate → /select-role (no role)`);
      navigationAttempted.current = true;
      navigate('/select-role', { replace: true });
      setDecisionMade(true);
      return;
    }

    // At this point: user is authenticated, verified, and has a role
    // Determine their landing page based on leagues/events

    // No league context → needs league selection or creation
    if (!selectedLeagueId || noLeague || !leagues || leagues.length === 0) {
      // Only redirect if they're trying to access a protected page
      const protectedRoutes = ['/dashboard', '/players', '/admin', '/live-entry', '/coach', '/analytics', '/scorecards', '/team-formation', '/evaluators', '/sport-templates', '/event-sharing', '/live-standings', '/schedule'];
      
      if (protectedRoutes.some(route => location.pathname.startsWith(route))) {
        console.log(`${logPrefix} NAV_FROM: RouteDecisionGate → /dashboard (no league, will show fallback)`);
        navigationAttempted.current = true;
        navigate('/dashboard', { replace: true });
        setDecisionMade(true);
        return;
      }
    }

    // Has league, check for event requirement
    if (selectedLeagueId && !selectedEvent) {
      const needsEvent = ['/players', '/admin', '/live-entry', '/scorecards', '/analytics'].some(
        route => location.pathname.startsWith(route)
      );
      
      if (needsEvent) {
        console.log(`${logPrefix} NAV_FROM: RouteDecisionGate → /dashboard (no event selected)`);
        navigationAttempted.current = true;
        navigate('/dashboard', { replace: true });
        setDecisionMade(true);
        return;
      }
    }

    // Special handling: Organizers and coaches should land on /coach dashboard
    if ((userRole === 'organizer' || userRole === 'coach') && location.pathname === '/dashboard') {
      console.log(`${logPrefix} NAV_FROM: RouteDecisionGate → /coach (${userRole} default dashboard)`);
      navigationAttempted.current = true;
      navigate('/coach', { replace: true });
      setDecisionMade(true);
      return;
    }

    // If we're here, state is ready and current route is valid
    console.log(`${logPrefix} ROUTE_VALID: ${location.pathname} is valid, rendering content`);
    setDecisionMade(true);

  }, [
    isReady, 
    decisionMade, 
    bypassGate,
    user,
    userRole,
    selectedLeagueId,
    noLeague,
    leagues,
    selectedEvent,
    location.pathname,
    navigate
  ]);

  // Show loading screen while waiting for state OR while navigating
  if (!isReady || !decisionMade) {
    return (
      <LoadingScreen
        title="Loading Dashboard..."
        subtitle="Preparing your workspace"
        size="large"
        showProgress={true}
      />
    );
  }

  // State is ready and decision made → render children
  console.log(`${logPrefix} RENDER_CHILDREN: Rendering route children for ${location.pathname}`);
  return children;
}

