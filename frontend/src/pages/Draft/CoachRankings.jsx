/**
 * CoachRankings - Pre-draft player ranking interface
 * Coaches can drag and drop players to create their personal rankings
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { 
  useDraft, 
  useAvailablePlayers,
  useCoachRankings
} from '../../hooks/useDraft';
import LoadingScreen from '../../components/LoadingScreen';
import { 
  ArrowLeft, 
  Search, 
  GripVertical, 
  Star,
  Save,
  X,
  ChevronUp,
  ChevronDown,
  Clock,
  User
} from 'lucide-react';

const CoachRankings = () => {
  const { draftId } = useParams();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  
  const { draft, loading: draftLoading } = useDraft(draftId);
  const { players, loading: playersLoading } = useAvailablePlayers(draftId);
  const { rankings: savedRankings, saving, saveRankings } = useCoachRankings(draftId);

  const [rankedPlayers, setRankedPlayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('composite');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize ranked players from saved rankings
  useEffect(() => {
    if (savedRankings && players.length > 0) {
      const ranked = savedRankings
        .map(id => players.find(p => p.id === id))
        .filter(Boolean);
      setRankedPlayers(ranked);
    }
  }, [savedRankings, players]);

  // Players not yet ranked
  const unrankedPlayers = useMemo(() => {
    const rankedIds = new Set(rankedPlayers.map(p => p.id));
    let unranked = players.filter(p => !rankedIds.has(p.id));

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      unranked = unranked.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.number?.toString().includes(q)
      );
    }

    // Sort
    unranked.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      const aScore = a.composite_score ?? a.scores?.composite ?? 0;
      const bScore = b.composite_score ?? b.scores?.composite ?? 0;
      return bScore - aScore;
    });

    return unranked;
  }, [players, rankedPlayers, searchQuery, sortBy]);

  // Add player to rankings
  const addToRankings = (player) => {
    setRankedPlayers(prev => [...prev, player]);
    setHasChanges(true);
  };

  // Remove from rankings
  const removeFromRankings = (index) => {
    setRankedPlayers(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  // Move player up/down
  const movePlayer = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= rankedPlayers.length) return;

    setRankedPlayers(prev => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
    setHasChanges(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setRankedPlayers(prev => {
      const updated = [...prev];
      const [removed] = updated.splice(draggedIndex, 1);
      updated.splice(index, 0, removed);
      return updated;
    });
    setDraggedIndex(index);
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Save rankings
  const handleSave = async () => {
    try {
      await saveRankings(rankedPlayers.map(p => p.id));
      setHasChanges(false);
      showSuccess('Rankings saved!');
    } catch (err) {
      showError(err.message || 'Failed to save rankings');
    }
  };

  // Get player score display
  const getScore = (player) => {
    return (player.composite_score ?? player.scores?.composite)?.toFixed(1) ?? '-';
  };

  const get40m = (player) => {
    return (player.scores?.['40m_dash'] ?? player.drill_40m_dash)?.toFixed(2) ?? '-';
  };

  const getVert = (player) => {
    return (player.scores?.vertical_jump ?? player.vertical_jump)?.toFixed(1) ?? '-';
  };

  if (draftLoading || playersLoading) return <LoadingScreen />;
  if (!draft) return <div className="p-8 text-center">Draft not found</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to={`/draft/${draftId}/setup`} className="text-gray-500 hover:text-gray-700">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-xl font-bold">My Player Rankings</h1>
                <p className="text-sm text-gray-500">{draft.name}</p>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                hasChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Rankings'}
            </button>
          </div>
        </div>
      </header>

      {/* Info Banner */}
      <div className="bg-blue-50 border-b border-blue-100 py-3 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-blue-700">
            <Star size={14} className="inline mr-1" />
            Create your personal player rankings. These are private to you and will help during the draft.
            {draft.auto_pick_on_timeout && ' Your rankings are also used for auto-pick if time runs out.'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* My Rankings */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-yellow-50">
              <h3 className="font-semibold flex items-center gap-2">
                <Star size={18} className="text-yellow-600" />
                My Rankings ({rankedPlayers.length})
              </h3>
              <p className="text-xs text-gray-500 mt-1">Drag to reorder. #1 is your top pick.</p>
            </div>

            <div className="overflow-y-auto max-h-[600px]">
              {rankedPlayers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <User size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No players ranked yet</p>
                  <p className="text-sm">Add players from the list on the right</p>
                </div>
              ) : (
                <div className="divide-y">
                  {rankedPlayers.map((player, index) => (
                    <div
                      key={player.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-move ${
                        draggedIndex === index ? 'bg-blue-50 opacity-50' : ''
                      }`}
                    >
                      <div className="text-gray-400 cursor-grab">
                        <GripVertical size={18} />
                      </div>
                      
                      <div className="w-8 h-8 flex items-center justify-center bg-yellow-100 text-yellow-700 font-bold rounded-full text-sm">
                        {index + 1}
                      </div>

                      {/* Player Photo */}
                      {player.photo_url ? (
                        <img 
                          src={player.photo_url} 
                          alt={player.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User size={20} className="text-gray-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{player.name}</p>
                        <p className="text-xs text-gray-500">
                          Score: {getScore(player)} | 40m: {get40m(player)} | Vert: {getVert(player)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => movePlayer(index, -1)}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronUp size={18} />
                        </button>
                        <button
                          onClick={() => movePlayer(index, 1)}
                          disabled={index === rankedPlayers.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronDown size={18} />
                        </button>
                        <button
                          onClick={() => removeFromRankings(index)}
                          className="p-1 text-red-400 hover:text-red-600"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Available Players */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold mb-3">Available Players ({unrankedPlayers.length})</h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border rounded-lg px-2"
                >
                  <option value="composite">Score</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[600px]">
              {unrankedPlayers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchQuery ? 'No players match your search' : 'All players ranked!'}
                </div>
              ) : (
                <div className="divide-y">
                  {unrankedPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50"
                    >
                      {/* Player Photo */}
                      {player.photo_url ? (
                        <img 
                          src={player.photo_url} 
                          alt={player.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User size={20} className="text-gray-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{player.name}</p>
                        <p className="text-xs text-gray-500">
                          {player.number && `#${player.number} • `}
                          Score: {getScore(player)}
                        </p>
                      </div>

                      <div className="text-right text-xs text-gray-500 mr-2">
                        <p>40m: {get40m(player)}</p>
                        <p>Vert: {getVert(player)}</p>
                      </div>

                      <button
                        onClick={() => addToRankings(player)}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Save Button */}
      {hasChanges && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            {saving ? 'Saving...' : `Save Rankings (${rankedPlayers.length} players)`}
          </button>
        </div>
      )}
    </div>
  );
};

export default CoachRankings;
