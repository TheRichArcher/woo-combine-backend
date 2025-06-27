import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, BarChart3 } from 'lucide-react';
import LoadingScreen from '../components/LoadingScreen';
import EventSelector from '../components/EventSelector';
import LeagueFallback from '../context/LeagueFallback';

export default function Home() {
  const { user: _user, userRole, selectedLeagueId, leagues } = useAuth();
  const { selectedEvent, noLeague } = useEvent();
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

  // Check league and event selection status
  if (!selectedLeagueId) {
    // Check if user has no leagues at all (new user) - show guided setup
    if (noLeague || (leagues && leagues.length === 0)) {
      return <LeagueFallback />;
    }
    
    // User has leagues but none selected - redirect to league selection
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
            <p className="text-gray-600 mb-6">
              Please select a league to get started.
            </p>
            <button
              onClick={() => navigate('/select-league')}
              className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition"
            >
              Select League
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedEvent) {
    // League selected but no event - show event selector
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-cmf-primary/30">
            <div className="w-16 h-16 bg-cmf-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-cmf-primary" />
            </div>
            <h2 className="text-2xl font-bold text-cmf-secondary mb-4">
              Select or Create an Event
            </h2>
            <p className="text-gray-600 mb-6">
              Choose an existing event or create a new one for your league.
            </p>
            
            {/* Event Selection Interface */}
            <EventSelector onEventSelected={(event) => {
              console.log('Event selected:', event);
              // Event is automatically set in EventContext
            }} />
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => navigate('/select-league')}
                className="text-sm text-gray-600 hover:text-cmf-primary underline"
              >
                ← Switch League
              </button>
            </div>
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
            {userRole === 'viewer' && (
              <button
                onClick={() => handleNavigation('/players')}
                className="bg-blue-600 text-white font-bold px-6 py-4 rounded-xl shadow hover:bg-blue-700 transition flex items-center justify-center gap-3 text-lg"
              >
                <Users className="w-6 h-6" />
                👁️ View Event Results
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
          <div className="space-y-4 text-sm text-gray-600">
            {/* Step 1 - Event Selected */}
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
              <span>Event selected: <strong>{selectedEvent.name}</strong></span>
            </div>
            
            {/* Step 2 - View Rankings & Adjust Weights */}
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-cmf-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
              <div className="flex-1">
                <div className="mb-2">
                  {userRole === 'organizer' && 'Import players and manage event settings'}
                  {userRole === 'coach' && 'View player rankings and adjust drill weights'}
                  {userRole === 'viewer' && 'View player rankings and explore different weight priorities'}
                  {userRole === 'player' && 'Submit your drill results'}
                </div>
                {userRole === 'organizer' && (
                  <button
                    onClick={() => handleNavigation('/admin')}
                    className="bg-cmf-secondary text-white px-4 py-2 rounded-lg hover:bg-cmf-primary transition text-sm font-medium"
                  >
                    🛠️ Manage Event Settings
                  </button>
                )}
                {(userRole === 'coach' || userRole === 'viewer') && (
                  <button
                    onClick={() => handleNavigation('/players')}
                    className="bg-cmf-primary text-white px-4 py-2 rounded-lg hover:bg-cmf-secondary transition text-sm font-medium"
                  >
                    {userRole === 'coach' ? '📊 View Rankings & Adjust Weights' : '👁️ Explore Player Rankings'}
                  </button>
                )}
                {userRole === 'player' && (
                  <button
                    onClick={() => handleNavigation('/drill-input')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium"
                  >
                    📝 Submit Your Results
                  </button>
                )}
              </div>
            </div>
            
            {/* Step 3 - Real-time Rankings */}
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-gray-300 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
              <div className="flex-1">
                <div className="mb-2">View real-time rankings and results</div>
                {(userRole === 'organizer' || userRole === 'coach' || userRole === 'viewer') && (
                  <button
                    onClick={() => handleNavigation('/players?tab=rankings')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                  >
                    🏆 View Live Rankings
                  </button>
                )}
                {userRole === 'player' && (
                  <button
                    onClick={() => handleNavigation('/players')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                  >
                    🏆 View Event Results
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 