import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

const AuthContext = createContext();

const API = import.meta.env.VITE_API_URL;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leagues, setLeagues] = useState([]); // [{id, name, role}]
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => localStorage.getItem('selectedLeagueId') || '');
  const [role, setRole] = useState(null); // 'organizer' | 'coach'

  // Fetch leagues/roles from backend after login
  useEffect(() => {
    if (user) {
      // Fetch leagues for this user
      fetch(`${API}/users/${user.uid}/leagues`)
        .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch leagues'))
        .then(data => {
          setLeagues(data.leagues || []);
          // Set role for selected league
          const league = data.leagues?.find(l => l.id === selectedLeagueId) || data.leagues?.[0];
          setRole(league?.role || null);
          if (league && !selectedLeagueId) setSelectedLeagueId(league.id);
        })
        .catch(() => setLeagues([]));
    } else {
      setLeagues([]);
      setRole(null);
      setSelectedLeagueId('');
    }
  }, [user]);

  // Persist selectedLeagueId
  useEffect(() => {
    if (selectedLeagueId) localStorage.setItem('selectedLeagueId', selectedLeagueId);
    else localStorage.removeItem('selectedLeagueId');
  }, [selectedLeagueId]);

  // Add league after join
  const addLeague = (league) => {
    setLeagues(prev => {
      if (prev.some(l => l.id === league.id)) return prev;
      return [...prev, league];
    });
    setSelectedLeagueId(league.id);
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
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 