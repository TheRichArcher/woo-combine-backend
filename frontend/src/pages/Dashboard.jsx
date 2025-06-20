import React from "react";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import EventSelector from "../components/EventSelector";

export default function Dashboard() {
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Still allow user to continue - don't block logout on errors
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full text-center border-2 border-cmf-primary/30">
          <EventSelector />
          <h1 className="text-2xl font-bold mb-4 text-cmf-secondary">Welcome to Woo-Combine!</h1>
          {user && <p className="mb-4 text-gray-600">Logged in as <span className="font-mono">{user.email}</span></p>}
          <button
            onClick={handleLogout}
            className="bg-cmf-primary hover:bg-cmf-secondary text-white font-bold px-4 py-2 rounded-lg shadow transition"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
} 