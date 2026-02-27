/**
 * TradeModal - Propose and manage trades during draft
 */

import React, { useEffect, useMemo, useState } from 'react';
import { X, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';

const TradeModal = ({ draftId, teams, picks, players, currentTeam, isAdmin, onClose }) => {
  const { showSuccess, showError } = useToast();
  const [trades, setTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const initialOfferingTeamId = currentTeam?.id || (isAdmin ? teams[0]?.id || '' : '');
  const [offeringTeamId, setOfferingTeamId] = useState(initialOfferingTeamId);
  const [receivingTeamId, setReceivingTeamId] = useState('');
  const [offeringPlayerId, setOfferingPlayerId] = useState('');
  const [receivingPlayerId, setReceivingPlayerId] = useState('');

  useEffect(() => {
    if (!offeringTeamId) return;
    const otherTeams = teams.filter((team) => team.id !== offeringTeamId);
    setReceivingTeamId(otherTeams[0]?.id || '');
    setOfferingPlayerId('');
    setReceivingPlayerId('');
  }, [offeringTeamId, teams]);

  useEffect(() => {
    const loadTrades = async () => {
      if (!draftId) return;
      setLoadingTrades(true);
      try {
        const response = await api.get(`/drafts/${draftId}/trades`);
        const tradeList = Array.isArray(response.data) ? response.data : response.data?.trades || [];
        setTrades(tradeList);
      } catch (err) {
        showError(err.response?.data?.detail || 'Failed to load trades');
      } finally {
        setLoadingTrades(false);
      }
    };

    loadTrades();
  }, [draftId, showError]);

  const playersById = useMemo(() => {
    const map = new Map();
    (players || []).forEach((player) => map.set(player.id, player));
    (picks || []).forEach((pick) => {
      if (pick.player?.id) {
        map.set(pick.player.id, pick.player);
      } else if (pick.player_id && pick.player) {
        map.set(pick.player_id, pick.player);
      }
    });
    return map;
  }, [players, picks]);

  const draftedPlayersByTeam = useMemo(() => {
    const grouped = {};
    teams.forEach((team) => {
      grouped[team.id] = [];
    });

    const seenByTeam = {};
    picks.forEach((pick) => {
      if (!seenByTeam[pick.team_id]) {
        seenByTeam[pick.team_id] = new Set();
      }
      if (seenByTeam[pick.team_id].has(pick.player_id)) return;
      seenByTeam[pick.team_id].add(pick.player_id);

      const player = playersById.get(pick.player_id) || pick.player || {
        id: pick.player_id,
        name: pick.player?.name || pick.player_id
      };
      grouped[pick.team_id] = grouped[pick.team_id] || [];
      grouped[pick.team_id].push(player);
    });

    Object.values(grouped).forEach((list) => {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    return grouped;
  }, [teams, picks, playersById]);

  const offeringPlayers = draftedPlayersByTeam[offeringTeamId] || [];
  const receivingPlayers = draftedPlayersByTeam[receivingTeamId] || [];

  const getTeamName = (teamId) => teams.find(t => t.id === teamId)?.team_name || 'Unknown Team';
  const getPlayerName = (playerId) => playersById.get(playerId)?.name || playerId || 'Unknown Player';

  const pendingTrades = trades.filter((trade) => trade.status === 'pending' || !trade.status);
  const tradeHistory = trades.filter((trade) => trade.status && trade.status !== 'pending');

  const handleProposeTrade = async () => {
    if (!offeringTeamId || !receivingTeamId || !offeringPlayerId || !receivingPlayerId) {
      showError('Select teams and players for the trade');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/drafts/${draftId}/trades`, {
        offering_team_id: offeringTeamId,
        receiving_team_id: receivingTeamId,
        offering_player_id: offeringPlayerId,
        receiving_player_id: receivingPlayerId
      });
      showSuccess('Trade proposed');
      setOfferingPlayerId('');
      setReceivingPlayerId('');

      const response = await api.get(`/drafts/${draftId}/trades`);
      const tradeList = Array.isArray(response.data) ? response.data : response.data?.trades || [];
      setTrades(tradeList);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to propose trade');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTrade = async (tradeId, status) => {
    try {
      await api.patch(`/drafts/${draftId}/trades/${tradeId}`, { status });
      showSuccess(`Trade ${status}`);

      const response = await api.get(`/drafts/${draftId}/trades`);
      const tradeList = Array.isArray(response.data) ? response.data : response.data?.trades || [];
      setTrades(tradeList);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to update trade');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-blue-600" />
            <h2 className="font-semibold text-lg">Trade Players</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Close trade modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Offer Column */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Offer</h3>
              {isAdmin && !currentTeam && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Team</label>
                  <select
                    value={offeringTeamId}
                    onChange={(e) => setOfferingTeamId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.team_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <label className="block text-xs font-medium text-gray-600 mb-1">Player</label>
              <select
                value={offeringPlayerId}
                onChange={(e) => setOfferingPlayerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Select player</option>
                {offeringPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.number ? `#${player.number} ` : ''}{player.name}
                  </option>
                ))}
              </select>
              {offeringPlayers.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">No drafted players yet.</p>
              )}
            </div>

            {/* For Column */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">For</h3>
              <label className="block text-xs font-medium text-gray-600 mb-1">Other Team</label>
              <select
                value={receivingTeamId}
                onChange={(e) => setReceivingTeamId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
              >
                <option value="">Select team</option>
                {teams.filter((team) => team.id !== offeringTeamId).map((team) => (
                  <option key={team.id} value={team.id}>{team.team_name}</option>
                ))}
              </select>

              <label className="block text-xs font-medium text-gray-600 mb-1">Player</label>
              <select
                value={receivingPlayerId}
                onChange={(e) => setReceivingPlayerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Select player</option>
                {receivingPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.number ? `#${player.number} ` : ''}{player.name}
                  </option>
                ))}
              </select>
              {receivingPlayers.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">No drafted players yet.</p>
              )}
            </div>
          </div>

          <button
            onClick={handleProposeTrade}
            disabled={submitting || !offeringPlayerId || !receivingPlayerId || !offeringTeamId || !receivingTeamId}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-sm font-medium"
          >
            Propose Trade
          </button>

          {/* Pending Trades */}
          <div className="bg-white border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">Pending Trades</h3>
              {loadingTrades && <span className="text-xs text-gray-400">Loading...</span>}
            </div>
            <div className="p-4 space-y-3">
              {pendingTrades.length === 0 && (
                <p className="text-sm text-gray-500">No pending trades.</p>
              )}
              {pendingTrades.map((trade) => (
                <div key={trade.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{getTeamName(trade.offering_team_id)}</span>
                    <span className="mx-1">→</span>
                    <span className="font-medium">{getTeamName(trade.receiving_team_id)}</span>
                    <span className="mx-2 text-gray-400">|</span>
                    <span>{getPlayerName(trade.offering_player_id)}</span>
                    <span className="mx-1 text-gray-400">for</span>
                    <span>{getPlayerName(trade.receiving_player_id)}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateTrade(trade.id, 'approved')}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleUpdateTrade(trade.id, 'rejected')}
                        className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Trade History */}
          <div className="bg-white border rounded-xl">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
            >
              Trade History
              <ChevronDown size={16} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
            {showHistory && (
              <div className="border-t p-4 space-y-3">
                {tradeHistory.length === 0 && (
                  <p className="text-sm text-gray-500">No trade history yet.</p>
                )}
                {tradeHistory.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                    <div className="text-gray-700">
                      <span className="font-medium">{getTeamName(trade.offering_team_id)}</span>
                      <span className="mx-1">→</span>
                      <span className="font-medium">{getTeamName(trade.receiving_team_id)}</span>
                      <span className="mx-2 text-gray-400">|</span>
                      <span>{getPlayerName(trade.offering_player_id)}</span>
                      <span className="mx-1 text-gray-400">for</span>
                      <span>{getPlayerName(trade.receiving_player_id)}</span>
                    </div>
                    <span className={`text-xs font-semibold ${trade.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeModal;
