/**
 * DraftRoom - Live draft interface
 * Real-time draft picking with player pool, draft board, and team view
 * Mobile-optimized with player photos and auto-pick support
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { 
  useDraft, 
  useDraftPicks, 
  useDraftTeams, 
  useAvailablePlayers,
  useDraftActions,
  useCoachRankings
} from '../../hooks/useDraft';
import LoadingScreen from '../../components/LoadingScreen';
import { 
  Clock, 
  Users, 
  Trophy,
  Search,
  Pause,
  Play,
  RotateCcw,
  Monitor,
  ArrowLeft,
  Star,
  User,
  Menu,
  X,
  ChevronDown,
  ListOrdered
} from 'lucide-react';

const DraftRoom = () => {
  const { draftId } = useParams();
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();
  
  const { draft, loading: draftLoading } = useDraft(draftId);
  const { picks } = useDraftPicks(draftId);
  const { teams } = useDraftTeams(draftId);
  const { players, refetch: refetchPlayers } = useAvailablePlayers(draftId);
  const { rankings } = useCoachRankings(draftId);
  const { 
    makePick, 
    pauseDraft, 
    resumeDraft, 
    undoPick, 
    autoPick,
    loading: actionLoading 
  } = useDraftActions(draftId);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('composite');
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [mobileTab, setMobileTab] = useState('players'); // players | board | myteam
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const autoPickTriggeredRef = useRef(false);

  // Timer countdown and auto-pick trigger
  useEffect(() => {
    if (!draft?.pick_deadline) {
      setTimeRemaining(null);
      autoPickTriggeredRef.current = false;
      return;
    }

    const deadline = new Date(draft.pick_deadline).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
      setTimeRemaining(remaining);
      
      // Auto-pick when timer hits 0
      if (remaining <= 0 && !autoPickTriggeredRef.current && draft.auto_pick_on_timeout) {
        autoPickTriggeredRef.current = true;
        clearInterval(interval);
        
        // Only trigger if draft is still active
        if (draft.status === 'active') {
          handleAutoPick();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [draft?.pick_deadline, draft?.auto_pick_on_timeout, draft?.status]);

  // Reset auto-pick trigger when pick changes
  useEffect(() => {
    autoPickTriggeredRef.current = false;
  }, [draft?.current_pick]);

  // Refetch players when picks change
  useEffect(() => {
    refetchPlayers();
  }, [picks.length, refetchPlayers]);

  // Current team on the clock
  const currentTeam = useMemo(() => {
    if (!draft?.current_team_id || !teams.length) return null;
    return teams.find(t => t.id === draft.current_team_id);
  }, [draft?.current_team_id, teams]);

  // Is it my turn?
  const isMyTurn = useMemo(() => {
    if (!currentTeam || !user) return false;
    return currentTeam.coach_user_id === user.uid || draft?.created_by === user.uid;
  }, [currentTeam, user, draft?.created_by]);

  // Am I the admin?
  const isAdmin = draft?.created_by === user?.uid;

  // My team
  const myTeam = useMemo(() => {
    return teams.find(t => t.coach_user_id === user?.uid);
  }, [teams, user]);

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    let result = [...players];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(q) ||
        p.number?.toString().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'ranking') {
        const aRank = rankings.indexOf(a.id);
        const bRank = rankings.indexOf(b.id);
        if (aRank !== -1 && bRank !== -1) return aRank - bRank;
        if (aRank !== -1) return -1;
        if (bRank !== -1) return 1;
      }
      
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }

      const aScore = a.composite_score ?? a.scores?.composite ?? 0;
      const bScore = b.composite_score ?? b.scores?.composite ?? 0;
      return bScore - aScore;
    });

    return result;
  }, [players, searchQuery, sortBy, rankings]);

  // Group picks by team
  const picksByTeam = useMemo(() => {
    const grouped = {};
    teams.forEach(team => {
      grouped[team.id] = picks.filter(p => p.team_id === team.id);
    });
    return grouped;
  }, [picks, teams]);

  // Handle pick
  const handlePick = async (playerId) => {
    if (!isMyTurn && !isAdmin) {
      showError("It's not your turn");
      return;
    }

    try {
      await makePick(playerId);
      showSuccess('Pick made!');
    } catch (err) {
      showError(err.message || 'Failed to make pick');
    }
  };

  // Handle auto-pick
  const handleAutoPick = async () => {
    try {
      const result = await autoPick();
      showInfo(`Auto-pick: ${result.player_name || 'Player selected'}`);
    } catch (err) {
      // Timer might not have actually expired or draft state changed
      console.log('Auto-pick failed:', err.message);
    }
  };

  // Handle pause/resume
  const handlePauseResume = async () => {
    try {
      if (draft.status === 'active') {
        await pauseDraft();
        showSuccess('Draft paused');
      } else {
        await resumeDraft();
        showSuccess('Draft resumed');
      }
    } catch (err) {
      showError(err.message);
    }
  };

  // Handle undo
  const handleUndo = async () => {
    if (!confirm('Undo the last pick?')) return;
    try {
      await undoPick();
      showSuccess('Pick undone');
    } catch (err) {
      showError(err.message);
    }
  };

  if (draftLoading) return <LoadingScreen />;
  if (!draft) return <div className="p-8 text-center">Draft not found</div>;

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScore = (player) => (player.composite_score ?? player.scores?.composite)?.toFixed(1) ?? '-';
  const get40m = (player) => (player.scores?.['40m_dash'] ?? player.drill_40m_dash)?.toFixed(2) ?? '-';
  const getVert = (player) => (player.scores?.vertical_jump ?? player.vertical_jump)?.toFixed(1) ?? '-';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to={`/events`} className="text-gray-500 hover:text-gray-700">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-lg md:text-xl font-bold truncate max-w-[200px] md:max-w-none">
                  {draft.name}
                </h1>
                <p className="text-xs md:text-sm text-gray-500">
                  Round {draft.current_round}/{draft.num_rounds} • Pick #{draft.current_pick}
                </p>
              </div>
            </div>
            
            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <Link 
                to={`/draft/${draftId}/rankings`}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
              >
                <ListOrdered size={16} />
                My Rankings
              </Link>
              <Link 
                to={`/draft/${draftId}/board`}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <Monitor size={16} />
                Draft Board
              </Link>

              {isAdmin && (
                <>
                  <button
                    onClick={handlePauseResume}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                    disabled={actionLoading}
                  >
                    {draft.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                    {draft.status === 'active' ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={handleUndo}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    disabled={actionLoading || picks.length === 0}
                  >
                    <RotateCcw size={16} />
                    Undo
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden mt-3 pt-3 border-t space-y-2">
              <Link 
                to={`/draft/${draftId}/rankings`}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg"
              >
                <ListOrdered size={16} />
                My Rankings
              </Link>
              <Link 
                to={`/draft/${draftId}/board`}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 rounded-lg"
              >
                <Monitor size={16} />
                TV Draft Board
              </Link>
              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={handlePauseResume}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg"
                    disabled={actionLoading}
                  >
                    {draft.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                    {draft.status === 'active' ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={handleUndo}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg"
                    disabled={actionLoading || picks.length === 0}
                  >
                    <RotateCcw size={16} />
                    Undo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* On The Clock Banner */}
      {draft.status === 'active' && currentTeam && (
        <div className={`py-4 md:py-6 text-center ${isMyTurn ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
          <p className="text-xs uppercase tracking-wide opacity-80">On The Clock</p>
          <h2 className="text-2xl md:text-3xl font-bold mt-1">{currentTeam.team_name}</h2>
          {currentTeam.coach_name && (
            <p className="text-xs md:text-sm mt-1 opacity-80">{currentTeam.coach_name}</p>
          )}
          {timeRemaining !== null && (
            <div className="mt-2 md:mt-3 flex items-center justify-center gap-2">
              <Clock size={18} />
              <span className={`text-xl md:text-2xl font-mono ${timeRemaining <= 10 ? 'text-red-300 animate-pulse' : ''}`}>
                {formatTime(timeRemaining)}
              </span>
              {draft.auto_pick_on_timeout && timeRemaining <= 10 && (
                <span className="text-xs opacity-75">(auto-pick)</span>
              )}
            </div>
          )}
          {isMyTurn && (
            <p className="mt-2 text-green-200 font-semibold text-sm md:text-base">Your pick!</p>
          )}
        </div>
      )}

      {/* Status Banners */}
      {draft.status === 'paused' && (
        <div className="py-3 text-center bg-yellow-500 text-white font-semibold">
          ⏸️ Draft Paused
        </div>
      )}
      {draft.status === 'completed' && (
        <div className="py-3 text-center bg-green-600 text-white font-semibold">
          🏆 Draft Complete!
        </div>
      )}

      {/* Mobile Tab Bar */}
      <div className="md:hidden sticky top-[57px] z-10 bg-white border-b flex">
        <button
          onClick={() => setMobileTab('players')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 ${
            mobileTab === 'players' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          Players
        </button>
        <button
          onClick={() => setMobileTab('board')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 ${
            mobileTab === 'board' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          Teams
        </button>
        {myTeam && (
          <button
            onClick={() => setMobileTab('myteam')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 ${
              mobileTab === 'myteam' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            My Team
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          
          {/* Available Players */}
          <div className={`lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden ${
            mobileTab !== 'players' ? 'hidden md:block' : ''
          }`}>
            <div className="p-3 md:p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base">
                  <Users size={18} />
                  Available ({filteredPlayers.length})
                </h3>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border rounded-lg px-2 py-1"
                >
                  <option value="composite">Score</option>
                  <option value="ranking">My Ranking</option>
                  <option value="name">Name</option>
                </select>
              </div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[400px] md:max-h-[500px]">
              {filteredPlayers.map((player) => {
                const rankIndex = rankings.indexOf(player.id);
                const isRanked = rankIndex !== -1;
                
                return (
                  <div 
                    key={player.id} 
                    className={`flex items-center gap-3 p-3 border-b hover:bg-gray-50 ${isRanked ? 'bg-yellow-50' : ''}`}
                  >
                    {/* Player Photo */}
                    {player.photo_url ? (
                      <img 
                        src={player.photo_url} 
                        alt={player.name}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-gray-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isRanked && (
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded flex-shrink-0">
                            #{rankIndex + 1}
                          </span>
                        )}
                        <p className="font-medium truncate">{player.name}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        {player.number && <span>#{player.number}</span>}
                        <span>Score: {getScore(player)}</span>
                        <span className="hidden sm:inline">40m: {get40m(player)}</span>
                        <span className="hidden sm:inline">Vert: {getVert(player)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handlePick(player.id)}
                      disabled={!isMyTurn && !isAdmin || actionLoading || draft.status !== 'active'}
                      className={`px-3 md:px-4 py-1.5 text-sm font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isMyTurn || isAdmin
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Draft
                    </button>
                  </div>
                );
              })}
              
              {filteredPlayers.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No players available
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className={`space-y-4 md:space-y-6 ${
            mobileTab === 'players' ? 'hidden md:block' : ''
          }`}>
            
            {/* My Team - Mobile Tab or Desktop Card */}
            {myTeam && (mobileTab === 'myteam' || mobileTab !== 'board') && (
              <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                mobileTab !== 'myteam' ? 'hidden md:block' : ''
              }`}>
                <div className="p-3 md:p-4 border-b bg-blue-50">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Trophy size={18} className="text-blue-600" />
                    My Team: {myTeam.team_name}
                  </h3>
                </div>
                <div className="p-3 md:p-4">
                  {(picksByTeam[myTeam.id] || []).length === 0 ? (
                    <p className="text-gray-500 text-sm">No picks yet</p>
                  ) : (
                    <ul className="space-y-2">
                      {(picksByTeam[myTeam.id] || []).map((pick) => {
                        const player = players.find(p => p.id === pick.player_id) || 
                          { name: pick.player?.name || pick.player_id };
                        return (
                          <li key={pick.id} className="flex items-center gap-3 text-sm">
                            <span className="text-xs text-gray-400 w-8">Rd {pick.round}</span>
                            {player.photo_url ? (
                              <img 
                                src={player.photo_url}
                                alt={player.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User size={14} className="text-gray-400" />
                              </div>
                            )}
                            <span className="font-medium truncate">{player.name}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Teams / Draft Board - Desktop and Mobile Board Tab */}
            <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${
              mobileTab === 'myteam' ? 'hidden md:block' : ''
            }`}>
              <div className="p-3 md:p-4 border-b">
                <h3 className="font-semibold">Teams</h3>
              </div>
              <div className="p-3 md:p-4 space-y-3 max-h-[400px] md:max-h-none overflow-y-auto">
                {teams.map((team) => {
                  const teamPicks = picksByTeam[team.id] || [];
                  const isOnClock = team.id === draft.current_team_id;
                  
                  return (
                    <div 
                      key={team.id}
                      className={`p-3 rounded-lg ${isOnClock ? 'bg-blue-100 border border-blue-300' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-medium text-sm ${isOnClock ? 'text-blue-700' : ''}`}>
                          {team.team_name}
                          {isOnClock && <span className="ml-2 text-xs">⏳</span>}
                        </span>
                        <span className="text-xs text-gray-500">{teamPicks.length} picks</span>
                      </div>
                      
                      {/* Show recent picks */}
                      {teamPicks.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {teamPicks.slice(-4).map((pick) => {
                            const player = players.find(p => p.id === pick.player_id);
                            const name = player?.name || pick.player?.name || '...';
                            return (
                              <span 
                                key={pick.id}
                                className="text-xs bg-white px-2 py-0.5 rounded border truncate max-w-[100px]"
                                title={name}
                              >
                                {name.split(' ').pop()}
                              </span>
                            );
                          })}
                          {teamPicks.length > 4 && (
                            <span className="text-xs text-gray-400">+{teamPicks.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Picks - Desktop Only */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Recent Picks</h3>
              </div>
              <div className="p-4 max-h-[200px] overflow-y-auto">
                {picks.length === 0 ? (
                  <p className="text-gray-500 text-sm">No picks yet</p>
                ) : (
                  <ul className="space-y-2">
                    {picks.slice(-6).reverse().map((pick) => {
                      const team = teams.find(t => t.id === pick.team_id);
                      const player = players.find(p => p.id === pick.player_id);
                      return (
                        <li key={pick.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400 w-8">#{pick.pick_number}</span>
                          <span className="font-medium text-gray-600 truncate mx-2 flex-1">
                            {team?.team_name}
                          </span>
                          <span className="truncate max-w-[100px]">
                            {player?.name || pick.player?.name || '...'}
                          </span>
                          {pick.pick_type === 'auto' && (
                            <span className="ml-1 text-xs text-orange-500" title="Auto-pick">⚡</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftRoom;
