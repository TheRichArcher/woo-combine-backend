import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu } from 'lucide-react';

export default function Navigation() {
  const { user, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="bg-white shadow-md p-4">
      <div className="flex flex-row justify-between items-center max-w-screen-xl mx-auto">
        {/* Left: Logo */}
        <div className="font-extrabold text-2xl text-cyan-700 bg-green-100 px-4 py-2 rounded">Woo-Combine</div>
        {/* Right: Desktop Nav Items */}
        <div className="hidden sm:flex items-center gap-x-6 bg-yellow-100 px-4 py-2 rounded">
          <Link to="/dashboard" className="text-lg font-semibold text-gray-800 hover:text-cyan-700">Dashboard</Link>
          <Link to="/players" className="text-lg font-semibold text-gray-800 hover:text-cyan-700">Players</Link>
          {user && (role === 'organizer' || role === 'admin') && (
            <Link to="/admin" className="text-lg font-semibold text-gray-800 hover:text-cyan-700">Admin</Link>
          )}
        </div>
        {/* Hamburger for mobile */}
        <button className="sm:hidden p-2 ml-2" onClick={() => setMobileOpen(v => !v)} aria-label="Open menu">
          <Menu className="w-7 h-7 text-cyan-700" />
        </button>
      </div>
      {/* Mobile nav menu */}
      {mobileOpen && (
        <div className="sm:hidden fixed top-16 left-0 w-full bg-white shadow-lg z-50 border-t border-gray-200">
          <div className="flex flex-col items-center py-4 space-y-2">
            <Link to="/dashboard" className="block text-lg font-semibold text-gray-800 hover:text-cyan-700 px-4 py-2" onClick={closeMobile}>Dashboard</Link>
            <Link to="/players" className="block text-lg font-semibold text-gray-800 hover:text-cyan-700 px-4 py-2" onClick={closeMobile}>Players</Link>
            {user && (role === 'organizer' || role === 'admin') && (
              <Link to="/admin" className="block text-lg font-semibold text-gray-800 hover:text-cyan-700 px-4 py-2" onClick={closeMobile}>Admin</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
} 