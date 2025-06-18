import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import LoadingScreen from "../components/LoadingScreen";
import { QrCode, CheckCircle, AlertCircle } from "lucide-react";

export default function JoinEvent() {
  const { leagueId, eventId } = useParams();
  const navigate = useNavigate();
  const { user, leagues, addLeague, setSelectedLeagueId } = useAuth();
  const { setSelectedEvent } = useEvent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [event, setEvent] = useState(null);
  const [league, setLeague] = useState(null);
  const [status, setStatus] = useState("checking"); // checking, found, not_found, no_access, success

  useEffect(() => {
    const handleEventJoin = async () => {
      // Handle backward compatibility: if leagueId is actually the eventId (old URL format)
      const actualEventId = leagueId && !eventId ? leagueId : eventId;
      const actualLeagueId = leagueId && eventId ? leagueId : null;
      
      if (!actualEventId) {
        setError("Invalid event code");
        setStatus("not_found");
        setLoading(false);
        return;
      }

      try {
        // First check if user is authenticated
        if (!user) {
          // Store the event ID for after authentication (keeping old format for compatibility)
          localStorage.setItem('pendingEventJoin', actualEventId);
          navigate("/login");
          return;
        }

        // If we don't have a leagueId (old URL format), try to find the event in user's leagues
        if (!actualLeagueId) {
          let foundEvent = null;
          let foundLeague = null;

          for (const userLeague of leagues || []) {
            try {
              const response = await fetch(`/api/leagues/${userLeague.id}/events/${actualEventId}`, {
                headers: {
                  'Authorization': `Bearer ${await user.getIdToken()}`
                }
              });

              if (response.ok) {
                foundEvent = await response.json();
                foundLeague = userLeague;
                break;
              }
            } catch (err) {
              console.error(`Error checking event in league ${userLeague.id}:`, err);
            }
          }

          if (foundEvent && foundLeague) {
            // Success with old URL format
            setEvent(foundEvent);
            setLeague(foundLeague);
            setSelectedEvent(foundEvent);
            setSelectedLeagueId(foundLeague.id);
            setStatus("found");
            
            setTimeout(() => {
              navigate("/dashboard");
            }, 2000);
            setLoading(false);
            return;
          } else {
            // Event not found in user's leagues
            setStatus("no_access");
            setLoading(false);
            return;
          }
        }

        // New URL format: we have both leagueId and eventId
        // Check if user is already a member of this league
        const existingLeague = leagues?.find(l => l.id === actualLeagueId);
        
        let targetLeague = existingLeague;

        if (!existingLeague) {
          // User is not a member - join them to the league automatically
          try {
            const joinResponse = await fetch(`/api/leagues/${actualLeagueId}/join`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await user.getIdToken()}`
              },
              body: JSON.stringify({
                user_id: user.uid,
                email: user.email
              })
            });

            if (joinResponse.ok) {
              const joinData = await joinResponse.json();
              // Add league to user's context
              targetLeague = { id: actualLeagueId, name: joinData.league_name || 'League', role: 'coach' };
              if (addLeague) {
                addLeague(targetLeague);
              }
            } else {
              throw new Error('Failed to join league');
            }
          } catch (joinErr) {
            console.error("Error joining league:", joinErr);
            setError("Unable to join the league for this event.");
            setStatus("not_found");
            setLoading(false);
            return;
          }
        }

        // Now fetch the event from the league
        try {
          const eventResponse = await fetch(`/api/leagues/${actualLeagueId}/events/${actualEventId}`, {
            headers: {
              'Authorization': `Bearer ${await user.getIdToken()}`
            }
          });

          if (eventResponse.ok) {
            const foundEvent = await eventResponse.json();
            
            // Success! Set everything up
            setEvent(foundEvent);
            setLeague(targetLeague);
            setSelectedEvent(foundEvent);
            setSelectedLeagueId(actualLeagueId);
            setStatus("found");
            
            // Auto-redirect to dashboard after 2 seconds
            setTimeout(() => {
              navigate("/dashboard");
            }, 2000);
          } else {
            throw new Error('Event not found in league');
          }
        } catch (eventErr) {
          console.error("Error fetching event:", eventErr);
          setError("Event not found or no longer available.");
          setStatus("not_found");
        }

      } catch (err) {
        console.error("Error in event join flow:", err);
        setError("Failed to join event. Please try again.");
        setStatus("not_found");
      }

      setLoading(false);
    };

    handleEventJoin();
  }, [leagueId, eventId, user, leagues, navigate, setSelectedEvent, addLeague, setSelectedLeagueId]);

  if (loading) {
    return <LoadingScreen size="medium" />;
  }

  return (
    <WelcomeLayout
      contentClassName="min-h-screen"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="mb-6">
          <QrCode className="w-16 h-16 mx-auto mb-4 text-cyan-600" />
          <h1 className="text-2xl font-bold mb-2">Join Event</h1>
        </div>

        {status === "found" && event && league && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <h2 className="text-lg font-semibold text-green-800 mb-2">
                Successfully Joined!
              </h2>
              <p className="text-green-700 mb-2">
                <strong>{event.name}</strong>
              </p>
              <p className="text-green-600 text-sm">
                League: {league.name}
              </p>
            </div>
            <p className="text-gray-600 text-sm">
              Redirecting to your dashboard...
            </p>
          </div>
        )}

        {status === "no_access" && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-orange-600" />
              <h2 className="text-lg font-semibold text-orange-800 mb-2">
                League Access Required
              </h2>
              <p className="text-orange-700 mb-4">
                This event belongs to a league you haven't joined yet. You'll need to join the league first.
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => navigate("/join")}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200"
              >
                Join League with Invite Code
              </button>
              
              <button
                onClick={() => navigate("/select-league")}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors duration-200"
              >
                Choose from Your Leagues
              </button>
            </div>
            
            <p className="text-gray-500 text-sm mt-4">
              Event Code: <code className="bg-gray-100 px-2 py-1 rounded">{leagueId && !eventId ? leagueId : eventId}</code>
            </p>
          </div>
        )}

        {status === "not_found" && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
              <h2 className="text-lg font-semibold text-red-800 mb-2">
                Event Not Found
              </h2>
              <p className="text-red-700 mb-2">
                {error || "This event code is invalid or expired."}
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200"
              >
                Go to Dashboard
              </button>
              
              <button
                onClick={() => navigate("/join")}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors duration-200"
              >
                Join League Instead
              </button>
            </div>
            
            <p className="text-gray-500 text-sm mt-4">
              Event Code: <code className="bg-gray-100 px-2 py-1 rounded">{leagueId && !eventId ? leagueId : eventId}</code>
            </p>
          </div>
        )}
      </div>
    </WelcomeLayout>
  );
} 