import React from "react";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import EventSelector from "../components/EventSelector";

export default function Dashboard() {
  const { user } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cmf-light">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
        <EventSelector />
        <h1 className="text-3xl font-extrabold mb-4 text-cmf-primary drop-shadow">Welcome to Woo-Combine!</h1>
        {user && <p className="mb-4">Logged in as <span className="font-mono">{user.email}</span></p>}
        <button
          onClick={handleLogout}
          className="bg-cmf-primary hover:bg-cmf-secondary text-white font-bold px-4 py-2 rounded-lg shadow transition"
        >
          Log Out
        </button>
      </div>
    </div>
  );
} 