/**
 * CreateDraft - Create a new draft for an event
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEvent } from '../../context/EventContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { ArrowLeft, Zap } from 'lucide-react';

const CreateDraft = () => {
  const navigate = useNavigate();
  const { selectedEvent, events } = useEvent();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersByEvent, setPlayersByEvent] = useState({});
  const [customAgeGroup, setCustomAgeGroup] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState(selectedEvent?.id ? [selectedEvent.id] : []);
  const [formData, setFormData] = useState({
    name: '',
    age_group: '',
    draft_type: 'snake',
    pick_timer_seconds: 60,
    trades_enabled: false
  });

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aTime = a?.date ? new Date(a.date).getTime() : NaN;
      const bTime = b?.date ? new Date(b.date).getTime() : NaN;
      const hasAValidDate = Number.isFinite(aTime);
      const hasBValidDate = Number.isFinite(bTime);

      if (hasAValidDate && hasBValidDate && aTime !== bTime) {
        return aTime - bTime;
      }

      if (hasAValidDate !== hasBValidDate) {
        return hasAValidDate ? -1 : 1;
      }

      return (a?.name || '').localeCompare((b?.name || ''));
    });
  }, [events]);

  const selectedEvents = useMemo(
    () => sortedEvents.filter((event) => selectedEventIds.includes(event.id)),
    [sortedEvents, selectedEventIds]
  );

  useEffect(() => {
    if (!selectedEvent?.id) return;
    setSelectedEventIds((currentIds) => {
      if (currentIds.length > 0) return currentIds;
      return [selectedEvent.id];
    });
  }, [selectedEvent?.id]);

  // Fetch players to derive age groups dynamically
  useEffect(() => {
    if (!selectedEventIds.length) {
      setPlayers([]);
      setPlayersByEvent({});
      setPlayersLoading(false);
      return;
    }

    setPlayersLoading(true);
    Promise.all(
      selectedEventIds.map((eventId) => api.get(`/players?event_id=${eventId}`))
    )
      .then((responses) => {
        const merged = [];
        const seen = new Set();
        const countsByEvent = {};
        responses.forEach((res) => {
          const list = Array.isArray(res.data) ? res.data : res.data?.players || [];
          const eventId = list[0]?.event_id;
          if (eventId) countsByEvent[eventId] = list.length;
          list.forEach((player) => {
            if (!player?.id || seen.has(player.id)) return;
            seen.add(player.id);
            merged.push(player);
          });
        });
        // Fall back to request-order mapping if response player shape omits event_id.
        if (Object.keys(countsByEvent).length !== selectedEventIds.length) {
          responses.forEach((res, index) => {
            const eventId = selectedEventIds[index];
            if (countsByEvent[eventId] != null) return;
            const list = Array.isArray(res.data) ? res.data : res.data?.players || [];
            countsByEvent[eventId] = list.length;
          });
        }
        setPlayers(merged);
        setPlayersByEvent(countsByEvent);
      })
      .catch(() => {
        setPlayers([]);
        setPlayersByEvent({});
      })
      .finally(() => {
        setPlayersLoading(false);
      }); // silent — age groups just won't auto-populate
  }, [selectedEventIds]);

  // Derive distinct age groups from player data
  const ageGroups = useMemo(() => {
    const groups = new Set();
    players.forEach(p => {
      const ag = (p.age_group || '').trim();
      if (ag) groups.add(ag);
    });
    return [...groups].sort();
  }, [players]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Event is optional for standalone drafts

    if (!formData.name.trim()) {
      showError('Draft name is required');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/drafts', {
        ...formData,
        event_ids: selectedEventIds,
        name: formData.name.trim(),
        age_group: formData.age_group || null
      });
      
      showSuccess('Draft created!');
      navigate(`/draft/${res.data.id}/setup`);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to={selectedEvents.length ? "/coach" : "/drafts"} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Create Draft</h1>
              {selectedEvents.length > 0 && (
                <p className="text-sm text-gray-500">
                  linked to {selectedEvents.length} combine{selectedEvents.length === 1 ? '' : 's'}
                </p>
              )}
              {selectedEvents.length === 0 && <p className="text-sm text-gray-500">Standalone draft (no combine)</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          {/* Link to Combine */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link to Combine
            </label>
            <div className="space-y-2 border rounded-lg p-3 max-h-52 overflow-y-auto">
              {sortedEvents.length === 0 && (
                <p className="text-sm text-gray-500">No combines found.</p>
              )}
              {sortedEvents.map((event) => {
                const checked = selectedEventIds.includes(event.id);
                return (
                  <label key={event.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setSelectedEventIds((currentIds) => {
                          if (isChecked) {
                            return currentIds.includes(event.id) ? currentIds : [...currentIds, event.id];
                          }
                          return currentIds.filter((id) => id !== event.id);
                        });
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {event.date ? `${event.name} - ${event.date}` : event.name}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Players from the selected combine will be available in your draft pool. Leave blank for a standalone draft where you add players manually.
            </p>
            {selectedEventIds.length > 0 && (
              <p className="text-sm text-emerald-700 mt-2">
                {playersLoading
                  ? 'Loading combine players...'
                  : `✅ ${players.length} players from ${selectedEvents.length} combine${selectedEvents.length === 1 ? '' : 's'} will be in the draft pool`}
              </p>
            )}
            {!playersLoading && selectedEvents.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-emerald-800">
                {selectedEvents.map((event) => (
                  <li key={event.id}>
                    {event.name}: {playersByEvent[event.id] ?? 0} player{(playersByEvent[event.id] ?? 0) === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Draft Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Draft Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., U10 Spring Draft"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Age Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Age Group (Optional)
            </label>
            {ageGroups.length > 0 ? (
              <>
                <select
                  value={customAgeGroup ? '__custom__' : formData.age_group}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setCustomAgeGroup(' ');
                      setFormData(f => ({ ...f, age_group: '' }));
                    } else {
                      setCustomAgeGroup('');
                      setFormData(f => ({ ...f, age_group: val }));
                    }
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Players</option>
                  {ageGroups.map(ag => (
                    <option key={ag} value={ag}>{ag}</option>
                  ))}
                  <option value="__custom__">+ Enter custom age group...</option>
                </select>
                {customAgeGroup && (
                  <input
                    type="text"
                    value={customAgeGroup.trim()}
                    onChange={(e) => {
                      setCustomAgeGroup(e.target.value || ' ');
                      setFormData(f => ({ ...f, age_group: e.target.value.trim() }));
                    }}
                    placeholder="Type your age group name..."
                    className="w-full px-4 py-2 mt-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                )}
              </>
            ) : (
              <input
                type="text"
                value={formData.age_group}
                onChange={(e) => setFormData(f => ({ ...f, age_group: e.target.value }))}
                placeholder="e.g., U10, Bantam, 9-10, Varsity"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              {ageGroups.length > 0
                ? 'Showing age groups from your players. Leave empty for all players.'
                : 'No players imported yet — type any age group name your league uses.'}
            </p>
          </div>

          {/* Draft Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Draft Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                formData.draft_type === 'snake' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="draft_type"
                  value="snake"
                  checked={formData.draft_type === 'snake'}
                  onChange={(e) => setFormData(f => ({ ...f, draft_type: e.target.value }))}
                  className="sr-only"
                />
                <div>
                  <p className="font-medium">Snake</p>
                  <p className="text-xs text-gray-500">1-2-3... 3-2-1 (fairer)</p>
                </div>
              </label>
              <label className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                formData.draft_type === 'linear' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="draft_type"
                  value="linear"
                  checked={formData.draft_type === 'linear'}
                  onChange={(e) => setFormData(f => ({ ...f, draft_type: e.target.value }))}
                  className="sr-only"
                />
                <div>
                  <p className="font-medium">Linear</p>
                  <p className="text-xs text-gray-500">1-2-3... 1-2-3</p>
                </div>
              </label>
            </div>
          </div>

          {/* Pick Timer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pick Timer
            </label>
            <select
              value={formData.pick_timer_seconds}
              onChange={(e) => setFormData(f => ({ ...f, pick_timer_seconds: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0}>No Timer</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>

          {/* Trades */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Allow Trades</p>
              <p className="text-xs text-gray-500">Let coaches trade picks during the draft</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.trades_enabled}
                onChange={(e) => setFormData(f => ({ ...f, trades_enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
          >
            <Zap size={18} />
            {loading ? 'Creating...' : 'Create Draft'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateDraft;
