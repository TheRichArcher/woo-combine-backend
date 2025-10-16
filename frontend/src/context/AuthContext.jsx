import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut, getIdTokenResult } from "firebase/auth";
import api, { apiHealth, apiWarmup } from '../lib/api';
import { useNavigate } from "react-router-dom";

import { useToast } from './ToastContext';
import LoadingScreen from '../components/LoadingScreen';
import { authLogger } from '../utils/logger';
import { cacheInvalidation } from '../utils/dataCache';

const AuthContext = createContext();

// Role utilities to avoid treating 'undefined'/'null' as valid roles
// Align with backend-accepted roles while keeping internal roles for UI/admin
const VALID_ROLES = ['organizer', 'coach', 'viewer', 'player', 'evaluator', 'admin'];
function sanitizeRole(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return VALID_ROLES.includes(trimmed) ? trimmed : null;
}

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
  const { showColdStartNotification, isColdStartActive, showWarning } = useToast();
  
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

  // PERFORMANCE: Enhanced backend warmup with parallel health checks
  const warmupBackend = useCallback(async () => {
    try {
      authLogger.debug('Starting enhanced backend warmup...');
      const warmupStart = performance.now();
      
      // Parallel warmup requests for maximum efficiency
      const warmupPromises = [apiWarmup().catch(() => null), apiHealth().catch(() => null)];
      
      await Promise.race([
        Promise.allSettled(warmupPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Warmup timeout')), 6000)) // allow a bit longer for cold starts
      ]);
      
      const warmupTime = performance.now() - warmupStart;
      authLogger.debug(`Enhanced backend warmup completed in ${warmupTime.toFixed(0)}ms`);
    } catch (error) {
      authLogger.warn('Backend warmup failed (non-critical)', error.message);
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

  // PERFORMANCE: Concurrent league fetching to reduce wait time
  const fetchLeaguesConcurrently = useCallback(async (firebaseUser, userRole) => {
    if (leagueFetchInProgress) return;
    
    setLeagueFetchInProgress(true);
    authLogger.debug('Starting concurrent league fetch');
    
    try {
      const token = await firebaseUser.getIdToken(false);
      // Allow api default timeout (45s) to handle cold start rather than a 5s abort
      const response = await api.get(`/leagues/me`).catch((e) => { throw e; });

      if (response?.data) {
        const leagueData = response.data;
        // Normalize to array shape for state to avoid runtime errors
        const leagueArray = Array.isArray(leagueData)
          ? leagueData
          : (Array.isArray(leagueData?.leagues) ? leagueData.leagues : []);
        setLeagues(leagueArray);
        authLogger.debug('Leagues loaded concurrently', leagueArray.length);
      }
    } catch (error) {
      authLogger.warn('Concurrent league fetch failed', error.message);
      // Don't block UI for failed league fetch
    } finally {
      setLeagueFetchInProgress(false);
    }
  }, []);





  // CRITICAL FIX: Firebase auth state change handler with stable dependencies
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      authLogger.debug('Auth state change', firebaseUser ? 'User logged in' : 'User logged out');
      
      if (!firebaseUser) {
        // User logged out
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
        return;
      }

      // User logged in - start initialization with inline logic to avoid dependency issues
      // Quick auth check
      setUser(firebaseUser);
      setAuthChecked(true);
      
      // PERFORMANCE: Start backend warmup immediately to reduce cold start impact
      warmupBackend();

      // FAST EXIT: If we're on the login page, immediately send the user back
      try {
        const path = window.location?.pathname || '';
        if (path === '/login') {
          const target = localStorage.getItem('postLoginRedirect') || '/dashboard';
          localStorage.removeItem('postLoginRedirect');
          // Ensure minimal ready state before redirect so guards don't stall
          const cachedRoleQuick = sanitizeRole(localStorage.getItem('userRole'));
          if (cachedRoleQuick) {
            setUserRole(cachedRoleQuick);
            setRole(cachedRoleQuick);
          }
          setRoleChecked(true);
          navigate(target, { replace: true });
          setInitializing(false);
          return;
        }
      } catch {}
      
      if (!firebaseUser.emailVerified) {
        // User needs to verify email - redirect immediately to avoid being stuck on login
        setInitializing(false);
        navigate('/verify-email');
        return;
      }

      // MFA GUARD for admins (env-gated): require enrolled factor when admin claim is present
      try {
        const idt = await getIdTokenResult(firebaseUser, true);
        const isAdmin = !!idt.claims?.admin;
        const enrolled = (firebaseUser?.multiFactor?.enrolledFactors || []).length > 0;
        const REQUIRE_ADMIN_MFA = import.meta.env.VITE_REQUIRE_ADMIN_MFA === 'true';
        if (REQUIRE_ADMIN_MFA && isAdmin && !enrolled) {
          navigate('/mfa-enroll');
          setInitializing(false);
          return;
        }
      } catch (mfaErr) {
        // Non-fatal
        authLogger.warn('MFA guard check failed', mfaErr?.message);
      }
      
      // Complete initialization inline to prevent dependency loops
      try {
        authLogger.debug('Starting role check for user', firebaseUser.email);
        
        // PERFORMANCE FIX: Always use cached role for immediate UI load
        const cachedRole = sanitizeRole(localStorage.getItem('userRole'));
        const cachedEmail = localStorage.getItem('userEmail');
        
        if (cachedRole && cachedEmail === firebaseUser.email) {
          authLogger.debug('Using cached role for immediate startup', cachedRole);
          setUserRole(cachedRole);
          setRole(cachedRole);
          setRoleChecked(true);
          setInitializing(false); // Don't wait for API verification
          
          // Start league fetch immediately if we have a role and we're not on onboarding routes
          try {
            const path = window.location?.pathname || '';
            const onboarding = ['/login','/signup','/verify-email','/welcome','/'];
            if (cachedRole !== null && !onboarding.includes(path)) {
              fetchLeaguesConcurrently(firebaseUser, cachedRole);
            }
          } catch {
            if (cachedRole !== null) fetchLeaguesConcurrently(firebaseUser, cachedRole);
          }
          
          // Still verify role in background, but don't block UI
          setTimeout(async () => {
            try {
              const token = await firebaseUser.getIdToken(false);
              const response = await api.get(`/users/me`, { headers: { Authorization: `Bearer ${token}` } });
              if (response?.data) {
                const userData = response.data;
                const serverRole = sanitizeRole(userData.role);
                if (serverRole && serverRole !== cachedRole) {
                  authLogger.debug('Role changed on server, updating cache');
                  setUserRole(serverRole);
                  localStorage.setItem('userRole', serverRole);
                }
              }
            } catch (error) {
              authLogger.warn('Background role verification failed', error.message);
            }
          }, 1000); // Verify in background after 1 second
        }
        
        // STEP 1: Role check with extended timeout for cold starts using backend API
        let userRole = cachedRole;
        
        // PERFORMANCE OPTIMIZATION: Skip API call completely if we have valid cached role
        if (!cachedRole || cachedEmail !== firebaseUser.email) {
          authLogger.debug('No valid cached role found, fetching from API');
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
            } else if (roleResponse?.status === 404) {
              authLogger.debug('User not found (404) - treating as new user');
              userRole = null;
            } else if (roleResponse?.status === 403) {
              // Email verification required - redirect to verification page
              const errorData = roleResponse.data || {};
              if (errorData.detail?.includes('Email verification required')) {
                authLogger.warn('Email verification required during role check');
                setInitializing(false);
                navigate('/verify-email');
                return;
              }
              throw new Error(`Role check failed: ${roleResponse?.status}`);
            } else {
              throw new Error(`Role check failed: ${roleResponse?.status}`);
            }
          } catch (error) {
            authLogger.error('Role check error', error.message);
            
            // Check if we have a cached role in localStorage as fallback
            const fallbackCachedRole = sanitizeRole(localStorage.getItem('userRole'));
            if (fallbackCachedRole) {
              authLogger.debug('API failed, but found cached role', fallbackCachedRole);
              authLogger.warn(`API role check failed (${error.message}), using cached role: ${fallbackCachedRole}`);
              userRole = fallbackCachedRole;
            } else {
              if (error.message.includes('Role check timeout')) {
                authLogger.warn('Role check timed out after 30s - no cached role available (backend may be cold starting)');
              } else if (error.message.includes('Firebase auth token unavailable')) {
                authLogger.error('Firebase token issue - no cached role available');
              } else {
                authLogger.debug('Role check error - no cached role available', error.message);
              }
              userRole = null;
            }
          }
        } else {
          authLogger.debug('Using cached role for instant startup - skipping API call entirely');
          userRole = cachedRole;
        }

        if (!userRole) {
          authLogger.debug('No user role found - redirecting to select-role');
          setUserRole(null);
          localStorage.removeItem('userRole'); // Clear any stale role data
          setLeagues([]);
          setRole(null);
          setRoleChecked(true);
          
          const currentPath = window.location.pathname;
          authLogger.debug('Current path', currentPath);
          if (currentPath.startsWith('/join-event/')) {
            const joinPath = currentPath.replace('/join-event/', '');
            localStorage.setItem('pendingEventJoin', joinPath);
          }
          
          authLogger.debug('Navigating to /select-role');
          navigate("/select-role");
          setInitializing(false);
          return;
        }

        authLogger.debug('User role found', userRole);
        setUserRole(userRole);
        // Persist only valid roles to localStorage
        if (userRole && VALID_ROLES.includes(userRole)) {
          localStorage.setItem('userRole', userRole);
        } else {
          localStorage.removeItem('userRole');
        }
        localStorage.setItem('userEmail', firebaseUser.email);

        // STEP 2: INTELLIGENT LEAGUE LOADING - Skip only for new organizers
        const currentPath = window.location.pathname;
        authLogger.debug('Current path (with role)', currentPath);
        const isNewOrganizerFlow = userRole === 'organizer' && (currentPath === '/select-role' || currentPath === '/create-league');
        
        if (isNewOrganizerFlow) {
          // ULTRA-FAST PATH: New organizers get immediate state setup and navigation
          setLeagues([]);
          setSelectedLeagueIdState('');
          setRole(userRole);
          localStorage.removeItem('selectedLeagueId');
          setRoleChecked(true);
          setInitializing(false);
          authLogger.info('PERFORMANCE: New organizer ultra-fast path - immediate navigation ready');

          // Optional: auto-create a default league
          if (AUTO_CREATE_DEFAULT_LEAGUE) {
            try {
              await createDefaultLeagueIfNeeded(firebaseUser, userRole);
            } catch (autoLeagueErr) {
              authLogger.warn('AUTO-LEAGUE', `Auto-create on ultra-fast path failed: ${autoLeagueErr.message}`);
            }
          }
        } else if (!leagueFetchInProgress) {
          // Normal path for existing users not on select-role
          setLeagueFetchInProgress(true);
          
          try {
            // Avoid fetching leagues on onboarding routes to prevent 401 spam when session is refreshing
            try {
              const path = window.location?.pathname || '';
              const onboarding = ['/login','/signup','/verify-email','/welcome','/'];
              if (onboarding.includes(path)) {
                authLogger.debug('Skipping leagues fetch on onboarding route', path);
                setLeagueFetchInProgress(false);
                return;
              }
            } catch {}
            const leagueResponse = await api.get(`/leagues/me`);
            
            // Normalize possible shapes: array or { leagues: [...] }
            const userLeagues = Array.isArray(leagueResponse.data)
              ? leagueResponse.data
              : (Array.isArray(leagueResponse.data?.leagues) ? leagueResponse.data.leagues : []);
            setLeagues(userLeagues);
            
            const rawStored = localStorage.getItem('selectedLeagueId');
            const currentSelectedLeagueId = (rawStored && rawStored !== 'null' && rawStored !== 'undefined' && rawStored.trim() !== '') ? rawStored : '';
            let targetLeagueId = currentSelectedLeagueId;
            
            if (userLeagues.length > 0) {
              if (!targetLeagueId || !userLeagues.some(l => l.id === targetLeagueId)) {
                targetLeagueId = userLeagues[0].id;
              }
              
              setSelectedLeagueIdState(targetLeagueId);
              localStorage.setItem('selectedLeagueId', targetLeagueId);
              
              const selectedLeague = userLeagues.find(l => l.id === targetLeagueId);
              setRole(selectedLeague?.role || null);
            } else {
              // No leagues found for organizer
              // Optional: auto-create for smoother onboarding
              if (AUTO_CREATE_DEFAULT_LEAGUE) {
                await createDefaultLeagueIfNeeded(firebaseUser, userRole);
              }
              // RACE CONDITION FIX:
              // Do not clear an explicitly selected league that might have just been set
              // by the Create League flow or another tab. Respect any existing selection
              // in localStorage and only clear if none exists.
              const persistedSelectedRaw = localStorage.getItem('selectedLeagueId');
              const persistedSelected = (persistedSelectedRaw && persistedSelectedRaw !== 'null' && persistedSelectedRaw !== 'undefined' && persistedSelectedRaw.trim() !== '') ? persistedSelectedRaw : '';
              if (!persistedSelected || persistedSelected.trim() === '') {
                setSelectedLeagueIdState('');
                setRole(null);
                // Do not remove key unnecessarily to avoid thrashing between tabs/routes
              } else {
                // If there is a persisted selection, reflect it in state
                setSelectedLeagueIdState(persistedSelected);
              }
            }
            
          } catch (leagueError) {
            // Preserve any previously selected league on transient errors
            setLeagues([]);
            const persistedSelectedRaw = localStorage.getItem('selectedLeagueId');
            const persistedSelected = (persistedSelectedRaw && persistedSelectedRaw !== 'null' && persistedSelectedRaw !== 'undefined' && persistedSelectedRaw.trim() !== '') ? persistedSelectedRaw : '';
            if (persistedSelected) {
              setSelectedLeagueIdState(persistedSelected);
            } else {
              setSelectedLeagueIdState('');
            }
            setRole(null);
            // Do not remove from localStorage here to avoid wiping user context on intermittent failures
          } finally {
            setLeagueFetchInProgress(false);
          }
        }

        setRoleChecked(true);
        
        // Navigation logic (reuse currentPath from above)
        // Include '/welcome' so authenticated users land on the dashboard automatically
        const onboardingRoutes = ["/login", "/signup", "/", "/welcome"];
        authLogger.debug('Checking navigation', { currentPath, onboardingRoutes });
        authLogger.debug('Auth state after role check', {
          userRole,
          selectedLeagueId: localStorage.getItem('selectedLeagueId'),
          leaguesLoaded: leagues?.length || 0
        });
        
        if (onboardingRoutes.includes(currentPath)) {
          // If we were redirected here due to session expiry, send user back
          try {
            const target = localStorage.getItem('postLoginRedirect');
            if (target && target !== '/login') {
              localStorage.removeItem('postLoginRedirect');
              authLogger.debug('Navigating back to post-login redirect', target);
              navigate(target, { replace: true });
              return;
            }
          } catch {}
          // If we have a pending invited join, honor it first
          const pendingEventJoin = localStorage.getItem('pendingEventJoin');
          if (pendingEventJoin) {
            const safePath = pendingEventJoin.split('/').map(part => encodeURIComponent(part)).join('/');
            authLogger.debug('Redirecting to pending invited event join');
            navigate(`/join-event/${safePath}`, { replace: true });
          } else {
            authLogger.debug('Navigating to /dashboard');
            navigate("/dashboard");
          }
        } else {
          authLogger.debug('Staying on current path', currentPath);
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
          navigate("/select-role");
        }
      } finally {
        setInitializing(false);
      }
    });

    return () => unsubscribe();
  }, []); // CRITICAL: Empty dependency array to prevent infinite loops

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

  // Add logout function directly in AuthContext to avoid circular dependency
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      // Clear all auth state
      setUser(null);
      setLeagues([]);
      setSelectedLeagueIdState('');
      setRole(null);
      setUserRole(null);
      setError(null);
      // Clear localStorage including invitation data
      localStorage.removeItem('selectedLeagueId');
      localStorage.removeItem('selectedEventId');
      localStorage.removeItem('pendingEventJoin');
      localStorage.removeItem('userRole');
      cacheInvalidation.userLoggedOut();
    } catch {
      // Logout error handled internally
      // Still clear state even if signOut fails
      setUser(null);
      setLeagues([]);
      setSelectedLeagueIdState('');
      setRole(null);
      setUserRole(null);
      localStorage.removeItem('selectedLeagueId');
      localStorage.removeItem('selectedEventId');
      localStorage.removeItem('pendingEventJoin');
      localStorage.removeItem('userRole');
      cacheInvalidation.userLoggedOut();
    }
  }, []);

  // Add function to refresh user role after it's been set via API
  const refreshUserRole = useCallback(async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken(true); // Force refresh token
      const response = await api.get(`/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response?.data) {
        const userData = response.data;
        const newRole = userData.role;
        authLogger.debug('Refreshed user role', newRole);
        setUserRole(newRole);
        // Persist role to localStorage for browser refresh resilience
        localStorage.setItem('userRole', newRole);
        
        // FIXED: Don't reload page - let the auth flow handle navigation naturally
        if (newRole && !userRole) {
          authLogger.debug('First-time role detected, allowing natural navigation');
          // Natural navigation will happen via SelectRole component
        }
      }
    } catch (error) {
      authLogger.error('Failed to refresh user role', error);
    }
  }, [user, userRole]);

  // Expose state setters for logout functionality
  const contextValue = {
    user,
    userRole,
    role,
      initializing,
    leagues,
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
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {initializing && <LoadingScreen size="large" />}
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