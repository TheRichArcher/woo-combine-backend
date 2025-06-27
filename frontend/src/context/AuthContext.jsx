import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import api from '../lib/api';
import { useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useToast } from './ToastContext';
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
  const [selectedLeagueId, setSelectedLeagueIdState] = useState(() => localStorage.getItem('selectedLeagueId') || '');
  const [role, setRole] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();
  const { showColdStartNotification, isColdStartActive } = useToast();
  
  // CRITICAL FIX: Prevent concurrent league fetches during cold start
  const [leagueFetchInProgress, setLeagueFetchInProgress] = useState(false);

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

  // OPTIMIZED: Single request initialization to prevent timeout cascade
  const completeInitialization = useCallback(async (firebaseUser) => {
    try {
      const db = getFirestore();
      
      // STEP 1: Role check with extended timeout for cold starts
      const roleDoc = await Promise.race([
        getDoc(doc(db, "users", firebaseUser.uid)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Role check timeout')), 20000))  // Increased to 20s
      ]);

      if (!roleDoc.exists() || !roleDoc.data().role) {
        setUserRole(null);
        setLeagues([]);
        setRole(null);
        setRoleChecked(true);
        
        // CRITICAL FIX: Preserve join-event routes for invited users
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/join-event/')) {
          // Extract the path parameters and store for after role selection
          const joinPath = currentPath.replace('/join-event/', '');
          localStorage.setItem('pendingEventJoin', joinPath);

        }
        
        navigate("/select-role");
        return;
      }

      const userRole = roleDoc.data().role;
      setUserRole(userRole);

      // STEP 2: League fetch with single request and extended timeout
      // CRITICAL FIX: Prevent concurrent league fetches
      if (leagueFetchInProgress) {
        return; // Another fetch is already in progress
      }
      
      setLeagueFetchInProgress(true);
      let coldStartToastId = null;
      let coldStartTimer = null;
      
      try {
        // Show cold start notification after 5 seconds if still loading and no notification is active
        coldStartTimer = setTimeout(() => {
          if (!coldStartToastId && !isColdStartActive()) {
            coldStartToastId = showColdStartNotification();
          }
        }, 5000);

        const leagueResponse = await api.get(`/leagues/me`, { 
          timeout: 45000,  // 45s timeout to match API client for extreme cold starts
          retry: 1         // REDUCED: Only 1 retry to prevent cascade
        });
        
        // Clear the cold start timer if request completes quickly
        if (coldStartTimer) {
          clearTimeout(coldStartTimer);
          coldStartTimer = null;
        }
        
        const userLeagues = leagueResponse.data.leagues || [];
        setLeagues(userLeagues);
        
        // Set up selected league and role
        let targetLeagueId = selectedLeagueId;
        
        if (userLeagues.length > 0) {
          // If no league selected or selected league doesn't exist, use first available
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
        // Clear timer to prevent duplicate notifications
        if (coldStartTimer) {
          clearTimeout(coldStartTimer);
          coldStartTimer = null;
        }
        
        // CRITICAL FIX: 404 "No leagues found" is NORMAL for new users - don't show as error
        if (leagueError.response?.status === 404) {
          // This is expected for new users going through onboarding - handle silently
          setLeagues([]);
          setSelectedLeagueIdState('');
          setRole(null);
          localStorage.removeItem('selectedLeagueId');
          setLeagueFetchInProgress(false);
          
          // GUIDED SETUP FIX: Don't treat 404 as an error during onboarding
          console.info('[AUTH] New user detected - no leagues found (expected for guided setup)');
          
          // CRITICAL FIX: Must complete role check even for 404s to avoid infinite loading
          setRoleChecked(true);
          
          // Complete initialization and allow guided setup to proceed
          setInitializing(false);
          return; // Exit early without error notifications
        }
        
        // Show cold start notification only for real errors (not 404) and if none is already active
        if (!coldStartToastId && !isColdStartActive()) {
          coldStartToastId = showColdStartNotification();
        }
        
        // Enhanced error handling for cold start scenarios (excluding 404s)
        if (leagueError.message.includes('timeout') || leagueError.code === 'ECONNABORTED') {
          // Don't set error state for timeouts - toast notification handles this
          setError(null);
        } else if (leagueError.response?.status >= 500) {
          // Don't set error state for server errors during cold start - toast handles this
          setError(null);
        }
        
        // Continue without leagues rather than blocking the entire app
        setLeagues([]);
        setSelectedLeagueIdState('');
        setRole(null);
        localStorage.removeItem('selectedLeagueId');
      } finally {
        // CRITICAL: Always clear the fetch flag
        setLeagueFetchInProgress(false);
      }

      // Mark role check as complete
      setRoleChecked(true);

      // Navigation logic - only redirect from onboarding routes, not between authenticated pages
      // Note: /select-role is excluded because it has its own navigation logic
      const currentPath = window.location.pathname;
      const onboardingRoutes = ["/login", "/signup", "/verify-email", "/"];
      
      if (onboardingRoutes.includes(currentPath)) {
        navigate("/dashboard");
      }

    } catch (err) {

      setError(err.message);
      setUserRole(null);
      setLeagues([]);
      setRole(null);
      setRoleChecked(true);
      
      // Redirect to appropriate page based on error
      if (err.message.includes('Role check timeout')) {
        // CRITICAL FIX: Preserve join-event routes even on timeout
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
  }, [navigate, selectedLeagueId]);

  // Firebase auth state change handler
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      
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

      // User logged in - start initialization
      const isAuthenticated = await quickAuthCheck(firebaseUser);
      if (isAuthenticated) {
        await completeInitialization(firebaseUser);
      } else {
        setInitializing(false);
      }
    });

    return () => unsubscribe();
  }, [quickAuthCheck, completeInitialization]);

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
    }
  }, []);

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