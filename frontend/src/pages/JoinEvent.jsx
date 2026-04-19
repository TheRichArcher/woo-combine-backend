import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import LoadingScreen from "../components/LoadingScreen";
import { QrCode, CheckCircle, AlertCircle } from "lucide-react";
import axios from "axios";
import api from '../lib/api';
import { persistViewerInviteEventContext, VIEWER_INVITE_EVENT_CONTEXT_KEY } from '../lib/viewerInviteContext';

const isQrDebugEnabled = () => {
  try {
    return localStorage.getItem('debug_qr_flow') === '1';
  } catch {
    return false;
  }
};

const qrDebug = (message, payload) => {
  if (!isQrDebugEnabled()) return;
  console.log(`[QR_FLOW][JoinEvent] ${message}`, payload);
};

const QR_JOIN_STAGE_KEY = 'debug_qr_join_stage';
const INVITE_JOIN_IN_PROGRESS_KEY = 'inviteJoinInProgress';

const writeJoinStage = (stage, payload = {}) => {
  const snapshot = {
    stage,
    ...payload,
    timestamp: new Date().toISOString()
  };
  qrDebug(`Stage: ${stage}`, snapshot);
  try {
    localStorage.setItem(QR_JOIN_STAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // best-effort debug write
  }
};

export default function JoinEvent() {
  const { leagueId, eventId, role } = useParams();
  const navigate = useNavigate();
  const { user, leagues, setSelectedLeagueId, userRole, initializing, refreshLeagues } = useAuth();
  const { setSelectedEvent } = useEvent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [event, setEvent] = useState(null);
  const [league, setLeague] = useState(null);
  const [status, setStatus] = useState("checking"); // checking, found, not_found, success
  const handledJoinKeyRef = useRef(null);

  useEffect(() => {
    // Wait for auth initialization to complete
    if (initializing) return;
    let isActive = true;
    const joinFlowController = new AbortController();

    const isCancellationError = (error) => (
      (typeof axios !== "undefined" && typeof axios.isCancel === "function" && axios.isCancel(error)) ||
      error?.code === "ERR_CANCELED" ||
      error?.name === "CanceledError" ||
      error?.name === "AbortError" ||
      String(error?.message || "").toLowerCase().includes("aborted") ||
      String(error?.message || "").toLowerCase() === "canceled"
    );

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const withCancellationRetry = async (requestFactory, options = {}) => {
      const retries = options.retries ?? 2;
      const retryDelayMs = options.retryDelayMs ?? 150;
      const label = options.label || "request";
      let lastError = null;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        if (!isActive) {
          return null;
        }
        try {
          return await requestFactory();
        } catch (error) {
          lastError = error;
          if (!isCancellationError(error) || attempt >= retries) {
            throw error;
          }
          qrDebug("Retrying canceled request in JoinEvent", {
            label,
            attempt: attempt + 1,
            retries,
            message: error?.message || "canceled"
          });
          await sleep(retryDelayMs * (attempt + 1));
        }
      }

      throw lastError;
    };

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
      
      qrDebug('Route params parsed', {
        leagueId,
        eventId,
        role,
        actualLeagueId,
        actualEventId,
        intendedRole
      });
      writeJoinStage('route-params-parsed', {
        leagueId,
        eventId,
        role,
        actualLeagueId,
        actualEventId,
        intendedRole,
        userAgent: navigator.userAgent
      });

      
      if (!actualEventId) {
        setError("Invalid event link");
        setStatus("not_found");
        setLoading(false);
        return;
      }

      const joinKey = `${user?.uid || 'anon'}:${actualLeagueId || 'none'}:${actualEventId}:${intendedRole || 'none'}`;
      if (handledJoinKeyRef.current === joinKey) {
        qrDebug('Skipping duplicate join flow execution', { joinKey });
        return;
      }
      handledJoinKeyRef.current = joinKey;
      try {
        localStorage.setItem(INVITE_JOIN_IN_PROGRESS_KEY, '1');
      } catch {
        // best effort lock flag
      }

      const buildJoinRequestPayload = (eventIdForInvite) => {
        const effectiveRole = (intendedRole ? intendedRole.toLowerCase() : 'viewer');
        const payload = {
          user_id: user.uid,
          email: user.email,
          role: effectiveRole
        };
        // Critical for scoped coach/viewer memberships: backend only appends
        // *_event_ids when invited_event_id is present on league joins.
        if ((effectiveRole === 'viewer' || effectiveRole === 'coach') && eventIdForInvite) {
          payload.invited_event_id = eventIdForInvite;
        }
        return payload;
      };

      const requestConfig = { signal: joinFlowController.signal };
      const effectiveInviteRole = (intendedRole || userRole || '').toLowerCase();
      const hasPendingInvite = (() => {
        try {
          const raw = localStorage.getItem('pendingEventJoin');
          return Boolean(raw && raw.trim());
        } catch {
          return false;
        }
      })();
      const mustApplyInviteBeforeFetch = Boolean(
        hasPendingInvite || intendedRole === 'coach' || intendedRole === 'viewer'
      );
      let inviteJoinConfirmed = false;

      const runJoinRequest = async (targetLeagueId) => {
        const joinPayload = buildJoinRequestPayload(actualEventId);
        console.info('[JoinEvent] Invite join started', {
          targetLeagueId,
          actualEventId,
          role: joinPayload?.role || null
        });
        const joinResponse = await withCancellationRetry(
          () => api.post(`/leagues/join/${targetLeagueId}`, joinPayload, requestConfig),
          { label: "join-league" }
        );
        console.info('[JoinEvent] Invite join succeeded', {
          targetLeagueId,
          actualEventId,
          status: joinResponse?.status,
          response: joinResponse?.data || null
        });
        inviteJoinConfirmed = true;
        return { joinResponse, joinPayload };
      };

      const runEventFetch = async (targetLeagueId) => (
        withCancellationRetry(
          () => api.get(`/leagues/${targetLeagueId}/events/${actualEventId}`, requestConfig),
          { label: "get-event" }
        )
      );

      const fetchEventWithScopeRecovery = async (targetLeagueId) => {
        if (mustApplyInviteBeforeFetch && !inviteJoinConfirmed) {
          throw new Error('Invite join must complete before event fetch');
        }
        try {
          return await runEventFetch(targetLeagueId);
        } catch (eventError) {
          const status = eventError?.response?.status;
          if (
            status === 403 &&
            (effectiveInviteRole === "coach" || effectiveInviteRole === "viewer")
          ) {
            qrDebug("Event fetch hit 403 after join, retrying scope sync", {
              targetLeagueId,
              actualEventId,
              effectiveInviteRole
            });
            const { joinResponse, joinPayload } = await runJoinRequest(targetLeagueId);
            writeJoinStage('join-api-scope-recovery-success', {
              actualLeagueId: targetLeagueId,
              actualEventId,
              effectiveInviteRole,
              joinPayload,
              joinData: joinResponse?.data
            });
            return runEventFetch(targetLeagueId);
          }
          throw eventError;
        }
      };

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
        writeJoinStage('redirect-signup-missing-user', { inviteData });

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
          writeJoinStage('redirect-select-role-missing-role', { inviteData });
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

            
            let joinData;
            try {
              const { joinResponse, joinPayload } = await runJoinRequest(actualLeagueId);
              joinData = joinResponse.data;
              writeJoinStage('join-api-success', {
                actualLeagueId,
                actualEventId,
                intendedRole,
                joinPayload,
                joinData
              });
              qrDebug('Join API success', {
                url: `/leagues/join/${actualLeagueId}`,
                status: joinResponse?.status,
                joinPayload,
                joinData
              });
            } catch (joinError) {
              writeJoinStage('join-api-failure', {
                actualLeagueId,
                actualEventId,
                status: joinError?.response?.status,
                message: joinError?.message
              });
              qrDebug('Join API failure', {
                url: `/leagues/join/${actualLeagueId}`,
                status: joinError?.response?.status,
                message: joinError?.message
              });
              throw joinError;
            }
            
            // CRITICAL FIX: Refresh leagues from backend and USE RETURNED ARRAY
            // Cannot rely on context leagues state because React state updates are async
            // Using returned value ensures we have fresh data immediately
            const refreshedLeagues = await refreshLeagues();
            writeJoinStage('refresh-leagues-after-join', {
              refreshedLeaguesCount: refreshedLeagues?.length || 0,
              actualLeagueId
            });
            
            // Find league in the RETURNED array (not stale context state)
            targetLeague = refreshedLeagues.find(l => l.id === actualLeagueId) || { 
              id: actualLeagueId, 
              name: joinData.league_name || 'League', 
              role: (joinData?.role || intendedRole || userRole || 'viewer').toLowerCase()
            };
          } else {
            targetLeague = existingLeague;
            const effectiveRole = (intendedRole || userRole || existingLeague?.role || '').toLowerCase();
            // If coach/viewer already belongs to the league, still re-hit join endpoint so backend
            // can merge invited_event_id into *_event_ids for event-scoped access.
            if (
              mustApplyInviteBeforeFetch ||
              effectiveRole === 'viewer' ||
              effectiveRole === 'coach'
            ) {
              try {
                const { joinResponse, joinPayload } = await runJoinRequest(actualLeagueId);
                writeJoinStage('join-api-existing-member-scope-sync-success', {
                  actualLeagueId,
                  actualEventId,
                  effectiveRole,
                  joinPayload,
                  joinData: joinResponse?.data
                });
                qrDebug('Existing member scope sync success', {
                  url: `/leagues/join/${actualLeagueId}`,
                  status: joinResponse?.status,
                  effectiveRole,
                  joinPayload,
                  joinData: joinResponse?.data
                });
              } catch (joinError) {
                writeJoinStage('join-api-existing-member-scope-sync-failure', {
                  actualLeagueId,
                  actualEventId,
                  effectiveRole,
                  status: joinError?.response?.status,
                  message: joinError?.message
                });
                qrDebug('Existing member scope sync failed', {
                  url: `/leagues/join/${actualLeagueId}`,
                  status: joinError?.response?.status,
                  effectiveRole,
                  message: joinError?.message
                });
                throw joinError;
              }
            }
          }

          if (mustApplyInviteBeforeFetch && !inviteJoinConfirmed) {
            throw new Error('Invite join did not complete. Please retry this invite link.');
          }

          // Now fetch the event
          try {
            const eventResponse = await fetchEventWithScopeRecovery(actualLeagueId);
            targetEvent = eventResponse.data;
            qrDebug('Event fetch success', {
              url: `/leagues/${actualLeagueId}/events/${actualEventId}`,
              status: eventResponse?.status,
              eventId: targetEvent?.id,
              eventName: targetEvent?.name
            });
          } catch (eventError) {
            qrDebug('Event fetch failed', {
              url: `/leagues/${actualLeagueId}/events/${actualEventId}`,
              status: eventError?.response?.status,
              message: eventError?.message
            });
            if (eventError.response?.status === 404) {
              throw new Error('Event not found in league');
            }
            throw eventError;
          }
        } 
        // STRATEGY 2: Only eventId provided (old format)
        else {

          if (mustApplyInviteBeforeFetch) {
            let joinResponse;
            try {
              const { joinResponse: resolvedJoinResponse, joinPayload } = await runJoinRequest(actualEventId);
              joinResponse = resolvedJoinResponse;
              writeJoinStage('legacy-join-api-success', {
                actualEventId,
                joinPayload,
                joinData: joinResponse?.data
              });
              qrDebug('Join API success', {
                url: `/leagues/join/${actualEventId}`,
                status: joinResponse?.status,
                joinPayload,
                joinData: joinResponse?.data
              });
            } catch (joinError) {
              writeJoinStage('legacy-join-api-failure', {
                actualEventId,
                status: joinError?.response?.status,
                message: joinError?.message
              });
              qrDebug('Join API failure', {
                url: `/leagues/join/${actualEventId}`,
                status: joinError?.response?.status,
                message: joinError?.message
              });
              throw joinError;
            }

            const resolvedLeagueId = joinResponse?.data?.league_id;
            if (!resolvedLeagueId) {
              throw new Error('Unable to resolve league for this event');
            }
            const refreshedLeagues = await refreshLeagues();
            targetLeague = refreshedLeagues.find(l => l.id === resolvedLeagueId) || {
              id: resolvedLeagueId,
              name: joinResponse.data?.league_name || 'League',
              role: (joinResponse?.data?.role || intendedRole || userRole || 'viewer').toLowerCase()
            };
            const legacyEventResponse = await fetchEventWithScopeRecovery(resolvedLeagueId);
            targetEvent = legacyEventResponse.data;
          }

          // If user already has leagues, search them first
          for (const userLeague of (mustApplyInviteBeforeFetch ? [] : (leagues || []))) {
            try {
              const response = await runEventFetch(userLeague.id);
              targetEvent = response.data;
              targetLeague = userLeague;
              qrDebug('Event fetch success', {
                url: `/leagues/${userLeague.id}/events/${actualEventId}`,
                status: response?.status,
                eventId: targetEvent?.id,
                eventName: targetEvent?.name
              });
              break;
            } catch (err) {
              qrDebug('Event fetch failed', {
                url: `/leagues/${userLeague.id}/events/${actualEventId}`,
                status: err?.response?.status,
                message: err?.message
              });
              if (err.response?.status !== 404) {
                // Non-404 errors indicate connection issues, not missing events
              }
              // Continue to next league
            }
          }

          // If not found and user has no leagues, attempt to resolve via event code directly
          if (!targetEvent) {
            let joinResponse;
            try {
              const { joinResponse: resolvedJoinResponse, joinPayload } = await runJoinRequest(actualEventId);
              joinResponse = resolvedJoinResponse;
              writeJoinStage('legacy-join-api-success', {
                actualEventId,
                joinPayload,
                joinData: joinResponse?.data
              });
              qrDebug('Join API success', {
                url: `/leagues/join/${actualEventId}`,
                status: joinResponse?.status,
                joinPayload,
                joinData: joinResponse?.data
              });
            } catch (joinError) {
              writeJoinStage('legacy-join-api-failure', {
                actualEventId,
                status: joinError?.response?.status,
                message: joinError?.message
              });
              qrDebug('Join API failure', {
                url: `/leagues/join/${actualEventId}`,
                status: joinError?.response?.status,
                message: joinError?.message
              });
              throw joinError;
            }

            const resolvedLeagueId = joinResponse?.data?.league_id;
            if (!resolvedLeagueId) {
              throw new Error('Unable to resolve league for this event');
            }

            // CRITICAL FIX: Refresh leagues and USE RETURNED ARRAY
            // Cannot rely on context leagues state (React state updates are async)
            const refreshedLeagues = await refreshLeagues();
            writeJoinStage('refresh-leagues-after-legacy-join', {
              refreshedLeaguesCount: refreshedLeagues?.length || 0,
              resolvedLeagueId
            });
            
            // Find league in the RETURNED array (not stale context state)
            targetLeague = refreshedLeagues.find(l => l.id === resolvedLeagueId) || {
              id: resolvedLeagueId,
              name: joinResponse.data?.league_name || 'League',
              role: (joinResponse?.data?.role || intendedRole || userRole || 'viewer').toLowerCase()
            };

            const legacyEventResponse = await fetchEventWithScopeRecovery(resolvedLeagueId);
            targetEvent = legacyEventResponse.data;
            qrDebug('Event fetch success', {
              url: `/leagues/${resolvedLeagueId}/events/${actualEventId}`,
              status: legacyEventResponse?.status,
              eventId: targetEvent?.id,
              eventName: targetEvent?.name
            });
          }

          if (!targetEvent) {
            throw new Error('Event not found in any of your leagues');
          }
        }

        // Success! Set up the event and league
        if (targetEvent && targetLeague) {
          setEvent(targetEvent);
          setLeague(targetLeague);
          const persistedInviteContext = persistViewerInviteEventContext({
            event: targetEvent,
            leagueId: targetLeague?.id || null,
            role: intendedRole || userRole || 'viewer',
            source: 'join-event'
          });
          writeJoinStage('viewer-invite-context-persisted', {
            selectedLeagueId: targetLeague?.id || null,
            selectedEventId: targetEvent?.id || null,
            selectedEventLeagueId: targetEvent?.league_id || null,
            persistedInviteContext
          });
          qrDebug('Viewer invite context persisted with ids', {
            selectedLeagueId: targetLeague?.id || null,
            selectedEventId: targetEvent?.id || null,
            selectedEventLeagueId: targetEvent?.league_id || null,
            persistedInviteContext
          });
          writeJoinStage('viewer-invite-context-persist-attempted', {
            storageKey: VIEWER_INVITE_EVENT_CONTEXT_KEY,
            persistedInviteContext
          });
          qrDebug('Viewer invite context persist result', {
            storageKey: VIEWER_INVITE_EVENT_CONTEXT_KEY,
            persistedInviteContext
          });
          qrDebug('Calling setSelectedEvent', {
            id: targetEvent?.id,
            name: targetEvent?.name,
            league_id: targetEvent?.league_id
          });
          // Apply league before event to avoid stale-league mismatch clears.
          qrDebug('Calling setSelectedLeagueId', { id: targetLeague?.id });
          setSelectedLeagueId(targetLeague.id);
          qrDebug('Calling setSelectedEvent', {
            id: targetEvent?.id,
            name: targetEvent?.name,
            league_id: targetEvent?.league_id
          });
          setSelectedEvent(targetEvent);
          writeJoinStage('selection-state-written', {
            selectedLeagueId: targetLeague?.id || null,
            selectedEventId: targetEvent?.id || null,
            selectedEventLeagueId: targetEvent?.league_id || null
          });
          setStatus("found");
          

          
          // Clear any stored invitation data
          localStorage.removeItem('pendingEventJoin');
          
          // Auto-redirect after 2 seconds.
          // Viewer goes to standings; staff goes to coach shell with selected context.
          setTimeout(() => {
            if (mustApplyInviteBeforeFetch && !inviteJoinConfirmed) {
              setError('Invite join was not completed. Please retry the invite link.');
              setStatus('not_found');
              return;
            }
            writeJoinStage('navigate-live-standings-timeout-fired', {
              from: window.location.pathname,
              selectedLeagueId: localStorage.getItem('selectedLeagueId'),
              selectedEventRaw: localStorage.getItem('selectedEvent')
            });
            const destination = (intendedRole || userRole || '').toLowerCase() === 'viewer'
              ? '/live-standings'
              : '/coach';
            qrDebug('Navigating after join', {
              destination,
              from: window.location.pathname,
              selectedLeagueId: targetLeague?.id,
              selectedEventId: targetEvent?.id
            });
            navigate(destination);
          }, 2000);
        } else {
          throw new Error('Failed to set up event and league');
        }

      } catch (err) {
        if (isCancellationError(err) || !isActive) {
          handledJoinKeyRef.current = null;
          try {
            localStorage.removeItem(INVITE_JOIN_IN_PROGRESS_KEY);
          } catch {
            // best effort cleanup
          }
          qrDebug('Join flow canceled safely', {
            message: err?.message || 'canceled'
          });
          return;
        }
        writeJoinStage('join-flow-failure', {
          status: err?.response?.status,
          message: err?.message
        });
        qrDebug('Join flow failed', {
          status: err?.response?.status,
          message: err?.message
        });
        if (err?.response?.status === 409) {
          setStatus("found");
          setError("This invite points to a different league than expected. Please try scanning the latest QR code or ask the organizer for a fresh link.");
        } else if (err?.response?.status === 404) {
          setError("We couldn't find that league or event. Double-check the link or ask the organizer for a new invitation.");
        } else {
          setError(err.message || "Failed to join event");
        }
        setStatus("not_found");
      } finally {
        try {
          localStorage.removeItem(INVITE_JOIN_IN_PROGRESS_KEY);
        } catch {
          // best effort cleanup
        }
        if (!isActive) return;
        writeJoinStage('join-flow-finally', { status });
        qrDebug('Join flow completed', { status });
        setLoading(false);
      }
    };

    handleEventJoin();

    return () => {
      // Keep in-flight join requests alive across harmless dependency re-runs.
      // We only gate state writes via isActive to avoid stale updates.
      isActive = false;
    };
  }, [leagueId, eventId, role, user, leagues, navigate, setSelectedEvent, setSelectedLeagueId, userRole, initializing, refreshLeagues]);

  if (loading || initializing) {
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
          <QrCode className="w-16 h-16 mx-auto mb-4 text-brand-primary" />
          <h1 className="text-2xl font-bold mb-2">Join Event</h1>
        </div>

        {status === "found" && event && league && (
          <div className="space-y-4">
            <div className="bg-semantic-success/10 border border-semantic-success/20 rounded-lg p-4">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-semantic-success" />
              <h2 className="text-lg font-semibold text-semantic-success mb-2">
                Successfully Joined!
              </h2>
              <p className="text-semantic-success/90 mb-2">
                <strong>{event.name}</strong>
              </p>
              <p className="text-semantic-success/80 text-sm">
                League: {league.name}
              </p>
            </div>
            <p className="text-gray-600 text-sm">
              Redirecting to your event dashboard...
            </p>
          </div>
        )}

        {status === "not_found" && (
          <div className="space-y-4">
            <div className="bg-semantic-error/10 border border-semantic-error/20 rounded-lg p-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-semantic-error" />
              <h2 className="text-lg font-semibold text-semantic-error mb-2">
                Unable to Join Event
              </h2>
              <p className="text-semantic-error/90 mb-4">
                {error || "This event link is invalid or expired."}
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => navigate("/join")}
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200"
              >
                Join League with Code
              </button>
              
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors duration-200"
              >
                Go to Dashboard
              </button>
            </div>
            

          </div>
        )}
      </div>
    </WelcomeLayout>
  );
} 