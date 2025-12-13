import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut, getIdTokenResult } from "firebase/auth";
import api, { apiHealth, apiWarmup } from '../lib/api';
import { useNavigate } from "react-router-dom";

import { useToast } from './ToastContext';
import LoadingScreen from '../components/LoadingScreen';
import { authLogger } from '../utils/logger';
import { cacheInvalidation } from '../utils/dataCache';
import { fetchSchemas } from '../constants/drillTemplates';

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
      // ALSO FETCH SCHEMAS HERE to preload the Multi-Sport Engine
      const warmupPromises = [
        apiWarmup().catch(() => null), 
        apiHealth().catch(() => null),
        fetchSchemas().catch(() => null)
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

  // PERFORMANCE: Concurrent league fetching with retry logic for cold starts
  const fetchLeaguesConcurrently = useCallback(async (firebaseUser, userRole) => {
    if (leagueFetchInProgress) return;
    
    setLeagueFetchInProgress(true);
    authLogger.debug('Starting concurrent league fetch');
    
    let attempts = 0;
    const maxAttempts = 3;
    
    const tryFetch = async () => {
      try {
        // Force refresh on retries OR first attempt to ensure fresh token for cold start
        const token = await firebaseUser.getIdToken(true); 
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
          
          // Set selection if needed
          const rawStored = localStorage.getItem('selectedLeagueId');
          const currentSelectedLeagueId = (rawStored && rawStored !== 'null' && rawStored !== 'undefined' && rawStored.trim() !== '') ? rawStored : '';
          
          if (leagueArray.length > 0 && (!currentSelectedLeagueId || !leagueArray.some(l => l.id === currentSelectedLeagueId))) {
             const targetLeagueId = leagueArray[0].id;
             setSelectedLeagueIdState(targetLeagueId);
             localStorage.setItem('selectedLeagueId', targetLeagueId);
             setRole(leagueArray[0].role);
          }
          return true; // Success
        }
        return false;
      } catch (error) {
        authLogger.warn(`Concurrent league fetch failed (attempt ${attempts + 1}/${maxAttempts})`, error.message);
        return false;
      }
    };

    try {
      // Avoid fetching leagues on onboarding routes to prevent 401 spam when session is refreshing
      const path = window.location?.pathname || '';
      // Do not skip fetching on /welcome - authenticated users landing there need leagues
      const onboarding = ['/login','/signup','/verify-email','/'];
      if (onboarding.includes(path)) {
        authLogger.debug('Skipping leagues fetch on onboarding route', path);
        setLeagueFetchInProgress(false);
        return;
      }
      
      while (attempts < maxAttempts) {
        const success = await tryFetch();
        if (success) break;
        
        attempts++;
        if (attempts < maxAttempts) {
          // Exponential backoff: 500ms, 1500ms, 3000ms
          await new Promise(r => setTimeout(r, attempts * 500 + 500)); 
        }
      }
    } finally {
      setLeagueFetchInProgress(false);
    }
  }, [leagueFetchInProgress]);




  // CRITICAL FIX: Firebase auth state change handler with stable dependencies
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      authLogger.debug('Auth state change', firebaseUser ? 'User logged in' : 'User logged out');
      
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
        if (initialPath === '/login') {
          // CRITICAL FIX: Check for pending join FIRST, before default redirect
          // This ensures users returning from email verification loop back to the join flow
          const pendingEventJoin = localStorage.getItem('pendingEventJoin');
          if (pendingEventJoin) {
            const safePath = pendingEventJoin.split('/').map(part => encodeURIComponent(part)).join('/');
            authLogger.debug('Redirecting to pending invited event join from FAST EXIT');
            navigate(`/join-event/${safePath}`, { replace: true });
            setInitializing(false);
            return;
          }

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
        if (!isVerificationBridgeRoute) {
          navigate('/verify-email');
        }
        return;
      }

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
          
            // CRITICAL FIX: Always fetch leagues after login, even with cache
          try {
            const path = window.location?.pathname || '';
            // Do not skip fetching on /welcome - authenticated users landing there need leagues
            const onboarding = ['/login','/signup','/verify-email','/'];
            if (cachedRole !== null && !onboarding.includes(path)) {
              console.debug("[AUTH] Calling fetchLeagues() after login (cached path)");
              fetchLeaguesConcurrently(firebaseUser, cachedRole);
            }
          } catch {
            // Do not fetch while on onboarding routes
          }
          
          // Still verify role in background, but don't block UI
          setTimeout(async () => {
            try {
              const token = await firebaseUser.getIdToken(false);
              const response = await api.get(`/users/me`, { headers: { Authorization: `Bearer ${token}` } });
              if (response?.data) {
                const userData = response.data;
                const serverRole = sanitizeRole(userData.role);
                
                // CRITICAL FIX: Restore pending invite from background check too
                if (userData.pending_invite && !localStorage.getItem('pendingEventJoin')) {
                   authLogger.info('Restoring pending invite from server profile (background)', userData.pending_invite);
                   localStorage.setItem('pendingEventJoin', userData.pending_invite);
                }

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
              
              // CRITICAL FIX: Restore pending invite from server if missing locally
              // This handles the cross-device / incognito verification flow
              if (userData.pending_invite && !localStorage.getItem('pendingEventJoin')) {
                authLogger.info('Restoring pending invite from server profile', userData.pending_invite);
                localStorage.setItem('pendingEventJoin', userData.pending_invite);
              }
            } else if (roleResponse?.status === 404) {
              authLogger.debug('User not found (404) - treating as new user');
              userRole = null;
            } else if (roleResponse?.status === 403) {
              // Email verification required - redirect to verification page
              const errorData = roleResponse.data || {};
              if (errorData.detail?.includes('Email verification required')) {
                authLogger.warn('Email verification required during role check');
                setInitializing(false);
                if (!isVerificationBridgeRoute) {
                  navigate('/verify-email');
                }
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
          if (!isVerificationBridgeRoute) {
            navigate("/select-role");
          }
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
        } else {
          // CRITICAL FIX: Always fetch leagues if not in new organizer flow
          // Check if we already triggered it in the cached path above to avoid double-fetch?
          // The concurrency guard inside fetchLeaguesConcurrently handles that.
          
          console.debug("[AUTH] Calling fetchLeagues() after login (standard path)");
          fetchLeaguesConcurrently(firebaseUser, userRole);
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
          if (!isVerificationBridgeRoute) {
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
        
        // CRITICAL FIX: Restore pending invite during manual refresh
        if (userData.pending_invite && !localStorage.getItem('pendingEventJoin')) {
            authLogger.info('Restoring pending invite from server profile (refresh)', userData.pending_invite);
            localStorage.setItem('pendingEventJoin', userData.pending_invite);
        }
        
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