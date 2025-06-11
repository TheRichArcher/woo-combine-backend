import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block w-6 h-6 border-4 border-gray-300 border-t-cmf-primary rounded-full"></div>
          <div className="mt-3 text-gray-600">Loading...</div>
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
          <p className="text-gray-600 mb-4">
            {selectedEvent ? (
              <>Event: <strong>{selectedEvent.name}</strong> - {formattedDate}</>
            ) : (
              'Select an event to get started'
            )}
          </p>
          
          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-3">
            {userRole === 'organizer' && (
              <>
                <button
                  onClick={() => handleNavigation('/admin')}
                  className="bg-cmf-secondary text-white font-bold px-4 py-3 rounded-lg shadow hover:bg-cmf-primary transition flex items-center justify-center"
                >
                  📊 Manage Event
                </button>
                <button
                  onClick={() => handleNavigation('/coach-dashboard')}
                  className="bg-cmf-primary text-white font-bold px-4 py-3 rounded-lg shadow hover:bg-cmf-secondary transition flex items-center justify-center"
                >
                  🏆 View Rankings
                </button>
              </>
            )}
            {userRole === 'coach' && (
              <button
                onClick={() => handleNavigation('/coach-dashboard')}
                className="bg-cmf-primary text-white font-bold px-4 py-3 rounded-lg shadow hover:bg-cmf-secondary transition flex items-center justify-center"
              >
                🏆 Coach Dashboard
              </button>
            )}
            {userRole === 'player' && selectedEvent && (
              <button
                onClick={() => handleNavigation('/drill-input')}
                className="bg-cmf-secondary text-white font-bold px-4 py-3 rounded-lg shadow hover:bg-cmf-primary transition flex items-center justify-center"
              >
                📝 Submit Drill Results
              </button>
            )}
          </div>
        </div>

        {/* Event Info */}
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

        {/* Getting Started */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Getting Started</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <span className="text-cmf-primary font-bold">1.</span>
              <span>Select an event from the dropdown above</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-cmf-primary font-bold">2.</span>
              <span>
                {userRole === 'organizer' && 'Import players and manage event settings'}
                {userRole === 'coach' && 'View player rankings and adjust drill weights'}
                {userRole === 'player' && 'Submit your drill results'}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-cmf-primary font-bold">3.</span>
              <span>View real-time rankings and results</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 