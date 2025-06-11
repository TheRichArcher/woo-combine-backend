import { signOut } from "firebase/auth";
import { useAuth } from "./AuthContext";
import { auth } from "../firebase";

export function useLogout() {
  const { setUser, setLeagues, setSelectedLeagueId, setRole, setUserRole, setError } = useAuth();
  return async function logout() {
    try {
      await signOut(auth);
      // Clear all auth state
      setUser(null);
      setLeagues([]);
      setSelectedLeagueId('');
      setRole(null);
      setUserRole(null);
      setError(null);
      // Clear localStorage
      localStorage.removeItem('selectedLeagueId');
      localStorage.removeItem('selectedEventId');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear state even if signOut fails
      setUser(null);
      setLeagues([]);
      setSelectedLeagueId('');
      setRole(null);
      setUserRole(null);
      localStorage.removeItem('selectedLeagueId');
      localStorage.removeItem('selectedEventId');
    }
  };
} 