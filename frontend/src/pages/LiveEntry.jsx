import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from '../lib/api';
import { Clock, Users, Undo2, CheckCircle, AlertTriangle, ArrowLeft, Calendar, ChevronDown, Target, Info, Lock, LockOpen, StickyNote } from 'lucide-react';
import { getDrillsFromTemplate } from '../constants/drillTemplates';
import { Link, useLocation } from 'react-router-dom';
import { cacheInvalidation } from '../utils/dataCache';


export default function LiveEntry() {
  const { selectedEvent, setSelectedEvent } = useEvent();
  const { userRole } = useAuth();
  const { showError, showSuccess } = useToast();
  const location = useLocation();

  // Refresh event data on mount to ensure drill template is up to date
  useEffect(() => {
    if (selectedEvent?.id && selectedEvent?.league_id) {
      const fetchFreshEvent = async () => {
        try {
          const response = await api.get(`/leagues/${selectedEvent.league_id}/events/${selectedEvent.id}`);
          const freshEvent = response.data;
          
          // Only update if critical fields differ to avoid unnecessary context updates
          if (freshEvent.drillTemplate !== selectedEvent.drillTemplate || 
              freshEvent.name !== selectedEvent.name ||
              JSON.stringify(freshEvent.custom_drills) !== JSON.stringify(selectedEvent.custom_drills)) {
             setSelectedEvent(freshEvent);
          }
        } catch (error) {
          // Silent failure is acceptable here, falls back to context data
          console.warn("Background event refresh failed:", error);
        }
      };
      fetchFreshEvent();
    }
  }, [selectedEvent?.id, selectedEvent?.league_id, setSelectedEvent]);

  // Get drills from event template and custom drills
  const drills = useMemo(() => {
    if (!selectedEvent) return [];
    
    // 1. Get standard drills from template
    const templateDrills = getDrillsFromTemplate(selectedEvent.drillTemplate || 'football');
    
    // 2. Get custom drills from event data
    // Note: backend returns snake_case fields, but we normalize for UI
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
  
  // Core state
  const [selectedDrill, setSelectedDrill] = useState("");
  const [drillConfirmed, setDrillConfirmed] = useState(false);
  const [playerNumber, setPlayerNumber] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [score, setScore] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Players data for auto-complete
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  
  // Entry tracking
  const [recentEntries, setRecentEntries] = useState([]);
  const [duplicateData, setDuplicateData] = useState(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editValues, setEditValues] = useState({}); // {entryId: value}
  const [savingEditId, setSavingEditId] = useState(null);
  const [editNotes, setEditNotes] = useState({}); // {entryId: note}
  
  // Optional note per score
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  
  // Per-drill lock state and review dismissals (client-side only)
  const [lockedDrills, setLockedDrills] = useState({}); // { drillKey: true }
  const [reviewDismissed, setReviewDismissed] = useState({}); // { drillKey: true }
  const [showDrillHint, setShowDrillHint] = useState(false);
  
  // Refs for auto-focus
  const playerNumberRef = useRef(null);
  const scoreRef = useRef(null);
  
  const fetchPlayers = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      const response = await api.get(`/players?event_id=${selectedEvent.id}`);
      setPlayers(response.data);
          } catch {
        // Player fetch failed
    }
  }, [selectedEvent]);

  // Local storage keys (per event)
  const storageKeys = useMemo(() => {
    if (!selectedEvent) return null;
    return {
      drill: `liveEntry:${selectedEvent.id}:selectedDrill`,
      entries: `liveEntry:${selectedEvent.id}:recentEntries`,
      checklist: `liveEntry:${selectedEvent.id}:checklistDismissed`,
      focus: `liveEntry:${selectedEvent.id}:lastPlayerNumber`,
      locks: `liveEntry:${selectedEvent.id}:locks`,
      reviews: `liveEntry:${selectedEvent.id}:reviewDismissed`,
      drillHint: `liveEntry:${selectedEvent.id}:drillHintShown`
    };
  }, [selectedEvent]);

  // Load persisted state
  useEffect(() => {
    if (!storageKeys) return;
    
    // Reset transient state whenever event/keys change
    setScore("");
    setPlayerName("");
    setPlayerId("");
    setDuplicateData(null);
    setShowDuplicateDialog(false);

    try {
      const savedDrill = localStorage.getItem(storageKeys.drill);
      if (savedDrill) {
        setSelectedDrill(savedDrill);
        setDrillConfirmed(!!savedDrill);
      } else {
        // Important: Reset if no saved drill for this specific event
        setSelectedDrill("");
        setDrillConfirmed(false);
      }
    } catch {}
    try {
      const savedEntries = localStorage.getItem(storageKeys.entries);
      if (savedEntries) {
        const parsed = JSON.parse(savedEntries);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map(e => ({
            ...e,
            timestamp: e.timestamp ? new Date(e.timestamp) : new Date()
          }));
          setRecentEntries(normalized);
        }
      } else {
        setRecentEntries([]);
      }
    } catch {}
    try {
      const savedChecklist = localStorage.getItem(storageKeys.checklist);
      if (savedChecklist === '1') {
        setChecklistDismissed(true);
      } else {
        setChecklistDismissed(false);
      }
    } catch {}
    try {
      const savedFocus = localStorage.getItem(storageKeys.focus);
      if (savedFocus) {
        setPlayerNumber(savedFocus);
      } else {
        setPlayerNumber("");
      }
    } catch {}
    try {
      const savedLocks = localStorage.getItem(storageKeys.locks);
      if (savedLocks) {
        const parsed = JSON.parse(savedLocks);
        if (parsed && typeof parsed === 'object') setLockedDrills(parsed);
      } else {
        setLockedDrills({});
      }
    } catch {}
    try {
      const savedReviews = localStorage.getItem(storageKeys.reviews);
      if (savedReviews) {
        const parsed = JSON.parse(savedReviews);
        if (parsed && typeof parsed === 'object') setReviewDismissed(parsed);
      } else {
        setReviewDismissed({});
      }
    } catch {}
    try {
      const hintFlag = localStorage.getItem(storageKeys.drillHint);
      if (hintFlag !== '1') {
        setShowDrillHint(true);
      } else {
        setShowDrillHint(false);
      }
    } catch {}
  }, [storageKeys]);

  // Deep-link handling (?player=123&drill=40m_dash)
  useEffect(() => {
    if (!selectedEvent) return;
    const params = new URLSearchParams(location.search);
    const drillParam = params.get('drill');
    const playerParam = params.get('player');
    let applied = false;
    if (drillParam && drills.some(d => d.key === drillParam)) {
      setSelectedDrill(drillParam);
      setDrillConfirmed(true);
      applied = true;
    }
    if (playerParam) {
      setPlayerNumber(playerParam.toString());
      applied = true;
    }
    if (applied) {
      setTimeout(() => {
        if (playerParam) {
          // focus score after auto-complete resolves
          scoreRef.current?.focus();
        } else {
          playerNumberRef.current?.focus();
        }
      }, 200);
    }
    // run once per navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, location.search, players.length]);

  // Persist selected drill
  useEffect(() => {
    if (!storageKeys) return;
    try {
      if (selectedDrill) {
        localStorage.setItem(storageKeys.drill, selectedDrill);
      } else {
        localStorage.removeItem(storageKeys.drill);
      }
    } catch {}
  }, [storageKeys, selectedDrill]);

  // Clear score when drill changes
  useEffect(() => {
    setScore("");
  }, [selectedDrill]);

  // Persist recent entries (last 10)
  useEffect(() => {
    if (!storageKeys) return;
    try {
      localStorage.setItem(storageKeys.entries, JSON.stringify(recentEntries.slice(0, 10)));
    } catch {}
  }, [storageKeys, recentEntries]);

  // Persist last focused player number
  useEffect(() => {
    if (!storageKeys) return;
    try {
      if (playerNumber) {
        localStorage.setItem(storageKeys.focus, playerNumber);
      } else {
        localStorage.removeItem(storageKeys.focus);
      }
    } catch {}
  }, [storageKeys, playerNumber]);

  // Persist locks and review dismissals
  useEffect(() => {
    if (!storageKeys) return;
    try { localStorage.setItem(storageKeys.locks, JSON.stringify(lockedDrills)); } catch {}
  }, [storageKeys, lockedDrills]);
  useEffect(() => {
    if (!storageKeys) return;
    try { localStorage.setItem(storageKeys.reviews, JSON.stringify(reviewDismissed)); } catch {}
  }, [storageKeys, reviewDismissed]);

  // Load players on mount
  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Auto-focus player number input when drill is confirmed
  useEffect(() => {
    if (selectedDrill && drillConfirmed) {
      setTimeout(() => {
        playerNumberRef.current?.focus();
      }, 100);
    }
  }, [selectedDrill, drillConfirmed]);

  // Keyboard shortcuts to switch drills when not typing
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!drillConfirmed || !selectedDrill) return;
      const target = e.target;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
      if (isTyping) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const idx = drills.findIndex(d => d.key === selectedDrill);
        if (idx === -1) return;
        const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % drills.length : (idx - 1 + drills.length) % drills.length;
        setSelectedDrill(drills[nextIdx].key);
        setDrillConfirmed(true);
        setTimeout(() => { playerNumberRef.current?.focus(); }, 100);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drillConfirmed, selectedDrill]);
  
  // Auto-complete logic
  useEffect(() => {
    if (playerNumber && players.length > 0) {
      const filtered = players.filter(p => 
        p.number && p.number.toString().startsWith(playerNumber)
      );
      
      // Auto-select if exact match and hide suggestions
      const exactMatch = players.find(p => p.number && p.number.toString() === playerNumber);
      if (exactMatch) {
        setPlayerName(exactMatch.name);
        setPlayerId(exactMatch.id);
        setFilteredPlayers([]);
      } else {
        setPlayerName("");
        setPlayerId("");
        setFilteredPlayers(filtered);
      }
    } else {
      setFilteredPlayers([]);
      setPlayerName("");
      setPlayerId("");
    }
  }, [playerNumber, players]);
  
  // Check for existing scores
  const checkForDuplicate = useCallback((targetPlayerId, targetDrill) => {
    const player = players.find(p => p.id === targetPlayerId);
    if (player && player[targetDrill] != null) {
      return {
        existingScore: player[targetDrill],
        playerName: player.name,
        drill: drills.find(d => d.key === targetDrill)
      };
    }
    return null;
  }, [players, drills]);
  
  // Handle score submission
  const attemptSubmit = async () => {
    if (!selectedDrill || !playerId || !score) return;
    if (lockedDrills[selectedDrill]) return; // locked: no submit
    
    // Validate score input before sending to backend
    const numericScore = parseFloat(score);
    if (isNaN(numericScore)) {
      showError("Please enter a valid number for the score.");
      scoreRef.current?.focus();
      return;
    }
    
    // Optional: Reject obvious typo cases like "4..5" or "abc" that might slip through some parsers
    if (!/^-?\d*\.?\d+$/.test(score.trim())) {
      showError("Please enter a valid numeric format.");
      scoreRef.current?.focus();
      return;
    }

    const duplicate = checkForDuplicate(playerId, selectedDrill);
    if (duplicate) {
      setDuplicateData({ ...duplicate, newScore: numericScore });
      setShowDuplicateDialog(true);
      return;
    }
    await submitScore();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await attemptSubmit();
  };
  
  const submitScore = async (overrideDuplicate = false) => {
    setLoading(true);
    
    try {
      const response = await api.post('/drill-results/', {
        player_id: playerId,
        type: selectedDrill,
        value: parseFloat(score),
        event_id: selectedEvent.id
      });
      
      // Add to recent entries
      const entry = {
        id: Date.now(),
        drillResultId: response.data.id, // Capture backend ID for undo
        playerId,
        playerNumber,
        playerName,
        drill: drills.find(d => d.key === selectedDrill),
        score: parseFloat(score),
        timestamp: new Date(),
        overridden: overrideDuplicate,
        note: note || ""
      };
      
      setRecentEntries(prev => [entry, ...prev.slice(0, 9)]); // Keep last 10
      
      // Reset form
      setPlayerNumber("");
      setScore("");
      setNote("");
      setShowNote(false);
      setShowDuplicateDialog(false);
      setDuplicateData(null);
      
      // Invalidate cache to ensure live standings update immediately
      cacheInvalidation.playersUpdated(selectedEvent.id);
      
      // Refresh players data
      await fetchPlayers();
      
      // Auto-focus back to player number
      setTimeout(() => {
        playerNumberRef.current?.focus();
      }, 100);
      
          } catch {
        // Score submission failed
      showError('Error submitting score. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUndo = async () => {
    if (recentEntries.length === 0) return;
    
    const lastEntry = recentEntries[0];
    if (confirm(`Undo entry for ${lastEntry.playerName}?`)) {
      // Perform true backend undo if we have the ID
      if (lastEntry.drillResultId) {
        try {
          await api.delete(`/drill-results/${lastEntry.drillResultId}?event_id=${selectedEvent.id}&player_id=${lastEntry.playerId}`);
          
          // Refresh data
          cacheInvalidation.playersUpdated(selectedEvent.id);
          fetchPlayers();
        } catch (error) {
          console.error("Undo failed:", error);
          showError("Failed to remove score from backend. Please try again.");
          return;
        }
      }
      
      setRecentEntries(prev => prev.slice(1));
      showSuccess('Entry undone');
    }
  };
  
  const selectPlayer = (player) => {
    setPlayerNumber(player.number.toString());
    setPlayerName(player.name);
    setPlayerId(player.id);
    setScore(""); // Clear score on explicit player selection to prevent phantom scores
    setFilteredPlayers([]);
    setTimeout(() => {
      scoreRef.current?.focus();
    }, 100);
  };

  const isCurrentDrillLocked = selectedDrill ? !!lockedDrills[selectedDrill] : false;
  const toggleCurrentDrillLock = () => {
    if (!selectedDrill) return;
    setLockedDrills(prev => ({ ...prev, [selectedDrill]: !prev[selectedDrill] }));
  };

  // Prevent scroll from changing numeric inputs
  const preventWheel = (e) => e.preventDefault();
  
  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md border-2 border-orange-200">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-orange-600 mb-4">No Event Selected</h1>
          <p className="text-gray-600 mb-6">You need to select an event before using Live Entry mode.</p>
          
          <div className="space-y-3">
            <Link to="/admin" className="block w-full">
              <div className="bg-brand-primary hover:opacity-90 text-white font-medium py-3 rounded-xl transition text-center">Go to Admin Tools</div>
            </Link>
            <Link 
              to="/dashboard" 
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition block"
            >
              Back to Dashboard
            </Link>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>Tip:</strong> Select an event from the header dropdown first, then return to Live Entry.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  const currentDrill = drills.find(d => d.key === selectedDrill);
  const totalPlayers = players.length;
  const completedForDrill = selectedDrill ? players.filter(p => p && p[selectedDrill] != null).length : 0;
  const completionPct = totalPlayers > 0 ? Math.round((completedForDrill / totalPlayers) * 100) : 0;
  const currentIndex = drills.findIndex(d => d.key === selectedDrill);
  const nextDrill = currentIndex >= 0 ? drills[(currentIndex + 1) % drills.length] : null;
  const missingPlayers = useMemo(() => {
    if (!selectedDrill) return [];
    return players.filter(p => p && (p[selectedDrill] == null || p[selectedDrill] === undefined));
  }, [players, selectedDrill]);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header (sticky) */}
            <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Live Entry Mode</h1>
              <p className="text-sm text-gray-600">{selectedEvent.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Drill selector - now visible on all screen sizes */}
            <div className="block">
              <select
                value={selectedDrill || ''}
                onChange={(e) => { setSelectedDrill(e.target.value); setDrillConfirmed(!!e.target.value); setTimeout(() => { playerNumberRef.current?.focus(); }, 100); }}
                className="p-2 border rounded-lg text-sm bg-white"
              >
                <option value="">Select drill…</option>
                {drills.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="font-semibold">{recentEntries.length} entries</span>
            </div>
                  {selectedDrill && (
                    <button
                      onClick={toggleCurrentDrillLock}
                      className={`text-xs px-3 py-1 rounded-lg flex items-center gap-1 border ${isCurrentDrillLocked ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                    >
                      {isCurrentDrillLocked ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
                      {isCurrentDrillLocked ? 'Locked' : 'Recording Active'}
                    </button>
                  )}
          </div>
        </div>
      </div>

      {/* Slim checklist banner */}
      {!checklistDismissed && (
        <div className="px-4">
          <div className="max-w-lg mx-auto mt-3 bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg p-3 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">Steps:</span>
              <span>1) Select a drill</span>
              <span>→ 2) Enter scores</span>
              <span>→ 3) View Rankings</span>
              {(!selectedDrill || !drillConfirmed) && (
                <span className="ml-2 text-yellow-800">Start here: Choose a drill</span>
              )}
            </div>
            <button
              onClick={() => { setChecklistDismissed(true); try { if (storageKeys) localStorage.setItem(storageKeys.checklist, '1'); } catch {} }}
              className="text-yellow-800 hover:text-yellow-900 text-xs px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      
      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Drill Selection */}
        {!selectedDrill || !drillConfirmed ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Select Drill</h2>
              <div className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Live Entry Mode
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6 text-center">
              Choose the drill you want to enter scores for during this live evaluation session.
            </p>

            {/* Start here callout */}
            <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-3 text-sm">
              <span className="font-medium">Start here:</span> Choose a drill to begin. You'll then enter scores by player number.
            </div>

            {/* Dropdown Selector */}
            <div className="relative mb-6">
              <select
                value={selectedDrill || ''}
                onChange={(e) => setSelectedDrill(e.target.value)}
                className="w-full p-3 pr-10 border-2 rounded-lg appearance-none bg-white text-left cursor-pointer transition-all duration-200 border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="" disabled>Select a drill to begin...</option>
                {drills.map((drill) => (
                  <option key={drill.key} value={drill.key}>
                    {drill.label} - {drill.unit} {drill.lowerIsBetter ? '(lower is better)' : '(higher is better)'}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            {/* Drill Preview - appears when drill is selected but not confirmed */}
            {selectedDrill && !drillConfirmed && (
              <div className="mt-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Target className="w-6 h-6 text-blue-600" />
                    <div>
                      <h4 className="text-lg font-bold text-blue-900">{currentDrill.label}</h4>
                      <p className="text-sm text-blue-700">Unit: {currentDrill.unit}</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-blue-600 ml-2" />
                  </div>
                </div>

                <div className="bg-white bg-opacity-70 rounded-lg p-3 border border-blue-200 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Scoring</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    {currentDrill.lowerIsBetter 
                      ? "⬇️ Lower scores are better (faster times, etc.)" 
                      : "⬆️ Higher scores are better (more points, distance, etc.)"
                    }
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedDrill("")}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                  >
                    Change Drill
                  </button>
                  <button
                    onClick={() => setDrillConfirmed(true)}
                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    Start Entry
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Active Drill Header */}
            <div className="bg-blue-500 text-white rounded-xl p-4 text-center">
              <h2 className="text-xl font-bold">{currentDrill.label}</h2>
              <p className="text-blue-100">Entry Mode Active</p>
              {/* Progress summary */}
              <div className="mt-2 text-sm">
                You've entered <span className="font-semibold">{completedForDrill}</span> / {totalPlayers} players ({completionPct}%).
              </div>
              <div className="mt-2 h-2 bg-blue-400/50 rounded-full overflow-hidden">
                <div className="h-full bg-white/80" style={{ width: `${Math.min(100, completionPct)}%` }} />
              </div>
              {/* Removed redundant "Change Drill" link; use drill pills/selector above */}
            </div>

            {/* Quick Drill Switcher */}
            <div className="mt-3 px-2">
              <div className="flex flex-wrap gap-2 justify-center">
                {drills.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => { setSelectedDrill(d.key); setDrillConfirmed(true); setTimeout(() => { playerNumberRef.current?.focus(); }, 100); }}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm border ${d.key === selectedDrill ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    aria-pressed={d.key === selectedDrill}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* One-time hint */}
            {showDrillHint && (
              <div className="mt-2 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-2 text-xs flex items-center justify-between">
                <span>Tip: Use the drill buttons above or ←/→ keys to switch drills.</span>
                <button
                  className="text-blue-700 hover:text-blue-900 underline ml-2"
                  onClick={() => { setShowDrillHint(false); try { if (storageKeys) localStorage.setItem(storageKeys.drillHint, '1'); } catch {} }}
                >
                  Got it
                </button>
              </div>
            )}

            {/* Review banner when complete */}
            {selectedDrill && completionPct === 100 && !reviewDismissed[selectedDrill] && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 flex items-center justify-between">
                <div className="text-sm font-medium">Drill Complete — Review?</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEditModal(true)} className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">Open Review</button>
                  <button
                    onClick={() => setReviewDismissed(prev => ({ ...prev, [selectedDrill]: true }))}
                    className="text-sm text-green-700 hover:text-green-900 underline"
                  >Dismiss</button>
                </div>
              </div>
            )}
            
            {/* Entry Form */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Player Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Player Number
                  </label>
                  <input
                    ref={playerNumberRef}
                    type="text"
                    inputMode="numeric"
                    value={playerNumber}
                    onChange={(e) => setPlayerNumber(e.target.value)}
                    onWheel={preventWheel}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (playerId) {
                          // Move to score field
                          e.preventDefault();
                          setTimeout(() => scoreRef.current?.focus(), 0);
                        }
                      }
                    }}
                    placeholder="Enter player #"
                    className="w-full text-2xl p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-center"
                    disabled={isCurrentDrillLocked}
                    autoFocus
                    required
                  />
                  
                  {/* Player Auto-complete */}
                  {filteredPlayers.length > 0 && !playerId && (
                    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                      {filteredPlayers.slice(0, 5).map(player => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => selectPlayer(player)}
                          className="w-full p-3 text-left hover:bg-blue-50 border-b border-gray-200 last:border-b-0"
                        >
                          <div className="font-medium">#{player.number} - {player.name}</div>
                          <div className="text-sm text-gray-600">{player.age_group}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Player Confirmation */}
                {playerName && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="font-medium text-green-900">{playerName}</div>
                        <div className="text-sm text-green-700">Player #{playerNumber}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Score Entry */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Score ({currentDrill.unit})
                  </label>
                  <input
                    ref={scoreRef}
                    type="text"
                    inputMode="decimal"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        await attemptSubmit();
                      }
                    }}
                    onWheel={(e) => e.preventDefault()}
                    placeholder={`Enter ${currentDrill.unit}`}
                    className="w-full text-3xl p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-center"
                    disabled={isCurrentDrillLocked}
                    required
                  />
                </div>

                {/* Optional note */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowNote((v) => !v)}
                    className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2"
                  >
                    <StickyNote className="w-4 h-4" /> {showNote ? 'Hide note' : 'Add note (optional)'}
                  </button>
                  {(showNote || note) && (
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g., tripped, fast start, minor injury"
                      className="mt-2 w-full p-3 border rounded-lg text-sm"
                      rows={2}
                      disabled={isCurrentDrillLocked}
                    />
                  )}
                </div>
                
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !playerId || !score || isCurrentDrillLocked}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold text-xl py-4 rounded-lg transition"
                >
                  {loading ? "Saving..." : "Submit & Next"}
                </button>
              </form>
            </div>
            
            {/* Action Buttons - Forward-looking flow */}
            <div className="flex gap-3 flex-wrap">
              <Link
                to="/live-standings"
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-lg transform hover:scale-[1.02]"
              >
                <Target className="w-5 h-5" />
                View Live Standings
              </Link>
              {/* Next Drill CTA at >=80% completion */}
              {selectedDrill && completionPct >= 80 && nextDrill && (
                <button
                  onClick={() => { setSelectedDrill(nextDrill.key); setDrillConfirmed(true); setTimeout(() => { playerNumberRef.current?.focus(); }, 100); }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition shadow"
                >
                  Next Drill → {nextDrill.label}
                </button>
              )}
              {recentEntries.length >= 3 && (userRole === 'organizer' || userRole === 'coach') && (
                <Link
                  to="/team-formation"
                  className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Users className="w-5 h-5" />
                  Create Teams
                </Link>
              )}
              {recentEntries.length > 0 && (
                <button
                  onClick={handleUndo}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Undo2 className="w-5 h-5" />
                  Undo
                </button>
              )}
            </div>
            
            {/* Recent Entries - Enhanced */}
            {recentEntries.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Recent Entries
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                      {recentEntries.length} recent
                    </span>
                <button
                  onClick={() => {
                    setShowEditModal(true);
                    const initial = {};
                    const initialNotes = {};
                    recentEntries.forEach(e => { 
                      initial[e.id] = String(e.score ?? '');
                      initialNotes[e.id] = e.note ?? '';
                    });
                    setEditValues(initial);
                    setEditNotes(initialNotes);
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Edit Recent
                </button>
                    <Link
                      to="/players/rankings"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All →
                    </Link>
                  </div>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {recentEntries.map(entry => (
                    <div key={entry.id} className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">#{entry.playerNumber} {entry.playerName}</div>
                        <div className="text-sm text-gray-700 flex items-center gap-2">
                          <span className="font-medium">{entry.drill.label}:</span>
                          <span className="bg-white px-2 py-1 rounded font-medium text-blue-900">
                            {entry.score} {entry.drill.unit}
                          </span>
                          {entry.overridden && <span className="text-orange-600 font-medium">(Updated)</span>}
                        </div>
                        {entry.note && (
                          <div className="text-xs text-gray-600 mt-1">Note: {entry.note}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        <div>{entry.timestamp.toLocaleTimeString()}</div>
                        <CheckCircle className="w-4 h-4 text-green-600 mx-auto mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Players remaining for this drill */}
            {selectedDrill && missingPlayers.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" /> Players Remaining
                  </h3>
                  <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-1">{missingPlayers.length} missing</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {missingPlayers.slice(0, 20).map(p => (
                    <div key={p.id} className="text-sm text-gray-500 flex items-center gap-2 opacity-80">
                      <span className="w-16">#{p.number || '—'}</span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-orange-600">Missing</span>
                    </div>
                  ))}
                  {missingPlayers.length > 20 && (
                    <div className="text-xs text-gray-400">+{missingPlayers.length - 20} more…</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Duplicate Score Dialog */}
      {showDuplicateDialog && duplicateData && (
        <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg font-bold text-gray-900">Existing Score Found</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                <strong>{duplicateData.playerName}</strong> already has a {duplicateData.drill.label} score:
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="text-lg font-medium">
                  Current: {duplicateData.existingScore} {duplicateData.drill.unit}
                </div>
                <div className="text-lg font-medium text-blue-600">
                  New: {duplicateData.newScore} {duplicateData.drill.unit}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDuplicateDialog(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg"
              >
                Keep Current
              </button>
              <button
                onClick={() => submitScore(true)}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg"
              >
                Replace Score
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recent Scores Modal (replace-only) */}
      {showEditModal && (
        <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit Recent Scores</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">Close</button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {recentEntries.slice(0, 10).map(entry => (
                <div key={entry.id} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">#{entry.playerNumber} {entry.playerName}</div>
                      <div className="text-sm text-gray-600">{entry.drill.label}</div>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editValues[entry.id] ?? ''}
                      onChange={(e) => setEditValues(prev => ({ ...prev, [entry.id]: e.target.value }))}
                      className="w-24 p-2 border rounded text-center"
                    />
                    <div className="text-sm text-gray-500 w-10 text-center">{entry.drill.unit}</div>
                    <button
                      disabled={savingEditId === entry.id}
                      onClick={async () => {
                        const newVal = parseFloat(editValues[entry.id]);
                        if (isNaN(newVal)) return;
                        try {
                          setSavingEditId(entry.id);
                          await api.post('/drill-results/', {
                            player_id: entry.playerId,
                            type: entry.drill.key,
                            value: newVal,
                            event_id: selectedEvent.id
                          });
                          // Update local recentEntries (including note if changed)
                          setRecentEntries(prev => prev.map(e => e.id === entry.id ? { ...e, score: newVal, overridden: true, note: editNotes[entry.id] ?? e.note } : e));
                          cacheInvalidation.playersUpdated(selectedEvent.id);
                          await fetchPlayers();
                        } catch {
                          showError('Error updating score. Please try again.');
                        } finally {
                          setSavingEditId(null);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded"
                    >
                      {savingEditId === entry.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
                    <input
                      type="text"
                      value={editNotes[entry.id] ?? entry.note ?? ''}
                      onChange={(e) => setEditNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
                      className="w-full p-2 border rounded text-sm"
                      placeholder="e.g., tripped, fast start, injured"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setShowEditModal(false)} className="text-sm text-gray-700 hover:text-gray-900 underline">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 