import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import api from '../lib/api';
import { useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useLogout } from './logout';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Optimized state management with faster initial checks
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authChecked, setAuthChecked] = useState(false); // New: faster auth check
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => localStorage.getItem('selectedLeagueId') || '');
  const [role, setRole] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  // Fast initial auth check - just Firebase auth state
  const quickAuthCheck = async (firebaseUser) => {
    console.log('[AuthContext] Quick auth check for:', firebaseUser?.email);
    
    if (!firebaseUser) {
      console.log('[AuthContext] No user, quick clear');
      setUser(null);
      setAuthChecked(true);
      return false;
    }

    setUser(firebaseUser);
    setAuthChecked(true);
    
    // Quick email verification check
    if (!firebaseUser.emailVerified) {
      console.log('[AuthContext] User not verified, redirecting quickly');
      if (window.location.pathname !== '/verify-email') {
        navigate('/verify-email');
      }
      return false;
    }

    return true; // User is authenticated and verified
  };

  // Comprehensive initialization - can run in background after quick check
  const completeInitialization = async (firebaseUser) => {
    console.log('[AuthContext] Starting background initialization...');
    
    try {
      // Check user role in Firestore
      console.log('[AuthContext] Checking role in Firestore...');
      const db = getFirestore();
      const docRef = doc(db, "users", firebaseUser.uid);
      const snap = await getDoc(docRef);
      
      if (!snap.exists() || !snap.data().role) {
        console.log('[AuthContext] No role found, redirecting to select-role');
        setUserRole(null);
        setLeagues([]);
        setRole(null);
        navigate("/select-role");
        return;
      }

      const userRole = snap.data().role;
      setUserRole(userRole);
      console.log('[AuthContext] Role found:', userRole);

      // Fetch leagues in background with retry logic for race conditions
      console.log('[AuthContext] Fetching leagues in background...');
      let userLeagues = [];
      
      try {
        // First attempt
        const res = await api.get(`/leagues/me`);
        userLeagues = res.data.leagues || [];
        setLeagues(userLeagues);
        
      } catch (error) {
        if (error.response?.status === 404) {
          // 404 could be a race condition - retry after short delay
          console.log('[AuthContext] League fetch returned 404, retrying after delay (possible race condition)...');
          
          try {
            // Wait 3 seconds for Firestore consistency and ordering
            await new Promise(resolve => setTimeout(resolve, 3000));
            const retryRes = await api.get(`/leagues/me`);
            userLeagues = retryRes.data.leagues || [];
            setLeagues(userLeagues);
            console.log('[AuthContext] Retry successful, found leagues:', userLeagues.length);
            
          } catch (retryError) {
            if (retryError.response?.status === 404) {
              console.log('[AuthContext] User confirmed to have no leagues after retry');
              userLeagues = [];
              setLeagues([]);
            } else {
              console.error('[AuthContext] Retry error:', retryError);
              userLeagues = [];
              setLeagues([]);
            }
          }
        } else {
          console.error('[AuthContext] Non-404 error:', error);
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
        console.log('[AuthContext] User has no leagues yet (normal for new users)');
        setSelectedLeagueId('');
        setRole(null);
        localStorage.removeItem('selectedLeagueId');
      }

      // Navigation logic - only redirect from onboarding routes
      const currentPath = window.location.pathname;
      const onboardingRoutes = ["/login", "/signup", "/verify-email", "/select-role", "/"];
      
      if (onboardingRoutes.includes(currentPath)) {
        console.log('[AuthContext] On onboarding route, navigating to dashboard');
        navigate("/dashboard");
      } else {
        console.log('[AuthContext] Staying on current route:', currentPath);
      }

    } catch (error) {
      console.error('[AuthContext] Background initialization failed:', error);
      setError(error);
      navigate("/select-role");
    }
  };

  // Main auth state listener with optimized flow
  useEffect(() => {
    console.log('[AuthContext] Setting up optimized auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AuthContext] Auth state changed:', firebaseUser?.email, 'verified:', firebaseUser?.emailVerified);
      
      // Step 1: Quick auth check (shows UI faster)
      const isAuthenticated = await quickAuthCheck(firebaseUser);
      
      if (!isAuthenticated) {
        setInitializing(false); // Stop loading for unauthenticated/unverified users
        return;
      }

      // Step 2: Complete initialization in background (user sees page faster)
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
  }, [navigate]);

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

  // Optimized loading screen - only show for true initialization, not quick auth checks
  if (initializing && !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-cyan-600 rounded-full"></div>
          <div className="mt-4 text-gray-600">
            Loading WooCombine...
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Checking authentication
          </div>
        </div>
      </div>
    );
  }

  // Show lighter loading for background data loading (user can see page)
  if (initializing && authChecked && user && user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin inline-block w-6 h-6 border-4 border-gray-300 border-t-cyan-600 rounded-full"></div>
          <div className="mt-3 text-gray-600">
            Loading your data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading: initializing, // For backward compatibility
      roleChecking: false, // No longer used
      error,
      leagues,
      selectedLeagueId,
      setSelectedLeagueId,
      role,
      addLeague,
      isOrganizer,
      userRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { useLogout }; 