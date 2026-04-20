import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import CombineLockedBanner from "../components/CombineLockedBanner";
import api from '../lib/api';
import { Clock, Users, Undo2, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, Calendar, ChevronDown, ChevronRight, Target, Info, Lock, LockOpen, StickyNote, Search, BookOpen, Edit, Camera, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cacheInvalidation } from '../utils/dataCache';
import { useDrills } from '../hooks/useDrills';
import { useCombineLockState } from '../hooks/useCombineLockState';


export default function LiveEntry() {
  const { selectedEvent, setSelectedEvent } = useEvent();
  const { userRole } = useAuth();
  const { showError, showSuccess } = useToast();
  const location = useLocation();
  
  // Real-time combine lock state monitoring
  const { isLocked: combineIsLocked, lockMessage, handleSubmitError } = useCombineLockState();

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

  // Unified Drills Hook - resolves schema from backend or local template
  // NOTE: This handles the multi-sport logic (no hardcoded football fallback)
  const { drills, loading: drillsLoading } = useDrills(selectedEvent);
  
  // Core state
  const [selectedDrill, setSelectedDrill] = useState("");
  const [drillConfirmed, setDrillConfirmed] = useState(false);
  // playerNumber/playerName/playerId represent the CONFIRMED selection
  const [playerNumber, setPlayerNumber] = useState(""); 
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState("");
  
  // Search input state
  const [inputValue, setInputValue] = useState("");
  const [shortlist, setShortlist] = useState([]);
  const [focusedMatchIndex, setFocusedMatchIndex] = useState(-1);
  const [isNameMode, setIsNameMode] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [score, setScore] = useState("");
  const [loading, setLoading] = useState(false);
  
  // OCR Scanner state
  const [ocrScanning, setOcrScanning] = useState(false);
  const ocrFileRef = useRef(null);
  
  const handleOcrCapture = useCallback(async (file) => {
    if (!file || !selectedDrill) return;
    setOcrScanning(true);
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('event_id', selectedEvent.id);
      form.append('drill_type', selectedDrill);
      const { data } = await api.post('/scanner/ocr', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data?.value != null) {
        setScore(String(data.value));
        showSuccess(`OCR read: ${data.value} (${Math.round((data.confidence || 0) * 100)}% confidence)`);
      } else {
        showError('Could not read a number. Enter manually or try another photo.');
      }
    } catch {
      showError('OCR failed. Enter score manually.');
    } finally {
      setOcrScanning(false);
      if (ocrFileRef.current) ocrFileRef.current.value = '';
    }
  }, [selectedDrill, showSuccess, showError]);
  
  // Players data for auto-complete
  const [players, setPlayers] = useState([]);
  // filteredPlayers is replaced by shortlist/search logic, but kept for now if needed or removed
  
  // Entry tracking
  const [recentEntries, setRecentEntries] = useState([]);
  const [entryToUndo, setEntryToUndo] = useState(null);
  const [duplicateData, setDuplicateData] = useState(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [playersExpanded, setPlayersExpanded] = useState(false);
  const [playerFilter, setPlayerFilter] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
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
  const [autoReplaceDuplicates, setAutoReplaceDuplicates] = useState({}); // { drillKey: true }
  
  // Rapid Entry Mode (optional single-input mode)
  const [rapidEntryMode, setRapidEntryMode] = useState(false);
  const [rapidEntryInput, setRapidEntryInput] = useState("");
  const [showRapidEntryHint, setShowRapidEntryHint] = useState(false);
  
  // Drill-aware validation
  const [validationWarning, setValidationWarning] = useState(null); // { message: string, score: number }
  
  // Drill switch protection
  const [entriesInCurrentDrill, setEntriesInCurrentDrill] = useState(0);
  const [drillSwitchNotice, setDrillSwitchNotice] = useState(null); // { previousDrillLabel, restore }
  
  // Refs for auto-focus
  const playerNumberRef = useRef(null);
  const scoreRef = useRef(null);
  const rapidEntryRef = useRef(null);
  const refreshPlayersTimerRef = useRef(null);
  const selectedEventIdRef = useRef(selectedEvent?.id || null);

  useEffect(() => {
    selectedEventIdRef.current = selectedEvent?.id || null;
  }, [selectedEvent?.id]);
  
  const fetchPlayers = useCallback(async (requestedEventId = selectedEvent?.id) => {
    if (!requestedEventId) return;
    try {
      const response = await api.get(`/players?event_id=${requestedEventId}`);

      // Drop stale responses that return after an event switch.
      if (selectedEventIdRef.current !== requestedEventId) {
        return;
      }

      setPlayers(response.data);
          } catch {
        // Player fetch failed
    }
  }, [selectedEvent?.id]);

  // Keep player list refresh off the critical submit path.
  // Small debounce prevents overlapping refreshes during rapid consecutive saves.
  const schedulePlayersRefresh = useCallback(() => {
    const requestedEventId = selectedEventIdRef.current;
    if (refreshPlayersTimerRef.current) {
      clearTimeout(refreshPlayersTimerRef.current);
    }
    refreshPlayersTimerRef.current = setTimeout(() => {
      fetchPlayers(requestedEventId);
      refreshPlayersTimerRef.current = null;
    }, 120);
  }, [fetchPlayers]);

  useEffect(() => {
    return () => {
      if (refreshPlayersTimerRef.current) {
        clearTimeout(refreshPlayersTimerRef.current);
      }
    };
  }, []);

  // Local storage keys (per event)
  const storageKeys = useMemo(() => {
    if (!selectedEvent) return null;
    return {
      drill: `liveEntry:${selectedEvent.id}:selectedDrill`,
      entries: `liveEntry:${selectedEvent.id}:recentEntries`,
      focus: `liveEntry:${selectedEvent.id}:lastPlayerNumber`,
      locks: `liveEntry:${selectedEvent.id}:locks`,
      reviews: `liveEntry:${selectedEvent.id}:reviewDismissed`,
      drillHint: `liveEntry:${selectedEvent.id}:drillHintShown`,
      autoReplace: `liveEntry:${selectedEvent.id}:autoReplace`,
      rapidEntry: `liveEntry:${selectedEvent.id}:rapidEntryMode`,
      rapidEntryHint: `liveEntry:${selectedEvent.id}:rapidEntryHintShown`
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
      const savedFocus = localStorage.getItem(storageKeys.focus);
      if (savedFocus) {
        setInputValue(savedFocus);
      } else {
        setInputValue("");
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
    try {
      const savedAutoReplace = localStorage.getItem(storageKeys.autoReplace);
      if (savedAutoReplace) {
        const parsed = JSON.parse(savedAutoReplace);
        if (parsed && typeof parsed === 'object') setAutoReplaceDuplicates(parsed);
      } else {
        setAutoReplaceDuplicates({});
      }
    } catch {}
    try {
      const savedRapidEntry = localStorage.getItem(storageKeys.rapidEntry);
      if (savedRapidEntry === 'true') {
        setRapidEntryMode(true);
      } else {
        setRapidEntryMode(false); // Default OFF
      }
    } catch {}
    try {
      const hintFlag = localStorage.getItem(storageKeys.rapidEntryHint);
      if (hintFlag !== '1') {
        setShowRapidEntryHint(true);
      } else {
        setShowRapidEntryHint(false);
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
      setInputValue(playerParam.toString());
      applied = true;
    }
    if (applied) {
      setTimeout(() => {
        if (playerParam) {
          // focus score after auto-complete resolves
          // We let the search effect handle selection
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

  // Clear score when drill changes and reset entry counter
  useEffect(() => {
    setScore("");
    setEntriesInCurrentDrill(0);
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
  useEffect(() => {
    if (!storageKeys) return;
    try { localStorage.setItem(storageKeys.autoReplace, JSON.stringify(autoReplaceDuplicates)); } catch {}
  }, [storageKeys, autoReplaceDuplicates]);
  useEffect(() => {
    if (!storageKeys) return;
    try { localStorage.setItem(storageKeys.rapidEntry, rapidEntryMode ? 'true' : 'false'); } catch {}
  }, [storageKeys, rapidEntryMode]);

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

  // Handle drill switching (non-blocking).
  // UX update: switching drills is always instant. If there is unsaved draft data, show
  // an inline notice with Undo instead of blocking with a modal.
  const handleDrillSwitch = useCallback((newDrillKey) => {
    const previousDrillKey = selectedDrill;
    const previousDrillLabel = drills.find(d => d.key === previousDrillKey)?.label || "previous drill";

    // Treat in-progress input as unsaved draft data.
    const hasUnsavedDraft = Boolean(
      rapidEntryMode
        ? rapidEntryInput.trim()
        : (inputValue.trim() || playerId || score.trim() || note.trim())
    );

    if (hasUnsavedDraft && previousDrillKey && previousDrillKey !== newDrillKey) {
      const restore = {
        previousDrillKey,
        rapidEntryMode,
        inputValue,
        playerNumber,
        playerName,
        playerId,
        score,
        note,
        showNote,
        rapidEntryInput
      };

      // Clear draft to avoid carrying stale values into a different drill.
      setInputValue("");
      setPlayerNumber("");
      setPlayerName("");
      setPlayerId("");
      setScore("");
      setNote("");
      setShowNote(false);
      setRapidEntryInput("");
      // Reset transient search UI so stale shortlist/error state does not carry across drills.
      setShortlist([]);
      setFocusedMatchIndex(-1);
      setSearchError(null);

      setDrillSwitchNotice({
        previousDrillLabel,
        restore
      });
    }

    setSelectedDrill(newDrillKey);
    setDrillConfirmed(true);
    setTimeout(() => { playerNumberRef.current?.focus(); }, 100);
  }, [selectedDrill, drills, rapidEntryMode, rapidEntryInput, inputValue, playerId, score, note, showNote, playerNumber, playerName]);

  // Invalidate pending undo on first meaningful new edit in the current drill.
  // This prevents undo from overwriting newly entered work.
  useEffect(() => {
    if (!drillSwitchNotice) return;

    const hasMeaningfulNewEdit = Boolean(
      inputValue.trim() ||
      score.trim() ||
      note.trim() ||
      rapidEntryInput.trim() ||
      playerId
    );

    if (hasMeaningfulNewEdit) {
      setDrillSwitchNotice(null);
    }
  }, [drillSwitchNotice, inputValue, score, note, rapidEntryInput, playerId]);

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
        handleDrillSwitch(drills[nextIdx].key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drillConfirmed, selectedDrill, drills, entriesInCurrentDrill, handleDrillSwitch]);
  
  // Memoized normalized players for efficient search
  const normalizedPlayers = useMemo(() => {
    return players.map(p => {
      const name = p.name || "";
      const parts = name.trim().split(/\s+/);
      const first = parts[0] || "";
      const last = parts.slice(1).join(" ") || "";
      
      return {
        ...p,
        normFirst: first.toLowerCase(),
        normLast: last.toLowerCase(),
        normFull: name.toLowerCase(),
        normNumber: p.number != null ? p.number.toString() : ""
      };
    });
  }, [players]);

  // Overall combine-day progress (any player with at least one score > 0)
  const overallScoredPlayers = useMemo(() => {
    if (!players.length || !drills.length) return 0;
    return players.filter(p => {
      for (const d of drills) {
        const v = p?.[d.key];
        if (typeof v === 'number' && v > 0) return true;
        if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) && Number(v) > 0) return true;
      }
      return false;
    }).length;
  }, [players, drills]);

  // Memoize completion stats to avoid recalculation on every render
  const completionStats = useMemo(() => {
    const totalPlayers = players.length;
    const completedForDrill = selectedDrill ? players.filter(p => p && p[selectedDrill] != null).length : 0;
    const completionPct = totalPlayers > 0 ? Math.round((completedForDrill / totalPlayers) * 100) : 0;
    return { totalPlayers, completedForDrill, completionPct };
  }, [players, selectedDrill]);

  const missingPlayers = useMemo(() => {
    if (!selectedDrill) return [];
    // Optimization: Use simple loop instead of filter if array is huge, but filter is fine for <2000 with useMemo
    return players.filter(p => p && (p[selectedDrill] == null || p[selectedDrill] === undefined));
  }, [players, selectedDrill]);

  const selectPlayer = useCallback((player) => {
    if (!player) return;
    
    // Handle null/undefined player numbers gracefully
    const playerNum = player.number != null ? player.number.toString() : '';
    
    setPlayerNumber(playerNum);
    setPlayerName(player.name);
    setPlayerId(player.id);
    
    // Update input to show full player info: "#123 · John Doe"
    const displayText = playerNum ? `#${playerNum} · ${player.name}` : player.name;
    setInputValue(displayText);
    
    setShortlist([]);
    setSearchError(null);
    setScore(""); 
    setFocusedMatchIndex(-1);
    
    // Focus score
    setTimeout(() => {
      scoreRef.current?.focus();
    }, 100);
  }, []);

  // Dual-mode search logic
  useEffect(() => {
    // Skip if input matches currently selected player (avoids loops)
    // Check for both old format (just number) and new format ("#123 · Name")
    const selectedDisplay = playerNumber ? `#${playerNumber} · ${playerName}` : playerName;
    if (playerId && (inputValue === playerNumber || inputValue === selectedDisplay)) {
      return;
    }

    if (!inputValue) {
      setShortlist([]);
      setSearchError(null);
      setFocusedMatchIndex(-1);
      if (playerId) {
        setPlayerNumber("");
        setPlayerName("");
        setPlayerId("");
      }
      return;
    }

    const isDigits = /^\d+$/.test(inputValue);
    setIsNameMode(!isDigits);

    if (isDigits) {
      // NUMBER MODE: Instant
      // Exact match has highest priority
      const exactMatch = normalizedPlayers.find(p => p.normNumber === inputValue);
      
      if (exactMatch) {
         // Auto-select if confident
         if (playerId !== exactMatch.id) {
            selectPlayer(exactMatch);
         }
      } else {
        // No exact match - reset selection
        if (playerId) {
            setPlayerNumber("");
            setPlayerName("");
            setPlayerId("");
        }
        
        // Show partials for convenience
        const partials = normalizedPlayers
          .filter(p => p.normNumber.startsWith(inputValue))
          .slice(0, 5);
        setShortlist(partials);
      }
    } else {
      // NAME MODE: Debounced
      const handler = setTimeout(() => {
        const query = inputValue.toLowerCase().trim();
        if (!query) return;
        
        // Filter logic
        const matches = normalizedPlayers.filter(p => {
            // 1. Starts with first or last
            if (p.normFirst.startsWith(query) || p.normLast.startsWith(query)) return true;
            // 2. Starts with full name
            if (p.normFull.startsWith(query)) return true;
            // 3. Includes full name
            if (p.normFull.includes(query)) return true;
            // 4. First letter + last name (e.g. "j sm" -> "john smith")
            if (query.includes(' ')) {
                const [qFirst, ...qRest] = query.split(' ');
                const qLast = qRest.join(' ');
                if (p.normFirst.startsWith(qFirst) && p.normLast.startsWith(qLast)) return true;
            }
            return false;
        });
        
        // Ranking/Sorting matches
        matches.sort((a, b) => {
            // Priority 1: Starts with query (First/Last/Full)
            const aStarts = a.normFirst.startsWith(query) || a.normLast.startsWith(query) || a.normFull.startsWith(query);
            const bStarts = b.normFirst.startsWith(query) || b.normLast.startsWith(query) || b.normFull.startsWith(query);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return 0;
        });

        const topMatches = matches.slice(0, 5);
        setShortlist(topMatches);
        
        // Auto-select if SINGLE confident match
        if (matches.length === 1) {
             if (playerId !== matches[0].id) {
                selectPlayer(matches[0]);
             }
        } else {
            // Multiple or none - clear selection if ambiguous
            if (playerId) {
                setPlayerNumber("");
                setPlayerName("");
                setPlayerId("");
            }
        }
      }, 150);
      
      return () => clearTimeout(handler);
    }
  }, [inputValue, normalizedPlayers, playerId, playerNumber, playerName, selectPlayer]);
  
  // Rapid Entry Parser - handles formats like "1201 87", "1201,87", "1201-87"
  const parseRapidEntry = useCallback((input) => {
    const trimmed = input.trim();
    
    // Pattern: number (space/comma/dash) number
    const patterns = [
      /^(\d+)\s+(\d+\.?\d*)$/, // "1201 87" or "1201  7.2"
      /^(\d+),(\d+\.?\d*)$/,   // "1201,87"
      /^(\d+)-(\d+\.?\d*)$/,   // "1201-87"
    ];
    
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return { 
          playerNumber: match[1], 
          score: match[2] 
        };
      }
    }
    
    return null;
  }, []);
  
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
  
  // Drill-aware validation - checks for suspicious scores
  const validateScoreForDrill = useCallback((score, drill) => {
    const numericScore = parseFloat(score);
    
    // Basic numeric check
    if (isNaN(numericScore)) {
      return { valid: false, error: "Score must be a valid number." };
    }
    
    // Check drill-defined ranges (if available)
    if (drill.min !== undefined && numericScore < drill.min) {
      // Only show range if both min and max are defined
      const rangeText = (drill.max !== undefined) 
        ? ` Expected range: ${drill.min}-${drill.max} ${drill.unit}.`
        : '';
      
      return { 
        valid: false, 
        warning: `${numericScore} ${drill.unit} is unusually low for ${drill.label}.${rangeText}`
      };
    }
    if (drill.max !== undefined && numericScore > drill.max) {
      // Only show range if both min and max are defined
      const rangeText = (drill.min !== undefined) 
        ? ` Expected range: ${drill.min}-${drill.max} ${drill.unit}.`
        : '';
      
      return { 
        valid: false, 
        warning: `${numericScore} ${drill.unit} is unusually high for ${drill.label}.${rangeText}`
      };
    }
    
    // Unit-aware checks for common mistakes
    if (drill.unit === 'sec' && drill.lowerIsBetter) {
      // Sprint times - check for decimal mistakes (e.g., 72 instead of 7.2)
      if (numericScore > 20 && numericScore < 100) {
        const suggestedScore = (numericScore / 10).toFixed(1);
        return {
          valid: false,
          warning: `${numericScore} seconds seems very slow for ${drill.label}. Did you mean ${suggestedScore} seconds?`
        };
      }
      // Extremely fast times (likely typo)
      if (numericScore < 3) {
        return {
          valid: false,
          warning: `${numericScore} seconds is unusually fast for ${drill.label}. Please verify this is correct.`
        };
      }
    }
    
    // Percentage checks (0-100 expected)
    if (drill.unit === '%') {
      if (numericScore > 100) {
        return {
          valid: false,
          warning: `${numericScore}% exceeds 100%. Please enter a value between 0-100.`
        };
      }
      if (numericScore < 0) {
        return {
          valid: false,
          warning: `Percentage cannot be negative. Please enter a value between 0-100.`
        };
      }
    }
    
    // Points checks (0-100 typical)
    if (drill.unit === 'pts') {
      if (numericScore > 100 && !drill.max) {
        return {
          valid: false,
          warning: `${numericScore} points is unusually high for ${drill.label}. Most drills use 0-100 scale. Verify this is correct.`
        };
      }
      if (numericScore < 0) {
        return {
          valid: false,
          warning: `Points cannot be negative.`
        };
      }
    }
    
    // All checks passed
    return { valid: true };
  }, []);
  
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
    
    // Drill-aware validation
    const validation = validateScoreForDrill(score, currentDrill);
    if (!validation.valid) {
      if (validation.error) {
        // Hard error - block submission
        showError(validation.error);
        scoreRef.current?.focus();
        return;
      } else if (validation.warning) {
        // Soft warning - require confirmation
        setValidationWarning({ message: validation.warning, score: numericScore });
        return;
      }
    }

    const duplicate = checkForDuplicate(playerId, selectedDrill);
    if (duplicate) {
      // Check if auto-replace is enabled for this drill
      if (autoReplaceDuplicates[selectedDrill]) {
        // Auto-replace without showing modal
        await submitScore(true);
      } else {
        // Show modal for user decision
        setDuplicateData({ ...duplicate, newScore: numericScore });
        setShowDuplicateDialog(true);
      }
      return;
    }
    await submitScore();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await attemptSubmit();
  };
  
  const confirmSubmitDespiteWarning = async () => {
    // User has explicitly confirmed they want to submit despite validation warning
    setValidationWarning(null);
    
    // Proceed with submission (skip validation, go straight to duplicate check)
    const duplicate = checkForDuplicate(playerId, selectedDrill);
    if (duplicate) {
      const numericScore = parseFloat(score);
      if (autoReplaceDuplicates[selectedDrill]) {
        await submitScore(true);
      } else {
        setDuplicateData({ ...duplicate, newScore: numericScore });
        setShowDuplicateDialog(true);
      }
      return;
    }
    await submitScore();
  };
  
  const handleRapidEntrySubmit = async (e) => {
    e.preventDefault();
    
    const parsed = parseRapidEntry(rapidEntryInput);
    if (!parsed) {
      showError('Invalid format. Use: # SCORE (e.g., "1201 87" or "1201,87")');
      return;
    }
    
    // Find player by number
    const player = normalizedPlayers.find(p => p.normNumber === parsed.playerNumber);
    if (!player) {
      showError(`Player #${parsed.playerNumber} not found in this event.`);
      return;
    }
    
    // Validate score
    const numericScore = parseFloat(parsed.score);
    if (isNaN(numericScore)) {
      showError("Score must be a valid number.");
      return;
    }
    
    // Drill-aware validation
    const validation = validateScoreForDrill(parsed.score, currentDrill);
    if (!validation.valid) {
      if (validation.error) {
        showError(validation.error);
        return;
      } else if (validation.warning) {
        // Set player and score state so warning modal has context
        setPlayerId(player.id);
        setPlayerNumber(parsed.playerNumber);
        setPlayerName(player.name);
        setScore(parsed.score);
        setValidationWarning({ message: validation.warning, score: numericScore });
        return;
      }
    }
    
    // Build explicit submit payload so rapid mode does not depend on freshly set component state.
    const rapidSubmitPayload = {
      playerId: player.id,
      playerNumber: parsed.playerNumber,
      playerName: player.name,
      selectedDrill,
      score: parsed.score
    };
    
    // Keep existing state assignment for modal/review context and visual continuity.
    setPlayerId(player.id);
    setPlayerNumber(parsed.playerNumber);
    setPlayerName(player.name);
    setScore(parsed.score);
    
    // Check for duplicate and submit
    const duplicate = checkForDuplicate(player.id, selectedDrill);
    if (duplicate) {
      if (autoReplaceDuplicates[selectedDrill]) {
        const saved = await submitScore(true, rapidSubmitPayload);
        if (saved) {
          setRapidEntryInput("");
        }
      } else {
        setDuplicateData({ ...duplicate, newScore: numericScore });
        setShowDuplicateDialog(true);
        return;
      }
    } else {
      const saved = await submitScore(false, rapidSubmitPayload);
      if (saved) {
        setRapidEntryInput("");
      }
    }
  };
  
  const submitScore = async (overrideDuplicate = false, payloadOverride = null) => {
    // Early guard against duplicate submits from fast repeated key presses/clicks.
    if (loading) return false;

    const submitPayload = {
      playerId: payloadOverride?.playerId ?? playerId,
      playerNumber: payloadOverride?.playerNumber ?? playerNumber,
      playerName: payloadOverride?.playerName ?? playerName,
      drillKey: payloadOverride?.selectedDrill ?? selectedDrill,
      scoreRaw: payloadOverride?.score ?? score,
      noteValue: payloadOverride?.note ?? note
    };

    if (!submitPayload.playerId || !submitPayload.drillKey || submitPayload.scoreRaw == null || submitPayload.scoreRaw === "") {
      return false;
    }

    const numericScore = typeof submitPayload.scoreRaw === 'number'
      ? submitPayload.scoreRaw
      : parseFloat(submitPayload.scoreRaw);

    if (Number.isNaN(numericScore)) {
      return false;
    }

    setLoading(true);
    
    try {
      const response = await api.post('/drill-results/', {
        player_id: submitPayload.playerId,
        type: submitPayload.drillKey,
        value: numericScore,
        event_id: selectedEvent.id
      });
      
      // Add to recent entries
      const entry = {
        id: Date.now(),
        drillResultId: response.data.id, // Capture backend ID for undo
        playerId: submitPayload.playerId,
        playerNumber: submitPayload.playerNumber,
        playerName: submitPayload.playerName,
        drill: drills.find(d => d.key === submitPayload.drillKey),
        score: numericScore,
        timestamp: new Date(),
        overridden: overrideDuplicate,
        note: submitPayload.noteValue || ""
      };
      
      setRecentEntries(prev => [entry, ...prev.slice(0, 9)]); // Keep last 10
      
      // Track entries in current drill for switch protection
      setEntriesInCurrentDrill(prev => prev + 1);
      
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 300);
      
      // Reset form
      setPlayerNumber("");
      setPlayerName("");
      setPlayerId("");
      setInputValue("");
      setScore("");
      setNote("");
      setShowNote(false);
      setShowDuplicateDialog(false);
      setDuplicateData(null);
      // A successful save means current work is now committed; stale undo should be removed.
      setDrillSwitchNotice(null);
      
      // Invalidate cache to ensure live standings update immediately
      cacheInvalidation.playersUpdated(selectedEvent.id);

      // Small optimistic update avoids temporary stale completion/missing-player UI
      // while deferred background refresh catches up with backend state.
      setPlayers(prev => prev.map(p => (
        p.id === submitPayload.playerId ? { ...p, [submitPayload.drillKey]: numericScore } : p
      )));

      // Auto-focus next-entry field immediately (critical path).
      setTimeout(() => {
        if (rapidEntryMode) {
          rapidEntryRef.current?.focus();
        } else {
          playerNumberRef.current?.focus();
        }
      }, 100);

      // Defer player refresh so next entry is not blocked on network.
      schedulePlayersRefresh();
      return true;
      
    } catch (error) {
      // Check if error is due to combine being locked
      const { isLockError, userMessage } = await handleSubmitError(error);
      
      if (isLockError) {
        // Combine was locked - show specific message
        showError(userMessage);
        console.log('[LOCK] Score submission blocked - combine is locked');
      } else {
        // Generic error
        showError(userMessage);
      }
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  const handleUndoClick = () => {
    if (recentEntries.length === 0) return;
    const lastEntry = recentEntries[0];
    setEntryToUndo(lastEntry);
  };

  const handleUndoConfirm = async () => {
    if (!entryToUndo) return;
    
    // Perform true backend undo if we have the ID
    if (entryToUndo.drillResultId) {
      try {
        await api.delete(`/drill-results/${entryToUndo.drillResultId}?event_id=${selectedEvent.id}&player_id=${entryToUndo.playerId}`);
        
        // Refresh data
        cacheInvalidation.playersUpdated(selectedEvent.id);
        fetchPlayers();
      } catch (error) {
        console.error("Undo failed:", error);
        throw error; // Let DeleteConfirmModal handle the error display
      }
    }
    
    setRecentEntries(prev => prev.slice(1));
    // Success toast handled by DeleteConfirmModal
  };

  const handleEditLast = () => {
    if (recentEntries.length === 0) return;
    
    const lastEntry = recentEntries[0];
    
    // Find the player and select them
    const player = players.find(p => p.id === lastEntry.playerId);
    if (player) {
      selectPlayer(player);
    }
    
    // Pre-fill the score
    setScore(String(lastEntry.score));
    
    // Focus and select the score input for easy editing
    setTimeout(() => {
      scoreRef.current?.focus();
      scoreRef.current?.select();
    }, 150);
    
    showSuccess(`Editing ${lastEntry.playerName}'s ${lastEntry.drill.label} score`);
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
          <div className="w-16 h-16 bg-semantic-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-semantic-warning" />
          </div>
          <h1 className="text-2xl font-bold text-semantic-warning mb-4">No Event Selected</h1>
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
          
          <div className="mt-4 p-3 bg-brand-light/20 border border-brand-primary/20 rounded-lg">
            <p className="text-brand-primary text-sm">
              <strong>Tip:</strong> Select an event from the header dropdown first, then return to Live Entry.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (drillsLoading && drills.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event configuration...</p>
        </div>
      </div>
    );
  }
  
  const { totalPlayers, completedForDrill, completionPct } = completionStats;

  const currentDrill = drills.find(d => d.key === selectedDrill);
  const currentIndex = drills.findIndex(d => d.key === selectedDrill);
  const nextDrill = currentIndex >= 0 ? drills[(currentIndex + 1) % drills.length] : null;
  const drillSequenceLabel = currentIndex >= 0 ? `Drill ${currentIndex + 1} of ${drills.length}` : null;

  const switchToPreviousDrill = () => {
    if (drills.length <= 1 || currentIndex < 0) return;
    const previousIndex = (currentIndex - 1 + drills.length) % drills.length;
    handleDrillSwitch(drills[previousIndex].key);
  };

  const switchToNextDrill = () => {
    if (drills.length <= 1 || currentIndex < 0) return;
    const followingIndex = (currentIndex + 1) % drills.length;
    handleDrillSwitch(drills[followingIndex].key);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light/20 to-white overflow-x-hidden">
      {/* Header (sticky) */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: title + progress */}
          <div className="flex items-start gap-3 min-w-0">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 mt-0.5 shrink-0">
              <ArrowLeft className="w-6 h-6" />
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap">Live Entry Mode</h1>
              </div>

              {/* LIVE badge + overall progress */}
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">LIVE</span>
                <span className="text-xs text-gray-500 whitespace-nowrap">{overallScoredPlayers} of {players.length} players scored</span>
              </div>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: (players.length ? Math.round((overallScoredPlayers / players.length) * 100) : 0) + '%' }}
                />
              </div>

              {/* Event name */}
              <p className="text-sm text-gray-600 truncate max-w-full">{selectedEvent.name}</p>
            </div>
          </div>

          {/* Right: controls (scroll on mobile rather than crush) */}
          <div className="-mx-1 px-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <select
                value={selectedDrill || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleDrillSwitch(e.target.value);
                  } else {
                    setSelectedDrill('');
                    setDrillConfirmed(false);
                  }
                }}
                className="p-2 border rounded-lg text-sm bg-white max-w-[220px]"
              >
                <option value="">Select drill…</option>
                {drills.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>

              {selectedDrill && (
                <button
                  onClick={toggleCurrentDrillLock}
                  className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1 border ${isCurrentDrillLocked ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                >
                  {isCurrentDrillLocked ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
                  {isCurrentDrillLocked ? 'Locked' : 'Recording Active'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* How It Works - Collapsible Help */}
      <div className="max-w-lg mx-auto px-4 mt-3">
        <button 
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-primary transition-colors"
        >
          <span className="text-brand-primary">📘</span> How Live Entry Works
          {showHelp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        
        {showHelp && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200 shadow-sm space-y-1 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="bg-white border border-gray-200 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-brand-primary shadow-sm">1</span>
              <span>Select a drill</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white border border-gray-200 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-brand-primary shadow-sm">2</span>
              <span>Enter player scores</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white border border-gray-200 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-brand-primary shadow-sm">3</span>
              <span>View rankings</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Combine Lock Banner */}
        <CombineLockedBanner isLocked={combineIsLocked} message={lockMessage} />
        
        {/* Drill Selection */}
        {!selectedDrill || !drillConfirmed ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-brand-primary" />
              <h2 className="text-xl font-bold text-gray-900">Select Drill</h2>
              <div className="flex items-center gap-1 text-xs bg-semantic-success/10 text-semantic-success px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Live Entry Mode
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6 text-center">
              Choose the drill you want to enter scores for during this live evaluation session.
            </p>

            {/* Start here callout */}
            <div className="mb-4 bg-brand-light/20 border border-brand-primary/20 text-brand-primary rounded-lg p-3 text-sm">
              <span className="font-medium">Start here:</span> Choose a drill to begin. You'll then enter scores by player number.
            </div>

            {/* Dropdown Selector */}
            <div className="relative mb-6">
              <select
                value={selectedDrill || ''}
                onChange={(e) => {
                  // UX simplification: selecting a drill immediately starts entry mode.
                  // We intentionally remove the separate "Start Entry" confirmation step.
                  setSelectedDrill(e.target.value);
                  setDrillConfirmed(!!e.target.value);
                }}
                className="w-full p-3 pr-10 border-2 rounded-lg appearance-none bg-white text-left cursor-pointer transition-all duration-200 border-gray-300 hover:border-gray-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
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

            {/* The explicit preview/confirmation card was intentionally removed.
                Drill selection above now transitions directly into entry mode. */}
          </div>
        ) : (
          <>
            {/* One-time hint */}
            {showDrillHint && (
              <div className="mt-2 bg-brand-light/20 border border-brand-primary/20 text-brand-primary rounded-lg p-2 text-xs flex items-center justify-between">
                <span>Tip: Use the drill buttons above or ←/→ keys to switch drills.</span>
                <button
                  className="text-brand-primary hover:text-brand-secondary underline ml-2"
                  onClick={() => { setShowDrillHint(false); try { if (storageKeys) localStorage.setItem(storageKeys.drillHint, '1'); } catch {} }}
                >
                  Got it
                </button>
              </div>
            )}

            {/* Non-blocking drill switch notice for unsaved draft data */}
            {drillSwitchNotice && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg p-2 text-xs flex items-center justify-between gap-3">
                <span>Previous drill score not saved.</span>
                <button
                  type="button"
                  className="text-yellow-900 underline hover:text-yellow-700 font-medium"
                  onClick={() => {
                    const restore = drillSwitchNotice.restore;
                    setSelectedDrill(restore.previousDrillKey);
                    setDrillConfirmed(true);
                    // Restore mode first so the correct form renders before restoring its fields.
                    setRapidEntryMode(restore.rapidEntryMode);
                    setInputValue(restore.inputValue);
                    setPlayerNumber(restore.playerNumber);
                    setPlayerName(restore.playerName);
                    setPlayerId(restore.playerId);
                    setScore(restore.score);
                    setNote(restore.note);
                    setShowNote(restore.showNote);
                    setRapidEntryInput(restore.rapidEntryInput);
                    // Reset transient search UI on restore; search effect will recompute if needed.
                    setShortlist([]);
                    setFocusedMatchIndex(-1);
                    setSearchError(null);
                    setDrillSwitchNotice(null);
                    setTimeout(() => {
                      if (restore.rapidEntryMode) {
                        rapidEntryRef.current?.focus();
                        return;
                      }
                      if (restore.score) {
                        scoreRef.current?.focus();
                      } else {
                        playerNumberRef.current?.focus();
                      }
                    }, 100);
                  }}
                >
                  Undo
                </button>
              </div>
            )}

            {/* Review banner when complete */}
            {selectedDrill && completionPct === 100 && !reviewDismissed[selectedDrill] && (
              <div className="bg-semantic-success/10 border border-semantic-success/30 text-semantic-success rounded-lg p-3 flex items-center justify-between">
                <div className="text-sm font-medium">Drill Complete — Review?</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEditModal(true)} className="text-sm bg-semantic-success hover:bg-green-700 text-white px-3 py-1 rounded">Open Review</button>
                  <button
                    onClick={() => setReviewDismissed(prev => ({ ...prev, [selectedDrill]: true }))}
                    className="text-sm text-semantic-success hover:text-green-900 underline"
                  >Dismiss</button>
                </div>
              </div>
            )}
            
            {/* Entry Form */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              {/* Sticky drill context strip: remains visible while entering scores */}
              <div className="sticky top-[72px] sm:top-16 z-10 -mx-6 px-6 py-3 mb-4 border-b border-gray-200 bg-white/95 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Target className="w-4 h-4 text-brand-primary shrink-0" />
                      <p className="font-semibold text-gray-900 truncate">{currentDrill.label}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {drillSequenceLabel && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {drillSequenceLabel}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full border ${isCurrentDrillLocked ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {isCurrentDrillLocked ? 'Locked' : 'Recording Active'}
                      </span>
                      <span className="text-gray-500 font-medium">
                        {completedForDrill}/{totalPlayers} scored
                      </span>
                    </div>
                  </div>

                  {drills.length > 1 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={switchToPreviousDrill}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        aria-label="Previous drill"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={switchToNextDrill}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                        aria-label="Next drill"
                      >
                        Next
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Rapid Entry Mode Selector - Segmented Control */}
              <div className="mb-4 pb-3 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Entry Mode:</span>
                </div>
                
                {/* Segmented Control */}
                <div className="inline-flex rounded-lg border-2 border-gray-200 bg-gray-50 p-1 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setRapidEntryMode(false);
                      if (showRapidEntryHint && storageKeys) {
                        try { localStorage.setItem(storageKeys.rapidEntryHint, '1'); } catch {}
                        setShowRapidEntryHint(false);
                      }
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                      !rapidEntryMode 
                        ? 'bg-white text-brand-primary shadow-sm border border-brand-primary/20' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📝 Standard
                    <div className="text-xs text-gray-500 mt-0.5">Player + Score</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRapidEntryMode(true);
                      if (showRapidEntryHint && storageKeys) {
                        try { localStorage.setItem(storageKeys.rapidEntryHint, '1'); } catch {}
                        setShowRapidEntryHint(false);
                      }
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                      rapidEntryMode 
                        ? 'bg-blue-500 text-white shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ⚡ Rapid Entry
                    <div className="text-xs mt-0.5" style={{ opacity: rapidEntryMode ? 0.9 : 0.7 }}>
                      # SCORE
                    </div>
                  </button>
                </div>
                
                {/* One-time hint */}
                {showRapidEntryHint && !rapidEntryMode && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-2 text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <strong>Tip:</strong> Try Rapid Entry mode for faster keyboard-based entry. Type player# and score together (e.g., "1201 87").
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRapidEntryHint(false);
                        if (storageKeys) {
                          try { localStorage.setItem(storageKeys.rapidEntryHint, '1'); } catch {}
                        }
                      }}
                      className="text-blue-700 hover:text-blue-900 font-medium"
                    >
                      Got it
                    </button>
                  </div>
                )}
              </div>
              
              {rapidEntryMode ? (
                // RAPID ENTRY MODE: Single input
                <form onSubmit={handleRapidEntrySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enter Player # and Score
                    </label>
                    <input
                      ref={rapidEntryRef}
                      type="text"
                      inputMode="text"
                      value={rapidEntryInput}
                      onChange={(e) => setRapidEntryInput(e.target.value)}
                      placeholder={`e.g., 1201 87 or 1201,87 or 1201-87`}
                      className="w-full text-2xl p-4 border-2 border-gray-300 rounded-lg focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-center font-mono"
                      disabled={isCurrentDrillLocked}
                      autoFocus
                      required
                    />
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Format: player# space/comma/dash score ({currentDrill.unit})
                    </p>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading || isCurrentDrillLocked || combineIsLocked || !rapidEntryInput}
                    className={`w-full font-bold text-xl py-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2
                      ${submitSuccess 
                        ? 'bg-green-500 text-white scale-[1.02] shadow-lg' 
                        : 'bg-semantic-success hover:bg-green-600 disabled:bg-gray-300 text-white'}`}
                  >
                    {submitSuccess ? (
                      <>
                        <CheckCircle className="w-6 h-6" />
                        Saved!
                      </>
                    ) : (
                      loading ? "Saving..." : "Submit & Next"
                    )}
                  </button>
                </form>
              ) : (
                // STANDARD MODE: Separate player and score inputs
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Player Number or Name Input */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Player Number or Name
                  </label>
                  <div className="relative">
                    <input
                      ref={playerNumberRef}
                      type="text"
                      inputMode="text"
                      autoCapitalize="words"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onWheel={preventWheel}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setFocusedMatchIndex(prev => Math.min(prev + 1, shortlist.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setFocusedMatchIndex(prev => Math.max(prev - 1, -1));
                        } else if (e.key === 'Enter') {
                          if (focusedMatchIndex >= 0 && shortlist[focusedMatchIndex]) {
                            e.preventDefault();
                            selectPlayer(shortlist[focusedMatchIndex]);
                          } else if (playerId) {
                            // Move to score field
                            e.preventDefault();
                            setTimeout(() => scoreRef.current?.focus(), 0);
                          } else if (inputValue && !playerId) {
                            // Invalid submission check
                            if (shortlist.length > 0) {
                                // If user hits enter with shortlist but no selection, maybe select top?
                                // User: "If the user presses Enter... and no valid player is selected... Input border turns red"
                                // But keyboard section says: "Up/Down arrows to move, Enter to confirm".
                            }
                            setSearchError(true);
                          }
                        } else if (e.key === 'Escape') {
                          setShortlist([]);
                        }
                      }}
                      onBlur={() => {
                        // Delay clearing shortlist to allow clicks
                        setTimeout(() => {
                           // if (!playerId && inputValue) setSearchError(true); // Optional: validate on blur
                           setShortlist([]);
                        }, 200);
                      }}
                      placeholder="Enter player # or name..."
                      className={`w-full text-2xl p-4 border-2 rounded-lg text-left sm:text-center transition-colors truncate pr-12 sm:pr-4
                        ${playerId 
                          ? 'border-green-500 bg-green-50 focus:border-green-500 focus:ring-green-500' 
                          : searchError 
                            ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20'
                        }`}
                      disabled={isCurrentDrillLocked}
                      autoFocus
                      required
                    />
                    
                    {/* Selected Indicator Icon */}
                    {playerId && (
                         <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-green-600 flex items-center pointer-events-none animate-in zoom-in duration-200">
                             <CheckCircle className="w-6 h-6" />
                         </div>
                    )}
                  </div>

                  {/* Selected Helper Text - REMOVED: Info now shows in input field */}
                  
                  {/* Error Message */}
                  {searchError && !playerId && (
                      <div className="text-red-500 text-sm mt-1 text-center font-medium animate-in fade-in slide-in-from-top-1">
                          {/^\d+$/.test(inputValue) 
                              ? `No player #${inputValue} in this event.` 
                              : "No player found. Check the number or name."}
                      </div>
                  )}
                  
                  {/* Shortlist Dropdown */}
                  {!playerId && shortlist.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                      {shortlist.map((player, idx) => (
                        <div
                          key={player.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('[LiveEntry] DIV onMouseDown:', player.name, player.number);
                            selectPlayer(player);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('[LiveEntry] DIV onClick:', player.name);
                            selectPlayer(player);
                          }}
                          className={`w-full p-3 text-left border-b border-gray-100 last:border-b-0 flex items-center gap-3 transition-colors cursor-pointer
                            ${idx === focusedMatchIndex ? 'bg-brand-primary/10 text-brand-primary' : 'hover:bg-gray-50'}`}
                        >
                          <span className="font-bold w-12 bg-gray-100 rounded px-2 py-1 text-center text-xs pointer-events-none">#{player.number}</span>
                          <span className="flex-1 min-w-0 font-medium pointer-events-none truncate">{player.name}</span>
                          <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded pointer-events-none">{player.age_group}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Recent Players Quick-Select */}
                  {!playerId && !shortlist.length && recentEntries.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap mr-1">Recent:</span>
                          {Array.from(new Set(recentEntries.map(e => e.playerId)))
                             .slice(0, 5)
                             .map(pid => {
                                 const entry = recentEntries.find(e => e.playerId === pid);
                                 return (
                                     <button
                                         key={pid}
                                         type="button"
                                         onMouseDown={(e) => {
                                             e.preventDefault(); // Prevent input blur
                                             const p = players.find(pl => pl.id === pid);
                                             if (p) selectPlayer(p);
                                         }}
                                         className="text-xs bg-white hover:bg-brand-light/30 text-gray-700 border border-gray-200 hover:border-brand-primary/30 rounded-full px-3 py-1.5 transition-all shadow-sm whitespace-nowrap flex items-center gap-1"
                                     >
                                         <span className="font-bold text-brand-primary">#{entry.playerNumber}</span>
                                         <span className="max-w-[12rem] truncate">{entry.playerName}</span>
                                     </button>
                                 );
                             })
                          }
                      </div>
                  )}
                </div>
                
                {/* Score Entry */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Score ({currentDrill.unit})
                  </label>
                  <div className="flex gap-2 items-stretch w-full max-w-full">
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
                      className="flex-1 w-0 min-w-0 max-w-full box-border text-3xl p-4 border-2 border-gray-300 rounded-lg focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-center"
                      disabled={isCurrentDrillLocked || combineIsLocked}
                      required
                    />
                    <input
                      ref={ocrFileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleOcrCapture(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => ocrFileRef.current?.click()}
                      disabled={ocrScanning || isCurrentDrillLocked || combineIsLocked}
                      className="px-4 rounded-lg border-2 border-gray-300 hover:border-brand-primary hover:bg-brand-primary/5 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Scan score with camera"
                    >
                      {ocrScanning ? (
                        <Loader2 className="w-7 h-7 text-brand-primary animate-spin" />
                      ) : (
                        <Camera className="w-7 h-7 text-gray-600" />
                      )}
                    </button>
                  </div>
                  {ocrScanning && (
                    <p className="text-sm text-brand-primary mt-1 animate-pulse">Reading score from photo…</p>
                  )}
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
                      disabled={isCurrentDrillLocked || combineIsLocked}
                    />
                  )}
                </div>
                
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || (!submitSuccess && (!playerId || !score || isCurrentDrillLocked || combineIsLocked))}
                  className={`w-full font-bold text-xl py-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2
                    ${submitSuccess 
                      ? 'bg-green-500 text-white scale-[1.02] shadow-lg' 
                      : 'bg-semantic-success hover:bg-green-600 disabled:bg-gray-300 text-white'}`}
                >
                  {submitSuccess ? (
                    <>
                      <CheckCircle className="w-6 h-6" />
                      Saved!
                    </>
                  ) : (
                    loading ? "Saving..." : "Submit & Next"
                  )}
                </button>
              </form>
              )}
            </div>
            
            {/* Prominent Rankings Button */}
            <div className="pt-2">
              <Link
                to="/live-standings"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow"
              >
                View Rankings →
              </Link>
              <div className="text-xs text-gray-500 text-center mt-2">Rankings update automatically as you enter scores.</div>
            </div>

            {/* Action Buttons - Forward-looking flow */}
            <div className="flex gap-3 flex-wrap">
              {/* Next Drill CTA at >=80% completion */}
              {selectedDrill && completionPct >= 80 && nextDrill && (
                <button
                  onClick={() => handleDrillSwitch(nextDrill.key)}
                  className="flex-1 bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-3 rounded-lg transition shadow"
                >
                  Next Drill → {nextDrill.label}
                </button>
              )}
              {recentEntries.length >= 3 && (userRole === 'organizer' || userRole === 'coach') && (
                <Link
                  to="/team-formation"
                  className="bg-brand-secondary hover:bg-brand-primary text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                >
                  <Users className="w-5 h-5" />
                  Create Teams
                </Link>
              )}
              {recentEntries.length > 0 && (
                <>
                  <button
                    onClick={handleEditLast}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow"
                    title="Edit the last entry"
                  >
                    <Edit className="w-5 h-5" />
                    Edit Last
                  </button>
                  <button
                    onClick={handleUndoClick}
                    className="bg-semantic-warning hover:opacity-90 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition"
                    title="Delete the last entry"
                  >
                    <Undo2 className="w-5 h-5" />
                    Undo
                  </button>
                </>
              )}
            </div>
            
            {/* Recent Entries - Enhanced */}
            {recentEntries.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-primary" />
                    Recent Entries
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="bg-brand-primary/10 text-brand-primary text-xs px-2 py-1 rounded-full font-medium">
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
                  className="text-brand-primary hover:text-brand-secondary text-sm font-medium"
                >
                  Edit Recent
                </button>
                    <Link
                      to="/players?tab=analyze"
                      className="text-brand-primary hover:text-brand-secondary text-sm font-medium"
                    >
                      View All →
                    </Link>
                  </div>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {recentEntries.map(entry => (
                    <div key={entry.id} className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 to-brand-light/10 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">#{entry.playerNumber} {entry.playerName}</div>
                        <div className="text-sm text-gray-700 flex items-center gap-2">
                          <span className="font-medium">{entry.drill.label}:</span>
                          <span className="bg-white px-2 py-1 rounded font-medium text-brand-primary">
                            {entry.score} {entry.drill.unit}
                          </span>
                          {entry.overridden && <span className="text-semantic-warning font-medium">(Updated)</span>}
                        </div>
                        {entry.note && (
                          <div className="text-xs text-gray-600 mt-1">Note: {entry.note}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        <div>{entry.timestamp.toLocaleTimeString()}</div>
                        <CheckCircle className="w-4 h-4 text-semantic-success mx-auto mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Players remaining for this drill */}
            {selectedDrill && missingPlayers.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 transition-all">
                <button 
                  onClick={() => setPlayersExpanded(!playersExpanded)}
                  className="w-full flex items-center justify-between group"
                >
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-semantic-warning" /> 
                    {missingPlayers.length} Players Remaining
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-brand-primary group-hover:text-brand-secondary">
                    {playersExpanded ? 'Collapse' : 'Expand List'}
                    {playersExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>
                
                {playersExpanded && (
                  <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search by player # or name..." 
                        value={playerFilter}
                        onChange={(e) => setPlayerFilter(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {missingPlayers
                        .filter(p => 
                          !playerFilter || 
                          (p.number && p.number.toString().includes(playerFilter)) || 
                          (p.name && p.name.toLowerCase().includes(playerFilter.toLowerCase()))
                        )
                        .slice(0, 50)
                        .map(p => (
                        <div key={p.id} className="text-sm text-gray-500 flex items-center gap-2 opacity-80 p-1 hover:bg-gray-50 rounded">
                          <span className="w-16">#{p.number || '—'}</span>
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="text-xs text-semantic-warning">Missing</span>
                        </div>
                      ))}
                      {missingPlayers.length > 0 && missingPlayers.filter(p => !playerFilter || (p.number && p.number.toString().includes(playerFilter)) || (p.name && p.name.toLowerCase().includes(playerFilter.toLowerCase()))).length === 0 && (
                        <div className="text-center text-gray-400 text-sm py-2">No matches found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Validation Warning Dialog */}
      {validationWarning && (
        <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmSubmitDespiteWarning();
              } else if (e.key === 'Escape') {
                setValidationWarning(null);
                scoreRef.current?.focus();
              }
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg font-bold text-gray-900">Score Verification Needed</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                {validationWarning.message}
              </p>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Entered score:</span>
                  <span className="text-xl font-bold text-orange-600">
                    {validationWarning.score} {currentDrill.unit}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setValidationWarning(null);
                  scoreRef.current?.focus();
                  scoreRef.current?.select();
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg transition"
              >
                ← Go Back & Edit
              </button>
              <button
                onClick={confirmSubmitDespiteWarning}
                autoFocus
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transition"
              >
                ✓ Submit Anyway
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-3">Press Enter to submit, Esc to go back</p>
          </div>
        </div>
      )}
      
      {/* Duplicate Score Dialog */}
      {showDuplicateDialog && duplicateData && (
        <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitScore(true);
              } else if (e.key === 'Escape') {
                setShowDuplicateDialog(false);
              }
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-semantic-warning" />
              <h3 className="text-lg font-bold text-gray-900">Existing Score Found</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                <strong>{duplicateData.playerName}</strong> already has a {duplicateData.drill.label} score:
              </p>
              <div className="bg-brand-light/20 rounded-lg p-3 mb-3">
                <div className="text-base font-medium text-gray-600">
                  Current: <span className="text-gray-800">{duplicateData.existingScore} {duplicateData.drill.unit}</span>
                </div>
                <div className="text-lg font-bold text-brand-primary mt-1">
                  New: {duplicateData.newScore} {duplicateData.drill.unit}
                </div>
              </div>
            </div>
            
            {/* Remember choice checkbox */}
            <label className="flex items-center gap-2 mb-4 text-sm text-gray-600 cursor-pointer hover:text-gray-800">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                onChange={(e) => {
                  setAutoReplaceDuplicates(prev => ({
                    ...prev,
                    [selectedDrill]: e.target.checked
                  }));
                }}
              />
              <span>Auto-replace duplicates for this drill (no more prompts)</span>
            </label>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDuplicateDialog(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg text-sm transition"
              >
                Cancel (Keep {duplicateData.existingScore})
              </button>
              <button
                onClick={() => submitScore(true)}
                autoFocus
                className="flex-1 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 rounded-lg text-lg shadow-lg transition"
              >
                ✓ Replace with {duplicateData.newScore}
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-3">Press Enter to replace, Esc to cancel</p>
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
                      className="bg-brand-primary hover:bg-brand-secondary text-white text-sm px-3 py-2 rounded"
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

      {/* Undo Confirmation Modal */}
      <DeleteConfirmModal
        open={!!entryToUndo}
        onClose={() => setEntryToUndo(null)}
        onConfirm={handleUndoConfirm}
        title="Undo Entry"
        itemName={entryToUndo?.playerName || ""}
        itemType="entry"
        description={`Undo the score entry for ${entryToUndo?.playerName}?`}
        consequences="This will remove the score from the backend and cannot be undone."
        severity="low"
        variant="warning"
        confirmButtonText="Undo Entry"
        requireTypedConfirmation={false}
        analyticsData={{
          playerId: entryToUndo?.playerId,
          playerName: entryToUndo?.playerName,
          drillResultId: entryToUndo?.drillResultId,
          eventId: selectedEvent?.id
        }}
      />
    </div>
  );
} 
