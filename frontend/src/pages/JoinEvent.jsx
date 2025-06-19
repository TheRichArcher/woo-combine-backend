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
  const { user, leagues, addLeague, setSelectedLeagueId, userRole } = useAuth();
  const { setSelectedEvent } = useEvent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [event, setEvent] = useState(null);
  const [league, setLeague] = useState(null);
  const [status, setStatus] = useState("checking"); // checking, found, not_found, no_access, success

  useEffect(() => {
    const handleEventJoin = async () => {
      // Handle backward compatibility: if leagueId is actually the eventId (old URL format)
      // Decode URL parameters in case they were encoded
      const rawEventId = leagueId && !eventId ? leagueId : eventId;
      const rawLeagueId = leagueId && eventId ? leagueId : null;
      
      const actualEventId = rawEventId ? decodeURIComponent(rawEventId) : null;
      const actualLeagueId = rawLeagueId ? decodeURIComponent(rawLeagueId) : null;
      
      console.log('JoinEvent starting:', { 
        leagueId, 
        eventId, 
        actualLeagueId, 
        actualEventId,
        userLeagueCount: leagues?.length || 0,
        currentURL: window.location.href,
        pathname: window.location.pathname 
      });
      
      if (!actualEventId) {
        setError("Invalid event code");
        setStatus("not_found");
        setLoading(false);
        return;
      }

      try {
        // First check if user is authenticated
        if (!user) {
          // Store the full path information for after authentication
          // Use the raw URL parameters to maintain consistency
          if (rawLeagueId) {
            // New format: store both league and event IDs
            localStorage.setItem('pendingEventJoin', `${rawLeagueId}/${rawEventId}`);
          } else {
            // Old format: just store event ID
            localStorage.setItem('pendingEventJoin', rawEventId);
          }
          console.log('JoinEvent: Stored pendingEventJoin for unauthenticated user:', localStorage.getItem('pendingEventJoin'));
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
            console.log(`Attempting to join league: ${actualLeagueId}`);
            console.log('League ID type:', typeof actualLeagueId, 'length:', actualLeagueId?.length);
            console.log('League ID characters:', actualLeagueId?.split('').map(c => `${c}(${c.charCodeAt(0)})`));
            
            // URL encode the league ID in case it contains special characters
            const encodedLeagueId = encodeURIComponent(actualLeagueId);
            console.log('Encoded league ID:', encodedLeagueId);
            
            const joinUrl = `/api/leagues/join/${encodedLeagueId}`;
            console.log('Full join URL:', joinUrl);
            console.log('About to make fetch request...');
            
            // ENHANCED DEBUGGING: Catch network/browser errors before backend
            let joinResponse;
            try {
              joinResponse = await fetch(joinUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${await user.getIdToken()}`
                },
                body: JSON.stringify({
                  user_id: user.uid,
                  email: user.email,
                  // CRITICAL FIX: Use the user's selected role from AuthContext
                  // This ensures the role they selected in SelectRole is properly applied
                  role: userRole || 'coach' // fallback to coach if somehow userRole is not set
                })
              });
              
              console.log('✅ Fetch completed successfully');
              console.log('Join response status:', joinResponse.status);
              console.log('Join response headers:', Object.fromEntries(joinResponse.headers.entries()));
              
            } catch (fetchError) {
              console.error('🚨 FETCH ERROR - Request never reached backend:', fetchError);
              console.error('Fetch error details:', {
                message: fetchError.message,
                name: fetchError.name,
                stack: fetchError.stack,
                url: joinUrl,
                leagueId: actualLeagueId,
                encodedLeagueId: encodedLeagueId
              });
              throw new Error(`Network error during league join: ${fetchError.message}`);
            }

            if (joinResponse.ok) {
              const joinData = await joinResponse.json();
              console.log('League join response:', joinData);
              // Add league to user's context - use the role that was sent in the request
              const assignedRole = userRole || 'coach'; // Use the same role we sent to backend
              targetLeague = { id: actualLeagueId, name: joinData.league_name || 'League', role: assignedRole };
              if (addLeague) {
                addLeague(targetLeague);
              }
              console.log('Successfully joined league and added to context with role:', assignedRole);
            } else {
              const errorText = await joinResponse.text();
              console.error('League join failed:', {
                status: joinResponse.status,
                statusText: joinResponse.statusText,
                errorText: errorText,
                url: joinUrl
              });
              
              // Try to parse error as JSON for better debugging
              try {
                const errorJson = JSON.parse(errorText);
                console.error('Parsed error JSON:', errorJson);
              } catch (e) {
                console.error('Error text (not JSON):', errorText);
              }
              
              throw new Error(`Failed to join league: ${joinResponse.status} ${errorText}`);
            }
          } catch (joinErr) {
            console.error("Error joining league:", joinErr);
            setError(`Unable to join the league for this event: ${joinErr.message}`);
            setStatus("not_found");
            setLoading(false);
            return;
          }
        }

        // Now fetch the event from the league
        try {
          console.log(`Fetching event ${actualEventId} from league ${actualLeagueId}`);
          const eventResponse = await fetch(`/api/leagues/${actualLeagueId}/events/${actualEventId}`, {
            headers: {
              'Authorization': `Bearer ${await user.getIdToken()}`
            }
          });

          console.log('Event fetch response status:', eventResponse.status);

          if (eventResponse.ok) {
            const foundEvent = await eventResponse.json();
            console.log('Event fetched successfully:', foundEvent);
            
            // Success! Set everything up
            setEvent(foundEvent);
            setLeague(targetLeague);
            setSelectedEvent(foundEvent);
            setSelectedLeagueId(actualLeagueId);
            setStatus("found");
            
            console.log('All setup complete, redirecting to dashboard in 2 seconds');
            // Auto-redirect to dashboard after 2 seconds
            setTimeout(() => {
              navigate("/dashboard");
            }, 2000);
          } else {
            const errorText = await eventResponse.text();
            console.error('Event fetch failed:', eventResponse.status, errorText);
            throw new Error(`Event not found in league: ${eventResponse.status} ${errorText}`);
          }
        } catch (eventErr) {
          console.error("Error fetching event:", eventErr);
          setError(`Event not found or no longer available: ${eventErr.message}`);
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
  }, [leagueId, eventId, user, leagues, navigate, setSelectedEvent, addLeague, setSelectedLeagueId, userRole]);

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
                onClick={() => {
                  // Try searching for this event across all public leagues
                  const eventCode = leagueId && !eventId ? leagueId : eventId;
                  console.log('Attempting manual event search for:', eventCode);
                  window.open(`/join?code=${eventCode}`, '_blank');
                }}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200"
              >
                Try Manual Join
              </button>
              
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors duration-200"
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
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-blue-800 text-xs">
                <strong>Debug Info:</strong> URL format issue detected. The "Try Manual Join" button will attempt to join using the event code directly.
              </p>
            </div>
          </div>
        )}
      </div>
    </WelcomeLayout>
  );
} 