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
import { Menu, ChevronDown, Settings, LogOut, X, Edit, Users, Plus, UserPlus, Bell, CreditCard, HelpCircle, MessageCircle, Heart } from 'lucide-react';

// Profile Modal Component
function ProfileModal({ isOpen, onClose, user, userRole, onLogout }) {
  const navigate = useNavigate();
  
  if (!isOpen) return null;

  const getUserInitials = () => {
    if (!user?.email) return 'U';
    const email = user.email;
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  const getUserName = () => {
    if (user?.displayName) return user.displayName;
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      return emailName.split('.').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(' ');
    }
    return 'User';
  };

  const handleNavigation = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-white rounded-t-2xl p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Profile</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Profile Section with Gradient Background */}
        <div className="bg-gradient-to-br from-cmf-primary to-cmf-secondary px-6 py-8 text-center text-white">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            {getUserInitials()}
          </div>
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-xl font-bold">{getUserName()}</h3>
            <button className="p-1 hover:bg-white/20 rounded-full transition">
              <Edit className="w-4 h-4" />
            </button>
          </div>
          <p className="text-cmf-light text-sm mt-1">{user?.email}</p>
        </div>

        {/* Menu Items */}
        <div className="p-4 space-y-2">
          {/* My Events */}
          <button
            onClick={() => handleNavigation('/select-league')}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition"
          >
            <Users className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">My Events</span>
          </button>

          {/* Create an Event */}
          {userRole === 'organizer' && (
            <button
              onClick={() => handleNavigation('/create-league')}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition"
            >
              <Plus className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Create an Event</span>
            </button>
          )}

          {/* Join an Event */}
          <button
            onClick={() => handleNavigation('/join')}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition"
          >
            <UserPlus className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Join an Event</span>
          </button>

          {/* Notifications */}
          <div className="px-4 py-3 hover:bg-gray-50 rounded-lg transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-red-500" />
                <div>
                  <div className="font-medium text-gray-900">Notifications are off</div>
                  <div className="text-sm text-gray-500">You will miss event updates</div>
                </div>
              </div>
              <div className="w-12 h-6 bg-gray-200 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow transition"></div>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Allow notifications for things like event updates, new events, and messages
            </div>
            <button className="text-cmf-primary text-sm font-medium mt-1 hover:underline">
              Open device settings
            </button>
          </div>

          {/* Subscription */}
          <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition">
            <CreditCard className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Subscription</span>
          </button>

          {/* Help Center */}
          <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition">
            <HelpCircle className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Help Center</span>
          </button>

          {/* Contact Us */}
          <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition">
            <MessageCircle className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Contact Us</span>
          </button>

          {/* Love WooCombine? */}
          <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition">
            <Heart className="w-5 h-5 text-red-500" />
            <span className="font-medium text-gray-900">Love WooCombine?</span>
          </button>

          {/* Logout */}
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 rounded-lg transition mt-4 border-t border-gray-200 pt-4"
          >
            <LogOut className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-600">Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Navigation() {
  const { user, userRole } = useAuth();
  const { selectedEvent } = useEvent();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
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
    } catch {
      navigate("/welcome");
    }
  };

  return (
    <>
      {/* Mojo Sports Style Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center max-w-7xl mx-auto gap-4">
          {/* Left: Avatar */}
          <div className="flex items-center">
            <button
              onClick={() => setProfileModalOpen(true)}
              className="w-10 h-10 bg-cmf-primary rounded-full flex items-center justify-center text-white font-bold text-sm hover:bg-cmf-secondary transition"
            >
              {getUserInitials()}
            </button>
          </div>

          {/* Center-Left: Event Name with Dropdown */}
          <div className="flex-1 flex justify-start min-w-0">
            <button
              onClick={handleEventDropdownClick}
              className="flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-gray-50 transition max-w-[200px]"
            >
              <div className="text-left min-w-0">
                <div className="font-bold text-sm md:text-lg text-gray-900 truncate">
                  {selectedEvent?.name || 'Select Event'}
                </div>
                {selectedEvent?.location && (
                  <div className="text-xs text-gray-500 truncate hidden sm:block">
                    {selectedEvent.location}
                  </div>
                )}
              </div>
              <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-gray-400 flex-shrink-0" />
            </button>
          </div>

          {/* Center-Right: Main Navigation Links - Always Visible */}
          <div className="flex items-center gap-3 md:gap-6">
            <Link 
              to="/dashboard" 
              className="text-gray-700 hover:text-cmf-primary font-medium transition whitespace-nowrap text-sm md:text-base"
            >
              Home
            </Link>
            <Link 
              to="/players" 
              className="text-gray-700 hover:text-cmf-primary font-medium transition whitespace-nowrap text-sm md:text-base"
            >
              Players
            </Link>
            {userRole === 'organizer' && (
              <Link 
                to="/admin" 
                className="text-gray-700 hover:text-cmf-primary font-medium transition whitespace-nowrap text-sm md:text-base"
              >
                Admin
              </Link>
            )}
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
                    to="/select-league" 
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-50"
                    onClick={() => setMobileOpen(false)}
                  >
                    Switch Event
                  </Link>
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
              to="/select-league" 
              className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
              onClick={closeMobile}
            >
              Switch Event
            </Link>
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

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        userRole={userRole}
        onLogout={handleLogout}
      />
    </>
  );
} 