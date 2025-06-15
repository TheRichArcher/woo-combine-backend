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

  // OPTIMIZED: Single request initialization to prevent timeout cascade
  const completeInitialization = useCallback(async (firebaseUser) => {
    try {
      const db = getFirestore();
      
      // STEP 1: Role check with extended timeout for cold starts
      console.log('[AuthContext] Checking user role...');
      const roleDoc = await Promise.race([
        getDoc(doc(db, "users", firebaseUser.uid)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Role check timeout')), 20000))  // Increased to 20s
      ]);

      if (!roleDoc.exists() || !roleDoc.data().role) {
        console.log('[AuthContext] No role found, redirecting to select-role');
        setUserRole(null);
        setLeagues([]);
        setRole(null);
        setRoleChecked(true);
        navigate("/select-role");
        return;
      }

      const userRole = roleDoc.data().role;
      setUserRole(userRole);
      console.log('[AuthContext] User role:', userRole);

      // STEP 2: League fetch with single request and extended timeout
      console.log('[AuthContext] Fetching user leagues...');
      try {
        const leagueResponse = await api.get(`/leagues/me`, { 
          timeout: 45000,  // 45s timeout to match API client for extreme cold starts
          retry: 2         // Increased retries for cold start scenarios
        });
        
        const userLeagues = leagueResponse.data.leagues || [];
        setLeagues(userLeagues);
        console.log('[AuthContext] Leagues loaded:', userLeagues.length);
        
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
        
        // Enhanced error handling for cold start scenarios
        if (leagueError.message.includes('timeout') || leagueError.code === 'ECONNABORTED') {
          console.log('[AuthContext] Cold start timeout detected - continuing without leagues');
          setError('Server is starting up. Please refresh the page in a moment.');
        } else if (leagueError.response?.status >= 500) {
          console.log('[AuthContext] Server error during cold start - continuing without leagues');
          setError('Server is temporarily unavailable. Please try again shortly.');
        } else {
          console.log('[AuthContext] Network or other error - continuing without leagues');
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
      const authenticatedRoutes = ["/dashboard", "/coach-dashboard", "/players", "/admin", "/roster", "/schedule"];
      
      if (onboardingRoutes.includes(currentPath)) {
        navigate("/dashboard");
      } else if (authenticatedRoutes.includes(currentPath)) {
        // Don't redirect - user is already on a valid authenticated page
        console.log('[AuthContext] User already on authenticated page:', currentPath);
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
        navigate("/select-role");
      }
    } finally {
      setInitializing(false);
    }
  }, [navigate, selectedLeagueId]);

  // Firebase auth state change handler
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AuthContext] Firebase auth state changed:', !!firebaseUser);
      
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