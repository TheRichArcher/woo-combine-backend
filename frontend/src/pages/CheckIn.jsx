import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Search, AlertTriangle, Save, Undo2 } from 'lucide-react';

import api from '../lib/api';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

function normalize(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesQuery(player, q) {
  if (!q) return true;
  const hay = normalize(`${player?.name || ''} ${player?.age_group || ''} ${player?.number ?? ''}`);

  // Word-based substring match (fast + forgiving)
  const parts = q.split(' ').filter(Boolean);
  return parts.every(p => hay.includes(p));
}

export default function CheckIn() {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const { showError, showSuccess, showInfo } = useToast();

  // Roster
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]);

  // UX state
  const searchInputId = 'checkin-search-input';
  const numberInputId = 'checkin-number-input';

  const [query, setQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [numberValue, setNumberValue] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmDuplicateOpen, setConfirmDuplicateOpen] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const [recent, setRecent] = useState([]); // [{id, playerId, name, age_group, number, prevNumber, ts}]

  const canUse = userRole === 'organizer' || userRole === 'coach';

  const fetchPlayers = useCallback(async () => {
    if (!selectedEvent?.id) return;

    setLoading(true);
    setError(null);

    try {
      let all = [];
      let page = 1;
      const limit = 200;
      let hasMore = true;

      while (hasMore) {
        const res = await api.get(`/players?event_id=${selectedEvent.id}&page=${page}&limit=${limit}`);
        const chunk = res.data || [];
        all = [...all, ...chunk];
        if (chunk.length < limit) hasMore = false;
        else page += 1;
      }

      setPlayers(all);
    } catch (err) {
      setError(err?.message || 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }, [selectedEvent?.id]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Autofocus: search by default; number after selection
  useEffect(() => {
    // Delay one tick to avoid focus fights on mobile
    const t = setTimeout(() => {
      const el = document.getElementById(selectedPlayer ? numberInputId : searchInputId);
      if (el && typeof el.focus === 'function') {
        el.focus();
        // Select number for quick overwrite
        if (selectedPlayer && typeof el.select === 'function') el.select();
      }
    }, 50);
    return () => clearTimeout(t);
  }, [selectedPlayer, numberInputId, searchInputId]);

  useEffect(() => {
    // Reset duplicate confirmation whenever input changes
    setDuplicateConfirmed(false);
  }, [numberValue, selectedPlayer?.id]);

  useEffect(() => {
    if (userRole && !canUse) {
      showInfo('Check-In is available to coaches and organizers only.');
    }
  }, [userRole, canUse, showInfo]);

  const checkedInCount = useMemo(() => {
    return players.filter(p => p.number !== null && p.number !== undefined && p.number !== '').length;
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const q = normalize(query);
    if (!q) return players;
    return players.filter(p => matchesQuery(p, q));
  }, [players, query]);

  const topResults = useMemo(() => {
    // Keep list short for speed on mobile
    return filteredPlayers.slice(0, 30);
  }, [filteredPlayers]);

  const parsedNumber = useMemo(() => {
    const raw = String(numberValue ?? '').trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return NaN;
    return Math.trunc(n);
  }, [numberValue]);

  const duplicateOwner = useMemo(() => {
    if (!selectedPlayer) return null;
    if (parsedNumber === null || Number.isNaN(parsedNumber)) return null;
    return players.find(p => p.id !== selectedPlayer.id && p.number === parsedNumber) || null;
  }, [players, selectedPlayer, parsedNumber]);

  const handleSelect = useCallback((player) => {
    setSelectedPlayer(player);
    setNumberValue(player?.number != null ? String(player.number) : '');
    setDuplicateConfirmed(false);
    setConfirmDuplicateOpen(false);
  }, []);

  const clearForNext = useCallback(() => {
    setSelectedPlayer(null);
    setNumberValue('');
    setQuery('');
    setDuplicateConfirmed(false);
    setConfirmDuplicateOpen(false);

    // Refocus search quickly
    setTimeout(() => {
      const el = document.getElementById(searchInputId);
      el?.focus?.();
    }, 50);
  }, [searchInputId]);

  const saveNumber = useCallback(async (opts = { allowDuplicate: false }) => {
    if (!selectedEvent?.id) {
      showError('No event selected');
      return;
    }
    if (!selectedPlayer) {
      showInfo('Select a player');
      return;
    }

    if (parsedNumber === null) {
      showError('Enter a number');
      return;
    }

    if (Number.isNaN(parsedNumber) || parsedNumber <= 0) {
      showError('Enter a valid positive number');
      return;
    }

    if (duplicateOwner && !opts.allowDuplicate) {
      setConfirmDuplicateOpen(true);
      return;
    }

    setSaving(true);
    try {
      const prevNumber = selectedPlayer.number ?? null;

      await api.put(`/players/${selectedPlayer.id}?event_id=${selectedPlayer.event_id}`, {
        number: parseInt(String(parsedNumber), 10),
      });

      // Update local roster
      setPlayers(prev => prev.map(p => (
        p.id === selectedPlayer.id
          ? { ...p, number: parsedNumber }
          : p
      )));

      // Recent list
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        playerId: selectedPlayer.id,
        name: selectedPlayer.name,
        age_group: selectedPlayer.age_group,
        number: parsedNumber,
        prevNumber,
        ts: new Date(),
      };
      setRecent(prev => [entry, ...prev].slice(0, 10));

      showSuccess('Checked in');
      clearForNext();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to save number';
      showError(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedEvent?.id, selectedPlayer, parsedNumber, duplicateOwner, showError, showInfo, showSuccess, clearForNext]);

  const handleConfirmDuplicate = async () => {
    setDuplicateConfirmed(true);
    setConfirmDuplicateOpen(false);
    await saveNumber({ allowDuplicate: true });
  };

  const handleRecentSelect = (entry) => {
    const p = players.find(x => x.id === entry.playerId);
    if (p) {
      setQuery(p.name || '');
      handleSelect(p);
    }
  };

  const handleUndoToPrevious = async (entry) => {
    const p = players.find(x => x.id === entry.playerId);
    if (!p) return;

    // "Undo" here means revert to previous number (or clear if there was none).
    // Backend may not accept null; we only revert if prevNumber is a valid int.
    if (entry.prevNumber === null || entry.prevNumber === undefined) {
      showInfo('Cannot clear number via Check-In (no previous number). Select the player to edit instead.');
      handleRecentSelect(entry);
      return;
    }

    setSaving(true);
    try {
      await api.put(`/players/${p.id}?event_id=${p.event_id}`, {
        number: parseInt(String(entry.prevNumber), 10),
      });

      setPlayers(prev => prev.map(x => (
        x.id === p.id ? { ...x, number: entry.prevNumber } : x
      )));

      showSuccess('Reverted');
      // Keep recent list as-is (acts like an audit trail)
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to revert number';
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!selectedEvent?.id) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <ClipboardCheck className="w-6 h-6 text-brand-primary" />
              <h1 className="text-xl font-bold text-gray-900">Check-In</h1>
            </div>
            <p className="text-sm text-gray-600">Select an event to begin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-brand-primary" />
                <h1 className="text-lg font-bold text-gray-900">Check-In</h1>
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate">{selectedEvent?.name}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {checkedInCount} of {players.length} checked in
              </div>
              <div className="text-xs text-gray-500">Numbers assigned</div>
            </div>
          </div>
        </div>

        {/* Restricted role */}
        {!canUse && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <div className="font-semibold text-orange-900">Access limited</div>
                <div className="text-sm text-orange-800">Only coaches and organizers can check athletes in.</div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4">
          <label className="text-sm font-medium text-gray-700">Search athlete</label>
          <div className="mt-2 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <Input
              id={searchInputId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a name (e.g. ‘Jordan’)"
              className="pl-9 text-base"
              disabled={!canUse}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          {loading && (
            <div className="mt-3 text-sm text-gray-500">Loading roster…</div>
          )}
          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}

          {/* Results */}
          {!loading && !error && (
            <div className="mt-4 space-y-2">
              {topResults.length === 0 ? (
                <div className="text-sm text-gray-500">No matches.</div>
              ) : (
                topResults.map((p) => {
                  const isChecked = p.number !== null && p.number !== undefined && p.number !== '';
                  const isActive = selectedPlayer?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p)}
                      className={[
                        'w-full text-left rounded-xl border p-3 transition',
                        isActive ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-200 bg-white hover:bg-gray-50',
                      ].join(' ')}
                      disabled={!canUse}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{p.name || 'Unnamed'}</div>
                          <div className="text-xs text-gray-500">
                            {p.age_group ? `Age Group: ${p.age_group}` : 'Age Group: —'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isChecked && (
                            <div className="flex items-center gap-1 text-green-700 text-xs font-semibold">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Checked</span>
                            </div>
                          )}
                          <div className="text-sm font-bold text-gray-900 bg-gray-100 rounded-lg px-2 py-1 min-w-[52px] text-center">
                            {p.number != null && p.number !== '' ? `#${p.number}` : '—'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Number input */}
        {selectedPlayer && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-gray-500">Selected</div>
                <div className="text-lg font-bold text-gray-900">{selectedPlayer.name}</div>
                <div className="text-xs text-gray-500">{selectedPlayer.age_group || '—'}</div>
              </div>
              <Button variant="subtle" onClick={clearForNext} disabled={saving}>
                Clear
              </Button>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">Bib number</label>
              <Input
                id={numberInputId}
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveNumber({ allowDuplicate: duplicateConfirmed });
                  }
                }}
                placeholder="Enter #"
                className="mt-2 text-2xl py-4"
                disabled={!canUse || saving}
              />

              {duplicateOwner && (
                <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div className="text-sm text-orange-900">
                      <div className="font-semibold">Duplicate number</div>
                      <div className="mt-0.5">
                        #{parsedNumber} is already assigned to <span className="font-semibold">{duplicateOwner.name}</span>.
                        You can still save to override.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  disabled={!canUse || saving}
                  onClick={() => saveNumber({ allowDuplicate: duplicateConfirmed })}
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>

              <div className="text-xs text-gray-500 mt-2">Tip: hit Enter to save.</div>
            </div>
          </div>
        )}

        {/* Recent */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-900">Recent check-ins</div>
            <div className="text-xs text-gray-500">Last {Math.min(recent.length, 10)}</div>
          </div>

          {recent.length === 0 ? (
            <div className="text-sm text-gray-500">No recent check-ins yet.</div>
          ) : (
            <div className="space-y-2">
              {recent.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="text-left min-w-0"
                      onClick={() => handleRecentSelect(r)}
                      disabled={!canUse}
                    >
                      <div className="font-semibold text-gray-900 truncate">{r.name}</div>
                      <div className="text-xs text-gray-500">
                        {r.age_group || '—'} • {r.ts instanceof Date ? r.ts.toLocaleTimeString() : ''}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-sm font-bold text-gray-900 bg-gray-100 rounded-lg px-2 py-1">#{r.number}</div>
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => handleUndoToPrevious(r)}
                        disabled={!canUse || saving}
                        title="Revert to previous number"
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Duplicate confirm modal */}
      {confirmDuplicateOpen && duplicateOwner && (
        <Modal
          title="Duplicate number"
          icon={<AlertTriangle className="w-5 h-5" />}
          onClose={() => setConfirmDuplicateOpen(false)}
          footer={(
            <>
              <Button variant="subtle" onClick={() => setConfirmDuplicateOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmDuplicate} disabled={saving}>
                Save Anyway
              </Button>
            </>
          )}
        >
          <div className="text-sm text-gray-700 space-y-2">
            <div>
              <span className="font-semibold">#{parsedNumber}</span> is already assigned to <span className="font-semibold">{duplicateOwner.name}</span>.
            </div>
            <div>Save anyway to override and assign it to <span className="font-semibold">{selectedPlayer?.name}</span>.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
