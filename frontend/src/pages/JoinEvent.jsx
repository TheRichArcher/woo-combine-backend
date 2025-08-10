import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import Button from "../components/ui/Button";
import LoadingScreen from "../components/LoadingScreen";
import { QrCode, CheckCircle, AlertCircle } from "lucide-react";
import api from '../lib/api';

export default function JoinEvent() {
  const { leagueId, eventId, role } = useParams();
  const navigate = useNavigate();
  const { user, leagues, addLeague, setSelectedLeagueId, userRole } = useAuth();
  const { setSelectedEvent } = useEvent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [event, setEvent] = useState(null);
  const [league, setLeague] = useState(null);
  const [status, setStatus] = useState("checking"); // checking, found, not_found, success

  useEffect(() => {
    const handleEventJoin = async () => {
      // Clean parameter extraction - handle multiple URL formats
      let actualLeagueId, actualEventId, intendedRole;
      
      if (role) {
        // New format: /join-event/{leagueId}/{eventId}/{role}
        actualLeagueId = leagueId;
        actualEventId = eventId;
        intendedRole = role;
      } else if (leagueId && eventId) {
        // Previous format: /join-event/{leagueId}/{eventId}
        actualLeagueId = leagueId;
        actualEventId = eventId;
        intendedRole = null; // Let user choose
      } else {
        // Legacy format: /join-event/{eventId}
        actualLeagueId = null;
        actualEventId = leagueId; // eventId is actually in leagueId param
        intendedRole = null;
      }
      

      
      if (!actualEventId) {
        setError("Invalid event link");
        setStatus("not_found");
        setLoading(false);
        return;
      }

        // Check authentication first
        if (!user) {
        // Store invitation data for after login including intended role
        let inviteData;
        if (intendedRole) {
          inviteData = actualLeagueId ? `${actualLeagueId}/${actualEventId}/${intendedRole}` : `${actualEventId}/${intendedRole}`;
        } else {
          inviteData = actualLeagueId ? `${actualLeagueId}/${actualEventId}` : actualEventId;
        }
        localStorage.setItem('pendingEventJoin', inviteData);

        // CRITICAL FIX: Redirect to signup for invited users (they're typically new)
        navigate("/signup");
        return;
        }

        // If authenticated but role not selected yet, push to role selection first
        if (user && !userRole) {
          let inviteData;
          if (intendedRole) {
            inviteData = actualLeagueId ? `${actualLeagueId}/${actualEventId}/${intendedRole}` : `${actualEventId}/${intendedRole}`;
          } else {
            inviteData = actualLeagueId ? `${actualLeagueId}/${actualEventId}` : actualEventId;
          }
          localStorage.setItem('pendingEventJoin', inviteData);
          navigate('/select-role');
          return;
        }

      try {
        let targetLeague = null;
        let targetEvent = null;

        // STRATEGY 1: If we have both leagueId and eventId (new format)
        if (actualLeagueId) {

          
          // Check if user is already in this league
          const existingLeague = leagues?.find(l => l.id === actualLeagueId);
          
          if (!existingLeague) {
            // Need to join the league first

            
              const joinResponse = await api.post(`/leagues/join/${actualLeagueId}`, {
              user_id: user.uid,
              email: user.email,
                role: intendedRole || userRole || 'coach'
            });

            const joinData = joinResponse.data;
            targetLeague = { 
              id: actualLeagueId, 
              name: joinData.league_name || 'League', 
              role: intendedRole || userRole || 'coach' 
            };
            
            // Add to user context
            if (addLeague) addLeague(targetLeague);
          } else {
            targetLeague = existingLeague;
          }

          // Now fetch the event
          try {
            const eventResponse = await api.get(`/leagues/${actualLeagueId}/events/${actualEventId}`);
            targetEvent = eventResponse.data;
          } catch (eventError) {
            if (eventError.response?.status === 404) {
              throw new Error('Event not found in league');
            }
            throw eventError;
          }
        } 
        // STRATEGY 2: Only eventId provided (old format) - search user's leagues
        else {

          
          for (const userLeague of leagues || []) {
            try {
              const response = await api.get(`/leagues/${userLeague.id}/events/${actualEventId}`);
              targetEvent = response.data;
              targetLeague = userLeague;
              break;
            } catch (err) {
              if (err.response?.status !== 404) {
                // Non-404 errors indicate connection issues, not missing events
              }
              // Continue to next league
            }
          }

          if (!targetEvent) {
            throw new Error('Event not found in any of your leagues');
          }
        }

        // Success! Set up the event and league
        if (targetEvent && targetLeague) {
          setEvent(targetEvent);
          setLeague(targetLeague);
          setSelectedEvent(targetEvent);
          setSelectedLeagueId(targetLeague.id);
          setStatus("found");
          

          
          // Clear any stored invitation data
          localStorage.removeItem('pendingEventJoin');
          
          // Auto-redirect after 2 seconds
          setTimeout(() => {
            navigate("/dashboard");
          }, 2000);
        } else {
          throw new Error('Failed to set up event and league');
        }

      } catch (err) {
        setError(err.message || "Failed to join event");
        setStatus("not_found");
      } finally {
        setLoading(false);
      }
    };

    handleEventJoin();
  }, [leagueId, eventId, role, user, leagues, navigate, setSelectedEvent, addLeague, setSelectedLeagueId, userRole]);

  if (loading) {
    return <LoadingScreen size="medium" />;
  }

  return (
    <WelcomeLayout
      contentClassName="min-h-screen"
      hideHeader={true}
      showOverlay={false}
      backgroundColor="bg-surface-subtle"
    >
      <div className="w-full max-w-md wc-card p-8 text-center">
        <div className="mb-6">
          <QrCode className="w-16 h-16 mx-auto mb-4 text-brand-primary" />
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

        {status === "not_found" && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
              <h2 className="text-lg font-semibold text-red-800 mb-2">
                Unable to Join Event
              </h2>
              <p className="text-red-700 mb-4">
                {error || "This event link is invalid or expired."}
              </p>
            </div>
            
            <div className="space-y-3">
              <Button onClick={() => navigate("/join")} size="lg" className="w-full">
                Join League with Code
              </Button>
              <Button variant="subtle" onClick={() => navigate("/dashboard")} className="w-full">
                Go to Dashboard
              </Button>
            </div>
            

          </div>
        )}
      </div>
    </WelcomeLayout>
  );
} 