import React from "react";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import EventSelector from "../components/EventSelector";
import WelcomeLayout from "../components/layouts/WelcomeLayout";

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
    <WelcomeLayout
      contentClassName="min-h-screen"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/favicon/woocombine-logo.png"
            alt="Woo-Combine Logo"
            className="w-16 h-16 mx-auto mb-4"
            style={{ objectFit: 'contain' }}
          />
        </div>

        <h1 className="text-2xl font-bold mb-4 text-gray-900">Welcome to WooCombine!</h1>
        {user && <p className="mb-6 text-gray-600">Logged in as <span className="font-mono">{user.email}</span></p>}
        
        <div className="space-y-4 mb-6">
          <EventSelector />
        </div>
        
        <button
          onClick={handleLogout}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg shadow transition text-sm"
        >
          Log Out
        </button>
      </div>
    </WelcomeLayout>
  );
} 