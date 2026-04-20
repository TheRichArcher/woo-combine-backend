import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Skeleton from '../components/Skeleton';
import { Link, useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { usePlayerDetails } from '../context/PlayerDetailsContext';
import { ArrowLeft, Users, Target, Settings, Plus, BarChart3, TrendingUp, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import api from '../lib/api';
// PERFORMANCE OPTIMIZATION: Add caching and optimized scoring for LiveStandings
import { withCache } from '../utils/dataCache';
import { logger } from '../utils/logger';
import { calculateOptimizedRankings, calculateOptimizedRankingsAcrossAll } from '../utils/optimizedScoring';
import { getDrillsFromTemplate, getPresetsFromTemplate } from '../constants/drillTemplates';
import { readViewerInviteEventContext, VIEWER_INVITE_EVENT_CONTEXT_KEY } from '../lib/viewerInviteContext';
import { formatViewerPlayerName } from '../utils/playerDisplayName';

const isQrDebugEnabled = () => {
  try {
    return localStorage.getItem('debug_qr_flow') === '1';
  } catch {
    return false;
  }
};

const qrLiveDebug = (message, payload) => {
  if (!isQrDebugEnabled()) return;
  console.log(`[QR_FLOW][LiveStandings] ${message}`, payload);
};

const parseJsonSafe = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export default function LiveStandings() {
  const { selectedEvent: selectedEventFromContext, setSelectedEvent, events, setEvents } = useEvent();
  const { userRole, selectedLeagueId, setSelectedLeagueId } = useAuth();
  const navigate = useNavigate();
  const debugEnabled = isQrDebugEnabled();
  const shouldAttemptViewerInviteRestore = !selectedEventFromContext;
  let viewerInviteContextRaw = null;
  try {
    viewerInviteContextRaw = localStorage.getItem(VIEWER_INVITE_EVENT_CONTEXT_KEY);
  } catch {
    viewerInviteContextRaw = null;
  }
  const viewerInviteContext = shouldAttemptViewerInviteRestore ? readViewerInviteEventContext() : null;
  const restoredViewerEvent = viewerInviteContext?.event || null;
  const selectedEvent = selectedEventFromContext || restoredViewerEvent;
  const [activeSchema, setActiveSchema] = useState(null);
  const [viewerRestoreDebug, setViewerRestoreDebug] = useState({
    ran: false,
    result: 'not-run',
    skipReason: ''
  });
  const setViewerRestoreDebugSafe = useCallback((nextState) => {
    setViewerRestoreDebug((prev) => {
      if (
        prev.ran === nextState.ran &&
        prev.result === nextState.result &&
        prev.skipReason === nextState.skipReason
      ) {
        return prev;
      }
      return nextState;
    });
  }, []);

  useEffect(() => {
    if (selectedEventFromContext) {
      qrLiveDebug('Viewer invite restore skipped (selectedEvent already in context)', {
        selectedEventFromContextId: selectedEventFromContext?.id || null
      });
      setViewerRestoreDebugSafe({
        ran: true,
        result: 'skipped',
        skipReason: 'selectedEvent already exists in context'
      });
      return;
    }
    if (!viewerInviteContextRaw) {
      qrLiveDebug('Viewer invite restore skipped (storage key missing/empty)', {
        storageKey: VIEWER_INVITE_EVENT_CONTEXT_KEY,
        storageRaw: viewerInviteContextRaw
      });
      setViewerRestoreDebugSafe({
        ran: true,
        result: 'skipped',
        skipReason: `${VIEWER_INVITE_EVENT_CONTEXT_KEY} is missing/empty`
      });
      return;
    }
    if (!viewerInviteContext) {
      qrLiveDebug('Viewer invite restore skipped (storage payload parse failed)', {
        storageKey: VIEWER_INVITE_EVENT_CONTEXT_KEY,
        storageRaw: viewerInviteContextRaw
      });
      setViewerRestoreDebugSafe({
        ran: true,
        result: 'skipped',
        skipReason: `${VIEWER_INVITE_EVENT_CONTEXT_KEY} parse failed`
      });
      return;
    }
    if (!restoredViewerEvent?.id) {
      qrLiveDebug('Viewer invite restore skipped (parsed payload missing event.id)', {
        storageKey: VIEWER_INVITE_EVENT_CONTEXT_KEY,
        parsedPayload: viewerInviteContext
      });
      setViewerRestoreDebugSafe({
        ran: true,
        result: 'skipped',
        skipReason: 'parsed invite payload missing event.id'
      });
      return;
    }

    qrLiveDebug('Viewer invite restore evaluation', {
      storageKey: VIEWER_INVITE_EVENT_CONTEXT_KEY,
      storageRaw: viewerInviteContextRaw,
      parsedPayload: viewerInviteContext,
      selectedEventFromContextId: selectedEventFromContext?.id || null
    });
    qrLiveDebug('Restoring selectedEvent from viewer invite context', {
      restoredEventId: restoredViewerEvent.id,
      restoredLeagueId: restoredViewerEvent.league_id || viewerInviteContext?.leagueId || null
    });
    setSelectedEvent(restoredViewerEvent);
    qrLiveDebug('setSelectedEvent(restoredViewerEvent) fired', {
      restoredEventId: restoredViewerEvent.id
    });
    setViewerRestoreDebugSafe({
      ran: true,
      result: 'restored successfully',
      skipReason: ''
    });
    if (!Array.isArray(events) || !events.some(e => e?.id === restoredViewerEvent.id)) {
      setEvents(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        if (safePrev.some(e => e?.id === restoredViewerEvent.id)) return safePrev;
        return [restoredViewerEvent, ...safePrev];
      });
    }
    const inviteLeagueId = viewerInviteContext?.leagueId || restoredViewerEvent?.league_id || null;
    if (inviteLeagueId && selectedLeagueId !== inviteLeagueId) {
      qrLiveDebug('Correcting selectedLeagueId from invite context', {
        previousSelectedLeagueId: selectedLeagueId || null,
        inviteLeagueId
      });
      setSelectedLeagueId(inviteLeagueId);
    }
  }, [
    selectedEventFromContext,
    viewerInviteContextRaw,
    restoredViewerEvent,
    viewerInviteContext,
    setSelectedEvent,
    events,
    setEvents,
    selectedLeagueId,
    setSelectedLeagueId,
    setViewerRestoreDebugSafe
  ]);

  let joinStageRaw = '';
  let lastContextClearRaw = '';
  let lastRedirectReasonRaw = '';
  try {
    joinStageRaw = localStorage.getItem('debug_qr_join_stage') || '';
    lastContextClearRaw = localStorage.getItem('debug_qr_last_context_clear') || '';
    lastRedirectReasonRaw = localStorage.getItem('debug_qr_last_redirect_reason') || '';
  } catch {
    // ignore storage failures
  }

  const joinStageParsed = parseJsonSafe(joinStageRaw);
  const lastContextClearParsed = parseJsonSafe(lastContextClearRaw);
  const lastRedirectReasonParsed = parseJsonSafe(lastRedirectReasonRaw);
  
  // Fetch schema for active event
  useEffect(() => {
    if (selectedEvent?.drillTemplate) {
      const fetchSchema = async () => {
        try {
          const res = await api.get(`/sports/${selectedEvent.drillTemplate}/schema`);
          if (res.data) {
            setActiveSchema(res.data);
          }
        } catch (err) {
          console.warn("Failed to fetch schema:", err);
        }
      };
      fetchSchema();
    }
  }, [selectedEvent?.drillTemplate]);

  // Compute drills
  const allDrills = useMemo(() => {
    if (!selectedEvent) return [];
    
    let baseDrills = [];
    if (activeSchema && activeSchema.drills) {
      // Use fetched schema
      baseDrills = activeSchema.drills.map(d => ({
        key: d.key,
        label: d.label,
        unit: d.unit,
        lowerIsBetter: d.lower_is_better,
        category: d.category,
        min: d.min_value,
        max: d.max_value,
        defaultWeight: d.default_weight
      }));
    } else {
      // Fallback to local templates
      baseDrills = getDrillsFromTemplate(selectedEvent.drillTemplate);
    }

    const disabled = selectedEvent.disabled_drills || [];
    const templateDrills = baseDrills.filter(d => !disabled.includes(d.key));
    
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
  }, [selectedEvent, activeSchema]);

  // Compute presets
  const currentPresets = useMemo(() => {
    if (activeSchema && activeSchema.presets) {
      return activeSchema.presets;
    }
    return getPresetsFromTemplate(selectedEvent?.drillTemplate) || {};
  }, [activeSchema, selectedEvent]);
  
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState({});
  const [activePreset, setActivePreset] = useState('balanced');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('ALL');
  const [normalizeAcrossAll, setNormalizeAcrossAll] = useState(true);
  const [displayCount, setDisplayCount] = useState(10); // Default to 10
  const { selectedPlayer, openDetails, closeDetails } = usePlayerDetails();
  const [showControls, setShowControls] = useState(false);
  const [showCompactSliders, setShowCompactSliders] = useState(false);

  useEffect(() => {
    let selectedEventRaw = null;
    let selectedLeagueId = null;
    try {
      selectedEventRaw = localStorage.getItem('selectedEvent');
      selectedLeagueId = localStorage.getItem('selectedLeagueId');
    } catch {
      // ignore storage failures in strict browser modes
    }

    qrLiveDebug('Render snapshot', {
      pathname: window.location.pathname,
      selectedEventId: selectedEvent?.id || null,
      selectedEventLeagueId: selectedEvent?.league_id || null,
      selectedEventFromContextId: selectedEventFromContext?.id || null,
      selectedLeagueId: selectedLeagueId || null,
      selectedEventRaw,
      restoredViewerEventId: restoredViewerEvent?.id || null,
      viewerInviteStorageKey: VIEWER_INVITE_EVENT_CONTEXT_KEY,
      viewerInviteStorageRaw: viewerInviteContextRaw,
      viewerInviteParsed: viewerInviteContext || null
    });
  }, [selectedEvent, selectedEventFromContext, restoredViewerEvent, viewerInviteContextRaw, viewerInviteContext]);

  // Initialize weights when drills change
  useEffect(() => {
    if (allDrills.length > 0) {
        const initialWeights = {};
        allDrills.forEach(drill => {
            // Use default weight from schema if available (scale to 0-100)
            const def = drill.defaultWeight !== undefined ? drill.defaultWeight : 0;
            initialWeights[drill.key] = def <= 1 ? def * 100 : def;
        });
        setWeights(initialWeights);
    }
  }, [allDrills]); 

  // PERFORMANCE OPTIMIZATION: Cached fetch for LiveStandings
  const cachedFetchPlayersLive = withCache(
    async (eventId) => {
      const response = await api.get(`/players?event_id=${eventId}`);
      return response.data || [];
    },
    'live-players',
    15 * 1000 // 15s cache for live rankings data
  );

  const isFetchingRef = React.useRef(false);

  // Fetch players
  const fetchPlayers = useCallback(async (isBackground = false) => {
    if (!selectedEvent) return;
    if (isBackground && isFetchingRef.current) return; // Prevent stacking
    
    try {
      isFetchingRef.current = true;
      if (!isBackground) setLoading(true); // Only show skeleton on first load/manual refresh
      const playersData = await cachedFetchPlayersLive(selectedEvent.id);
      setPlayers(playersData);
    } catch (error) {
      logger.error('LIVE_STANDINGS', 'Failed to fetch players', error);
      if (!isBackground) setPlayers([]);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [selectedEvent]);

  useEffect(() => {
    fetchPlayers();

    // Auto-refresh every 30 seconds to keep standings live
    const intervalId = setInterval(() => {
      fetchPlayers(true);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [fetchPlayers]);

  // PERFORMANCE OPTIMIZATION: Use optimized rankings calculation
  const ageGroups = useMemo(() => {
    const groups = new Set();
    players.forEach(p => { if (p.age_group) groups.add(p.age_group); });
    return ['ALL', ...Array.from(groups).sort()];
  }, [players]);

  const filteredPlayers = useMemo(() => {
    if (selectedAgeGroup === 'ALL') return players;
    return players.filter(p => p.age_group === selectedAgeGroup);
  }, [players, selectedAgeGroup]);

  const liveRankings = useMemo(() => {
    if (!filteredPlayers.length) return [];
    const source = normalizeAcrossAll && selectedAgeGroup === 'ALL'
      ? calculateOptimizedRankingsAcrossAll(filteredPlayers, weights, allDrills)
      : calculateOptimizedRankings(filteredPlayers, weights, allDrills);
    // Include players even if composite score is 0 so the dropdown represents a max, not a minimum
    return source;
  }, [filteredPlayers, weights, normalizeAcrossAll, selectedAgeGroup, allDrills]);

  const displayLimit = useMemo(() => (displayCount === -1 ? liveRankings.length : displayCount), [displayCount, liveRankings.length]);

  // Handle weight changes
  const handleWeightChange = (drillKey, value) => {
    setWeights(prev => ({ ...prev, [drillKey]: value }));
    setActivePreset(''); // Clear preset when manually adjusting
  };

  // Apply preset weights
  const applyPreset = (presetKey) => {
    if (currentPresets[presetKey]) {
      const newWeights = {};
      Object.entries(currentPresets[presetKey].weights).forEach(([key, value]) => {
        newWeights[key] = value * 100; // Convert to percentage
      });
      setWeights(newWeights);
      setActivePreset(presetKey);
    }
  };

  if (!selectedEvent) {
    qrLiveDebug('No selectedEvent at render-time fallback', {
      pathname: window.location.pathname
    });
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Event Selected</h2>
          <p className="text-gray-600 mb-4">Please select an event to view standings.</p>
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-700 underline">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {debugEnabled && (
        <div className="fixed top-2 left-2 z-[10000] max-w-md w-[95vw] bg-yellow-200 text-black border-2 border-red-600 p-3 text-xs font-mono shadow-2xl">
          <div className="font-bold text-sm mb-1">QR DEBUG PANEL (LIVE STANDINGS)</div>
          <div>userRole: {String(userRole || 'null')}</div>
          <div>selectedLeagueId: {String(selectedLeagueId || 'null')}</div>
          <div>selectedEvent.id: {String(selectedEvent?.id || 'null')}</div>
          <div>selectedEvent.name: {String(selectedEvent?.name || 'null')}</div>
          <div className="mt-1 font-bold">{VIEWER_INVITE_EVENT_CONTEXT_KEY} (raw):</div>
          <div className="whitespace-pre-wrap break-all">{viewerInviteContextRaw || 'null'}</div>
          <div className="mt-1">viewer restore logic ran: {viewerRestoreDebug.ran ? 'yes' : 'no'}</div>
          <div>restore result: {viewerRestoreDebug.result}</div>
          <div>skip reason: {viewerRestoreDebug.skipReason || 'n/a'}</div>
          <div className="mt-1">last context clear reason: {lastContextClearParsed?.reason || 'n/a'}</div>
          <div className="whitespace-pre-wrap break-all">last context clear raw: {lastContextClearRaw || 'null'}</div>
          <div className="mt-1">last redirect reason: {lastRedirectReasonParsed?.reason || 'n/a'}</div>
          <div className="whitespace-pre-wrap break-all">last redirect raw: {lastRedirectReasonRaw || 'null'}</div>
          <div className="mt-1">join stage: {joinStageParsed?.stage || 'n/a'}</div>
          <div className="whitespace-pre-wrap break-all">join stage raw: {joinStageRaw || 'null'}</div>
        </div>
      )}
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
             <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
               <ArrowLeft className="w-6 h-6" />
             </Link>
             <div className="flex items-center gap-2">
               <Link
                 to="/players?tab=analyze"
                 className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition"
                 aria-label="Customize weights"
                 title="Customize scoring weights"
               >
                 <Settings className="w-5 h-5 text-gray-600" />
               </Link>
               <div 
                 className="text-xs bg-semantic-success/10 text-semantic-success px-3 py-1 rounded-full font-medium cursor-help"
                 title="Standings auto-refresh every 30 seconds"
               >
                 ✨ Live Updates
               </div>
             </div>
          </div>
          
          <h1 className="text-2xl font-bold text-cmf-secondary mb-2">
            Live Standings
          </h1>
          <p className="text-gray-600 mb-4">{selectedEvent.name}</p>
          
          {/* Age Group Pills */}
          {ageGroups.length > 1 && (
            <div className="mb-4">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {ageGroups.map((g) => {
                  const active = selectedAgeGroup === g;
                  const label = g === 'ALL' ? 'All Ages' : g;
                  return (
                    <button
                      key={g}
                      onClick={() => setSelectedAgeGroup(g)}
                      className={
                        'whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-semibold border transition ' +
                        (active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500">Filter rankings by age group.</div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            {(userRole === 'organizer' || userRole === 'coach') && (
              <Link
                to="/live-entry"
                className="flex items-center justify-center gap-2 p-3 bg-semantic-success/10 hover:bg-semantic-success/20 rounded-xl border border-semantic-success/20 transition text-semantic-success font-medium"
              >
                <Target className="w-4 h-4" />
                <span>Record</span>
              </Link>
            )}
            <Link
              to="/players/rankings"
              className={`flex items-center justify-center gap-2 p-3 bg-brand-light/20 hover:bg-brand-light/30 rounded-xl border border-brand-primary/20 transition text-brand-secondary font-medium ${(userRole === 'organizer' || userRole === 'coach') ? '' : 'col-span-2'}`}
            >
              <Users className="w-4 h-4 text-brand-primary" />
              <span>Players</span>
            </Link>
          </div>
        </div>

        {/* Controls & Filters (Collapsible) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
           <button 
            onClick={() => setShowControls(!showControls)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="font-semibold text-gray-900 flex items-center gap-2">
              {showControls ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              Ranking Controls
            </span>
            {!showControls && <span className="text-xs text-gray-500">Tap to adjust weights</span>}
          </button>
          
          {showControls && (
            <div className="p-4 border-t border-gray-200">
              <div className="mb-4">
                  {ageGroups.length > 1 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Age Group</div>
                      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {ageGroups.map((g) => {
                          const active = selectedAgeGroup === g;
                          const label = g === 'ALL' ? 'All Ages' : g;
                          return (
                            <button
                              key={g}
                              onClick={() => setSelectedAgeGroup(g)}
                              className={
                                'whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-semibold border transition ' +
                                (active
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
                              }
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-2 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={normalizeAcrossAll}
                      onChange={(e) => setNormalizeAcrossAll(e.target.checked)}
                      className="rounded text-brand-primary focus:ring-brand-primary"
                    />
                    <span>Normalize scores across all players</span>
                  </label>
              </div>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(currentPresets).map(([key, preset]) => (
                  <button 
                    key={key}
                    onClick={() => applyPreset(key)} 
                    className={`p-3 text-left rounded-lg border transition-all ${
                      activePreset === key 
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-secondary' 
                        : 'border-gray-200 hover:border-brand-primary/50 bg-white text-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{preset.name}</div>
                  </button>
                ))}
              </div>

               {/* Weight Sliders */}
               <button
                  onClick={() => setShowCompactSliders((v) => !v)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium mb-3"
                >
                  {showCompactSliders ? 'Hide Advanced Weights' : 'Show Advanced Weights'}
                </button>

                {showCompactSliders && (
                    <div className="space-y-4 bg-gray-50 p-3 rounded-lg">
                        {allDrills.map((drill) => (
                        <div key={drill.key}>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-gray-700">{drill.label}</span>
                                <span className="text-brand-primary font-mono">{Math.round(weights[drill.key] || 0)}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={weights[drill.key] || 0}
                                onChange={(e) => handleWeightChange(drill.key, parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                            />
                        </div>
                        ))}
                    </div>
                )}
            </div>
          )}
        </div>

        {/* Live Rankings List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
             <h2 className="font-semibold text-gray-900 flex items-center gap-2">
               <TrendingUp className="w-5 h-5 text-brand-primary" />
               Current Standings
             </h2>
             <select
                value={displayCount === -1 ? 'all' : String(displayCount)}
                onChange={(e) => setDisplayCount(e.target.value === 'all' ? -1 : parseInt(e.target.value, 10))}
                className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded-lg"
              >
                <option value="10">Top 10</option>
                <option value="25">Top 25</option>
                <option value="50">Top 50</option>
                <option value="all">Show All</option>
              </select>
          </div>

          <div className="p-2">
            {loading ? (
                <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
                </div>
            ) : liveRankings.length === 0 ? (
                <div className="text-center py-12">
                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-medium mb-1">No Rankings Yet</h3>
                <p className="text-sm text-gray-500">
                    Start recording drill results to see live standings
                </p>
                </div>
            ) : (
                <div className="space-y-2">
                {liveRankings.slice(0, displayLimit).map((player, index) => (
                    <div 
                    key={player.id} 
                    onClick={() => openDetails(player, {
                      allPlayers: filteredPlayers,
                      persistedWeights: weights,
                      sliderWeights: weights,
                      persistSliderWeights: setWeights,
                      handleWeightChange,
                      activePreset,
                      applyPreset,
                      drills: allDrills,
                      presets: currentPresets,
                      normalizeAcrossAll: normalizeAcrossAll && selectedAgeGroup === 'ALL',
                      suppressGlobalModal: false
                    })}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                        index === 0 ? 'bg-yellow-50 border-yellow-200' :
                        index === 1 ? 'bg-gray-50 border-gray-200' :
                        index === 2 ? 'bg-orange-50 border-orange-200' :
                        'bg-white border-gray-100 hover:bg-gray-50'
                    }`}
                    >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold shadow-sm ${
                        index === 0 ? 'bg-yellow-400 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-400 text-white' :
                        'bg-gray-100 text-gray-500'
                        }`}>
                        {index + 1}
                        </div>
                        <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{formatViewerPlayerName(player, userRole)}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                             {player.number != null && player.number !== '' && <span>#{player.number}</span>}
                             {player.age_group && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">{player.age_group}</span>}
                        </div>
                        </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0 pl-2">
                        <div className="font-bold text-brand-primary text-lg">
                            {(player.compositeScore || 0).toFixed(1)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Score</div>
                    </div>
                    </div>
                ))}
                
                {liveRankings.length > displayLimit && (
                    <button 
                        onClick={() => setDisplayCount(prev => prev + 10)}
                        className="w-full py-3 text-sm text-brand-primary font-medium hover:bg-brand-primary/5 rounded-lg transition"
                    >
                        Show More
                    </button>
                )}
                </div>
            )}
          </div>
        </div>

        {/* Access to Advanced Features */}
        {(userRole === 'organizer' || userRole === 'coach') && liveRankings.length >= 3 && (
          <div className="mt-6 bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-brand-secondary bg-white p-2 rounded-lg border border-brand-primary/10 shadow-sm">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-brand-secondary mb-1">Advanced Tools</h3>
                <p className="text-gray-600 text-sm mb-3">
                  You have enough data to use advanced features
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/team-formation"
                    className="text-xs bg-white text-center text-brand-secondary px-3 py-2 rounded-lg border border-brand-secondary/20 hover:bg-brand-secondary/5 transition font-medium"
                  >
                    Create Teams
                  </Link>
                  <Link
                    to="/analytics"
                    className="text-xs bg-white text-center text-brand-secondary px-3 py-2 rounded-lg border border-brand-secondary/20 hover:bg-brand-secondary/5 transition font-medium"
                  >
                    Full Analytics
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Share / Export */}
        <div className="mt-6 space-y-2">
          <button
            onClick={async () => {
              const url = window.location.href;
              try {
                if (navigator.share) {
                  await navigator.share({ title: 'WooCombine Rankings', url });
                } else {
                  await navigator.clipboard.writeText(url);
                  alert('Link copied to clipboard');
                }
              } catch (e) {
                // ignore cancellation
              }
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition shadow"
          >
            Share Rankings
          </button>
          <button
            onClick={() => {
              const url = api.defaults.baseURL + '/events/' + selectedEvent.id + '/export-pdf';
              window.open(url, '_blank');
            }}
            className="w-full bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 rounded-xl transition border border-gray-200"
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}