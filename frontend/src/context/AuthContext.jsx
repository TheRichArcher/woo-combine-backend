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
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]); // [{id, name, role}]
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => localStorage.getItem('selectedLeagueId') || '');
  const [role, setRole] = useState(null); // 'organizer' | 'coach'
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[AuthContext] user:', user, 'loading:', loading, 'error:', error);
  }, [user, loading, error]);

  // Fetch leagues/roles from backend after login
  useEffect(() => {
    if (user && user.emailVerified) {
      api.get(`/leagues/me?user_id=${user.uid}`)
        .then(res => {
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
        })
        .catch(() => setLeagues([]));
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
      if (firebaseUser) {
        await firebaseUser.reload();
        setUser({ ...firebaseUser });
        setLoading(false);
        // If not verified, redirect to /verify-email
        if (!firebaseUser.emailVerified) {
          if (window.location.pathname !== '/verify-email') {
            navigate('/verify-email');
          }
        } else {
          // If verified and on /verify-email, redirect to dashboard or select-role
          const db = getFirestore();
          const docRef = doc(db, "users", firebaseUser.uid);
          const snap = await getDoc(docRef);
          if (!snap.exists() || !snap.data().role) {
            navigate("/select-role");
          } else {
            // Only redirect to dashboard if on onboarding routes
            const onboardingRoutes = ["/login", "/signup", "/verify-email", "/select-role", "/welcome", "/"];
            if (onboardingRoutes.includes(window.location.pathname)) {
              navigate("/dashboard");
            }
            // Otherwise, stay on the current route (e.g., /admin)
          }
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    }, (err) => {
      setError(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
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
      } catch {
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