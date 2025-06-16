// Navigation.jsx
//
// All navigation layout, logic, and role-based visibility are centralized in this file.
// Do NOT scatter nav logic or conditional rendering elsewhere (e.g., App.jsx, Routes.jsx, Dashboard.jsx).
// If you use custom Tailwind classes or override tailwind.config.js, document it here.
//
// The Admin nav link is only visible to users with 'organizer' or 'admin' roles (see comment below).
//
// Any changes to nav logic, layout, or visibility must go through checkpoint approval.

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useLogout } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { Menu, ChevronDown, Settings, LogOut } from 'lucide-react';

export default function Navigation() {
  const { user, userRole } = useAuth();
  const { selectedEvent } = useEvent();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const logout = useLogout();
  const navigate = useNavigate();

  const closeMobile = () => setMobileOpen(false);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return 'U';
    const email = user.email;
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  const handleEventDropdownClick = () => {
    setEventDropdownOpen(!eventDropdownOpen);
    navigate('/select-league'); // Navigate to league/event selection
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/welcome");
    } catch (error) {
      console.error('Logout failed:', error);
      navigate("/welcome");
    }
  };

  return (
    <>
      {/* Mojo Sports Style Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          {/* Left: Avatar */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cmf-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
              {getUserInitials()}
            </div>
          </div>

          {/* Center: Event Name with Dropdown */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={handleEventDropdownClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-50 transition max-w-xs"
            >
              <div className="text-center">
                <div className="font-bold text-lg text-gray-900 truncate">
                  {selectedEvent?.name || 'Select Event'}
                </div>
                {selectedEvent?.location && (
                  <div className="text-xs text-gray-500 truncate">
                    {selectedEvent.location}
                  </div>
                )}
              </div>
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Right: Settings & Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Desktop Settings Dropdown */}
            <div className="hidden sm:block relative">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="p-2 rounded-lg hover:bg-gray-50 transition"
                aria-label="Settings"
              >
                <Settings className="w-6 h-6 text-gray-600" />
              </button>
              
              {/* Settings Dropdown */}
              {mobileOpen && (
                <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <Link 
                    to="/dashboard" 
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-50"
                    onClick={() => setMobileOpen(false)}
                  >
                    Home
                  </Link>

                  <Link 
                    to="/players" 
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-50"
                    onClick={() => setMobileOpen(false)}
                  >
                    Players
                  </Link>
                  {userRole === 'organizer' && (
                    <Link 
                      to="/admin" 
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-50"
                      onClick={() => setMobileOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <hr className="my-2" />
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Hamburger */}
            <button 
              className="sm:hidden p-2 rounded-lg hover:bg-gray-50"
              onClick={() => setMobileOpen(!mobileOpen)} 
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile nav menu */}
      {mobileOpen && (
        <div className="sm:hidden fixed top-16 left-0 w-full bg-white shadow-lg z-50 border-t border-gray-200">
          <div className="flex flex-col py-4">
            <Link 
              to="/dashboard" 
              className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
              onClick={closeMobile}
            >
              Home
            </Link>

            <Link 
              to="/players" 
              className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
              onClick={closeMobile}
            >
              Players
            </Link>
            {userRole === 'organizer' && (
              <Link 
                to="/admin" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={closeMobile}
              >
                Admin
              </Link>
            )}
            <button
              onClick={() => {
                closeMobile();
                handleLogout();
              }}
              className="flex items-center gap-2 px-4 py-3 text-left text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </>
  );
} 