/**
 * DraftSetup - Configure and start a new draft
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  const draftEventIds = useMemo(() => (
    Array.isArray(draft?.event_ids)
      ? draft.event_ids.filter(Boolean)
      : (draft?.event_id ? [draft.event_id] : [])
  ), [draft?.event_ids, draft?.event_id]);

  // Settings form
  const [settings, setSettings] = useState({
    draft_type: 'snake',
    pick_timer_seconds: 60,
    auto_pick_on_timeout: true,
    trades_enabled: false
  });

  useEffect(() => {
    if (draft) {
      setSettings({
        draft_type: draft.draft_type || 'snake',
        pick_timer_seconds: draft.pick_timer_seconds ?? 60,
        auto_pick_on_timeout: draft.auto_pick_on_timeout ?? true,
        trades_enabled: draft.trades_enabled ?? false
      });
    }
  }, [draft]);

  useEffect(() => {
    if (!draftId || draft?.status !== 'setup') return;

    const loadPlayers = async () => {
      setPlayersLoading(true);
      try {
        const response = await api.get(`/drafts/${draftId}/players`);
        const playerList = Array.isArray(response.data) ? response.data : response.data?.players || [];
        setAvailablePlayers(playerList);
      } catch (err) {
        showError(err.response?.data?.detail || 'Failed to load players');
      } finally {
        setPlayersLoading(false);
      }
    };

    loadPlayers();
  }, [draftId, draft?.status, showError]);

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
      await api.patch(`/drafts/${draftId}`, settings);
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



  // Fetch draft-specific players (for standalone drafts)
  useEffect(() => {
    const fetchDraftPlayers = async () => {
      if (draftEventIds.length === 0) {
        try {
          const res = await api.get(`/drafts/${draftId}/players`);
          const players = Array.isArray(res.data) ? res.data : res.data?.players || [];
          setDraftPlayers(players.filter(p => p.source === 'manual'));
        } catch (err) {
          console.error('Failed to fetch draft players:', err);
        }
      }
    };
    fetchDraftPlayers();
  }, [draftId, draftEventIds.length]);

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
          <Link
            to={`/draft/${draftId}/live`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Draft Room
          </Link>
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
