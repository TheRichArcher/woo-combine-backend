import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, BarChart3 } from 'lucide-react';
import LoadingScreen from '../components/LoadingScreen';

export default function Home() {
  const { user: _user, userRole } = useAuth();
  const { selectedEvent } = useEvent();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = React.useState(false);

  // Format event date
  const formattedDate = selectedEvent && selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) 
    ? new Date(selectedEvent.date).toLocaleDateString() 
    : 'No date set';

  // Handle navigation with loading state to prevent flashing
  const handleNavigation = (path) => {
    setIsNavigating(true);
    // Use setTimeout to ensure state update happens before navigation
    setTimeout(() => {
      navigate(path);
    }, 0);
  };

  // Don't render anything if we're navigating (prevents flash)
  if (isNavigating) {
    return (
      <LoadingScreen 
        title="Navigating..."
        subtitle="Taking you to your destination"
        size="medium"
      />
    );
  }

  // If no event selected, guide organizers to wizard or coaches to select league
  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-cmf-primary/30">
            <div className="w-16 h-16 bg-cmf-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-cmf-primary" />
            </div>
            <h2 className="text-2xl font-bold text-cmf-secondary mb-4">
              Welcome to WooCombine!
            </h2>
            
            {userRole === 'organizer' ? (
              <>
                <p className="text-gray-600 mb-6">
                  Ready to create your first event? Our guided setup will walk you through creating an event, adding players, and sharing with coaches.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/onboarding/event')}
                    className="w-full bg-cmf-primary text-white font-bold px-6 py-4 rounded-xl shadow hover:bg-cmf-secondary transition flex items-center justify-center gap-2"
                  >
                    🚀 Start Guided Setup
                  </button>
                  <button
                    onClick={() => navigate('/select-league')}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-3 rounded-lg transition"
                  >
                    Select Existing Event
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-6">
                  Click on "Select Event" in the header above to choose an event and get started.
                </p>
                <button
                  onClick={() => navigate('/select-league')}
                  className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition"
                >
                  Select Event
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        {/* Welcome Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-cmf-primary/30">
          <h1 className="text-2xl font-bold text-cmf-secondary mb-2">
            Welcome to WooCombine!
          </h1>
          <div className="flex items-center gap-2 text-gray-600 mb-4">
            <Calendar className="w-4 h-4" />
            <span>
              <strong>{selectedEvent.name}</strong> - {formattedDate}
            </span>
          </div>
          
          {selectedEvent.location && (
            <div className="text-sm text-gray-500 mb-4">
              📍 {selectedEvent.location}
            </div>
          )}
          
          {/* Quick Actions - Mojo Style Large Buttons */}
          <div className="grid grid-cols-1 gap-3">
            {userRole === 'organizer' && (
              <>
                <button
                  onClick={() => handleNavigation('/admin')}
                  className="bg-cmf-secondary text-white font-bold px-6 py-4 rounded-xl shadow hover:bg-cmf-primary transition flex items-center justify-center gap-3 text-lg"
                >
                  <BarChart3 className="w-6 h-6" />
                  Manage Event
                </button>
                <button
                  onClick={() => handleNavigation('/players')}
                  className="bg-cmf-primary text-white font-bold px-6 py-4 rounded-xl shadow hover:bg-cmf-secondary transition flex items-center justify-center gap-3 text-lg"
                >
                  <Users className="w-6 h-6" />
                  View Players & Rankings
                </button>
              </>
            )}
            {userRole === 'coach' && (
              <button
                onClick={() => handleNavigation('/players')}
                className="bg-cmf-primary text-white font-bold px-6 py-4 rounded-xl shadow hover:bg-cmf-secondary transition flex items-center justify-center gap-3 text-lg"
              >
                <Users className="w-6 h-6" />
                View Players & Rankings
              </button>
            )}
            {userRole === 'player' && selectedEvent && (
              <button
                onClick={() => handleNavigation('/drill-input')}
                className="bg-cmf-secondary text-white font-bold px-6 py-4 rounded-xl shadow hover:bg-cmf-primary transition flex items-center justify-center gap-3 text-lg"
              >
                📝 Submit Drill Results
              </button>
            )}
          </div>
        </div>

        {/* Event Info Card */}
        {selectedEvent && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-cmf-primary" />
              <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Name:</strong> {selectedEvent.name}</p>
              <p><strong>Date:</strong> {formattedDate}</p>
              <p><strong>Location:</strong> {selectedEvent.location || 'Location TBD'}</p>
            </div>
          </div>
        )}

        {/* Getting Started Guide */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Getting Started</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-cmf-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
              <span>Event selected: <strong>{selectedEvent.name}</strong> ✓</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-cmf-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
              <span>
                {userRole === 'organizer' && 'Import players and manage event settings'}
                {userRole === 'coach' && 'View player rankings and adjust drill weights'}
                {userRole === 'player' && 'Submit your drill results'}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-cmf-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
              <span>View real-time rankings and results</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 