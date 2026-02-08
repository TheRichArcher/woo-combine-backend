import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { getMyLeagues } from '../lib/leagues';
import api from '../lib/api';
import { authLogger } from '../utils/logger';

const LeagueContext = createContext();

export function LeagueProvider({ children }) {
  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueIdState] = useState(() => {
    const raw = localStorage.getItem('selectedLeagueId');
    if (!raw) return '';
    const trimmed = String(raw).trim();
    return trimmed === '' || trimmed === 'null' || trimmed === 'undefined' ? '' : trimmed;
  });
  const [role, setRole] = useState(null);
  const [leagueFetchInProgress, setLeagueFetchInProgress] = useState(false);
  
  const leagueFetchPromiseRef = useRef(null);
  const lastFetchKeyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const tokenVersionCounterRef = useRef(0);

  const setSelectedLeagueId = useCallback((id) => {
    const sanitized = (id === undefined || id === null) ? '' : String(id).trim();
    setSelectedLeagueIdState(sanitized);
    if (sanitized) {
      localStorage.setItem('selectedLeagueId', sanitized);
    } else {
      localStorage.removeItem('selectedLeagueId');
    }
    if (leagues.length > 0) {
      const selectedLeague = leagues.find(l => l.id === sanitized);
      setRole(selectedLeague?.role || null);
    }
  }, [leagues]);

  const addLeague = useCallback((newLeague) => {
    setLeagues(prev => {
      if (prev.some(l => l.id === newLeague.id)) return prev;
      const updated = [...prev, newLeague];
      if (!selectedLeagueId || selectedLeagueId === '') {
        setSelectedLeagueId(newLeague.id);
      }
      return updated;
    });
  }, [selectedLeagueId, setSelectedLeagueId]);

  const fetchLeagues = useCallback(async (firebaseUser, roleParam) => {
    if (!firebaseUser || !roleParam) return [];
    
    const tokenVersion = ++tokenVersionCounterRef.current;
    const fetchKey = `${firebaseUser.uid}-${roleParam}`;
    
    if (fetchKey === lastFetchKeyRef.current && leagueFetchPromiseRef.current) {
      return leagueFetchPromiseRef.current;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    lastFetchKeyRef.current = fetchKey;
    setLeagueFetchInProgress(true);
    
    const promise = (async () => {
      try {
        const token = await firebaseUser.getIdToken();
        if (tokenVersion !== tokenVersionCounterRef.current) return [];
        
        const fetchedLeagues = await getMyLeagues(token);
        if (tokenVersion !== tokenVersionCounterRef.current) return [];
        
        setLeagues(fetchedLeagues || []);
        
        // Auto-select league
        const stored = localStorage.getItem('selectedLeagueId');
        if (fetchedLeagues?.length > 0) {
          const match = stored && fetchedLeagues.find(l => l.id === stored);
          const selectedId = match ? stored : fetchedLeagues[0].id;
          setSelectedLeagueIdState(selectedId);
          localStorage.setItem('selectedLeagueId', selectedId);
          
          const selectedLeague = fetchedLeagues.find(l => l.id === selectedId);
          setRole(selectedLeague?.role || null);
        }
        
        return fetchedLeagues || [];
      } catch (err) {
        if (err?.name !== 'AbortError') {
          authLogger.error('[LeagueContext] Failed to fetch leagues:', err);
        }
        return [];
      } finally {
        if (tokenVersion === tokenVersionCounterRef.current) {
          setLeagueFetchInProgress(false);
          leagueFetchPromiseRef.current = null;
        }
      }
    })();
    
    leagueFetchPromiseRef.current = promise;
    return promise;
  }, []);

  const refreshLeagues = useCallback(async (firebaseUser, roleParam) => {
    lastFetchKeyRef.current = null;
    return fetchLeagues(firebaseUser, roleParam);
  }, [fetchLeagues]);

  const resetLeagueState = useCallback(() => {
    setLeagues([]);
    setSelectedLeagueIdState('');
    setRole(null);
    localStorage.removeItem('selectedLeagueId');
    leagueFetchPromiseRef.current = null;
    lastFetchKeyRef.current = null;
  }, []);

  const contextValue = {
    leagues,
    setLeagues,
    selectedLeagueId,
    setSelectedLeagueId,
    role,
    setRole,
    leaguesLoading: leagueFetchInProgress,
    addLeague,
    fetchLeagues,
    refreshLeagues,
    resetLeagueState,
  };

  return (
    <LeagueContext.Provider value={contextValue}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error("useLeague must be used within a LeagueProvider");
  }
  return context;
}

export default LeagueContext;
