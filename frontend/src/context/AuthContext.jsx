import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import api from '../lib/api';
import { useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useLogout } from './logout';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleChecking, setRoleChecking] = useState(false);
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]); // [{id, name, role}]
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => localStorage.getItem('selectedLeagueId') || '');
  const [role, setRole] = useState(null); // 'organizer' | 'coach'
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[AuthContext] user:', user, 'loading:', loading, 'roleChecking:', roleChecking, 'error:', error);
  }, [user, loading, roleChecking, error]);

  // Fetch leagues/roles from backend after login
  useEffect(() => {
    if (user && user.emailVerified) {
      (async () => {
        try {
          const res = await api.get(`/leagues/me`);
          setLeagues(res.data.leagues || []);
          // Set role for selected league
          const league = res.data.leagues?.find(l => l.id === selectedLeagueId) || res.data.leagues?.[0];
          setRole(league?.role || null);
          // Always set selectedLeagueId to first league if not set or invalid
          if (res.data.leagues && res.data.leagues.length > 0) {
            if (!selectedLeagueId || !res.data.leagues.some(l => l.id === selectedLeagueId)) {
              setSelectedLeagueId(res.data.leagues[0].id);
              localStorage.setItem('selectedLeagueId', res.data.leagues[0].id);
            }
          }
        } catch (error) {
          console.log('[AuthContext] League fetch result:', error.response?.status, error.response?.data?.detail);
          if (error.response?.status === 404) {
            // 404 means user has no leagues yet - this is normal for new users
            console.log('[AuthContext] User has no leagues yet (normal for new users)');
            setLeagues([]);
          } else {
            // Other errors are actual problems
            console.error('[AuthContext] Error fetching leagues:', error);
            setLeagues([]);
          }
        }
      })();
    } else {
      setLeagues([]);
      setRole(null);
      setSelectedLeagueId('');
    }
  }, [user, selectedLeagueId]);

  // Persist selectedLeagueId
  useEffect(() => {
    if (selectedLeagueId) localStorage.setItem('selectedLeagueId', selectedLeagueId);
    else {
      // Restore from localStorage if not set
      const saved = localStorage.getItem('selectedLeagueId');
      if (saved) setSelectedLeagueId(saved);
      else localStorage.removeItem('selectedLeagueId');
    }
  }, [selectedLeagueId]);

  // Subscribe to Firebase Auth state changes and enforce email verification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[AuthContext] Auth state changed:', firebaseUser?.email, 'verified:', firebaseUser?.emailVerified);
      console.log('[AuthContext] Current pathname:', window.location.pathname);
      
      if (firebaseUser) {
        await firebaseUser.reload();
        setUser(firebaseUser);
        setLoading(false);
        // If not verified, redirect to /verify-email
        if (!firebaseUser.emailVerified) {
          console.log('[AuthContext] User not verified, redirecting to verify-email');
          if (window.location.pathname !== '/verify-email') {
            navigate('/verify-email');
          }
        } else {
          console.log('[AuthContext] User verified, checking role in Firestore...');
          setRoleChecking(true);
          
          // If verified and on /verify-email, redirect to dashboard or select-role
          const db = getFirestore();
          const docRef = doc(db, "users", firebaseUser.uid);
          
          try {
            const snap = await getDoc(docRef);
            console.log('[AuthContext] Firestore check complete. Document exists:', snap.exists());
            console.log('[AuthContext] Role data:', snap.exists() ? snap.data() : null);
            
            if (!snap.exists() || !snap.data().role) {
              console.log('[AuthContext] No role found, navigating to select-role');
              console.log('[AuthContext] Current path before redirect:', window.location.pathname);
              navigate("/select-role");
            } else {
              console.log('[AuthContext] Role found:', snap.data().role);
              // Only redirect to dashboard if on onboarding routes
              const onboardingRoutes = ["/login", "/signup", "/verify-email", "/select-role", "/"];
              if (onboardingRoutes.includes(window.location.pathname)) {
                console.log('[AuthContext] On onboarding route, navigating to dashboard');
                navigate("/dashboard");
              } else {
                console.log('[AuthContext] Not on onboarding route, staying on:', window.location.pathname);
              }
              // Otherwise, stay on the current route (e.g., /admin, /welcome)
            }
          } catch (error) {
            console.error('[AuthContext] Firestore role check failed:', error);
            console.log('[AuthContext] Firestore error, defaulting to select-role');
            navigate("/select-role");
          } finally {
            setRoleChecking(false);
          }
        }
      } else {
        console.log('[AuthContext] No user, clearing state');
        setUser(null);
        setLoading(false);
        setRoleChecking(false);
      }
    }, (err) => {
      console.error('[AuthContext] Auth state change error:', err);
      setError(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      setRoleChecking(false);
      return;
    }
    const db = getFirestore();
    const fetchRole = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setUserRole(snap.data().role || null);
        } else {
          setUserRole(null);
        }
      } catch (error) {
        console.error('[AuthContext] Firestore role fetch failed:', error);
        setUserRole(null);
      }
    };
    fetchRole();
  }, [user]);

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

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      roleChecking,
      error,
      leagues,
      selectedLeagueId,
      setSelectedLeagueId,
      role,
      addLeague,
      isOrganizer,
      userRole,
    }}>
      {(loading || roleChecking) ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-cyan-600 rounded-full"></div>
            <div className="mt-4 text-gray-600">
              {loading ? "Loading..." : "Checking account..."}
            </div>
          </div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { useLogout }; 