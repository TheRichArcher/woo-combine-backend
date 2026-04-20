import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Users, Trash2 } from 'lucide-react';

import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { formatEventDate } from '../utils/dateUtils';
import CreateEventModal from '../components/CreateEventModal';
import EditEventModal from '../components/EditEventModal';
import DeleteEventFlow from '../components/DeleteEventFlow';
import LeagueFallback from '../context/LeagueFallback';
import api from '../lib/api';

function ViewerEventUnavailable({ selectedEvent }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">We couldn't load your event</h1>
        <p className="text-sm text-gray-600 mb-6">
          Please reopen your invite link or scan the event QR code again.
        </p>
        <div className="space-y-3">
          {selectedEvent ? (
            <button
              onClick={() => navigate('/live-standings')}
              className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold px-4 py-3 rounded-xl transition"
            >
              Open Live Standings
            </button>
          ) : (
            <button
              onClick={() => navigate('/welcome')}
              className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold px-4 py-3 rounded-xl transition"
            >
              Reopen Invite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const sportEmojiFromTemplate = (drillTemplate) => {
  const t = (drillTemplate || '').toLowerCase();
  if (t.includes('football')) return '🏈';
  if (t.includes('soccer')) return '⚽';
  if (t.includes('basket')) return '🏀';
  if (t.includes('base')) return '⚾';
  if (t.includes('track')) return '🏃';
  if (t.includes('volley')) return '🏐';
  return '🏆';
};

function statusFromCounts({ isPlayersLoading, hasPlayersError, playerCount, scoredCount }) {
  if (isPlayersLoading) return { label: 'Loading', tone: 'bg-gray-100 text-gray-700 border-gray-200' };
  if (hasPlayersError) return { label: 'Unknown', tone: 'bg-gray-100 text-gray-700 border-gray-200' };
  if (playerCount <= 0) return { label: 'Setup', tone: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (scoredCount <= 0) return { label: 'Ready', tone: 'bg-green-100 text-green-800 border-green-200' };
  if (scoredCount < playerCount) return { label: 'Live', tone: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  return { label: 'Done', tone: 'bg-gray-100 text-gray-700 border-gray-200' };
}

function nextActionFromCounts({ isPlayersLoading, hasPlayersError, playerCount, scoredCount, userRole }) {
  if (isPlayersLoading) {
    return { text: 'Loading players...', route: '/dashboard', tone: 'bg-gray-50 border-gray-200 text-gray-700', isDisabled: true };
  }
  if (hasPlayersError) {
    return { text: 'Player data unavailable', route: '/dashboard', tone: 'bg-gray-50 border-gray-200 text-gray-700', isDisabled: true };
  }
  const isStaff = userRole === 'organizer' || userRole === 'coach';
  if (playerCount <= 0) {
    return { text: 'Next: Add your players', route: '/players?action=import', tone: 'bg-amber-50 border-amber-200 text-amber-900' };
  }
  if (isStaff && scoredCount <= 0) {
    return { text: 'Ready for Combine Day', route: '/live-entry', tone: 'bg-green-50 border-green-200 text-green-900' };
  }
  if (isStaff && scoredCount < playerCount) {
    return { text: `Continue scoring (${scoredCount}/${playerCount})`, route: '/live-entry', tone: 'bg-indigo-50 border-indigo-200 text-indigo-900' };
  }
  return { text: 'View Rankings', route: '/live-standings', tone: 'bg-green-50 border-green-200 text-green-900' };
}

export default function CoachDashboard() {
  const { events, selectedEvent, setSelectedEvent, noLeague, setEvents } = useEvent();
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [playerCounts, setPlayerCounts] = useState({}); // { eventId: { total, scored, isLoading, hasError } }

  // Fetch player counts for all events
  useEffect(() => {
    if (!Array.isArray(events) || events.length === 0) {
      setPlayerCounts({});
      return;
    }
    let cancelled = false;

    const initialCounts = {};
    for (const event of events) {
      if (!event.id) continue;
      initialCounts[event.id] = { total: 0, scored: 0, isLoading: true, hasError: false };
    }
    setPlayerCounts(initialCounts);

    async function fetchCounts() {
      const countEntries = await Promise.all(
        events
          .filter((event) => !!event.id)
          .map(async (event) => {
            try {
              const { data } = await api.get(`/players?event_id=${event.id}`);
              const players = Array.isArray(data) ? data : [];
              const scored = players.filter(p => {
                const scores = p.scores || {};
                return Object.values(scores).some(v => v !== null && v !== '' && Number(v) > 0);
              }).length;
              return [event.id, { total: players.length, scored, isLoading: false, hasError: false }];
            } catch {
              return [event.id, { total: 0, scored: 0, isLoading: false, hasError: true }];
            }
          })
      );

      if (!cancelled) {
        setPlayerCounts(Object.fromEntries(countEntries));
      }
    }

    fetchCounts();
    return () => { cancelled = true; };
  }, [events]);

  const normalizedEvents = useMemo(() => {
    const list = Array.isArray(events) ? [...events] : [];

    const enriched = list.map((e) => {
      const fetched = playerCounts[e.id];
      const isPlayersLoading = fetched ? fetched.isLoading : true;
      const hasPlayersError = fetched ? fetched.hasError : false;
      const playerCount = fetched ? fetched.total : 0;
      const scoredCount = fetched ? fetched.scored : 0;

      const status = statusFromCounts({ isPlayersLoading, hasPlayersError, playerCount, scoredCount });
      const next = nextActionFromCounts({ isPlayersLoading, hasPlayersError, playerCount, scoredCount, userRole });
      const isDone = status.label === 'Done';

      return {
        ...e,
        _isPlayersLoading: isPlayersLoading,
        _hasPlayersError: hasPlayersError,
        _playerCount: playerCount,
        _scoredCount: scoredCount,
        _status: status,
        _next: next,
        _isDone: isDone
      };
    });

    enriched.sort((a, b) => {
      if (a._isDone !== b._isDone) return a._isDone ? 1 : -1;
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return bd - ad;
    });

    return enriched;
  }, [events, playerCounts, userRole]);

  const handleOpenEvent = useCallback(
    (event, route) => {
      setSelectedEvent(event);
      navigate(route);
    },
    [setSelectedEvent, navigate]
  );

  const handleEventCreated = (newEvent) => {
    setEvents((prev) => [newEvent, ...(Array.isArray(prev) ? prev : [])]);
    setSelectedEvent(newEvent);
    setShowCreateModal(false);
  };

  if (userRole === 'viewer') {
    return <ViewerEventUnavailable selectedEvent={selectedEvent} />;
  }

  if (noLeague) return <LeagueFallback />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase font-bold text-gray-500 tracking-wide">Events</div>
            <h1 className="text-2xl font-bold text-gray-900">Your combines</h1>
            <p className="text-sm text-gray-600 mt-1">Pick an event. We’ll tell you what to do next.</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white font-semibold px-4 py-3 rounded-xl shadow-sm transition"
          >
            <Plus className="w-5 h-5" />
            New Event
          </button>
        </div>

        {normalizedEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
            <div className="w-14 h-14 bg-brand-light/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7 text-brand-primary" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Create your first event</h2>
            <p className="text-sm text-gray-600 mt-1">An event is a camp, tryout, or combine day.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 bg-brand-primary hover:bg-brand-secondary text-white font-semibold px-5 py-3 rounded-xl transition"
            >
              + New Event
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {normalizedEvents.map((event) => {
              const emoji = sportEmojiFromTemplate(event.drillTemplate);
              const dateText = event.date ? formatEventDate(event.date) : 'Date not set';
              const isSelected = selectedEvent?.id === event.id;

              return (
                <div
                  key={event.id}
                  className={
                    'bg-white rounded-2xl border shadow-sm overflow-hidden transition ' +
                    (isSelected ? 'border-brand-primary' : 'border-gray-200') +
                    (event._isDone ? ' opacity-80' : '')
                  }
                >
                  <button
                    onClick={() => {
                      if (event._next.isDisabled) return;
                      handleOpenEvent(event, event._next.route);
                    }}
                    className="w-full text-left p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-xl">{emoji}</div>
                          <div className="font-bold text-gray-900 truncate">{event.name || 'Untitled Event'}</div>
                        </div>
                        <div className="mt-1 text-sm text-gray-500 flex items-center gap-2">
                          <span>{dateText}</span>
                          <span className="text-gray-300">•</span>
                          <span>{event._isPlayersLoading ? 'Loading players...' : `${event._playerCount} players`}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={'text-xs font-bold px-2.5 py-1 rounded-full border ' + event._status.tone}>
                          {event._status.label}
                        </span>

                        {userRole === 'organizer' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingEvent(event);
                              }}
                              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                              aria-label={`Edit ${event.name}`}
                              title="Edit event"
                            >
                              <Edit className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeletingEvent(event);
                              }}
                              className="p-2 rounded-lg border border-red-200 hover:bg-red-50 transition"
                              aria-label={`Delete ${event.name}`}
                              title="Delete event"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className={'mt-3 rounded-xl border px-3 py-2 text-sm font-semibold ' + event._next.tone}>{event._next.text}</div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateEventModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={handleEventCreated} />

      {editingEvent && (
        <EditEventModal
          open={!!editingEvent}
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onUpdated={(updatedEvent) => {
            setEvents((prev) => (Array.isArray(prev) ? prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)) : prev));
            if (selectedEvent?.id === updatedEvent.id) setSelectedEvent(updatedEvent);
            setEditingEvent(null);
          }}
        />
      )}

      {deletingEvent && (
        <div className="fixed inset-0 flex items-center justify-center wc-overlay z-50 p-4">
          <div className="wc-card p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setDeletingEvent(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-brand-primary text-2xl font-bold"
              aria-label="Close delete modal"
            >
              ×
            </button>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">Delete Event</h2>
            </div>
            <div className="pb-1">
              <DeleteEventFlow
                event={deletingEvent}
                isCurrentlySelected={selectedEvent?.id === deletingEvent?.id}
                onSuccess={() => {
                  setDeletingEvent(null);
                }}
              />
            </div>
            <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDeletingEvent(null)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                >
                  Close
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
