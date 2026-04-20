/**
 * DraftSetup - Configure and start a new draft
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDraft, useDraftTeams, useDraftActions } from '../../hooks/useDraft';
import LoadingScreen from '../../components/LoadingScreen';
import api from '../../lib/api';
import {
  ArrowLeft,
  Link2,
  Copy,
  Check,
  Plus,
  Trash2,
  GripVertical,
  Play,
  Settings,
  Users,
  Timer,
  Shuffle,
  UserPlus,
  X
} from 'lucide-react';

const DraftSetup = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const { draft, loading: draftLoading } = useDraft(draftId);
  const { teams, refetch: refetchTeams } = useDraftTeams(draftId);
  const { startDraft, loading: actionLoading } = useDraftActions(draftId);

  const [newTeamName, setNewTeamName] = useState('');
  const [newCoachName, setNewCoachName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [preSlotTeamId, setPreSlotTeamId] = useState('');
  const [preSlotPlayerId, setPreSlotPlayerId] = useState('');
  
  // Player management (for standalone drafts without combine)
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [draftPlayers, setDraftPlayers] = useState([]);
  const [groupActionLoading, setGroupActionLoading] = useState({});
  const draftEventIds = useMemo(() => (
    Array.isArray(draft?.event_ids)
      ? draft.event_ids.filter(Boolean)
      : (draft?.event_id ? [draft.event_id] : [])
  ), [draft?.event_ids, draft?.event_id]);
  const isAdmin = draft?.created_by === user?.uid;

  const siblingAndBuddySummary = useMemo(() => {
    const playersList = Array.isArray(availablePlayers) ? availablePlayers : [];
    const nameCounts = {};
    playersList.forEach((player) => {
      const normalizedName = String(player?.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!normalizedName) return;
      nameCounts[normalizedName] = (nameCounts[normalizedName] || 0) + 1;
    });

    const siblingGroups = {};
    const buddyRows = [];
    playersList.forEach((player) => {
      const groupId = player?.siblingGroupId;
      const forceSame = !!player?.forceSameTeamWithSibling;
      if (groupId && forceSame) {
        if (!siblingGroups[groupId]) {
          siblingGroups[groupId] = {
            id: groupId,
            size: player?.siblingGroupSize || 0,
            signals: player?.siblingInferenceSignals || [],
            suspicious: !!player?.siblingInferenceSuspicious,
            suspicionReasons: player?.siblingInferenceSuspicionReasons || [],
            reviewStatus: player?.siblingReviewStatus || null,
            reviewedBy: player?.siblingReviewedBy || null,
            players: []
          };
        }
        siblingGroups[groupId].players.push(player);
      }
      const buddyRaw = player?.buddyRequestRaw || '';
      const buddyNormalized = String(player?.buddyRequestNormalized || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (buddyRaw && buddyNormalized) {
        const matches = nameCounts[buddyNormalized] || 0;
        let status = 'unmatched';
        if (matches === 1) status = 'matched';
        if (matches > 1) status = 'ambiguous_duplicate_name';
        buddyRows.push({
          playerId: player.id,
          playerName: player.name,
          requestRaw: buddyRaw,
          status,
          matchCount: matches
        });
      }
    });

    const groupedSiblingList = Object.values(siblingGroups).sort((a, b) => {
      if ((b.players?.length || 0) !== (a.players?.length || 0)) {
        return (b.players?.length || 0) - (a.players?.length || 0);
      }
      return String(a.id).localeCompare(String(b.id));
    });

    return {
      siblingGroups: groupedSiblingList,
      buddyRows
    };
  }, [availablePlayers]);

  // Settings form
  const [settings, setSettings] = useState({
    draft_type: 'snake',
    pick_timer_seconds: 60,
    auto_pick_on_timeout: true,
    trades_enabled: false,
    max_players_per_team: '',
    enforce_composite_balance: false,
    max_composite_avg_gap: '',
    composite_balance_blocking: false
  });

  useEffect(() => {
    if (draft) {
      setSettings({
        draft_type: draft.draft_type || 'snake',
        pick_timer_seconds: draft.pick_timer_seconds ?? 60,
        auto_pick_on_timeout: draft.auto_pick_on_timeout ?? true,
        trades_enabled: draft.trades_enabled ?? false,
        max_players_per_team: draft.max_players_per_team ?? '',
        enforce_composite_balance: draft.enforce_composite_balance ?? false,
        max_composite_avg_gap: draft.max_composite_avg_gap ?? '',
        composite_balance_blocking: draft.composite_balance_blocking ?? false
      });
    }
  }, [draft]);

  const activeRuleSummary = useMemo(() => {
    const roundsCap = draft?.num_rounds || null;
    const explicitCap = settings.max_players_per_team !== '' && settings.max_players_per_team != null
      ? Number(settings.max_players_per_team)
      : null;
    const resolvedCap = explicitCap || roundsCap || null;
    const compositeEnabled = !!settings.enforce_composite_balance;
    const compositeBlocking = !!settings.composite_balance_blocking;
    const compositeGap = settings.max_composite_avg_gap !== '' && settings.max_composite_avg_gap != null
      ? Number(settings.max_composite_avg_gap)
      : 20;
    return {
      resolvedCap,
      explicitCap,
      compositeEnabled,
      compositeGap,
      compositeBlocking
    };
  }, [draft?.num_rounds, settings.max_players_per_team, settings.enforce_composite_balance, settings.max_composite_avg_gap, settings.composite_balance_blocking]);

  const fetchDraftPlayers = useCallback(async () => {
    if (!draftId) return;
    setPlayersLoading(true);
    try {
      const response = await api.get(`/drafts/${draftId}/players`);
      const playerList = Array.isArray(response.data) ? response.data : response.data?.players || [];
      setAvailablePlayers(playerList);
      if (!draft?.event_id) {
        setDraftPlayers(playerList.filter(p => p.source === 'manual'));
      }
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to load players');
    } finally {
      setPlayersLoading(false);
    }
  }, [draftId, draft?.event_id, showError]);

  useEffect(() => {
    if (!draftId || draft?.status !== 'setup') return;
    fetchDraftPlayers();
  }, [draftId, draft?.status, fetchDraftPlayers]);

  const handleSiblingGroupAction = async (groupId, action, playerIds = null) => {
    setGroupActionLoading(prev => ({ ...prev, [groupId]: action }));
    try {
      await api.post(`/drafts/${draftId}/sibling-groups/${groupId}/review`, {
        action,
        player_ids: playerIds
      });
      if (action === 'confirm') showSuccess(`Sibling group ${groupId} confirmed`);
      if (action === 'clear_lock') showSuccess(`Sibling lock cleared for group ${groupId}`);
      if (action === 'mark_separate') showSuccess(`Marked siblings as intentionally separate for group ${groupId}`);
      await fetchDraftPlayers();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to apply sibling group review action');
    } finally {
      setGroupActionLoading(prev => ({ ...prev, [groupId]: null }));
    }
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) {
      showError('Team name required');
      return;
    }

    setAddingTeam(true);
    try {
      await api.post(`/drafts/${draftId}/teams`, {
        team_name: newTeamName.trim(),
        coach_name: newCoachName.trim() || null
      });
      setNewTeamName('');
      setNewCoachName('');
      refetchTeams();
      showSuccess('Team added');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to add team');
    } finally {
      setAddingTeam(false);
    }
  };

  const handleRemoveTeam = async (teamId) => {
    if (!confirm('Remove this team?')) return;
    
    try {
      await api.delete(`/drafts/${draftId}/teams/${teamId}`);
      refetchTeams();
      showSuccess('Team removed');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to remove team');
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const payload = {
        draft_type: settings.draft_type,
        pick_timer_seconds: settings.pick_timer_seconds,
        auto_pick_on_timeout: settings.auto_pick_on_timeout,
        trades_enabled: settings.trades_enabled,
        enforce_composite_balance: settings.enforce_composite_balance,
        composite_balance_blocking: settings.composite_balance_blocking,
        max_players_per_team:
          settings.max_players_per_team === '' || settings.max_players_per_team == null
            ? null
            : parseInt(settings.max_players_per_team, 10),
        max_composite_avg_gap:
          settings.max_composite_avg_gap === '' || settings.max_composite_avg_gap == null
            ? null
            : parseFloat(settings.max_composite_avg_gap)
      };
      await api.patch(`/drafts/${draftId}`, payload);
      showSuccess('Settings saved');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to save settings');
    }
  };

  const handleRandomizeOrder = async () => {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const teamIds = shuffled.map(t => t.id);
    
    try {
      await api.post(`/drafts/${draftId}/teams/reorder`, teamIds);
      refetchTeams();
      showSuccess('Order randomized');
    } catch (err) {
      showError('Failed to randomize order');
    }
  };

  const handleRemovePlayer = async (playerId) => {
    if (!confirm('Remove this player?')) return;
    try {
      await api.delete(`/drafts/${draftId}/players/${playerId}`);
      setDraftPlayers(prev => prev.filter(p => p.id !== playerId));
      showSuccess('Player removed');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to remove player');
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      showError('Player name required');
      return;
    }
    setAddingPlayer(true);
    try {
      const res = await api.post(`/drafts/${draftId}/players`, {
        name: newPlayerName.trim(),
        number: newPlayerNumber.trim() || null
      });
      setNewPlayerName('');
      setNewPlayerNumber('');
      setShowAddPlayer(false);
      setDraftPlayers(prev => [...prev, res.data]);
      showSuccess('Player added');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to add player');
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleStartDraft = () => {
    if (teams.length < 2) {
      showError('Need at least 2 teams to start');
      return;
    }
    // Navigate to payment page which handles payment check + starting
    navigate(`/draft/${draftId}/payment`);
  };

  const handlePreSlotPlayer = async () => {
    if (!preSlotTeamId || !preSlotPlayerId) {
      showError('Select a team and player');
      return;
    }

    try {
      await api.post(`/drafts/${draftId}/pre-slots`, {
        player_id: preSlotPlayerId,
        team_id: preSlotTeamId
      });
      setPreSlotPlayerId('');
      refetchTeams();
      showSuccess('Player pre-slotted');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to pre-slot player');
    }
  };

  const handleRemovePreSlot = async (teamId, playerId) => {
    try {
      await api.delete(`/drafts/${draftId}/pre-slots/${teamId}/${playerId}`);
      refetchTeams();
      showSuccess('Pre-slot removed');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to remove pre-slot');
    }
  };

  if (draftLoading) return <LoadingScreen />;
  if (!draft) return <div className="p-8 text-center">Draft not found</div>;

  if (draft.status !== 'setup') {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8 text-center">
          <h2 className="text-xl font-bold mb-4">Draft Already Started</h2>
          <p className="text-gray-600 mb-6">
            This draft is {draft.status}. You can't modify settings anymore.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to={`/draft/${draftId}/room`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Draft Room
            </Link>
            <button
              onClick={async () => {
                if (!window.confirm('Reset this draft back to setup? All picks will be deleted.')) return;
                try {
                  await api.post(`/drafts/${draftId}/reset`);
                  window.location.reload();
                } catch (err) {
                  alert(err.response?.data?.detail || 'Failed to reset draft');
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reset to Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  const preSlotEntries = teams.flatMap((team) => (
    (team.pre_slotted_player_ids || []).map((playerId) => ({
      team,
      playerId
    }))
  ));
  const preSlottedIds = new Set(preSlotEntries.map((entry) => entry.playerId));
  const availablePreSlotPlayers = availablePlayers.filter((player) => !preSlottedIds.has(player.id));
  const signalLabel = (signal) => {
    if (signal === 'parent_email') return 'Same parent email';
    if (signal === 'cell_phone') return 'Same parent cell phone';
    if (signal === 'street_parent_last_name') return 'Same street + parent last name';
    return signal;
  };
  const suspicionLabel = (reason) => {
    if (reason === 'large_group') return 'Large group (4+ players)';
    if (reason === 'weak_signal_only') return 'Only weak signal used';
    return reason;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/coach" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-xl font-bold">{draft.name}</h1>
                <p className="text-sm text-gray-500">Draft Setup</p>
              </div>
            </div>
            
            <button
              onClick={handleStartDraft}
              disabled={teams.length < 2 || actionLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              <Play size={18} />
              Start Draft
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Teams */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Users size={18} />
                Teams ({teams.length})
              </h2>
              <button
                onClick={handleRandomizeOrder}
                disabled={teams.length < 2}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              >
                <Shuffle size={14} />
                Randomize
              </button>
            </div>

            <div className="p-4">
              {/* Team List */}
              <div className="space-y-2 mb-4">
                {teams.map((team, idx) => (
                  <div 
                    key={team.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <GripVertical size={16} className="text-gray-400 cursor-grab" />
                    <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold rounded">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{team.team_name}</p>
                      {team.coach_name && (
                        <p className="text-xs text-gray-500">{team.coach_name}</p>
                      )}
                      {team.coach_user_id ? (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <Check size={12} /> Coach joined
                        </p>
                      ) : team.invite_token && (
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/draft/join/${team.invite_token}`;
                            navigator.clipboard.writeText(url);
                            showSuccess('Invite link copied!');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                        >
                          <Link2 size={12} /> Copy invite link
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveTeam(team.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {teams.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No teams added yet
                  </p>
                )}
              </div>

              {/* Add Team Form */}
              <div className="border-t pt-4">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Team name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Coach name (optional)"
                    value={newCoachName}
                    onChange={(e) => setNewCoachName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <button
                    onClick={handleAddTeam}
                    disabled={addingTeam || !newTeamName.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium"
                  >
                    <Plus size={16} />
                    Add Team
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Players Section - only for standalone drafts (no event) */}
          {draftEventIds.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Users size={18} />
                  Players ({draftPlayers.length})
                </h2>
                <button
                  onClick={() => setShowAddPlayer(!showAddPlayer)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add Player
                </button>
              </div>

              <div className="p-4">
                {showAddPlayer && (
                  <div className="border rounded-lg p-3 mb-3 bg-gray-50">
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Player name *"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        autoFocus
                      />
                      <input
                        type="text"
                        placeholder="Jersey # (optional)"
                        value={newPlayerNumber}
                        onChange={(e) => setNewPlayerNumber(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddPlayer}
                          disabled={addingPlayer || !newPlayerName.trim()}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300"
                        >
                          {addingPlayer ? 'Adding...' : 'Add Player'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddPlayer(false);
                            setNewPlayerName('');
                            setNewPlayerNumber('');
                          }}
                          className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {draftPlayers.length === 0 && !showAddPlayer && (
                  <div className="text-center py-6 text-gray-500">
                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No players added yet</p>
                    <p className="text-xs mt-1">Add players to include in the draft</p>
                  </div>
                )}

                {draftPlayers.length > 0 && (
                  <p className="text-sm text-gray-600">
                    {draftPlayers.length} player{draftPlayers.length !== 1 ? 's' : ''} ready for draft
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings size={18} />
                Draft Settings
              </h2>
            </div>

            <div className="p-4 space-y-6">
              {/* Draft Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Draft Type
                </label>
                <select
                  value={settings.draft_type}
                  onChange={(e) => setSettings(s => ({ ...s, draft_type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="snake">Snake (1-2-3... 3-2-1)</option>
                  <option value="linear">Linear (1-2-3... 1-2-3)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Snake reverses order each round for fairness
                </p>
              </div>

              {/* Pick Timer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Timer size={14} className="inline mr-1" />
                  Pick Timer
                </label>
                <select
                  value={settings.pick_timer_seconds}
                  onChange={(e) => setSettings(s => ({ ...s, pick_timer_seconds: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={0}>No Timer</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                  <option value={90}>90 seconds</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>

              {/* Auto-pick */}
              {settings.pick_timer_seconds > 0 && (
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Auto-pick on timeout
                    </label>
                    <p className="text-xs text-gray-500">
                      Uses best available by composite score
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.auto_pick_on_timeout}
                      onChange={(e) => setSettings(s => ({ ...s, auto_pick_on_timeout: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              )}

              {/* Trades */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Allow Trades
                  </label>
                  <p className="text-xs text-gray-500">
                    Let coaches trade picks during draft
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.trades_enabled}
                    onChange={(e) => setSettings(s => ({ ...s, trades_enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Team Cap */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Players Per Team (hard cap)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.max_players_per_team}
                  onChange={(e) => setSettings(s => ({ ...s, max_players_per_team: e.target.value }))}
                  placeholder={draft?.num_rounds ? `Default: ${draft.num_rounds}` : 'Leave blank to use rounds'}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If blank, the engine uses number of rounds as the per-team cap.
                </p>
              </div>

              {/* Composite Balance Rule */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Composite Balance Tracking
                  </label>
                  <p className="text-xs text-gray-500">
                    Compute projected team composite-score average gap at pick time.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enforce_composite_balance}
                    onChange={(e) => setSettings(s => ({ ...s, enforce_composite_balance: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              {settings.enforce_composite_balance && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Composite Avg Gap
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={settings.max_composite_avg_gap}
                      onChange={(e) => setSettings(s => ({ ...s, max_composite_avg_gap: e.target.value }))}
                      placeholder="Default: 20.0"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Block on Composite Balance Violation (advanced)
                      </label>
                      <p className="text-xs text-gray-500">
                        If off, composite balance remains advisory and will not block sibling guarantees.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.composite_balance_blocking}
                        onChange={(e) => setSettings(s => ({ ...s, composite_balance_blocking: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </>
              )}

              {/* Active Enforcement Rules */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-900 mb-2">Active Draft Engine Validation Rules</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>
                    Hard: per-team roster cap = {activeRuleSummary.resolvedCap ?? 'not set yet (depends on rounds)'}
                    {activeRuleSummary.explicitCap ? ' (custom override)' : ' (derived from rounds)'}
                  </li>
                  <li>
                    Hard: sibling same-team lock (when `forceSameTeamWithSibling=true`)
                  </li>
                  <li>
                    Hard: sibling unit must fit within remaining overall draft slots
                  </li>
                  <li>
                    {activeRuleSummary.compositeEnabled
                      ? `${activeRuleSummary.compositeBlocking ? 'Hard' : 'Advisory'}: team average composite gap <= ${activeRuleSummary.compositeGap}`
                      : 'Composite balance rule currently disabled'}
                  </li>
                  <li>
                    Advisory only: buddy requests (soft preference in auto-pick scoring)
                  </li>
                </ul>
              </div>

              <button
                onClick={handleUpdateSettings}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Save Settings
              </button>
            </div>
          </div>

        </div>

        {/* Pre-Slot Players */}
        {draft.status === 'setup' && (
          <div className="mt-8 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <UserPlus size={18} />
                Pre-Slot Players
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Assign specific players to teams before the draft starts.
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Team</label>
                  <select
                    value={preSlotTeamId}
                    onChange={(e) => setPreSlotTeamId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.team_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Player</label>
                  <select
                    value={preSlotPlayerId}
                    onChange={(e) => setPreSlotPlayerId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    disabled={playersLoading}
                  >
                    <option value="">{playersLoading ? 'Loading players...' : 'Select player'}</option>
                    {availablePreSlotPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.number ? `#${player.number} ` : ''}{player.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handlePreSlotPlayer}
                    disabled={!preSlotTeamId || !preSlotPlayerId}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium"
                  >
                    <Plus size={16} />
                    Pre-Slot
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">Current Pre-Slots</h4>
                {preSlotEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">No pre-slotted players yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {preSlotEntries.map((entry) => {
                      const player = availablePlayers.find(p => p.id === entry.playerId);
                      const label = player?.name || entry.playerId;
                      return (
                        <div
                          key={`${entry.team.id}-${entry.playerId}`}
                          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-xs"
                        >
                          <span className="font-medium">{label}</span>
                          <span className="text-gray-400">→</span>
                          <span>{entry.team.team_name}</span>
                          <button
                            onClick={() => handleRemovePreSlot(entry.team.id, entry.playerId)}
                            className="ml-1 text-gray-500 hover:text-gray-700"
                            title="Remove pre-slot"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sibling / Buddy Draft Prep Signals */}
        {draft.status === 'setup' && (
          <div className="mt-8 bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <Users size={18} />
                Sibling & Buddy Signals
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Sibling groups are hard constraints; buddy requests are soft preferences only.
              </p>
            </div>

            <div className="p-4 space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">
                  Inferred sibling groups ({siblingAndBuddySummary.siblingGroups.length})
                </h4>
                {siblingAndBuddySummary.siblingGroups.length === 0 ? (
                  <p className="text-sm text-gray-500">No inferred sibling groups found in current draft pool.</p>
                ) : (
                  <div className="space-y-3">
                    {siblingAndBuddySummary.siblingGroups.map((group) => (
                      <div key={group.id} className={`border rounded-lg p-3 ${group.suspicious ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-gray-700">{group.id}</span>
                          <span className="text-xs text-gray-500">{group.players.length} players</span>
                          {group.reviewStatus && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                              reviewed: {group.reviewStatus}
                            </span>
                          )}
                          {group.suspicious && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Review recommended
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                          Signals: {(group.signals || []).map(signalLabel).join(', ') || 'n/a'}
                        </div>
                        {group.reviewedBy && (
                          <div className="text-xs text-gray-500 mb-2">
                            Last reviewed by: {group.reviewedBy}
                          </div>
                        )}
                        {group.suspicious && (
                          <div className="text-xs text-amber-800 mb-2">
                            Flags: {(group.suspicionReasons || []).map(suspicionLabel).join(', ')}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {group.players.map((player) => (
                            <span key={player.id} className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5">
                              {player.number ? `#${player.number} ` : ''}{player.name}
                              {player.siblingSeparationRequested ? ' (separation requested)' : ''}
                            </span>
                          ))}
                        </div>
                        {isAdmin && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => handleSiblingGroupAction(group.id, 'confirm')}
                              disabled={!!groupActionLoading[group.id]}
                              className="text-xs px-2.5 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                              title="Confirm inferred sibling lock for this group"
                            >
                              Confirm group
                            </button>
                            <button
                              onClick={() => handleSiblingGroupAction(group.id, 'clear_lock')}
                              disabled={!!groupActionLoading[group.id]}
                              className="text-xs px-2.5 py-1 rounded bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-60"
                              title="Remove sibling lock and group association"
                            >
                              Clear sibling lock
                            </button>
                            <button
                              onClick={() => handleSiblingGroupAction(group.id, 'mark_separate')}
                              disabled={!!groupActionLoading[group.id]}
                              className="text-xs px-2.5 py-1 rounded bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-60"
                              title="Mark players in this group as intentionally separate"
                            >
                              Mark intentionally separate
                            </button>
                            {groupActionLoading[group.id] && (
                              <span className="text-xs text-gray-500 self-center">Applying...</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">
                  Buddy requests ({siblingAndBuddySummary.buddyRows.length})
                </h4>
                {siblingAndBuddySummary.buddyRows.length === 0 ? (
                  <p className="text-sm text-gray-500">No buddy requests found in current draft pool.</p>
                ) : (
                  <div className="space-y-2">
                    {siblingAndBuddySummary.buddyRows.slice(0, 30).map((row) => (
                      <div key={row.playerId} className="text-xs border border-gray-200 rounded p-2 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-700">{row.playerName}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-700">{row.requestRaw}</span>
                        {row.status === 'matched' && (
                          <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">matched</span>
                        )}
                        {row.status === 'ambiguous_duplicate_name' && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            ambiguous duplicate name ({row.matchCount})
                          </span>
                        )}
                        {row.status === 'unmatched' && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">unmatched</span>
                        )}
                      </div>
                    ))}
                    {siblingAndBuddySummary.buddyRows.length > 30 && (
                      <p className="text-xs text-gray-500">
                        Showing first 30 buddy requests. Total: {siblingAndBuddySummary.buddyRows.length}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Coach Preparation */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="font-semibold text-yellow-900 mb-2">📋 Coach Preparation</h3>
          <p className="text-sm text-yellow-800 mb-4">
            Before the draft starts, coaches can create their personal player rankings. 
            These rankings are private and help during the draft.
            {settings.auto_pick_on_timeout && ' Rankings are also used for auto-pick if the timer runs out.'}
          </p>
          <Link
            to={`/draft/${draftId}/rankings`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
          >
            Create My Rankings →
          </Link>
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Ready to draft?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Add at least 2 teams</li>
            <li>✓ Assign coaches to teams (optional)</li>
            <li>✓ Set your draft type and timer preferences</li>
            <li>✓ Coaches create their rankings (recommended)</li>
            <li>✓ Click "Start Draft" when ready</li>
          </ul>
          <p className="text-xs text-blue-600 mt-3">
            Players from {draftEventIds.length > 0 ? `${draftEventIds.length} linked combine${draftEventIds.length === 1 ? '' : 's'}` : 'manual draft entries'} 
            {draft.age_group ? ` (${draft.age_group})` : ''} will be available in the draft pool.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DraftSetup;
