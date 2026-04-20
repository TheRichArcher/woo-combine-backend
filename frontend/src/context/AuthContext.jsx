import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut, getIdTokenResult } from "firebase/auth";
import api, { apiHealth, apiWarmup } from '../lib/api';
import { getMyLeagues } from '../lib/leagues';
import axios from 'axios';
import { useNavigate, useLocation } from "react-router-dom";

import { useToast } from './ToastContext';
import { authLogger } from '../utils/logger';
import { cacheInvalidation } from '../utils/dataCache';
import { fetchSchemas } from '../constants/drillTemplates';
import { VIEWER_INVITE_EVENT_CONTEXT_KEY } from '../lib/viewerInviteContext';
import { getInviteHydrationState, setInviteHydrationState, clearInviteHydrationState } from '../lib/inviteHydrationState';
import { logSelectRoleRedirect } from '../lib/selectRoleRedirectDebug';

const AuthContext = createContext();

// NOTE: This context is being gradually split into:
// - AuthContext (this file) — auth state, tokens, user
// - LeagueContext — league selection, data (see LeagueContext.jsx)
// - NavigationContext — nav state (see NavigationContext.jsx)
// New code should prefer useLeague() and useNav() where possible.
// useAuth() remains the backward-compatible facade exposing all state.

// Role utilities to avoid treating 'undefined'/'null' as valid roles
// Align with backend-accepted roles while keeping internal roles for UI/admin
const VALID_ROLES = ['organizer', 'coach', 'viewer', 'player', 'evaluator', 'admin'];
function sanitizeRole(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return VALID_ROLES.includes(trimmed) ? trimmed : null;
}

function isSafeInternalPath(path) {
  if (typeof path !== 'string') return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  return !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path);
}

const isQrDebugEnabled = () => {
  try {
    return localStorage.getItem('debug_qr_flow') === '1';
  } catch {
    return false;
  }
};

const qrAuthDebug = (message, payload) => {
  if (!isQrDebugEnabled()) return;
  console.log(`[QR_FLOW][AuthContext] ${message}`, payload);
};

const hasPendingInviteJoin = () => {
  try {
    const pendingInvite = localStorage.getItem('pendingEventJoin');
    return Boolean(pendingInvite && pendingInvite.trim());
  } catch {
    return false;
  }
};

const INVITE_JOIN_IN_PROGRESS_KEY = 'inviteJoinInProgress';

export function AuthProvider({ children }) {
  // Optimized state management with faster initial checks
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authChecked, setAuthChecked] = useState(false); // New: faster auth check
  const [roleChecked, setRoleChecked] = useState(false); // NEW: role verification complete
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueIdState] = useState(() => {
    const raw = localStorage.getItem('selectedLeagueId');
    if (!raw) return '';
    const trimmed = String(raw).trim();
    return trimmed === '' || trimmed === 'null' || trimmed === 'undefined' ? '' : trimmed;
  });
  const [role, setRole] = useState(null);
  const [userRole, setUserRole] = useState(() => {
    // Restore from localStorage, but ignore invalid values
    return sanitizeRole(localStorage.getItem('userRole'));
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { showColdStartNotification, isColdStartActive, showWarning } = useToast();
  
  // STATUS ENUM - State Machine Foundation (Milestone 1)
  const STATUS = {
    IDLE: 'IDLE',
    INITIALIZING: 'INITIALIZING', // Checking Firebase
    AUTHENTICATING: 'AUTHENTICATING', // Fetching DB Profile
    ROLE_REQUIRED: 'ROLE_REQUIRED', // User needs to select role
    FETCHING_CONTEXT: 'FETCHING_CONTEXT', // Loading Leagues
    READY: 'READY', // App is usable
    UNAUTHENTICATED: 'UNAUTHENTICATED' // Guest mode
  };
  const [status, setStatus] = useState(STATUS.IDLE);

  // Helper to log state transitions
  const transitionTo = useCallback((newStatus, reason = '') => {
    setStatus(prev => {
        if (prev !== newStatus) {
            authLogger.debug(`[AuthContext] State Transition: ${prev} -> ${newStatus} ${reason ? `(${reason})` : ''}`);
        }
        return newStatus;
    });
  }, []);

  // CRITICAL FIX: Prevent concurrent league fetches during cold start
  const [leagueFetchInProgress, setLeagueFetchInProgress] = useState(false);
  const [creatingDefaultLeague, setCreatingDefaultLeague] = useState(false);

  // Feature flag to control default league auto-creation during onboarding
  const AUTO_CREATE_DEFAULT_LEAGUE = false;

  const createDefaultLeagueIfNeeded = useCallback(async (firebaseUserParam, roleParam) => {
    try {
      if (creatingDefaultLeague) return;
      const effectiveRole = roleParam || userRole || role;
      if (effectiveRole !== 'organizer') return;
      // Only create if user has no leagues
      if (leagues && leagues.length > 0) return;
      setCreatingDefaultLeague(true);
      const defaultName = 'My First League';
      authLogger.info('AUTO-LEAGUE', `Creating default league: ${defaultName}`);
      const response = await api.post('/leagues', { name: defaultName });
      const newLeagueId = response?.data?.league_id;
      if (newLeagueId) {
        const newLeague = { id: newLeagueId, name: defaultName, role: 'organizer' };
        setLeagues([newLeague]);
        setSelectedLeagueIdState(newLeagueId);
        localStorage.setItem('selectedLeagueId', newLeagueId);
        authLogger.info('AUTO-LEAGUE', `Default league created: ${newLeagueId}`);
      }
    } catch (e) {
      authLogger.warn('AUTO-LEAGUE', `Default league creation failed: ${e.message}`);
    } finally {
      setCreatingDefaultLeague(false);
    }
  }, [creatingDefaultLeague, leagues, role, userRole]);

  // WATCHDOG: Safety net to prevent getting stuck in FETCHING_CONTEXT if leagues are loaded
  useEffect(() => {
    let timer;
    if (status === STATUS.FETCHING_CONTEXT && leagues.length > 0 && user) {
      timer = setTimeout(() => {
        authLogger.warn('Watchdog: Force transitioning to READY (leagues loaded but state stuck)');
        transitionTo(STATUS.READY, 'Watchdog rescue');
        setInitializing(false); // Ensure loading screen is dismissed
      }, 2000);
    }
    return () => clearTimeout(timer);
  }, [status, leagues, user, transitionTo]);

  // PERFORMANCE: Enhanced backend warmup with parallel health checks
  const warmupBackend = useCallback(async () => {
    try {
      authLogger.debug('Starting enhanced backend warmup...');
      const warmupStart = performance.now();
      
      // Parallel warmup requests for maximum efficiency
      // ALSO FETCH SCHEMAS HERE to preload the Multi-Sport Engine
      // Schemas might require auth, so we should ensure we have a token if possible,
      // but apiWarmup and apiHealth are public. fetchSchemas might be protected.
      // If fetchSchemas is protected, it will use the interceptor to get the token.
      const warmupPromises = [
        apiWarmup().catch(() => null), 
        apiHealth().catch(() => null),
        fetchSchemas().catch((err) => {
            authLogger.warn('Schema pre-fetch failed (possibly 401)', err.message);
            return null;
        })
      ];
      
      await Promise.race([
        Promise.allSettled(warmupPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Warmup timeout')), 10000)) // allow longer on cold starts
      ]);
      
      const warmupTime = performance.now() - warmupStart;
      authLogger.debug(`Enhanced backend warmup & schema load completed in ${warmupTime.toFixed(0)}ms`);
    } catch (error) {
      // Warmup is best-effort; avoid noisy warnings in production
      authLogger.debug('Backend warmup non-critical failure', error.message);
    }
  }, []);

  // One-time cleanup: remove accidental string literals from older sessions
  useEffect(() => {
    const fixKey = (k) => {
      const v = localStorage.getItem(k);
      if (v === 'undefined' || v === 'null' || v === '') {
        localStorage.removeItem(k);
      }
    };
    fixKey('selectedLeagueId');
    const safeRole = sanitizeRole(localStorage.getItem('userRole'));
    if (!safeRole) localStorage.removeItem('userRole');
  }, []);

  // In-flight request tracking to prevent double calls
  const leagueFetchPromiseRef = useRef(null);
  const lastFetchKeyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const tokenVersionCounterRef = useRef(0); // Monotonic counter, always present

  // PERFORMANCE: Concurrent league fetching with retry logic for cold starts
  // NOTE: Status gate removed - fetch is now triggered by useEffect watching state machine
  const fetchLeaguesConcurrently = useCallback(async (firebaseUser, roleParam) => {
    // MINIMAL GUARDS - Status checking is now done in the triggering useEffect
    // This function focuses purely on fetching logic, not state machine validation
    
    if (!firebaseUser) {
      authLogger.debug('Skipping league fetch - no Firebase user');
      return [];
    }
    
    if (!roleParam) {
      authLogger.debug('Skipping league fetch - user has no role yet (awaiting /select-role)');
      return [];
    }
    
    authLogger.debug(`Starting league fetch (role: ${roleParam})`);
    qrAuthDebug('fetchLeaguesConcurrently start', {
      firebaseUid: firebaseUser?.uid,
      roleParam,
      selectedLeagueId: localStorage.getItem('selectedLeagueId') || '',
      authState: {
        hasCurrentUser: !!auth.currentUser,
        currentUserUid: auth.currentUser?.uid || null,
        emailVerified: !!auth.currentUser?.emailVerified
      }
    });
    
    // Get token version for cache key
    // Use Firebase's stsTokenManager for reliable token versioning
    let tokenVersion;
    let tokenSource = 'unknown';
    try {
      // OPTION 1: Use Firebase's expirationTime (milliseconds, always present)
      if (firebaseUser.stsTokenManager?.expirationTime) {
        tokenVersion = firebaseUser.stsTokenManager.expirationTime;
        tokenSource = 'expirationTime';
        
        // PRODUCTION VERIFICATION: Log token version to confirm it changes on refresh
        if (process.env.NODE_ENV === 'development') {
          authLogger.debug('Token version from expirationTime', {
            expirationTime: tokenVersion,
            expiresIn: Math.round((tokenVersion - Date.now()) / 1000 / 60) + ' minutes'
          });
        }
      } 
      // OPTION 2: Parse iat from JWT (may not always be present)
      else {
        const token = await firebaseUser.getIdToken(false);
        if (!token) {
          authLogger.warn('Skipping league fetch - no token available');
          return [];
        }
        const tokenPayload = parseJwtPayload(token);
        tokenVersion = tokenPayload?.iat;
        
        // FALLBACK: If iat not present, use monotonic counter
        if (!tokenVersion) {
          tokenVersionCounterRef.current += 1;
          tokenVersion = tokenVersionCounterRef.current;
          tokenSource = 'counter';
          authLogger.debug('Token iat missing, using counter', tokenVersion);
        } else {
          tokenSource = 'iat';
        }
      }
    } catch (err) {
      authLogger.warn('Failed to get token version for league fetch', err);
      return [];
    }
    
    // DE-DUPLICATION: Prevent double calls with in-flight promise cache
    // CRITICAL: Key by userId + roleParam (the parameter we were passed)
    // NOT by userRole state (which might be stale due to async setState)
    // Key by userId + role + tokenVersion to ensure we refetch if:
    // - User changes
    // - Role changes
    // - Token refreshes (expirationTime changes on refresh)
    const fetchKey = `${firebaseUser.uid}:${roleParam}:${tokenVersion}`;
    
    authLogger.debug(`League fetch key: ${fetchKey}`);
    
    // If same fetch is already in progress, return that promise
    if (leagueFetchInProgress && lastFetchKeyRef.current === fetchKey && leagueFetchPromiseRef.current) {
      authLogger.debug('Returning existing in-flight league fetch promise');
      return leagueFetchPromiseRef.current;
    }
    
    // If fetch key changed (different user/role/token), abort old request and clear cache
    if (lastFetchKeyRef.current !== fetchKey) {
      // Abort previous in-flight request if it exists
      if (abortControllerRef.current) {
        authLogger.debug('Aborting previous league fetch (key changed)', {
          old: lastFetchKeyRef.current,
          new: fetchKey
        });
        abortControllerRef.current.abort();
      }
      
      leagueFetchPromiseRef.current = null;
      lastFetchKeyRef.current = fetchKey;
    }
    
    setLeagueFetchInProgress(true);
    authLogger.info(`[League Fetch] STARTED - leagueFetchInProgress: true`, { 
      userRole, 
      status, 
      fetchKey,
      tokenSource,
      tokenVersion 
    });
    
    // Create new AbortController for this fetch
    abortControllerRef.current = new AbortController();
    const currentAbortController = abortControllerRef.current;
    
    // Create and cache the promise
    const fetchPromise = (async () => {
      try {
        // Force refresh token to ensure fresh auth for cold start
        const freshToken = await firebaseUser.getIdToken(true);
        
        if (!freshToken) {
          authLogger.warn('Skipping league fetch - no fresh token available');
          return [];
        }
        
        // Use centralized getMyLeagues() that normalizes response
        // Pass abort signal so axios can actually cancel the request
        let leagueArray = [];
        try {
          leagueArray = await getMyLeagues({
            signal: currentAbortController.signal
          });
          qrAuthDebug('/leagues/me success', {
            via: 'getMyLeagues',
            leaguesCount: leagueArray?.length || 0
          });
        } catch (leagueErr) {
          qrAuthDebug('/leagues/me failure', {
            via: 'getMyLeagues',
            status: leagueErr?.response?.status,
            message: leagueErr?.message
          });
          throw leagueErr;
        }
        
        // CRITICAL: Check if fetch is still valid before committing state
        // Prevents stale responses from winning if role changed mid-flight
        // This check is REQUIRED even with AbortController (defense in depth)
        if (lastFetchKeyRef.current !== fetchKey) {
          authLogger.debug('Discarding stale league fetch response (key changed)');
          return [];
        }
        
        // Verify we weren't aborted
        if (currentAbortController.signal.aborted) {
          authLogger.debug('League fetch was aborted');
          return [];
        }
        
        setLeagues(leagueArray);
        authLogger.info(`[League Fetch] COMPLETED - ${leagueArray.length} leagues loaded`);
        
        // Set selection if needed
        const rawStored = localStorage.getItem('selectedLeagueId');
        const currentSelectedLeagueId = (rawStored && rawStored !== 'null' && rawStored !== 'undefined' && rawStored.trim() !== '') ? rawStored : '';
        
        if (leagueArray.length > 0 && (!currentSelectedLeagueId || !leagueArray.some(l => l.id === currentSelectedLeagueId))) {
          const targetLeagueId = leagueArray[0].id;
          qrAuthDebug('selectedLeagueId replaced after /leagues/me', {
            previousSelectedLeagueId: currentSelectedLeagueId || null,
            nextSelectedLeagueId: targetLeagueId,
            reason: !currentSelectedLeagueId ? 'missing previous' : 'previous not in fetched leagues',
            authState: {
              hasCurrentUser: !!auth.currentUser,
              currentUserUid: auth.currentUser?.uid || null,
              emailVerified: !!auth.currentUser?.emailVerified
            }
          });
          setSelectedLeagueIdState(targetLeagueId);
          localStorage.setItem('selectedLeagueId', targetLeagueId);
          setRole(leagueArray[0].role);
        } else {
          qrAuthDebug('selectedLeagueId preserved after /leagues/me', {
            selectedLeagueId: currentSelectedLeagueId || null,
            leaguesCount: leagueArray.length,
            authState: {
              hasCurrentUser: !!auth.currentUser,
              currentUserUid: auth.currentUser?.uid || null,
              emailVerified: !!auth.currentUser?.emailVerified
            }
          });
        }
        
        // CRITICAL: Return the fetched array for consumers who need immediate access
        // (e.g., JoinEvent needs to use returned value, not stale state)
        return leagueArray;
      } catch (error) {
        // Robust cancel detection - use multiple checks
        const isCancel = 
          (typeof axios !== 'undefined' && axios.isCancel && axios.isCancel(error)) ||
          error.code === 'ERR_CANCELED' ||
          error.name === 'CanceledError' ||
          error.name === 'AbortError' ||
          error.message?.includes('abort');
        
        if (isCancel) {
          authLogger.debug('League fetch aborted (expected)');
          return [];
        }
        
        authLogger.warn('Concurrent league fetch failed', error.message);

        // BUG FIX: On 401, clear the stale selectedLeagueId from localStorage.
        // Without this, EventContext sees a non-empty selectedLeagueId and tries
        // to load events with a stale league ID — also getting 401 — and may
        // never set eventsLoaded=true, causing RouteDecisionGate to spin forever.
        if (error?.response?.status === 401) {
          authLogger.warn('League fetch 401 — retrying with fresh token');
          // Force a fresh token and retry once before giving up
          try {
            const freshUser = auth.currentUser;
            if (freshUser) {
              const freshToken = await freshUser.getIdToken(true);
              authLogger.info('Got fresh token, retrying league fetch');
              const retryResp = await api.get('/leagues/me', {
                headers: { Authorization: `Bearer ${freshToken}` },
                signal: currentAbortController.signal,
              });
              const retryLeagues = retryResp?.data?.leagues;
              qrAuthDebug('/leagues/me success', {
                via: 'retry api.get',
                status: retryResp?.status,
                leaguesCount: Array.isArray(retryLeagues) ? retryLeagues.length : 0
              });
              if (Array.isArray(retryLeagues) && retryLeagues.length > 0) {
                setLeagues(retryLeagues);
                authLogger.info(`[League Fetch] RETRY SUCCESS - ${retryLeagues.length} leagues loaded`);
                const targetLeagueId = retryLeagues[0].id;
                qrAuthDebug('selectedLeagueId replaced after /leagues/me retry', {
                  previousSelectedLeagueId: localStorage.getItem('selectedLeagueId') || null,
                  nextSelectedLeagueId: targetLeagueId,
                  authState: {
                    hasCurrentUser: !!auth.currentUser,
                    currentUserUid: auth.currentUser?.uid || null,
                    emailVerified: !!auth.currentUser?.emailVerified
                  }
                });
                setSelectedLeagueIdState(targetLeagueId);
                localStorage.setItem('selectedLeagueId', targetLeagueId);
                setRole(retryLeagues[0].role);
                return retryLeagues;
              }
            }
          } catch (retryErr) {
            qrAuthDebug('/leagues/me failure', {
              via: 'retry api.get',
              status: retryErr?.response?.status,
              message: retryErr?.message
            });
            authLogger.warn('League fetch retry also failed', retryErr.message);
          }
          // If retry failed too, treat as transient while auth is still valid.
          // Preserve existing league/event context so QR join flows don't
          // immediately collapse into "No League Selected" fallback screens.
          authLogger.warn('League fetch retry failed while authenticated - preserving existing league selection/context');
          qrAuthDebug('selectedLeagueId preserved after /leagues/me retry failure', {
            selectedLeagueId: localStorage.getItem('selectedLeagueId') || null,
            authState: {
              hasCurrentUser: !!auth.currentUser,
              currentUserUid: auth.currentUser?.uid || null,
              emailVerified: !!auth.currentUser?.emailVerified
            }
          });
        }

        // Return empty array on error so consumers can handle gracefully
        return [];
      } finally {
        qrAuthDebug('fetchLeaguesConcurrently end', {
          fetchKey,
          selectedLeagueId: localStorage.getItem('selectedLeagueId') || '',
          authState: {
            hasCurrentUser: !!auth.currentUser,
            currentUserUid: auth.currentUser?.uid || null,
            emailVerified: !!auth.currentUser?.emailVerified
          }
        });
        setLeagueFetchInProgress(false);
        authLogger.info(`[League Fetch] FINISHED - leagueFetchInProgress: false`);
        
        // Clear promise cache after completion
        if (leagueFetchPromiseRef.current === fetchPromise) {
          leagueFetchPromiseRef.current = null;
        }
        
        // Clear abort controller if it's still ours
        if (abortControllerRef.current === currentAbortController) {
          abortControllerRef.current = null;
        }
      }
    })();
    
    // Cache the promise
    leagueFetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [leagueFetchInProgress]); // Removed status from deps - now triggered by useEffect

// Helper to parse JWT payload (extracted for reuse)
function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

  // STATE MACHINE: Trigger league fetch when conditions are met
  // This replaces imperative calls with declarative state-driven fetching
  const leagueFetchTriggeredRef = useRef(false); // Prevent double-trigger during rapid state changes
  const lastFetchKeyForTriggerRef = useRef(null); // Track fetch key to reset trigger on changes
  
  useEffect(() => {
    // Use reactive location from useLocation hook (not window.location)
    const currentPath = location.pathname || '/';
    
    // Calculate fetch key for this potential fetch
    // IMPORTANT: Only uid + role matter for run-once semantics
    // Token refreshes should NOT trigger refetch (they happen automatically every hour)
    const fetchKey = user && userRole ? `${user.uid}:${userRole}` : null;
    
    // CRITICAL: Reset trigger flag when fetch key changes
    // This allows legitimate refetches after role change or user switch (NOT token refresh)
    if (fetchKey && fetchKey !== lastFetchKeyForTriggerRef.current) {
      authLogger.debug(`[League Fetch Trigger] Fetch key changed (${lastFetchKeyForTriggerRef.current} → ${fetchKey}), resetting trigger`);
      leagueFetchTriggeredRef.current = false;
      lastFetchKeyForTriggerRef.current = fetchKey;
    }
    
    // DIAGNOSTIC: Log ref state
    authLogger.debug(`[League Fetch Trigger] Ref state - triggered: ${leagueFetchTriggeredRef.current}, fetchKey: ${fetchKey}, lastKey: ${lastFetchKeyForTriggerRef.current}`);
    
    // GUARD 1: Only fetch when we have user + role
    if (!user || !userRole) {
      leagueFetchTriggeredRef.current = false;
      lastFetchKeyForTriggerRef.current = null;
      return;
    }
    
    // GUARD 2: Only fetch when status is ready for league operations
    // READY = normal operation, FETCHING_CONTEXT = already fetching, ROLE_REQUIRED = just selected role
    const readyStatuses = [STATUS.READY, STATUS.FETCHING_CONTEXT, STATUS.ROLE_REQUIRED];
    if (!readyStatuses.includes(status)) {
      authLogger.debug(`[League Fetch Trigger] Not ready - status: ${status}`);
      // Don't reset flag here - keep it for when status becomes ready
      return;
    }
    
    // GUARD 3: Skip fetch on onboarding routes where user hasn't reached app yet
    // NOTE: /dashboard, /coach, /players, /admin, etc. are NOT in this list
    const skipFetchRoutes = ['/login', '/signup', '/verify-email', '/'];
    if (skipFetchRoutes.includes(currentPath)) {
      authLogger.debug(`[League Fetch Trigger] Skipping on onboarding route: ${currentPath}`);
      // Don't reset flag - might navigate away soon
      return;
    }

    // GUARD 3.5: Invite-first sequencing. While invite join is pending or
    // the user is on /join-event, block automatic context hydration.
    // JoinEvent owns the join -> refresh ordering to avoid pre-join 403s.
    if (currentPath.startsWith('/join-event/') || hasPendingInviteJoin()) {
      authLogger.debug('[League Fetch Trigger] Skipping automatic fetch during pending invite join');
      return;
    }
    
    // GUARD 4: Prevent double-trigger (useEffect can fire multiple times during state transitions)
    if (leagueFetchTriggeredRef.current) {
      authLogger.debug('[League Fetch Trigger] Already triggered for this fetch key');
      return;
    }
    
    // GUARD 5: Skip if already fetching
    if (leagueFetchInProgress) {
      authLogger.debug('[League Fetch Trigger] Fetch already in progress');
      return;
    }
    
    // All conditions met - trigger the fetch
    authLogger.info(`[League Fetch Trigger] Conditions met - triggering fetch (user: ${user.uid}, role: ${userRole}, status: ${status}, path: ${currentPath})`);
    leagueFetchTriggeredRef.current = true;
    fetchLeaguesConcurrently(user, userRole);
    
  }, [user, userRole, status, leagueFetchInProgress, fetchLeaguesConcurrently, location]);


  // CRITICAL FIX: Firebase auth state change handler with stable dependencies
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      authLogger.debug('Auth state change', firebaseUser ? 'User logged in' : 'User logged out');
      
      // State Machine: Start Initialization
      transitionTo(STATUS.INITIALIZING, 'onAuthStateChanged');

      let initialPath = '/';
      let initialSearch = '';
      try {
        initialPath = window.location?.pathname || '/';
        initialSearch = window.location?.search || '';
      } catch {}
      const verificationBridgeRoutes = ['/email-action', '/__/auth/action', '/__auth/action'];
      const isFirebaseVerifyTab = initialPath === '/verify-email' && initialSearch.includes('fromFirebase=1');
      const isVerificationBridgeRoute = isFirebaseVerifyTab || verificationBridgeRoutes.some(route => initialPath.startsWith(route));
      
      if (!firebaseUser) {
        // User logged out
        qrAuthDebug('selectedLeagueId cleared (no firebase user)', {
          previousSelectedLeagueId: localStorage.getItem('selectedLeagueId') || null,
          authState: {
            hasCurrentUser: !!auth.currentUser,
            currentUserUid: auth.currentUser?.uid || null
          }
        });
        setUser(null);
        setUserRole(null);
        setLeagues([]);
        setSelectedLeagueIdState('');
        setRole(null);
        setAuthChecked(true);
        setRoleChecked(true);
        setInitializing(false);
        setError(null);
        localStorage.removeItem('selectedLeagueId');
        localStorage.removeItem(VIEWER_INVITE_EVENT_CONTEXT_KEY);
        clearInviteHydrationState();
        
        // Reset league fetch trigger refs to allow fresh fetch on next login
        leagueFetchTriggeredRef.current = false;
        lastFetchKeyForTriggerRef.current = null;
        
        transitionTo(STATUS.UNAUTHENTICATED, 'Logged out');
        return;
      }

      // User logged in - start initialization with inline logic to avoid dependency issues
      // Quick auth check
      setUser(firebaseUser);
      setAuthChecked(true);
      
      transitionTo(STATUS.AUTHENTICATING, 'User detected');

      // CRITICAL FIX: Check email verification BEFORE any backend calls
      // This prevents "Server waking up" / "Loading leagues" messages on the verify-email page
      if (!firebaseUser.emailVerified) {
        authLogger.debug('User email not verified - skipping backend initialization');
        setInitializing(false);
        // Ensure roleChecked is true so guards don't hang, but leave userRole null
        setRoleChecked(true); 
        
        transitionTo(STATUS.READY, 'Waiting for email verification');
        
        if (!isVerificationBridgeRoute && initialPath !== '/verify-email') {
          navigate('/verify-email');
        }
        return;
      }
      
      // PERFORMANCE: Start backend warmup immediately to reduce cold start impact
      warmupBackend();

      // CRITICAL FIX: Do NOT fetch leagues before role check
      // The old "hot path" was calling fetchLeagues with null role, causing 404s
      // Instead, we wait for role check to complete below, THEN fetch leagues
      console.debug("[AUTH] Skipping hot path league fetch - will fetch after role check");

      // FAST EXIT: If we're on the login page, immediately send the user back
      try {
        if (initialPath === '/login') {
          // CRITICAL FIX: Check for pending join FIRST, before any initialization
          // This ensures users returning from email verification loop back to the join flow
          const pendingEventJoin = localStorage.getItem('pendingEventJoin');
          if (pendingEventJoin) {
            const safePath = pendingEventJoin.split('/').map(part => encodeURIComponent(part)).join('/');
            authLogger.debug('Redirecting to pending invited event join');
            navigate(`/join-event/${safePath}`, { replace: true });
            setInitializing(false);
            return;
          }

          // REMOVED: Fast exit path - was causing race conditions where roleChecked was set
          // before userRole state propagated, causing premature redirects to /select-role
          // Now always go through normal initialization to ensure proper state sync
          authLogger.debug('Login detected - proceeding with normal initialization flow');
        }
      } catch {}
      
      // (Moved email verification check to top of flow)
      
      // MFA GUARD for admins (env-gated): require enrolled factor when admin claim is present
      try {
        const idt = await getIdTokenResult(firebaseUser, true);
        const isAdmin = !!idt.claims?.admin;
        const enrolled = (firebaseUser?.multiFactor?.enrolledFactors || []).length > 0;
        const REQUIRE_ADMIN_MFA = import.meta.env.VITE_REQUIRE_ADMIN_MFA === 'true';
        if (REQUIRE_ADMIN_MFA && isAdmin && !enrolled) {
          if (!isVerificationBridgeRoute) {
            navigate('/mfa-enroll');
          }
          setInitializing(false);
          return;
        }
      } catch (mfaErr) {
        // Non-fatal
        authLogger.warn('MFA guard check failed', mfaErr?.message);
      }
      
      const buildPendingInvitePath = (inviteValue) => (
        inviteValue.split('/').map(part => encodeURIComponent(part)).join('/')
      );

      // Complete initialization inline to prevent dependency loops
      try {
        authLogger.debug('Starting role check for user', firebaseUser.email);
        
        // Treat cached role as a hint only. Backend /users/me remains authoritative.
        const cachedRole = sanitizeRole(localStorage.getItem('userRole'));
        const cachedEmail = localStorage.getItem('userEmail');
        if (cachedRole && cachedEmail === firebaseUser.email) {
          authLogger.debug('Found cached role hint; awaiting backend confirmation', cachedRole);
        }
        
        // STEP 1: Role check with extended timeout for cold starts using backend API
        let userRole = null;
        let restoredPendingInvite = localStorage.getItem('pendingEventJoin');
        authLogger.debug('Fetching role from backend /users/me');
        try {
          let token;
          try {
            // For role checking, always refresh token to ensure email_verified is current
            // This is crucial after email verification
            token = await firebaseUser.getIdToken(true);
          } catch (refreshError) {
            authLogger.error('Token refresh failed:', refreshError.message);
            throw new Error('Firebase auth token unavailable');
          }
          
          const apiUrl = `/users/me`;
          authLogger.debug('Making API call to', apiUrl);
          const roleResponse = await api.get(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
          authLogger.debug('API Response status', roleResponse.status);
          if (roleResponse?.data) {
            const userData = roleResponse.data;
            authLogger.debug('User data received', userData);
            userRole = sanitizeRole(userData.role);
            
            // CRITICAL FIX: Restore pending invite from server if missing locally
            // This handles the cross-device / incognito verification flow
            if (userData.pending_invite && !localStorage.getItem('pendingEventJoin')) {
              authLogger.info('Restoring pending invite from server profile', userData.pending_invite);
              localStorage.setItem('pendingEventJoin', userData.pending_invite);
            }
            if (userData.pending_invite) {
              restoredPendingInvite = userData.pending_invite;
            }
          } else {
            throw new Error(`Role check failed: ${roleResponse?.status}`);
          }
        } catch (error) {
          const statusCode = error?.response?.status;
          if (statusCode === 404) {
            authLogger.debug('User not found (404) - treating as new user');
            userRole = null;
          } else if (statusCode === 403) {
            const detail = error?.response?.data?.detail || '';
            if (String(detail).includes('Email verification required')) {
              authLogger.warn('Email verification required during role check');
              setInitializing(false);
              if (!isVerificationBridgeRoute) {
                navigate('/verify-email');
              }
              return;
            }
            authLogger.warn('Role check forbidden, treating as no role');
            userRole = null;
          } else {
          authLogger.error('Role check error', error.message);
          if (error.message.includes('Role check timeout')) {
            authLogger.warn('Role check timed out after 30s');
          } else if (error.message.includes('Firebase auth token unavailable')) {
            authLogger.error('Firebase token issue');
          } else {
            authLogger.debug('Role check error', error.message);
          }
          userRole = null;
          }
        }

        if (!userRole) {
          const inviteHydration = getInviteHydrationState();
          const inviteJoinInProgress = (() => {
            try {
              return localStorage.getItem(INVITE_JOIN_IN_PROGRESS_KEY) === '1';
            } catch {
              return false;
            }
          })();
          const currentPathForHydration = window.location.pathname || '/';
          const allowInviteHydrationFallback = inviteJoinInProgress || currentPathForHydration.startsWith('/join-event/');
          if (inviteHydration?.role && allowInviteHydrationFallback) {
            authLogger.warn('No backend role found, applying invite hydration fallback role during active invite join', inviteHydration);
            setUserRole(inviteHydration.role);
            localStorage.setItem('userRole', inviteHydration.role);
            setRoleChecked(true);
            transitionTo(STATUS.READY, 'Invite hydration fallback role applied');
            setInitializing(false);
            return;
          }
          if (inviteHydration?.role && !allowInviteHydrationFallback) {
            authLogger.warn('Ignoring stale invite hydration fallback role outside invite join', {
              inviteHydration,
              currentPath: currentPathForHydration,
              inviteJoinInProgress
            });
          }
          if (restoredPendingInvite) {
            const safePath = buildPendingInvitePath(restoredPendingInvite);
            authLogger.debug('No user role found, but pending invite exists - routing to join flow first');
            setRoleChecked(true);
            transitionTo(STATUS.ROLE_REQUIRED, 'Pending invite requires join flow before role selection');
            navigate(`/join-event/${safePath}`, { replace: true });
            setInitializing(false);
            return;
          }

          authLogger.debug('No user role found and no pending invite - redirecting to select-role');
          setUserRole(null);
          localStorage.removeItem('userRole'); // Clear any stale role data
          setLeagues([]);
          setRole(null);
          setRoleChecked(true);
          
          // CRITICAL FIX: Transition to ROLE_REQUIRED state instead of READY
          // This allows BootGate to pass through and render SelectRole UI
          transitionTo(STATUS.ROLE_REQUIRED, 'User needs to select role');
          
          const currentPath = window.location.pathname;
          authLogger.debug('Current path', currentPath);
          if (currentPath.startsWith('/join-event/')) {
            const joinPath = currentPath.replace('/join-event/', '');
            localStorage.setItem('pendingEventJoin', joinPath);
          }
          
          console.log('[AuthContext] NAV_FROM: AuthContext → /select-role (no role)');
          authLogger.debug('Navigating to /select-role');
          if (!isVerificationBridgeRoute) {
            logSelectRoleRedirect({
              source: 'AuthContext',
              reason: 'no role and no pending invite',
              pathname: currentPath,
              userRole: userRole || null,
              leaguesLength: leagues?.length || 0,
              selectedLeagueId: localStorage.getItem('selectedLeagueId') || null
            });
            navigate("/select-role");
          }
          setInitializing(false);
          return;
        }

        authLogger.debug('User role found', userRole);
        clearInviteHydrationState();
        setUserRole(userRole);
        // Persist only valid roles to localStorage
        if (userRole && VALID_ROLES.includes(userRole)) {
          localStorage.setItem('userRole', userRole);
        } else {
          localStorage.removeItem('userRole');
        }
        localStorage.setItem('userEmail', firebaseUser.email);

        // STEP 2: League fetch will be triggered by state machine useEffect
        // No special paths - all users go through same flow for consistency
        authLogger.debug('Role confirmed - league fetch will be triggered by state machine');

        setRoleChecked(true);

        authLogger.debug('Auth state after role check', {
          userRole,
          selectedLeagueId: localStorage.getItem('selectedLeagueId'),
          leaguesLoaded: leagues?.length || 0
        });
        
        transitionTo(STATUS.READY, 'Initialization complete');
        
        // CRITICAL: If user is on /login, navigate to dashboard to trigger RouteDecisionGate
        // Gate will then immediately redirect to the correct final destination based on role/leagues
        // This creates a clean single-decision flow: /login → /dashboard (gate) → /coach (final)
        const currentPath = window.location.pathname;
        if (currentPath === '/login') {
          let pendingEventJoin = localStorage.getItem('pendingEventJoin') || restoredPendingInvite;

          // On cached-role logins, we may not have called /users/me yet.
          // Check server invite state before any fallback redirect.
          if (!pendingEventJoin) {
            try {
              const token = await firebaseUser.getIdToken(false);
              const profileResponse = await api.get(`/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              const serverPendingInvite = profileResponse?.data?.pending_invite;
              if (serverPendingInvite) {
                authLogger.info('Restoring pending invite before fallback redirect', serverPendingInvite);
                localStorage.setItem('pendingEventJoin', serverPendingInvite);
                pendingEventJoin = serverPendingInvite;
              }
            } catch (inviteLookupError) {
              authLogger.warn('Pending invite lookup before fallback redirect failed', inviteLookupError?.message);
            }
          }

          if (pendingEventJoin) {
            const safePath = buildPendingInvitePath(pendingEventJoin);
            authLogger.debug('Auth complete from /login - redirecting to restored invited event join');
            navigate(`/join-event/${safePath}`, { replace: true });
            return;
          }

          const postLoginTarget = localStorage.getItem('postLoginTarget');
          if (postLoginTarget && postLoginTarget !== '/login' && isSafeInternalPath(postLoginTarget)) {
            authLogger.debug('Auth complete from /login - redirecting to postLoginTarget', postLoginTarget);
            localStorage.removeItem('postLoginTarget');
            navigate(postLoginTarget, { replace: true });
            return;
          }
          if (postLoginTarget === '/login' || postLoginTarget) {
            localStorage.removeItem('postLoginTarget');
          }

          authLogger.debug('Auth complete from /login - navigating to /dashboard to trigger gate');
          navigate('/dashboard', { replace: true });
          } else {
          // Already on a protected route, gate will handle it
          authLogger.debug('Auth complete - RouteDecisionGate will handle routing');
        }

      } catch (err) {
        setError(err.message);
        setUserRole(null);
        setLeagues([]);
        setRole(null);
        setRoleChecked(true);
        
        if (err.message.includes('Role check timeout')) {
          const currentPath = window.location.pathname;
          if (currentPath.startsWith('/join-event/')) {
            const joinPath = currentPath.replace('/join-event/', '');
            localStorage.setItem('pendingEventJoin', joinPath);
          }
          if (!isVerificationBridgeRoute) {
            logSelectRoleRedirect({
              source: 'AuthContext',
              reason: 'role check timeout',
              pathname: currentPath,
              userRole: null,
              leaguesLength: leagues?.length || 0,
              selectedLeagueId: localStorage.getItem('selectedLeagueId') || null
            });
            navigate("/select-role");
          }
        }
      } finally {
        setInitializing(false);
      }
    });

    return () => unsubscribe();
  }, []); // CRITICAL: Empty dependency array to prevent infinite loops

  // Sync league selection across tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'selectedLeagueId') {
        const newValue = e.newValue;
        // If local state doesn't match new storage value, update it
        if (newValue !== selectedLeagueId) {
          const sanitized = (newValue === undefined || newValue === null || newValue === 'null') ? '' : String(newValue).trim();
          
          setSelectedLeagueIdState(sanitized);
          
          // Also update role if we have leagues loaded
          if (sanitized && leagues.length > 0) {
            const selectedLeague = leagues.find(l => l.id === sanitized);
            setRole(selectedLeague?.role || null);
          } else if (!sanitized) {
            setRole(null);
          }
          
          authLogger.debug('Synced selectedLeagueId from another tab', sanitized);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [leagues, selectedLeagueId]);

  // Add league function for join operations
  const addLeague = useCallback((newLeague) => {
    setLeagues(prevLeagues => {
      // Check if league already exists
      const exists = prevLeagues.some(l => l.id === newLeague.id);
      if (exists) {
        return prevLeagues;
      }
      
      // Add new league to the list
      const updatedLeagues = [...prevLeagues, newLeague];

      return updatedLeagues;
    });
  }, []);

  // Manual league refresh function for after joining via QR code
  // CRITICAL: Returns the fetched leagues array so consumers can use fresh data
  // immediately without waiting for React state to update
  const refreshLeagues = useCallback(async (options = {}) => {
    const roleOverride = sanitizeRole(options?.roleOverride);
    const effectiveRole = roleOverride || userRole;
    if (!user || !effectiveRole) {
      authLogger.warn('Cannot refresh leagues - user or role not set', {
        hasUser: !!user,
        userRole: userRole || null,
        roleOverride: roleOverride || null
      });
      return [];
    }
    authLogger.info('Manual league refresh requested', {
      role: effectiveRole,
      source: roleOverride ? 'roleOverride' : 'userRole'
    });
    const freshLeagues = await fetchLeaguesConcurrently(user, effectiveRole);
    return freshLeagues || [];
  }, [user, userRole, fetchLeaguesConcurrently]);

  // Add logout function directly in AuthContext to avoid circular dependency
  const logout = useCallback(async () => {
    try {
      qrAuthDebug('selectedLeagueId cleared (logout)', {
        previousSelectedLeagueId: localStorage.getItem('selectedLeagueId') || null,
        authState: {
          hasCurrentUser: !!auth.currentUser,
          currentUserUid: auth.currentUser?.uid || null
        }
      });
      await signOut(auth);
      // Clear all auth state
      setUser(null);
      setLeagues([]);
      setSelectedLeagueIdState('');
      setRole(null);
      setUserRole(null);
      setError(null);
      clearInviteHydrationState();
      // Clear localStorage including invitation data
      localStorage.removeItem('selectedLeagueId');
      localStorage.removeItem('selectedEventId');
      localStorage.removeItem('pendingEventJoin');
      localStorage.removeItem(VIEWER_INVITE_EVENT_CONTEXT_KEY);
      localStorage.removeItem('userRole');
      cacheInvalidation.userLoggedOut();
      // Reset league fetch trigger refs to allow fresh fetch on next login
      leagueFetchTriggeredRef.current = false;
      lastFetchKeyForTriggerRef.current = null;
    } catch {
      // Logout error handled internally
      // Still clear state even if signOut fails
      setUser(null);
      setLeagues([]);
      setSelectedLeagueIdState('');
      setRole(null);
      setUserRole(null);
      clearInviteHydrationState();
      localStorage.removeItem('selectedLeagueId');
      localStorage.removeItem('selectedEventId');
      localStorage.removeItem('pendingEventJoin');
      localStorage.removeItem(VIEWER_INVITE_EVENT_CONTEXT_KEY);
      localStorage.removeItem('userRole');
      cacheInvalidation.userLoggedOut();
      // Reset league fetch trigger refs to allow fresh fetch on next login
      leagueFetchTriggeredRef.current = false;
      lastFetchKeyForTriggerRef.current = null;
    }
  }, []);

  // Add function to refresh user role after it's been set via API
  const refreshUserRole = useCallback(async () => {
    if (!user) return null;
    
    try {
      const token = await user.getIdToken(true); // Force refresh token
      const response = await api.get(`/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response?.data) {
        const userData = response.data;
        const newRole = sanitizeRole(userData.role);
        authLogger.debug('Refreshed user role', newRole);
        
        // CRITICAL FIX: Restore pending invite during manual refresh
        if (userData.pending_invite && !localStorage.getItem('pendingEventJoin')) {
            authLogger.info('Restoring pending invite from server profile (refresh)', userData.pending_invite);
            localStorage.setItem('pendingEventJoin', userData.pending_invite);
        }
        
        setUserRole(newRole);
        setRoleChecked(true); // Ensure role check is complete
        // Persist role to localStorage for browser refresh resilience
        if (newRole) {
          localStorage.setItem('userRole', newRole);
          const inviteJoinInProgress = (() => {
            try {
              return localStorage.getItem(INVITE_JOIN_IN_PROGRESS_KEY) === '1';
            } catch {
              return false;
            }
          })();
          if (inviteJoinInProgress) {
            setInviteHydrationState({
              role: newRole,
              leagueId: localStorage.getItem('selectedLeagueId') || null
            });
          } else {
            clearInviteHydrationState();
          }
        } else {
          localStorage.removeItem('userRole');
        }
        
        // CRITICAL FIX: Transition from ROLE_REQUIRED to READY after role is set
        if (newRole && status === STATUS.ROLE_REQUIRED) {
          authLogger.debug('Role selected, transitioning to READY state');
          transitionTo(STATUS.READY, 'Role selected');
          // League fetch will be triggered by useEffect watching state transitions
        }
        return { role: newRole, userData };
      }
    } catch (error) {
      authLogger.error('Failed to refresh user role', error);
    }
    return null;
  }, [user, status, transitionTo]);

  const hydratePostJoinState = useCallback(async ({ fallbackRole = null } = {}) => {
    if (!user) {
      authLogger.warn('Post-join hydration skipped: no authenticated user');
      return { ok: false, reason: 'no_user', role: null, leagues: [] };
    }

    try {
      localStorage.setItem(INVITE_JOIN_IN_PROGRESS_KEY, '1');
    } catch {
      // best effort
    }

    try {
      authLogger.info('[JoinHydration] Starting post-join hydration', {
        uid: user.uid || null,
        fallbackRole: fallbackRole || null
      });

      const profile = await refreshUserRole();
      authLogger.info('[JoinHydration] /users/me response processed', {
        roleFromProfile: profile?.role || null,
        pendingInvite: profile?.userData?.pending_invite || null
      });

      const resolvedRole = sanitizeRole(profile?.role) || sanitizeRole(fallbackRole);
      if (!resolvedRole) {
        authLogger.warn('[JoinHydration] Missing role after profile refresh', {
          profileRole: profile?.role || null,
          fallbackRole: fallbackRole || null
        });
        return { ok: false, reason: 'role_missing', role: null, leagues: [] };
      }

      const refreshedLeagues = await refreshLeagues({ roleOverride: resolvedRole });
      authLogger.info('[JoinHydration] Completed', {
        resolvedRole,
        leaguesCount: refreshedLeagues?.length || 0
      });
      setInviteHydrationState({
        role: resolvedRole,
        leagueId: localStorage.getItem('selectedLeagueId') || null
      });
      return {
        ok: true,
        role: resolvedRole,
        leagues: refreshedLeagues || []
      };
    } catch (error) {
      authLogger.error('[JoinHydration] Failed', error);
      return { ok: false, reason: 'exception', role: null, leagues: [] };
    } finally {
      try {
        localStorage.removeItem(INVITE_JOIN_IN_PROGRESS_KEY);
      } catch {
        // best effort
      }
    }
  }, [user, refreshUserRole, refreshLeagues]);

  // Expose state setters for logout functionality
  const contextValue = {
    user,
    userRole,
    role,
      initializing,
    leagues,
    leaguesLoading: leagueFetchInProgress,
    selectedLeagueId,
    setSelectedLeagueId: useCallback((id) => {
      const sanitized = (id === undefined || id === null) ? '' : String(id).trim();
      setSelectedLeagueIdState(sanitized);
      // Persist only valid values; avoid 'undefined'/'null' strings
      if (sanitized) {
        localStorage.setItem('selectedLeagueId', sanitized);
      } else {
        localStorage.removeItem('selectedLeagueId');
      }
      
      // Update role when league changes
      if (leagues.length > 0) {
        const selectedLeague = leagues.find(l => l.id === sanitized);
        setRole(selectedLeague?.role || null);
      }
    }, [leagues]),
    addLeague,
    refreshLeagues,
    authChecked,
    roleChecked,
    error,
    setError,
    setUser,
    setUserRole,
    setRole,
    setLeagues,
    setAuthChecked,
    setRoleChecked,
    refreshUserRole,
    hydratePostJoinState,
    logout,
    status // Expose status for debugging/monitoring
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Export useLogout for backward compatibility
export function useLogout() {
  const { logout } = useAuth();
  return logout;
}