import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import api from '../lib/api';
import { useNavigate } from "react-router-dom";

import { useToast } from './ToastContext';
import LoadingScreen from '../components/LoadingScreen';
import { authLogger } from '../utils/logger';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Optimized state management with faster initial checks
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authChecked, setAuthChecked] = useState(false); // New: faster auth check
  const [roleChecked, setRoleChecked] = useState(false); // NEW: role verification complete
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueIdState] = useState(() => localStorage.getItem('selectedLeagueId') || '');
  const [role, setRole] = useState(null);
  const [userRole, setUserRole] = useState(() => {
    // Try to restore userRole from localStorage on initialization
    const storedRole = localStorage.getItem('userRole');
    return storedRole && storedRole !== 'null' ? storedRole : null;
  });
  const navigate = useNavigate();
  const { showColdStartNotification, isColdStartActive } = useToast();
  
  // CRITICAL FIX: Prevent concurrent league fetches during cold start
  const [leagueFetchInProgress, setLeagueFetchInProgress] = useState(false);

  // PERFORMANCE: Backend warmup to reduce cold start impact
  const warmupBackend = useCallback(async () => {
    try {
      authLogger.debug('Warming up backend...');
      const warmupStart = performance.now();
      
      await Promise.race([
        fetch(`${import.meta.env.VITE_API_BASE || 'https://woo-combine-backend.onrender.com/api'}/warmup`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Warmup timeout')), 3000))
      ]);
      
      const warmupTime = performance.now() - warmupStart;
      authLogger.debug(`Backend warmed up in ${warmupTime.toFixed(0)}ms`);
    } catch (error) {
      authLogger.warn('Backend warmup failed', error.message);
    }
  }, []);

  // PERFORMANCE: Concurrent league fetching to reduce wait time
  const fetchLeaguesConcurrently = useCallback(async (firebaseUser, userRole) => {
    if (leagueFetchInProgress) return;
    
    setLeagueFetchInProgress(true);
    authLogger.debug('Starting concurrent league fetch');
    
    try {
      const token = await firebaseUser.getIdToken(false);
      const response = await Promise.race([
        fetch(`${import.meta.env.VITE_API_BASE || 'https://woo-combine-backend.onrender.com/api'}/leagues/my`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('League fetch timeout')), 5000))
      ]);

      if (response.ok) {
        const leagueData = await response.json();
        setLeagues(leagueData);
        authLogger.debug('Leagues loaded concurrently', leagueData.length);
      }
    } catch (error) {
      authLogger.warn('Concurrent league fetch failed', error.message);
      // Don't block UI for failed league fetch
    } finally {
      setLeagueFetchInProgress(false);
    }
  }, [leagueFetchInProgress]);





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
      
      if (!firebaseUser.emailVerified) {
        // User needs to verify email - redirect will be handled by RequireAuth
        setInitializing(false);
        return;
      }
      
      // Complete initialization inline to prevent dependency loops
      try {
        authLogger.debug('Starting role check for user', firebaseUser.email);
        
        // PERFORMANCE FIX: Always use cached role for immediate UI load
        const cachedRole = localStorage.getItem('userRole');
        const cachedEmail = localStorage.getItem('userEmail');
        
        if (cachedRole && cachedRole !== 'null' && cachedEmail === firebaseUser.email) {
          authLogger.debug('Using cached role for immediate startup', cachedRole);
          setUserRole(cachedRole);
          setRole(cachedRole);
          setRoleChecked(true);
          setInitializing(false); // Don't wait for API verification
          
          // Start league fetch immediately if we have a role
          if (cachedRole !== null) {
            fetchLeaguesConcurrently(firebaseUser, cachedRole);
          }
          
          // Still verify role in background, but don't block UI
          setTimeout(async () => {
            try {
              const token = await firebaseUser.getIdToken(false);
              const response = await fetch(`${import.meta.env.VITE_API_BASE || 'https://woo-combine-backend.onrender.com/api'}/users/me`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              });
              if (response.ok) {
                const userData = await response.json();
                if (userData.role !== cachedRole) {
                  authLogger.debug('Role changed on server, updating cache');
                  setUserRole(userData.role);
                  localStorage.setItem('userRole', userData.role);
                }
              }
            } catch (error) {
              authLogger.warn('Background role verification failed', error.message);
            }
          }, 1000); // Verify in background after 1 second
        }
        
        // STEP 1: Role check with extended timeout for cold starts using backend API
        let userRole = cachedRole;
        
        // If we have a cached role, skip the API call to speed up startup
        if (!cachedRole || cachedRole === 'null') {
          authLogger.debug('No cached role found, fetching from API');
          try {
            let token;
            try {
              // Try cached token first, fallback to refresh only if needed
              token = await firebaseUser.getIdToken(false);
            } catch (tokenError) {
              authLogger.warn('Cached token failed, trying refresh:', tokenError.message);
              try {
                token = await firebaseUser.getIdToken(true);
              } catch (refreshError) {
                authLogger.error('Token refresh failed:', refreshError.message);
                throw new Error('Firebase auth token unavailable');
              }
            }
            
            const apiUrl = `${import.meta.env.VITE_API_BASE || 'https://woo-combine-backend.onrender.com/api'}/users/me`;
            authLogger.debug('Making API call to', apiUrl);
            
            const roleResponse = await Promise.race([
              fetch(apiUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Role check timeout')), 8000)) // Reduced to 8s - if backend takes longer, use cache
            ]);

            authLogger.debug('API Response status', roleResponse.status);
            
            if (roleResponse.ok) {
              const userData = await roleResponse.json();
              authLogger.debug('User data received', userData);
              userRole = userData.role;
            } else if (roleResponse.status === 404) {
              authLogger.debug('User not found (404) - treating as new user');
              userRole = null;
            } else if (roleResponse.status === 403) {
              // Email verification required - redirect to verification page
              const errorData = await roleResponse.json().catch(() => ({}));
              if (errorData.detail?.includes('Email verification required')) {
                authLogger.warn('Email verification required during role check');
                setInitializing(false);
                navigate('/verify-email');
                return;
              }
              throw new Error(`Role check failed: ${roleResponse.status}`);
            } else {
              throw new Error(`Role check failed: ${roleResponse.status}`);
            }
          } catch (error) {
            authLogger.error('Role check error', error.message);
            
            // Check if we have a cached role in localStorage as fallback
            const fallbackCachedRole = localStorage.getItem('userRole');
            if (fallbackCachedRole && fallbackCachedRole !== 'null') {
              authLogger.debug('API failed, but found cached role', fallbackCachedRole);
              authLogger.warn(`API role check failed (${error.message}), using cached role: ${fallbackCachedRole}`);
              userRole = fallbackCachedRole;
            } else {
              if (error.message.includes('Role check timeout')) {
                authLogger.warn('Role check timed out after 30s - no cached role available');
                authLogger.warn('Role check timed out after 30s - no cached role available (backend may be cold starting)');
              } else if (error.message.includes('Firebase auth token unavailable')) {
                authLogger.error('Firebase token issue - no cached role available');
                authLogger.error('Firebase token issue - no cached role available');
              } else {
                authLogger.error('Other role check error - no cached role available', error.message);
                authLogger.debug('Role check error - no cached role available', error.message);
              }
              userRole = null;
            }
          }
        } else {
          authLogger.debug('Skipping API call, using cached role for faster startup');
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
        // Persist role AND email to localStorage for browser refresh resilience
        localStorage.setItem('userRole', userRole);
        localStorage.setItem('userEmail', firebaseUser.email);

        // STEP 2: AGGRESSIVE OPTIMIZATION - Skip league fetch on initial load for speed
        // Do it in background after navigation completes
        const currentPath = window.location.pathname;
        authLogger.debug('Current path (with role)', currentPath);
        const isNewOrganizerFlow = currentPath === '/select-role' && userRole === 'organizer';
        const isInitialLoad = currentPath === '/select-role';
        
        if (isNewOrganizerFlow || isInitialLoad) {
          // FAST PATH: Set empty state immediately, fetch leagues in background
          setLeagues([]);
          setSelectedLeagueIdState('');
          setRole(null);
          localStorage.removeItem('selectedLeagueId');
          authLogger.info('PERFORMANCE: Fast path - will fetch leagues in background');
          
          // Background league fetch (non-blocking)
          if (!isNewOrganizerFlow) {
            setTimeout(async () => {
              try {
                const leagueResponse = await api.get(`/leagues/me`, { 
                  timeout: 30000, // Increased to 30s for Render cold starts
                  retry: 0
                });
                
                const userLeagues = leagueResponse.data.leagues || [];
                setLeagues(userLeagues);
                
                if (userLeagues.length > 0) {
                  const targetLeagueId = userLeagues[0].id;
                  setSelectedLeagueIdState(targetLeagueId);
                  localStorage.setItem('selectedLeagueId', targetLeagueId);
                  
                  const selectedLeague = userLeagues.find(l => l.id === targetLeagueId);
                  setRole(selectedLeague?.role || null);
                  authLogger.info('BACKGROUND: Leagues loaded successfully');
                }
              } catch (error) {
                authLogger.info('BACKGROUND: League fetch failed (non-critical)');
              }
            }, 100); // Minimal delay to let navigation complete
          }
        } else if (!leagueFetchInProgress) {
          // Normal path for existing users not on select-role
          setLeagueFetchInProgress(true);
          
          try {
            const leagueResponse = await api.get(`/leagues/me`, { 
              timeout: 30000, // Increased to 30s for Render cold starts
              retry: 0
            });
            
            const userLeagues = leagueResponse.data.leagues || [];
            setLeagues(userLeagues);
            
            const currentSelectedLeagueId = localStorage.getItem('selectedLeagueId') || '';
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
              setSelectedLeagueIdState('');
              setRole(null);
              localStorage.removeItem('selectedLeagueId');
            }
            
          } catch (leagueError) {
            setLeagues([]);
            setSelectedLeagueIdState('');
            setRole(null);
            localStorage.removeItem('selectedLeagueId');
          } finally {
            setLeagueFetchInProgress(false);
          }
        }

        setRoleChecked(true);
        
        // Navigation logic (reuse currentPath from above)
        const onboardingRoutes = ["/login", "/signup", "/"];
        authLogger.debug('Checking navigation', { currentPath, onboardingRoutes });
        authLogger.debug('Auth state after role check', {
          userRole,
          selectedLeagueId: localStorage.getItem('selectedLeagueId'),
          leaguesLoaded: leagues?.length || 0
        });
        
        if (onboardingRoutes.includes(currentPath)) {
          authLogger.debug('Navigating to /dashboard');
          navigate("/dashboard");
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
    }
  }, []);

  // Add function to refresh user role after it's been set via API
  const refreshUserRole = useCallback(async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken(true); // Force refresh token
              const response = await fetch(`${import.meta.env.VITE_API_BASE || 'https://woo-combine-backend.onrender.com/api'}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
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
    leagues,
    selectedLeagueId,
    setSelectedLeagueId: useCallback((id) => {
      setSelectedLeagueIdState(id);  // Set the state
      localStorage.setItem('selectedLeagueId', id);  // Persist to localStorage
      
      // Update role when league changes
      if (leagues.length > 0) {
        const selectedLeague = leagues.find(l => l.id === id);
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

  // Show loading screen while initializing
  if (initializing) {
    return <LoadingScreen size="large" />;
  }

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