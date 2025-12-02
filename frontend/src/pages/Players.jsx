import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Skeleton from "../components/Skeleton";
import DrillInputForm from "../components/DrillInputForm";
import EditPlayerModal from "../components/Players/EditPlayerModal";
import PlayerDetailsModal from "../components/Players/PlayerDetailsModal";
import AddPlayerModal from "../components/Players/AddPlayerModal";
import ImportResultsModal from "../components/Players/ImportResultsModal";

import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from '../lib/api';
import { X, TrendingUp, Users, BarChart3, Download, Filter, ChevronDown, ChevronRight, ArrowRight, UserPlus, Upload, FileText } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { parseISO, isValid, format } from 'date-fns';
import { DRILLS, WEIGHT_PRESETS } from '../constants/players';
import { calculateNormalizedCompositeScores } from '../utils/normalizedScoring';
import { calculateOptimizedRankingsAcrossAll } from '../utils/optimizedScoring';

import { useOptimizedWeights } from '../hooks/useOptimizedWeights';
import { withCache, cacheInvalidation } from '../utils/dataCache';
import WeightControls from '../components/WeightControls';
import { getDrillsFromTemplate } from '../constants/drillTemplates';

// PERFORMANCE OPTIMIZATION: Cached API function with chunked fetching
const cachedFetchPlayers = withCache(
  async (eventId) => {
    let allPlayers = [];
    let page = 1;
    const limit = 200; // Chunk size to avoid 1MB limits and timeouts
    let hasMore = true;

    while (hasMore) {
      const res = await api.get(`/players?event_id=${eventId}&page=${page}&limit=${limit}`);
      const chunk = res.data || [];
      allPlayers = [...allPlayers, ...chunk];
      
      if (chunk.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    }
    return allPlayers;
  },
  'players',
  60 * 1000 // 60s cache per requirements
);

export default function Players() {
  const { selectedEvent, setSelectedEvent } = useEvent();
  const { user, selectedLeagueId, userRole } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Redesign State
  const [showRoster, setShowRoster] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const rankingsRef = useRef(null);

  // Handle deep linking to sections
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'analyze') {
      setShowRankings(true);
      setShowRoster(true);
      setTimeout(() => {
        rankingsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else if (tabParam === 'manage') {
      setShowRoster(true);
    }
  }, [location.search]);

  // Refresh event data on mount
  useEffect(() => {
    if (selectedEvent?.id && selectedEvent?.league_id) {
      const fetchFreshEvent = async () => {
        try {
          const response = await api.get(`/leagues/${selectedEvent.league_id}/events/${selectedEvent.id}`);
          const freshEvent = response.data;
          
          if (freshEvent.drillTemplate !== selectedEvent.drillTemplate || 
              freshEvent.name !== selectedEvent.name ||
              JSON.stringify(freshEvent.custom_drills) !== JSON.stringify(selectedEvent.custom_drills)) {
             setSelectedEvent(freshEvent);
          }
        } catch (error) {
          console.warn("Background event refresh failed:", error);
        }
      };
      fetchFreshEvent();
    }
  }, [selectedEvent?.id, selectedEvent?.league_id, setSelectedEvent]);

  // Compute drills
  const allDrills = useMemo(() => {
    if (!selectedEvent) return DRILLS;
    const templateDrills = getDrillsFromTemplate(selectedEvent.drillTemplate || 'football');
    const customDrills = selectedEvent.custom_drills || [];
    const formattedCustomDrills = customDrills.map(d => ({
      key: d.id,
      label: d.name,
      unit: d.unit,
      lowerIsBetter: d.lower_is_better,
      category: d.category || 'custom',
      isCustom: true
    }));
    return [...templateDrills, ...formattedCustomDrills];
  }, [selectedEvent]);

  const [selectedAgeGroup, setSelectedAgeGroup] = useState("");

  // Optimized weights hook
  const {
    persistedWeights,
    sliderWeights,
    activePreset,
    handleWeightChange,
    applyPreset,
    rankings: optimizedRankings,
    liveRankings,
    groupedRankings,
    setSliderWeights,
    persistSliderWeights
  } = useOptimizedWeights(players, allDrills);

  const [showCustomControls, setShowCustomControls] = useState(false);
  const [showCompactSliders, setShowCompactSliders] = useState(false);
  const { showInfo, removeToast } = useToast();

  // Grouped players
  const grouped = useMemo(() => {
    if (Object.keys(groupedRankings).length > 0) {
      return groupedRankings;
    }
    return players.reduce((acc, player) => {
      const ageGroup = player.age_group || 'Unknown';
      if (!acc[ageGroup]) acc[ageGroup] = [];
      acc[ageGroup].push(player);
      return acc;
    }, {});
  }, [players, groupedRankings]);

  // Selected group rankings
  const selectedGroupRankings = useMemo(() => {
    if (!selectedAgeGroup) return [];
    if (selectedAgeGroup === 'all') {
      return calculateOptimizedRankingsAcrossAll(players, persistedWeights, allDrills);
    }
    return groupedRankings[selectedAgeGroup] || [];
  }, [selectedAgeGroup, players, persistedWeights, groupedRankings, allDrills]);

  // Live rankings
  const selectedLiveRankings = useMemo(() => {
    if (!selectedAgeGroup) return [];
    if (selectedAgeGroup === 'all') {
      return calculateOptimizedRankingsAcrossAll(players, sliderWeights, allDrills);
    }
    const filtered = (Array.isArray(liveRankings) ? liveRankings : [])
      .filter(p => p && p.age_group === selectedAgeGroup);
    return filtered.length > 0 ? filtered : selectedGroupRankings;
  }, [selectedAgeGroup, players, sliderWeights, liveRankings, selectedGroupRankings, allDrills]);

  // Selected group players
  const selectedGroupPlayers = useMemo(() => {
    if (!selectedAgeGroup) return [];
    return selectedAgeGroup === 'all' ? players : (grouped[selectedAgeGroup] || []);
  }, [selectedAgeGroup, players, grouped]);

  // Stats
  const selectedGroupScoredCount = useMemo(() => {
    if (!selectedGroupPlayers || selectedGroupPlayers.length === 0) return 0;
    return selectedGroupPlayers.filter(p =>
      allDrills.some(drill => p[drill.key] != null && typeof p[drill.key] === 'number')
    ).length;
  }, [selectedGroupPlayers, allDrills]);

  const selectedGroupCompletionPct = useMemo(() => {
    const total = selectedGroupPlayers.length || 0;
    if (total === 0) return 0;
    return Math.round((selectedGroupScoredCount / total) * 100);
  }, [selectedGroupScoredCount, selectedGroupPlayers]);

  // Fetch players
  const fetchPlayers = useCallback(async () => {
    if (!selectedEvent || !user || !selectedLeagueId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const playersData = await cachedFetchPlayers(selectedEvent.id);
      setPlayers(playersData);
      
      if (selectedPlayer) {
        const updatedPlayer = playersData.find(p => p.id === selectedPlayer.id);
        setSelectedPlayer(updatedPlayer || null);
      }
    } catch (err) {
      if (err.response?.status === 422) {
        setError("422: Unprocessable Entity - Players may not be set up yet");
      } else {
        setError(err.message || "Failed to load players");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedEvent, user, selectedLeagueId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Auto-select "all" age group
  useEffect(() => {
    const availableAgeGroups = Object.keys(grouped);
    if (!selectedAgeGroup && availableAgeGroups.length > 0) {
      setSelectedAgeGroup('all');
    }
  }, [selectedAgeGroup, grouped]);

  const toggleForm = (id) => {
    setExpandedPlayerIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to expand rankings
  const expandRankings = () => {
    setShowRankings(true);
    setTimeout(() => {
      rankingsRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // CSV Export Helper
  const exportCsv = (data, filename, headers) => {
    const escapeCsvCell = (cell) => {
      if (cell === null || cell === undefined) return '';
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csv = headers.join(',') + '\n';
    data.forEach(row => {
      csv += row.map(escapeCsvCell).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render Loading
  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-3">
        <Skeleton className="h-24 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );

  // Render Error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="text-red-500 font-semibold">Error: {error}</div>
            <button onClick={fetchPlayers} className="mt-4 text-red-600 underline">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  // Render No Event
  if (!selectedEvent || !selectedEvent.id) return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-blue-200">
           <h2 className="text-2xl font-bold text-cmf-primary mb-4">No Event Selected</h2>
           <button onClick={() => navigate('/select-league')} className="bg-cmf-primary text-white px-6 py-3 rounded-lg">Select Event</button>
        </div>
      </div>
    </div>
  );

  // VIEW ONLY MODE (Keep existing viewer layout roughly, or simplified)
  if (userRole === 'viewer') {
     return (
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
               <div className="flex items-center justify-between">
                 <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                   <Users className="w-5 h-5 text-cmf-primary" />
                   Event Participants
                 </h2>
                 <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">👁️ View Only</span>
               </div>
            </div>
            {/* Use the new Section 3 content for viewers essentially */}
             <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  {/* Age Group Selector for Viewer */}
                   <div className="flex items-center gap-3 mb-4">
                    <Filter className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <select
                      value={selectedAgeGroup}
                      onChange={e => setSelectedAgeGroup(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 p-2 text-sm"
                    >
                      <option value="all">All Players ({players.length})</option>
                      {Object.keys(grouped).map(group => (
                        <option key={group} value={group}>{group} ({grouped[group].length})</option>
                      ))}
                    </select>
                   </div>

                    {/* Weight Controls & Rankings */}
                   {selectedLiveRankings.length > 0 ? (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white p-3">
                           {/* Weight Presets */}
                           <div className="flex gap-1 mb-3">
                            {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
                              <button
                                key={key}
                                onClick={() => applyPreset(key)}
                                className={`px-2 py-1 text-xs rounded border transition-all flex-1 ${
                                  activePreset === key 
                                    ? 'border-white bg-white/20 text-white font-medium' 
                                    : 'border-white/30 hover:border-white/60 text-white/80 hover:text-white'
                                }`}
                              >
                                {preset.name}
                              </button>
                            ))}
                          </div>
                          {/* Compact Sliders Toggle */}
                           <button
                            onClick={() => setShowCompactSliders((v) => !v)}
                            className="w-full bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded text-xs font-medium mb-2"
                          >
                            {showCompactSliders ? 'Hide sliders' : 'Adjust weights'}
                          </button>

                          {showCompactSliders && (
                            <div className="bg-white/10 rounded p-2 mb-2">
                              <div className="grid grid-cols-5 gap-2 text-xs">
                                {allDrills.map((drill) => (
                                  <div key={drill.key} className="text-center">
                                    <div className="font-medium mb-1 truncate">{drill.label.replace(' ', '')}</div>
                                    <input
                                      type="range"
                                      value={sliderWeights[drill.key] ?? 50}
                                      min={0}
                                      max={100}
                                      step={5}
                                      onChange={(e) => handleWeightChange(drill.key, parseFloat(e.target.value))}
                                      className="w-full h-1 rounded cursor-pointer accent-white"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Rankings List */}
                         <div className="p-3 space-y-1">
                           {selectedLiveRankings.slice(0, 10).map((player, index) => (
                             <div key={player.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                               <div className="font-bold w-6 text-center text-gray-500">{index + 1}</div>
                               <div className="flex-1 min-w-0">
                                 <div className="font-medium text-gray-900 truncate">{player.name}</div>
                                 <div className="text-xs text-gray-500">#{player.number || '-'}</div>
                               </div>
                               <div className="font-bold text-blue-600">{(player.weightedScore ?? 0).toFixed(1)}</div>
                             </div>
                           ))}
                         </div>
                      </div>
                   ) : (
                     <div className="text-center py-8 text-gray-500">Rankings will appear once scores are recorded.</div>
                   )}
                </div>
             </div>
          </div>
        </div>
     );
  }

  // MAIN REDESIGN (Coach/Organizer)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        
        {/* SECTION 1: Primary Actions (Always Visible) */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4 border-2 border-blue-200">
          <h1 className="text-2xl font-bold text-cmf-secondary mb-4">
            WooCombine: Players & Rankings
          </h1>
          
          <div className="space-y-4">
            {/* Primary CTA */}
            <Link
              to="/live-entry"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-3 text-lg"
            >
              🚀 Start Recording Drill Results
              <ArrowRight className="w-5 h-5" />
            </Link>

            {/* Secondary CTAs */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setShowAddPlayerModal(true)}
                className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition border border-blue-200"
              >
                <UserPlus className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">Add Player</span>
              </button>
              
              <button
                onClick={() => setShowImportModal(true)}
                className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition border border-blue-200"
              >
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">Import Results</span>
              </button>
              
              <button
                onClick={() => setShowExportModal(true)}
                className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition border border-blue-200"
              >
                <FileText className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">Export Data</span>
              </button>
            </div>

            <p className="text-sm text-gray-600 text-center">
              Record 40-yard dash, vertical jump, and other drill results.
            </p>
          </div>
        </div>

        {/* SECTION 2: Roster Management (Collapsed by default) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
          <button 
            onClick={() => setShowRoster(!showRoster)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="font-semibold text-gray-900 flex items-center gap-2">
              {showRoster ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              Manage Players
            </span>
            {!showRoster && <span className="text-xs text-gray-500">Tap to expand</span>}
          </button>

          {showRoster && (
            <div className="p-4 border-t border-gray-200">
              {/* Filters */}
              <div className="flex items-center gap-3 mb-4">
                <select
                  value={selectedAgeGroup}
                  onChange={e => setSelectedAgeGroup(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Players ({players.length})</option>
                  {Object.keys(grouped).map(group => (
                    <option key={group} value={group}>{group} ({grouped[group].length})</option>
                  ))}
                </select>
                
                <button
                  onClick={expandRankings}
                  className="bg-cmf-primary hover:bg-cmf-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1"
                >
                  Analyze Rankings <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Player List */}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {selectedGroupPlayers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No players found. Add some players to get started!</div>
                ) : (
                  selectedGroupPlayers.map((player) => (
                    <div key={player.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{player.name}</h4>
                          <p className="text-sm text-gray-600">
                            #{player.number || '-'} • {player.age_group || 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedPlayer(player)}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm font-medium transition"
                        >
                          View Stats & Weights
                        </button>
                        <button
                          onClick={() => setEditingPlayer(player)}
                          className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-md text-sm font-medium transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleForm(player.id)}
                          className="bg-brand-light/20 hover:bg-brand-light/30 text-brand-primary px-3 py-1 rounded-md text-sm font-medium transition"
                        >
                          Add Result
                        </button>
                      </div>
                      
                      {expandedPlayerIds[player.id] && (
                        <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200 mt-3">
                          <DrillInputForm 
                            playerId={player.id} 
                            drills={allDrills}
                            onSuccess={() => { 
                              toggleForm(player.id); 
                              if (selectedEvent) {
                                cacheInvalidation.playersUpdated(selectedEvent.id);
                              }
                              fetchPlayers(); 
                            }} />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Rankings (Collapsed by default) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" ref={rankingsRef}>
          <button 
            onClick={() => setShowRankings(!showRankings)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="font-semibold text-gray-900 flex items-center gap-2">
              {showRankings ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              Analyze Rankings
            </span>
            {!showRankings && <span className="text-xs text-gray-500">Tap to expand</span>}
          </button>

          {showRankings && (
            <div className="p-4 border-t border-gray-200">
               {selectedLiveRankings && selectedLiveRankings.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Weight Controls */}
                    <div className="bg-gradient-to-r from-cmf-primary to-cmf-secondary text-white p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span className="font-semibold text-sm">{selectedAgeGroup === 'all' ? 'Top Prospects: All' : `Top Prospects: ${selectedAgeGroup}`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowCompactSliders((v) => !v)}
                            className="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded text-xs font-medium"
                          >
                            {showCompactSliders ? 'Hide sliders' : 'Adjust weights'}
                          </button>
                        </div>
                      </div>
                      
                      {/* Presets */}
                      <div className="flex gap-1 mb-3">
                        {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
                          <button
                            key={key}
                            onClick={() => applyPreset(key)}
                            className={`px-2 py-1 text-xs rounded border transition-all flex-1 ${
                              activePreset === key 
                                ? 'border-white bg-white/20 text-white font-medium' 
                                : 'border-white/30 hover:border-white/60 text-white/80 hover:text-white'
                            }`}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>

                      {/* Sliders */}
                      {showCompactSliders && (
                        <div className="bg-white/10 rounded p-2 mb-2">
                          <div className="grid grid-cols-5 gap-2 text-xs">
                            {allDrills.map((drill) => (
                              <div key={drill.key} className="text-center">
                                <div className="font-medium mb-1 truncate">{drill.label.replace(' ', '')}</div>
                                <input
                                  type="range"
                                  value={sliderWeights[drill.key] ?? 50}
                                  min={0}
                                  max={100}
                                  step={5}
                                  onChange={(e) => handleWeightChange(drill.key, parseFloat(e.target.value))}
                                  className="w-full h-1 rounded cursor-pointer accent-white"
                                />
                                <div className="font-mono font-bold text-xs mt-1">
                                  {(sliderWeights[drill.key] || 0).toFixed(0)}%
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-white/80 italic text-center">
                        * Adjust weights to see how rankings change based on priorities
                      </div>
                    </div>

                    {/* Rankings List */}
                    <div className="p-3 space-y-1">
                      {selectedLiveRankings.slice(0, 10).map((player, index) => (
                        <div key={player.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                          <div className={`font-bold w-6 text-center ${
                            index === 0 ? "text-yellow-500" : 
                            index === 1 ? "text-gray-500" : 
                            index === 2 ? "text-orange-500" : "text-gray-400"
                          }`}>
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{player.name}</div>
                            <div className="text-xs text-gray-500">
                               #{player.number || '-'} {selectedAgeGroup === 'all' && `• ${player.age_group}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-cmf-primary">{(player.weightedScore ?? player.compositeScore ?? 0).toFixed(1)}</div>
                            <div className="text-[10px] text-gray-400">points</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
               ) : (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>Rankings will appear once scores are recorded.</p>
                  </div>
               )}
            </div>
          )}
        </div>

      </div>

      {/* MODALS */}
      {selectedPlayer && (
        <PlayerDetailsModal 
          player={selectedPlayer} 
          allPlayers={players} 
          onClose={() => setSelectedPlayer(null)}
          persistedWeights={persistedWeights}
          sliderWeights={sliderWeights}
          setSliderWeights={setSliderWeights}
          persistSliderWeights={persistSliderWeights}
          handleWeightChange={handleWeightChange}
          activePreset={activePreset}
          applyPreset={applyPreset}
          drills={allDrills}
        />
      )}
      {editingPlayer && (
        <EditPlayerModal
          player={editingPlayer}
          allPlayers={players}
          onClose={() => setEditingPlayer(null)}
          onSave={() => {
            if (selectedEvent) cacheInvalidation.playersUpdated(selectedEvent.id);
            fetchPlayers();
          }}
        />
      )}
      {showAddPlayerModal && (
        <AddPlayerModal
          allPlayers={players}
          onClose={() => setShowAddPlayerModal(false)}
          onSave={() => {
            if (selectedEvent) cacheInvalidation.playersUpdated(selectedEvent.id);
            fetchPlayers();
          }}
        />
      )}

      {showImportModal && (
        <ImportResultsModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            if (selectedEvent) cacheInvalidation.playersUpdated(selectedEvent.id);
            fetchPlayers();
          }}
        />
      )}
      
      {/* EXPORT DATA MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold text-gray-900">Export Data</h3>
               <button onClick={() => setShowExportModal(false)} className="text-gray-500 hover:text-gray-700">
                 <X className="w-6 h-6" />
               </button>
             </div>
             
             <div className="space-y-3">
               {/* PDF Export Button */}
               <button
                  onClick={() => {
                    const url = `${api.defaults.baseURL}/events/${selectedEvent.id}/export-pdf`;
                    window.open(url, '_blank');
                    setShowExportModal(false);
                  }}
                  className="w-full p-4 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg text-left transition flex items-center justify-between mb-4"
               >
                 <div>
                    <div className="font-semibold text-teal-900 flex items-center gap-2">
                        <FileText className="w-5 h-5" /> Download Results PDF
                    </div>
                    <div className="text-sm text-teal-700">Formal report with rankings & stats</div>
                 </div>
                 <Download className="w-5 h-5 text-teal-700" />
               </button>

               {/* Export All */}
               <button
                  onClick={() => {
                    const allP = players.filter(p => p.composite_score != null);
                    if(allP.length === 0) return;
                    const headers = ['Rank', 'Name', 'Number', 'Age Group', 'Composite Score', ...allDrills.map(d => d.label)];
                    const data = allP.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0)).map((p, i) => [
                      i + 1, p.name, p.number, p.age_group, (p.composite_score||0).toFixed(2), ...allDrills.map(d => p[d.key])
                    ]);
                    exportCsv(data, `rankings_all_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers);
                    setShowExportModal(false);
                  }}
                  disabled={players.filter(p => p.composite_score != null).length === 0}
                  className="w-full p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition disabled:opacity-50"
               >
                 <div className="font-semibold text-blue-900">Export All Players</div>
                 <div className="text-sm text-blue-700">Complete CSV with all age groups</div>
               </button>

               <div className="border-t border-gray-100 my-3"></div>
               <p className="text-sm text-gray-500 mb-2">By Age Group:</p>

               {Object.keys(grouped).map(group => {
                 const groupP = grouped[group].filter(p => p.composite_score != null);
                 return (
                   <button
                      key={group}
                      disabled={groupP.length === 0}
                      onClick={() => {
                         const headers = ['Rank', 'Name', 'Number', 'Composite Score', ...allDrills.map(d => d.label)];
                         const data = groupP.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0)).map((p, i) => [
                            i + 1, p.name, p.number, (p.composite_score||0).toFixed(2), ...allDrills.map(d => p[d.key])
                         ]);
                         exportCsv(data, `rankings_${group}_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers);
                         setShowExportModal(false);
                      }}
                      className="w-full p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-left transition flex justify-between items-center disabled:opacity-50"
                   >
                     <span className="font-medium text-gray-700">{group}</span>
                     <span className="text-xs text-gray-500">{groupP.length} scores</span>
                   </button>
                 );
               })}
               
               {Object.keys(grouped).length === 0 && <div className="text-center text-gray-400 text-sm py-4">No player data available.</div>}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
