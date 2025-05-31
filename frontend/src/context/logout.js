import { signOut } from "firebase/auth";
import { useAuth } from "./AuthContext";
import { auth } from "../firebase";

export function useLogout() {
  const { setUser } = useAuth();
  return async function logout() {
    await signOut(auth);
    setUser(null);
  };
} 