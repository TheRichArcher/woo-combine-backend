// Navigation.jsx
//
// All navigation layout, logic, and role-based visibility are centralized in this file.
// Do NOT scatter nav logic or conditional rendering elsewhere (e.g., App.jsx, Routes.jsx, Dashboard.jsx).
// If you use custom Tailwind classes or override tailwind.config.js, document it here.
//
// The Admin nav link is only visible to users with 'organizer' or 'admin' roles (see comment below).
//
// Any changes to nav logic, layout, or visibility must go through checkpoint approval.

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useLogout } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { useToast } from '../context/ToastContext';
import { Menu, ChevronDown, Settings, LogOut, X, Edit, Users, Plus, UserPlus, Bell, BellOff, CreditCard, HelpCircle, MessageCircle, Heart, QrCode, Wrench, ArrowRight, ClipboardCheck } from 'lucide-react';
import EventSwitcher from './EventSwitcher';
import { isViewerInviteEventScopedSession } from '../lib/viewerInviteContext';

// Notification settings helper
const NOTIFICATION_STORAGE_KEY = 'woo-combine-notifications-enabled';

const getNotificationSettings = () => {
  const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
  return stored ? JSON.parse(stored) : false; // Default to disabled
};

const setNotificationSettings = (enabled) => {
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(enabled));
};

// Profile Modal Component
function ProfileModal({ isOpen, onClose, user, userRole, onLogout, hideEventSwitchActions = false }) {
  const navigate = useNavigate();
  const { showSuccess, showInfo } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(getNotificationSettings());
  
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

  const handleNotificationToggle = () => {
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);
    setNotificationSettings(newState);
    
    if (newState) {
      showSuccess('🔔 Notifications enabled! You\'ll receive updates about events and results.');
    } else {
      showInfo('🔕 Notifications disabled. You can re-enable them anytime.');
    }
  };

  const handleOpenDeviceSettings = () => {
    showInfo('💡 Check your browser settings to allow notifications from woo-combine.com');
  };

  return (
    <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4">
      <div className="wc-card max-w-md w-full max-h-[90vh] overflow-y-auto">
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
        <div className="bg-gradient-to-br from-brand-primary to-brand-secondary px-6 py-8 text-center text-white">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            {getUserInitials()}
          </div>
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-xl font-bold">{getUserName()}</h3>
            <button className="p-1 hover:bg-white/20 rounded-full transition">
              <Edit className="w-4 h-4" />
            </button>
          </div>
          <p className="text-brand-light text-sm mt-1">{user?.email}</p>
        </div>

        {/* Menu Items */}
        <div className="p-4 space-y-2">
          {/* My Events -> Switch Event */}
          {!hideEventSwitchActions && (
            <button
              onClick={() => handleNavigation('/select-league')}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition"
            >
              <Users className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Switch Event</span>
            </button>
          )}

          {/* Create an Event */}
          {userRole === 'organizer' && (
            <button
              onClick={() => handleNavigation('/onboarding/event')}
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

          {/* Share Event QR Codes - For Organizers */}
          {userRole === 'organizer' && (
            <button
              onClick={() => handleNavigation('/event-sharing')}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition"
            >
              <QrCode className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Share Event QR Codes</span>
                <div className="text-xs text-gray-500">Share with staff & participants</div>
              </div>
            </button>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200 my-2"></div>

          {/* Notifications - Now Functional */}
          <div className="px-4 py-3 hover:bg-gray-50 rounded-lg transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {notificationsEnabled ? (
                  <Bell className="w-5 h-5 text-green-500" />
                ) : (
                  <BellOff className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <div className="font-medium text-gray-900">
                    Notifications are {notificationsEnabled ? 'on' : 'off'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {notificationsEnabled 
                      ? 'You\'ll receive event updates' 
                      : 'You will miss event updates'
                    }
                  </div>
                </div>
              </div>
              <button
                onClick={handleNotificationToggle}
                className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${
                  notificationsEnabled ? 'bg-green-500' : 'bg-gray-200'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-transform duration-200 ${
                  notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}></div>
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {notificationsEnabled 
                ? 'Get notified about event updates, new events, and score results'
                : 'Enable notifications for event updates, new events, and messages'
              }
            </div>
            <button 
              onClick={handleOpenDeviceSettings}
              className="text-brand-primary text-sm font-medium mt-1 hover:underline"
            >
              {notificationsEnabled ? 'Manage browser settings' : 'Open device settings'}
            </button>
          </div>

        {/* Advanced tools removed from Profile modal to reduce duplication.
            Access via header nav and Tools dropdown. */}

          {/* Divider */}
          <div className="border-t border-gray-200 my-2"></div>

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
  const [eventSwitcherOpen, setEventSwitcherOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const { showInfo } = useToast();
  const isViewerInviteLockedSession = isViewerInviteEventScopedSession({ userRole });
  const isOrganizer = userRole === 'organizer';
  const isCoach = userRole === 'coach';
  const isStaff = isOrganizer || isCoach;

  const closeMobile = () => setMobileOpen(false);

  // Detect if we are in an onboarding flow
  const isOnboarding = location.pathname.startsWith('/onboarding') || location.pathname === '/create-league';

  // Action to guide user back to setup
  const handleContinueSetup = () => {
    // Navigate to the current onboarding path to ensure they are on the right route
    // This handles cases where they might be "lost" or just want to reset focus
    const target = location.pathname === '/create-league' ? '/create-league' : '/onboarding/event';
    
    navigate(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeMobile();
    
    // Dismiss toast programmatically
    const toastCloseBtn = document.querySelector('.toast-close-button');
    if (toastCloseBtn) toastCloseBtn.click();
  };

  // Handle restricted navigation
  const handleRestrictedNav = (e, path, label) => {
    if (isOnboarding) {
      e.preventDefault();
      // Don't block logout or settings (though settings path is usually handled by internal links)
      
      showInfo(
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Finish setup to unlock {label}</span>
          <button 
            onClick={handleContinueSetup}
            className="text-xs bg-white text-gray-800 px-2 py-1 rounded border border-gray-200 shadow-sm hover:bg-gray-50 flex items-center justify-center gap-1 w-full"
          >
            Continue Setup <ArrowRight className="w-3 h-3" />
          </button>
        </div>,
        { duration: 4000 }
      );
      if (mobileOpen) closeMobile();
    } else {
      // Normal navigation
      if (mobileOpen) closeMobile();
    }
  };

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
    if (isViewerInviteLockedSession) return;
    setEventSwitcherOpen(!eventSwitcherOpen);
  };

  useEffect(() => {
    if (isViewerInviteLockedSession && eventSwitcherOpen) {
      setEventSwitcherOpen(false);
    }
  }, [isViewerInviteLockedSession, eventSwitcherOpen]);

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
      <nav className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center max-w-7xl mx-auto gap-4">
          {/* Left: Avatar */}
          <div className="flex items-center">
            <button
              onClick={() => setProfileModalOpen(true)}
              className="w-10 h-10 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold text-sm hover:bg-brand-secondary transition"
            >
              {getUserInitials()}
            </button>
          </div>

          {/* Brand Logo */}
          <Link 
            to={isStaff ? '/coach' : '/dashboard'} 
            onClick={(e) => handleRestrictedNav(e, isStaff ? '/coach' : '/dashboard', 'Home')} 
            className="flex items-center flex-shrink-0" 
            aria-label="WooCombine Home"
          >
            <img
              src="/favicon/woocombine-logo.png"
              alt="WooCombine Logo"
              className="w-7 h-7 md:w-8 md:h-8"
            />
          </Link>

          {/* Center-Left: Event Name with Dropdown */}
          <div className="flex-1 flex justify-start min-w-0 mr-2 relative">
            <button
              onClick={handleEventDropdownClick}
              className={`flex items-center gap-1 px-2 py-2 rounded-lg transition min-w-0 max-w-full ${isViewerInviteLockedSession ? 'cursor-default' : 'hover:bg-gray-50'}`}
            >
              <div className="text-left min-w-0 flex-1">
                <div className="font-bold text-sm md:text-lg text-gray-900 truncate">
                  {selectedEvent?.name || 'Select Event'}
                </div>
                {selectedEvent?.location && (
                  <div className="text-xs text-gray-500 truncate hidden lg:block">
                    {selectedEvent.location}
                  </div>
                )}
              </div>
              {!isViewerInviteLockedSession && (
                <ChevronDown className={`w-4 h-4 md:w-5 md:h-5 text-gray-400 flex-shrink-0 transition-transform ${eventSwitcherOpen ? 'rotate-180' : ''}`} />
              )}
            </button>
            
            {/* Event Switcher Dropdown */}
            {!isViewerInviteLockedSession && eventSwitcherOpen && (
              <EventSwitcher 
                isOpen={eventSwitcherOpen} 
                onClose={() => setEventSwitcherOpen(false)} 
              />
            )}
          </div>
          
          {/* Onboarding Progress Indicator (Desktop) - Now Clickable as Escape Hatch */}
          {isOnboarding && (
             <button 
                onClick={handleContinueSetup}
                className="hidden md:flex items-center gap-3 bg-brand-primary/10 px-3 py-1.5 rounded-full border border-brand-primary/20 mr-2 animate-in fade-in slide-in-from-top-2 hover:bg-brand-primary/20 transition-colors"
                title="Click to continue setup"
             >
                <div className="text-xs font-semibold text-brand-primary whitespace-nowrap flex items-center gap-1">
                   <Wrench className="w-3 h-3" /> Event Setup In Progress
                </div>
             </button>
          )}

          {/* Center-Right: Main Navigation Links - Hidden on small mobile, shown on larger screens */}
          <div className="hidden sm:flex items-center gap-2 md:gap-4 flex-shrink-0">
            <Link 
              to={isStaff ? '/coach' : '/dashboard'}
              onClick={(e) => handleRestrictedNav(e, isStaff ? '/coach' : '/dashboard', 'Home')}
              className="text-gray-700 hover:text-brand-primary font-medium transition whitespace-nowrap text-xs md:text-sm"
            >
              {isOrganizer ? 'Event Dashboard' : isCoach ? 'Coach Dashboard' : 'Home'}
            </Link>
            {isStaff && (
              <Link 
                to="/players?tab=manage" 
                onClick={(e) => handleRestrictedNav(e, '/players', 'Players')}
                title={isOrganizer ? "Manage your event’s player list" : "View roster"}
                className="text-gray-700 hover:text-brand-primary font-medium transition whitespace-nowrap text-xs md:text-sm"
              >
                <Users className="w-4 h-4 inline-block mr-1" /> {isOrganizer ? 'Manage Players' : 'Roster'}
              </Link>
            )}
            {isStaff && (
              <Link
                to="/check-in"
                onClick={(e) => handleRestrictedNav(e, '/check-in', 'Check-In')}
                className="text-gray-700 hover:text-brand-primary font-medium transition whitespace-nowrap text-xs md:text-sm"
              >
                <ClipboardCheck className="w-4 h-4 inline-block mr-1" /> Check-In
              </Link>
            )}
            {isStaff && (
              <Link 
                to="/players?tab=analyze" 
                onClick={(e) => handleRestrictedNav(e, '/players', 'Rankings')}
                title="View and analyze rankings by age group"
                className="text-gray-700 hover:text-brand-primary font-medium transition whitespace-nowrap text-xs md:text-sm"
              >
                📊 Rankings
              </Link>
            )}
            {/* Keep Scorecards in primary workflow for coaches */}
            <Link 
              to="/scorecards" 
              onClick={(e) => handleRestrictedNav(e, '/scorecards', 'Scorecards')}
              className="text-gray-700 hover:text-brand-primary font-medium transition whitespace-nowrap text-xs md:text-sm"
            >
              Scorecards
            </Link>
            {isOrganizer && (
              <Link 
                to="/admin" 
                onClick={(e) => handleRestrictedNav(e, '/admin', 'Admin')}
                className="text-gray-700 hover:text-brand-primary font-medium transition whitespace-nowrap text-xs md:text-sm"
              >
                Admin
              </Link>
            )}

            {/* Promote Live Standings for Viewers */}
            {userRole === 'viewer' && (
              <Link 
                to="/live-standings" 
                onClick={(e) => handleRestrictedNav(e, '/live-standings', 'Live Standings')}
                className="text-gray-700 hover:text-brand-primary font-medium transition whitespace-nowrap text-xs md:text-sm"
              >
                Live Standings
              </Link>
            )}

            {/* Tools dropdown */}
            <div className="relative">
              <button
                onClick={() => setToolsOpen(prev => !prev)}
                className="flex items-center gap-1 text-gray-700 hover:text-brand-primary font-medium transition whitespace-nowrap text-xs md:text-sm px-2 py-1 rounded-lg hover:bg-gray-50"
                aria-haspopup="menu"
                aria-expanded={toolsOpen}
              >
                <Wrench className="w-4 h-4" />
                Tools
                <ChevronDown className="w-4 h-4" />
              </button>
              {toolsOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50" role="menu">
                  {isStaff && (
                    <Link to="/schedule" onClick={(e) => { setToolsOpen(false); handleRestrictedNav(e, '/schedule', 'Schedule'); }} className="block px-4 py-2 text-gray-700 hover:bg-gray-50" role="menuitem">
                      Schedule
                    </Link>
                  )}
                  {isStaff && (
                    <Link to="/team-formation" onClick={(e) => { setToolsOpen(false); handleRestrictedNav(e, '/team-formation', 'Teams'); }} className="block px-4 py-2 text-gray-700 hover:bg-gray-50" role="menuitem">
                      Teams
                    </Link>
                  )}
                  {isStaff && (
                    <Link to="/drafts" onClick={(e) => { setToolsOpen(false); handleRestrictedNav(e, '/drafts', 'Draft'); }} className="block px-4 py-2 text-gray-700 hover:bg-gray-50" role="menuitem">
                      Draft
                    </Link>
                  )}
                  {isOrganizer && (
                    <Link to="/analytics" onClick={(e) => { setToolsOpen(false); handleRestrictedNav(e, '/analytics', 'Analytics'); }} className="block px-4 py-2 text-gray-700 hover:bg-gray-50" role="menuitem">
                      Analytics Explorer
                    </Link>
                  )}
                  {/* Hide Live Standings from Tools if it's already in the main nav for viewers */}
                  {userRole !== 'viewer' && (
                    <Link to="/live-standings" onClick={(e) => { setToolsOpen(false); handleRestrictedNav(e, '/live-standings', 'Live Standings'); }} className="block px-4 py-2 text-gray-700 hover:bg-gray-50" role="menuitem">
                      Live Standings
                    </Link>
                  )}
                  {isOrganizer && (
                    <Link to="/sport-templates" onClick={(e) => { setToolsOpen(false); handleRestrictedNav(e, '/sport-templates', 'Sport Templates'); }} className="block px-4 py-2 text-gray-700 hover:bg-gray-50" role="menuitem">
                      Sport Templates
                    </Link>
                  )}
                  {isOrganizer && (
                    <Link to="/evaluators" onClick={(e) => { setToolsOpen(false); handleRestrictedNav(e, '/evaluators', 'Evaluators'); }} className="block px-4 py-2 text-gray-700 hover:bg-gray-50" role="menuitem">
                      Team Evaluations
                    </Link>
                  )}
                  {isOrganizer && (
                    <Link to="/event-sharing" onClick={(e) => { setToolsOpen(false); handleRestrictedNav(e, '/event-sharing', 'Event Sharing'); }} className="block px-4 py-2 text-gray-700 hover:bg-gray-50" role="menuitem">
                      Event Sharing
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Settings & Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Hamburger Menu - Always Visible */}
            <button 
              className="flex sm:hidden p-2 rounded-lg hover:bg-gray-50 transition"
              onClick={() => setMobileOpen(!mobileOpen)} 
              aria-label="Open menu"
              title="Menu"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </nav>

      {/* Navigation menu - accessible on all screen sizes */}
      {mobileOpen && (
        <div className="fixed top-16 left-0 w-full bg-white shadow-lg z-50 border-t border-gray-200">
          <div className="flex flex-col py-4">
            
            {/* Onboarding Indicator (Mobile) */}
            {isOnboarding && (
                 <button 
                    onClick={handleContinueSetup}
                    className="mx-4 mb-4 flex items-center gap-2 bg-brand-primary/10 px-3 py-2 rounded-lg border border-brand-primary/20 text-left hover:bg-brand-primary/20 transition-colors"
                 >
                    <Wrench className="w-4 h-4 text-brand-primary" />
                    <div className="text-sm font-semibold text-brand-primary">
                       Event Setup In Progress
                    </div>
                 </button>
            )}

            {/* Navigation Links on Mobile */}
            <Link 
              to={isStaff ? '/coach' : '/dashboard'}
              className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
              onClick={(e) => handleRestrictedNav(e, isStaff ? '/coach' : '/dashboard', 'Home')}
            >
              {isOrganizer ? 'Event Dashboard' : isCoach ? 'Coach Dashboard' : 'Home'}
            </Link>
            {isStaff && (
              <Link 
                to="/players?tab=manage" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/players', 'Players')}
                title={isOrganizer ? "Manage your event’s player list" : "View roster"}
              >
                <Users className="w-4 h-4 inline-block mr-1" /> {isOrganizer ? 'Manage Players' : 'Roster'}
              </Link>
            )}
            {isStaff && (
              <Link
                to="/check-in"
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/check-in', 'Check-In')}
              >
                <ClipboardCheck className="w-4 h-4 inline-block mr-1" /> Check-In
              </Link>
            )}
            {isStaff && (
              <Link 
                to="/players?tab=analyze" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/players', 'Rankings')}
                title="View and analyze rankings by age group"
              >
                📊 Rankings
              </Link>
            )}
            <Link 
              to="/scorecards" 
              className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
              onClick={(e) => handleRestrictedNav(e, '/scorecards', 'Scorecards')}
            >
              Scorecards
            </Link>
            {isOrganizer && (
              <Link 
                to="/admin" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/admin', 'Admin')}
              >
                Admin
              </Link>
            )}
            {/* Promote Live Standings for Viewers on Mobile */}
            {userRole === 'viewer' && (
              <Link 
                to="/live-standings" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/live-standings', 'Live Standings')}
              >
                Live Standings
              </Link>
            )}

            {!isViewerInviteLockedSession && (
              <Link 
                to="/select-league" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={closeMobile}
              >
                Switch Event
              </Link>
            )}
            <Link 
              to="/join" 
              className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
              onClick={closeMobile}
            >
              Join Event
            </Link>
            {/* Tools group on mobile */}
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase">Tools</div>
            {isStaff && (
              <Link 
                to="/schedule" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/schedule', 'Schedule')}
              >
                Schedule
              </Link>
            )}
            {isStaff && (
              <Link 
                to="/team-formation" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/team-formation', 'Teams')}
              >
                Teams
              </Link>
            )}
            {isStaff && (
              <Link 
                to="/drafts" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/drafts', 'Draft')}
              >
                Draft
              </Link>
            )}
            {isOrganizer && (
              <Link 
                to="/analytics" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/analytics', 'Analytics')}
              >
                Analytics Explorer
              </Link>
            )}
            {/* Hide Live Standings from Tools if it's already in the main nav for viewers */}
            {userRole !== 'viewer' && (
              <Link 
                to="/live-standings" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/live-standings', 'Live Standings')}
              >
                Live Standings
              </Link>
            )}
            {isOrganizer && (
              <Link 
                to="/sport-templates" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/sport-templates', 'Sport Templates')}
              >
                Sport Templates
              </Link>
            )}
            {isOrganizer && (
              <Link 
                to="/evaluators" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/evaluators', 'Evaluators')}
              >
                Team Evaluations
              </Link>
            )}
            {isOrganizer && (
              <Link 
                to="/event-sharing" 
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                onClick={(e) => handleRestrictedNav(e, '/event-sharing', 'Event Sharing')}
              >
                Event Sharing
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

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        userRole={userRole}
        onLogout={handleLogout}
        hideEventSwitchActions={isViewerInviteLockedSession}
      />

      {/* Mobile Bottom Nav (3-tab) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        <div className="max-w-lg mx-auto grid grid-cols-3">
          <Link
            to="/coach"
            className={
              "flex flex-col items-center justify-center py-2 text-xs font-medium transition " +
              (location.pathname.startsWith('/coach') ? 'text-brand-primary' : 'text-gray-500')
            }
            aria-label="Events"
          >
            <div className="text-lg">🏠</div>
            Events
          </Link>
          <Link
            to="/live-standings"
            className={
              "flex flex-col items-center justify-center py-2 text-xs font-medium transition " +
              (location.pathname.startsWith('/live-standings') ? 'text-brand-primary' : 'text-gray-500')
            }
            aria-label="Rankings"
          >
            <div className="text-lg">🏆</div>
            Rankings
          </Link>
          <Link
            to="/more"
            className={
              "flex flex-col items-center justify-center py-2 text-xs font-medium transition " +
              (location.pathname.startsWith('/more') ? 'text-brand-primary' : 'text-gray-500')
            }
            aria-label="More"
          >
            <div className="text-lg">⚙️</div>
            More
          </Link>
        </div>
      </div>

      {/* Spacer so content isn't hidden behind bottom nav */}
      <div className="sm:hidden h-14" />

    </>
  );
}
