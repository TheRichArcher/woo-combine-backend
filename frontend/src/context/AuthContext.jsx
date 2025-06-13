import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import api from '../lib/api';
import { useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useLogout } from './logout';
import LoadingScreen from '../components/LoadingScreen';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Optimized state management with faster initial checks
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authChecked, setAuthChecked] = useState(false); // New: faster auth check
  const [roleChecked, setRoleChecked] = useState(false); // NEW: role verification complete
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => localStorage.getItem('selectedLeagueId') || '');
  const [role, setRole] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  // Fast initial auth check - just Firebase auth state
  const quickAuthCheck = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setUser(null);
      setAuthChecked(true);
      return false;
    }

    setUser(firebaseUser);
    setAuthChecked(true);
    
    // Quick email verification check
    if (!firebaseUser.emailVerified) {
      if (window.location.pathname !== '/verify-email') {
        navigate('/verify-email');
      }
      return false;
    }

    return true; // User is authenticated and verified
  }, [navigate, setUser, setAuthChecked]);

  // OPTIMIZED: Sub-second initialization like big apps
  const completeInitialization = useCallback(async (firebaseUser) => {
    try {
      const db = getFirestore();
      
      // PARALLEL OPERATIONS: Role check + League fetch simultaneously (like Twitter/Instagram)
      const [roleResult, leagueResult] = await Promise.allSettled([
        // Role check with extended timeout (8s max for cold starts)
        Promise.race([
          getDoc(doc(db, "users", firebaseUser.uid)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Role check timeout')), 8000))
        ]),
        
        // League fetch with extended timeout (10s max for cold starts)  
        Promise.race([
          api.get(`/leagues/me`, { timeout: 10000 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('League fetch timeout')), 10000))
        ])
      ]);

      // Handle role check result
      if (roleResult.status === 'fulfilled' && roleResult.value.exists() && roleResult.value.data().role) {
        const userRole = roleResult.value.data().role;
        setUserRole(userRole);
      } else {
        // FAIL FAST: No role found or timeout - redirect immediately
        setUserRole(null);
        setLeagues([]);
        setRole(null);
        setRoleChecked(true);
        navigate("/select-role");
        return;
      }

      // Handle league fetch result
      let userLeagues = [];
      if (leagueResult.status === 'fulfilled') {
        userLeagues = leagueResult.value.data.leagues || [];
        setLeagues(userLeagues);
      } else {
        // EXTENDED RETRY: Single 8s retry for leagues only
        try {
          const retryRes = await Promise.race([
            api.get(`/leagues/me`, { timeout: 8000 }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Retry timeout')), 8000))
          ]);
          userLeagues = retryRes.data.leagues || [];
          setLeagues(userLeagues);
        } catch {
          // Give up gracefully - empty leagues is better than long wait
          userLeagues = [];
          setLeagues([]);
        }
      }
        
      // Set up selected league and role
      let targetLeagueId = selectedLeagueId;
      
      if (userLeagues.length > 0) {
        // If no league selected or selected league doesn't exist, use first available
        if (!targetLeagueId || !userLeagues.some(l => l.id === targetLeagueId)) {
          targetLeagueId = userLeagues[0].id;
        }
        
        setSelectedLeagueId(targetLeagueId);
        localStorage.setItem('selectedLeagueId', targetLeagueId);
        
        const selectedLeague = userLeagues.find(l => l.id === targetLeagueId);
        setRole(selectedLeague?.role || null);
      } else {
        setSelectedLeagueId('');
        setRole(null);
        localStorage.removeItem('selectedLeagueId');
      }

      // Mark role check as complete
      setRoleChecked(true);

      // Navigation logic - only redirect from onboarding routes, not between authenticated pages
      const currentPath = window.location.pathname;
      const onboardingRoutes = ["/login", "/signup", "/verify-email", "/select-role", "/"];
      const authenticatedRoutes = ["/dashboard", "/players", "/admin", "/roster", "/schedule"];
      
      if (onboardingRoutes.includes(currentPath)) {
        navigate("/dashboard");
      } else if (authenticatedRoutes.includes(currentPath)) {
        // Don't redirect - user is already on a valid authenticated page
      }

    } catch (error) {
      console.error('[AuthContext] Background initialization failed:', error);
      setError(error);
      setRoleChecked(true); // Role check complete - even if failed
      navigate("/select-role");
    }
  }, [navigate, selectedLeagueId, setUserRole, setLeagues, setRole, setSelectedLeagueId, setError]);

  // Main auth state listener with optimized flow
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Reset role check state for each auth change
      setRoleChecked(false);
      
      // Step 1: Quick auth check (shows UI faster)
      const isAuthenticated = await quickAuthCheck(firebaseUser);
      
      if (!isAuthenticated) {
        setRoleChecked(true); // No role needed for unauthenticated users
        setInitializing(false); // Stop loading for unauthenticated/unverified users
        return;
      }

      // Step 2: Complete initialization in background (user sees page faster)
      // But skip if we already have role and leagues loaded for the same user
      const shouldSkipInitialization = userRole && leagues.length > 0 && 
                                      user && user.uid === firebaseUser.uid;
      
      if (shouldSkipInitialization) {
        // CRITICAL: Even when skipping initialization, check if user is on wrong page
        const currentPath = window.location.pathname;
        const onboardingRoutes = ["/login", "/signup", "/verify-email", "/select-role", "/"];
        
        if (onboardingRoutes.includes(currentPath)) {
          navigate("/dashboard");
        }
        
        setRoleChecked(true); // User already has role
        setInitializing(false);
        return;
      }

      try {
        await completeInitialization(firebaseUser);
      } catch (error) {
        console.error('[AuthContext] Initialization error:', error);
        setError(error);
      } finally {
        setInitializing(false); // Always stop loading
      }
      
    }, (err) => {
      console.error('[AuthContext] Auth state change error:', err);
      setError(err);
      setInitializing(false);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [navigate, userRole, leagues.length, user, quickAuthCheck, completeInitialization]);

  // Persist selectedLeagueId changes
  useEffect(() => {
    if (selectedLeagueId) {
      localStorage.setItem('selectedLeagueId', selectedLeagueId);
    } else {
      localStorage.removeItem('selectedLeagueId');
    }
  }, [selectedLeagueId]);

  // Add league after join
  const addLeague = (league) => {
    setLeagues(prev => {
      if (prev.some(l => l.id === league.id)) return prev;
      return [...prev, league];
    });
    setSelectedLeagueId(league.id);
    localStorage.setItem('selectedLeagueId', league.id);
    setRole(league.role);
  };

  // Check if user is organizer for selected league
  const isOrganizer = () => {
    return leagues.find(l => l.id === selectedLeagueId)?.role === 'organizer';
  };

  // Show loading screen until BOTH auth and role checks are complete
  if (initializing || (user && user.emailVerified && !roleChecked)) {
    const isAuthPhase = !authChecked;
    return (
      <LoadingScreen 
        title={isAuthPhase ? "Loading WooCombine..." : "Loading your data..."}
        subtitle={isAuthPhase ? "Checking authentication" : "Verifying your account"}
        size="large"
      />
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      loading: initializing, // For backward compatibility
      roleChecking: false, // No longer used
      error,
      setError,
      leagues,
      setLeagues,
      selectedLeagueId,
      setSelectedLeagueId,
      role,
      setRole,
      userRole,
      setUserRole,
      addLeague,
      isOrganizer,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { useLogout }; 