import React, { useState, useEffect, useRef, useCallback } from "react";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import api from '../lib/api';
import { Clock, Users, Undo2, CheckCircle, AlertTriangle, ArrowLeft, Calendar, ChevronDown, Target, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

const DRILLS = [
  { key: "40m_dash", label: "40-Yard Dash", unit: "sec", lowerIsBetter: true },
  { key: "vertical_jump", label: "Vertical Jump", unit: "in", lowerIsBetter: false },
  { key: "catching", label: "Catching", unit: "pts", lowerIsBetter: false },
  { key: "throwing", label: "Throwing", unit: "pts", lowerIsBetter: false },
  { key: "agility", label: "Agility", unit: "pts", lowerIsBetter: false },
];

export default function LiveEntry() {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  
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
  
  // Auto-complete logic
  useEffect(() => {
    if (playerNumber && players.length > 0) {
      const filtered = players.filter(p => 
        p.number && p.number.toString().startsWith(playerNumber)
      );
      setFilteredPlayers(filtered);
      
      // Auto-select if exact match
      const exactMatch = players.find(p => p.number && p.number.toString() === playerNumber);
      if (exactMatch) {
        setPlayerName(exactMatch.name);
        setPlayerId(exactMatch.id);
      } else {
        setPlayerName("");
        setPlayerId("");
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
        drill: DRILLS.find(d => d.key === targetDrill)
      };
    }
    return null;
  }, [players]);
  
  // Handle score submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDrill || !playerId || !score) {
      return;
    }
    
    // Check for duplicate
    const duplicate = checkForDuplicate(playerId, selectedDrill);
    if (duplicate) {
      setDuplicateData({ ...duplicate, newScore: parseFloat(score) });
      setShowDuplicateDialog(true);
      return;
    }
    
    await submitScore();
  };
  
  const submitScore = async (overrideDuplicate = false) => {
    setLoading(true);
    
    try {
      await api.post('/drill-results/', {
        player_id: playerId,
        type: selectedDrill,
        value: parseFloat(score),
        event_id: selectedEvent.id
      });
      
      // Add to recent entries
      const entry = {
        id: Date.now(),
        playerNumber,
        playerName,
        drill: DRILLS.find(d => d.key === selectedDrill),
        score: parseFloat(score),
        timestamp: new Date(),
        overridden: overrideDuplicate
      };
      
      setRecentEntries(prev => [entry, ...prev.slice(0, 9)]); // Keep last 10
      
      // Reset form
      setPlayerNumber("");
      setScore("");
      setShowDuplicateDialog(false);
      setDuplicateData(null);
      
      // Refresh players data
      await fetchPlayers();
      
      // Auto-focus back to player number
      setTimeout(() => {
        playerNumberRef.current?.focus();
      }, 100);
      
          } catch {
        // Score submission failed
      alert('Error submitting score. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUndo = async () => {
    if (recentEntries.length === 0) return;
    
    const lastEntry = recentEntries[0];
    if (confirm(`Undo entry for ${lastEntry.playerName}?`)) {
      // Note: In a real implementation, you'd want a delete endpoint
      // For now, we'll just remove from the UI
      setRecentEntries(prev => prev.slice(1));
    }
  };
  
  const selectPlayer = (player) => {
    setPlayerNumber(player.number.toString());
    setPlayerName(player.name);
    setPlayerId(player.id);
    setFilteredPlayers([]);
    setTimeout(() => {
      scoreRef.current?.focus();
    }, 100);
  };

  // Smart scroll through actual player numbers only
  const handlePlayerNumberScroll = (e) => {
    e.preventDefault(); // Prevent page scroll
    
    if (players.length === 0) return;
    
    // Get all existing player numbers, sorted
    const playerNumbers = players
      .map(p => p.number)
      .filter(num => num !== null && num !== undefined)
      .map(num => parseInt(num))
      .filter(num => !isNaN(num))
      .sort((a, b) => a - b);
    
    if (playerNumbers.length === 0) return;
    
    const currentNum = parseInt(playerNumber) || 0;
    const currentIndex = playerNumbers.indexOf(currentNum);
    
    let newIndex;
    if (e.deltaY < 0) {
      // Scroll up - go to previous player
      newIndex = currentIndex <= 0 ? playerNumbers.length - 1 : currentIndex - 1;
    } else {
      // Scroll down - go to next player  
      newIndex = currentIndex >= playerNumbers.length - 1 ? 0 : currentIndex + 1;
    }
    
    const newPlayerNumber = playerNumbers[newIndex];
    setPlayerNumber(newPlayerNumber.toString());
    
    // Auto-complete will handle setting the player name and ID
  };
  
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
            <Link 
              to="/admin" 
              className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-3 rounded-xl transition block"
            >
              Go to Admin Tools
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
  
  const currentDrill = DRILLS.find(d => d.key === selectedDrill);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
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
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="font-semibold">{recentEntries.length} entries</span>
            </div>
            <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
              Recording Active
            </div>
          </div>
        </div>
      </div>
      
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

            {/* Dropdown Selector */}
            <div className="relative mb-6">
              <select
                value={selectedDrill || ''}
                onChange={(e) => setSelectedDrill(e.target.value)}
                className="w-full p-3 pr-10 border-2 rounded-lg appearance-none bg-white text-left cursor-pointer transition-all duration-200 border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="" disabled>Select a drill to begin...</option>
                {DRILLS.map((drill) => (
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

                <div className="bg-white/70 rounded-lg p-3 border border-blue-200 mb-3">
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
              <button
                onClick={() => {
                  setSelectedDrill("");
                  setDrillConfirmed(false);
                }}
                className="mt-2 text-blue-200 hover:text-white text-sm underline"
              >
                Change Drill
              </button>
            </div>
            
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
                    onWheel={handlePlayerNumberScroll}
                    placeholder="Enter player #"
                    className="w-full text-2xl p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-center"
                    autoFocus
                    required
                  />
                  
                  {/* Player Auto-complete */}
                  {filteredPlayers.length > 0 && (
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
                    type="number"
                    step="0.1"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder={`Enter ${currentDrill.unit}`}
                    className="w-full text-3xl p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-center"
                    required
                  />
                </div>
                
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !playerId || !score}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold text-xl py-4 rounded-lg transition"
                >
                  {loading ? "Saving..." : "Submit & Next"}
                </button>
              </form>
            </div>
            
            {/* Action Buttons - Forward-looking flow */}
            <div className="flex gap-3">
              <Link
                to="/live-standings"
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-lg transform hover:scale-[1.02]"
              >
                <Target className="w-5 h-5" />
                View Live Standings
              </Link>
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
                    <Link
                      to="/players"
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
          </>
        )}
      </div>
      
      {/* Duplicate Score Dialog */}
      {showDuplicateDialog && duplicateData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
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
    </div>
  );
} 