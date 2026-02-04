/**
 * DraftBoard - Big screen display for in-person drafts
 * Optimized for TV/projector display with player photos
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDraft, useDraftPicks, useDraftTeams, useAvailablePlayers } from '../../hooks/useDraft';
import LoadingScreen from '../../components/LoadingScreen';
import { Clock, User, Trophy } from 'lucide-react';

const DraftBoard = () => {
  const { draftId } = useParams();
  
  const { draft, loading: draftLoading } = useDraft(draftId);
  const { picks } = useDraftPicks(draftId);
  const { teams } = useDraftTeams(draftId);
  const { players } = useAvailablePlayers(draftId);
  
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Timer countdown
  useEffect(() => {
    if (!draft?.pick_deadline) {
      setTimeRemaining(null);
      return;
    }

    const deadline = new Date(draft.pick_deadline).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [draft?.pick_deadline]);

  // Build player lookup from picks (picks have player data) and available players
  const playerLookup = useMemo(() => {
    const lookup = {};
    
    // From available players
    players.forEach(p => {
      lookup[p.id] = p;
    });
    
    // From picks (might have embedded player data)
    picks.forEach(p => {
      if (p.player) {
        lookup[p.player_id] = { ...lookup[p.player_id], ...p.player };
      }
    });
    
    return lookup;
  }, [players, picks]);

  // Group picks by team for board display
  const picksByTeam = useMemo(() => {
    const grouped = {};
    teams.forEach(team => {
      grouped[team.id] = [];
    });
    picks.forEach(pick => {
      if (grouped[pick.team_id]) {
        grouped[pick.team_id].push(pick);
      }
    });
    return grouped;
  }, [picks, teams]);

  // Get current team
  const currentTeam = useMemo(() => {
    if (!draft?.current_team_id) return null;
    return teams.find(t => t.id === draft.current_team_id);
  }, [draft?.current_team_id, teams]);

  // Last pick info
  const lastPick = picks[picks.length - 1];
  const lastPickTeam = lastPick ? teams.find(t => t.id === lastPick.team_id) : null;
  const lastPickPlayer = lastPick ? playerLookup[lastPick.player_id] : null;

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (draftLoading) return <LoadingScreen />;
  if (!draft) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-white text-2xl">Draft not found</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white overflow-hidden">
      {/* Header */}
      <header className="text-center py-6 bg-black/30">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{draft.name}</h1>
        <p className="text-xl text-gray-400 mt-2">
          Round {draft.current_round} of {draft.num_rounds} • Pick #{draft.current_pick}
        </p>
      </header>

      {/* On The Clock - Active */}
      {draft.status === 'active' && currentTeam && (
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 py-8 px-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50"></div>
          <div className="relative">
            <p className="text-blue-200 uppercase tracking-[0.3em] text-sm mb-2 flex items-center justify-center gap-2">
              <Clock size={16} className="animate-pulse" />
              ON THE CLOCK
            </p>
            <h2 className="text-5xl md:text-6xl font-black">{currentTeam.team_name}</h2>
            {currentTeam.coach_name && (
              <p className="text-blue-100 mt-2 text-xl">{currentTeam.coach_name}</p>
            )}
            {timeRemaining !== null && (
              <div className={`mt-4 inline-flex items-center gap-3 px-6 py-3 rounded-full ${
                timeRemaining <= 10 ? 'bg-red-600 animate-pulse' : 'bg-black/30'
              }`}>
                <Clock size={24} />
                <span className="text-4xl font-mono font-bold">{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paused */}
      {draft.status === 'paused' && (
        <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 py-8 text-center">
          <h2 className="text-5xl font-black">⏸️ DRAFT PAUSED</h2>
        </div>
      )}

      {/* Completed */}
      {draft.status === 'completed' && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 py-8 text-center">
          <div className="flex items-center justify-center gap-4">
            <Trophy size={48} className="text-yellow-300" />
            <h2 className="text-5xl font-black">DRAFT COMPLETE</h2>
            <Trophy size={48} className="text-yellow-300" />
          </div>
        </div>
      )}

      {/* Draft Board Grid */}
      <div className="p-4 md:p-6 overflow-x-auto pb-24">
        <div className="min-w-max">
          {/* Team Headers */}
          <div className="flex gap-2 mb-2">
            {teams.map(team => {
              const isOnClock = team.id === draft.current_team_id && draft.status === 'active';
              return (
                <div 
                  key={team.id}
                  className={`flex-1 min-w-[180px] max-w-[220px] p-4 rounded-t-xl text-center transition-all ${
                    isOnClock 
                      ? 'bg-blue-600 ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' 
                      : 'bg-gray-800'
                  }`}
                >
                  <div className="font-bold text-lg truncate">{team.team_name}</div>
                  <div className="text-sm text-gray-400 truncate">{team.coach_name || 'No coach'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {(picksByTeam[team.id] || []).length} picks
                  </div>
                </div>
              );
            })}
          </div>

          {/* Picks Grid */}
          <div className="flex gap-2">
            {teams.map(team => {
              const teamPicks = picksByTeam[team.id] || [];
              const isOnClock = team.id === draft.current_team_id && draft.status === 'active';
              
              return (
                <div 
                  key={team.id}
                  className={`flex-1 min-w-[180px] max-w-[220px] rounded-b-xl overflow-hidden ${
                    isOnClock ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
                  }`}
                >
                  {Array.from({ length: draft.num_rounds || 12 }, (_, roundIdx) => {
                    const round = roundIdx + 1;
                    const pickForRound = teamPicks.find(p => p.round === round);
                    const player = pickForRound ? playerLookup[pickForRound.player_id] : null;
                    const isCurrentPick = draft.current_round === round && team.id === draft.current_team_id;
                    
                    return (
                      <div 
                        key={round}
                        className={`p-2 border-b border-gray-700/50 transition-all ${
                          isCurrentPick && draft.status === 'active'
                            ? 'bg-blue-900/80 animate-pulse' 
                            : pickForRound 
                              ? 'bg-gray-800' 
                              : 'bg-gray-900/50'
                        }`}
                      >
                        {pickForRound ? (
                          <div className="flex items-center gap-2">
                            {player?.photo_url ? (
                              <img 
                                src={player.photo_url}
                                alt={player.name}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2 border-gray-600"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                                <User size={14} className="text-gray-500" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {player?.name || `Player`}
                              </p>
                              {pickForRound.pick_type === 'auto' && (
                                <span className="text-xs text-orange-400">⚡ Auto</span>
                              )}
                            </div>
                          </div>
                        ) : isCurrentPick && draft.status === 'active' ? (
                          <div className="flex items-center gap-2 text-blue-400">
                            <div className="w-8 h-8 rounded-full border-2 border-blue-400 border-dashed animate-spin-slow flex items-center justify-center">
                              <span className="text-xs">?</span>
                            </div>
                            <span className="text-sm italic">Picking...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-600">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                              <span className="text-xs">{round}</span>
                            </div>
                            <span className="text-sm">—</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Last Pick Banner */}
      {lastPick && lastPickTeam && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 border-t border-gray-700 py-4 px-6">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
            {lastPickPlayer?.photo_url ? (
              <img 
                src={lastPickPlayer.photo_url}
                alt={lastPickPlayer.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-green-500"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center border-2 border-green-500">
                <User size={20} className="text-gray-400" />
              </div>
            )}
            <div className="text-center">
              <span className="text-gray-400">Pick #{lastPick.pick_number}: </span>
              <span className="font-bold text-lg text-white">{lastPickTeam.team_name}</span>
              <span className="text-gray-400"> selects </span>
              <span className="font-bold text-xl text-green-400">
                {lastPickPlayer?.name || 'Player'}
              </span>
              {lastPick.pick_type === 'auto' && (
                <span className="ml-2 text-orange-400 text-sm">⚡ Auto-pick</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="fixed top-4 right-4 flex items-center gap-2 text-gray-500 text-sm bg-black/50 px-3 py-1 rounded-full">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        Live
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default DraftBoard;
