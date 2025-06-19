import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import api from '../lib/api';
import { useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useLogout } from './logout';
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
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => localStorage.getItem('selectedLeagueId') || '');
  const [role, setRole] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();
  const { showColdStartNotification } = useToast();

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
          console.log('Preserved join-event path for invited user:', joinPath);
        }
        
        navigate("/select-role");
        return;
      }

      const userRole = roleDoc.data().role;
      setUserRole(userRole);

      // STEP 2: League fetch with single request and extended timeout
      let coldStartToastId = null;
      
      try {
        // Show cold start notification after 5 seconds if still loading
        const coldStartTimer = setTimeout(() => {
          coldStartToastId = showColdStartNotification();
        }, 5000);

        const leagueResponse = await api.get(`/leagues/me`, { 
          timeout: 45000,  // 45s timeout to match API client for extreme cold starts
          retry: 2         // Increased retries for cold start scenarios
        });
        
        // Clear the cold start timer if request completes quickly
        clearTimeout(coldStartTimer);
        
        const userLeagues = leagueResponse.data.leagues || [];
        setLeagues(userLeagues);
        
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
        
      } catch (leagueError) {
        console.error('[AuthContext] League fetch failed:', leagueError.message);
        
        // Show cold start notification if not already shown
        if (!coldStartToastId) {
          showColdStartNotification();
        }
        
        // Enhanced error handling for cold start scenarios
        if (leagueError.message.includes('timeout') || leagueError.code === 'ECONNABORTED') {
          setError('Server is starting up. Please refresh the page in a moment.');
        } else if (leagueError.response?.status >= 500) {
          setError('Server is temporarily unavailable. Please try again shortly.');
        }
        
        // Continue without leagues rather than blocking the entire app
        setLeagues([]);
        setSelectedLeagueId('');
        setRole(null);
        localStorage.removeItem('selectedLeagueId');
      }

      // Mark role check as complete
      setRoleChecked(true);

      // Navigation logic - only redirect from onboarding routes, not between authenticated pages
      const currentPath = window.location.pathname;
      const onboardingRoutes = ["/login", "/signup", "/verify-email", "/select-role", "/"];
      
      if (onboardingRoutes.includes(currentPath)) {
        navigate("/dashboard");
      }

    } catch (err) {
      console.error('[AuthContext] Initialization error:', err.message);
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
          console.log('Preserved join-event path on timeout:', joinPath);
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
        setSelectedLeagueId('');
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
      console.log('AuthContext: Added new league:', newLeague);
      return updatedLeagues;
    });
  }, []);

  // Expose state setters for logout functionality
  const contextValue = {
    user,
    userRole,
    role,
    leagues,
    selectedLeagueId,
    setSelectedLeagueId: (id) => {
      setSelectedLeagueId(id);
      localStorage.setItem('selectedLeagueId', id);
      
      // Update role when league changes
      if (leagues.length > 0) {
        const selectedLeague = leagues.find(l => l.id === id);
        setRole(selectedLeague?.role || null);
      }
    },
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
    setRoleChecked
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

export { useLogout }; 