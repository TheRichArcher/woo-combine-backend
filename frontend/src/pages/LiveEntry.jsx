import React, { useState, useEffect, useRef, useCallback } from "react";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import api from '../lib/api';
import { Clock, Users, Undo2, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const DRILLS = [
  { key: "40m_dash", label: "40M Dash", unit: "sec", lowerIsBetter: true },
  { key: "vertical_jump", label: "Vertical Jump", unit: "in", lowerIsBetter: false },
  { key: "catching", label: "Catching", unit: "pts", lowerIsBetter: false },
  { key: "throwing", label: "Throwing", unit: "pts", lowerIsBetter: false },
  { key: "agility", label: "Agility", unit: "pts", lowerIsBetter: false },
];

export default function LiveEntry() {
  const { selectedEvent } = useEvent();
  const { user } = useAuth();
  
  // Core state
  const [selectedDrill, setSelectedDrill] = useState("");
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
  
  // Load players on mount
  useEffect(() => {
    if (selectedEvent) {
      fetchPlayers();
    }
  }, [selectedEvent]);
  
  const fetchPlayers = async () => {
    try {
      const response = await api.get(`/players?event_id=${selectedEvent.id}`);
      setPlayers(response.data);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };
  
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
      
    } catch (error) {
      console.error('Error submitting score:', error);
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
  
  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Event Selected</h1>
          <p className="text-gray-600 mb-6">Please select an event first.</p>
          <Link to="/dashboard" className="bg-blue-500 text-white px-6 py-3 rounded-lg">
            Go to Dashboard
          </Link>
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
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            {recentEntries.length} entries
          </div>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Drill Selection */}
        {!selectedDrill ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Select Drill</h2>
            <div className="grid grid-cols-1 gap-3">
              {DRILLS.map(drill => (
                <button
                  key={drill.key}
                  onClick={() => setSelectedDrill(drill.key)}
                  className="p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition"
                >
                  <div className="font-semibold text-gray-900">{drill.label}</div>
                  <div className="text-sm text-gray-600">Unit: {drill.unit}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Active Drill Header */}
            <div className="bg-blue-500 text-white rounded-xl p-4 text-center">
              <h2 className="text-xl font-bold">{currentDrill.label}</h2>
              <p className="text-blue-100">Entry Mode Active</p>
              <button
                onClick={() => setSelectedDrill("")}
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
                    type="number"
                    value={playerNumber}
                    onChange={(e) => setPlayerNumber(e.target.value)}
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
            
            {/* Undo Button */}
            {recentEntries.length > 0 && (
              <button
                onClick={handleUndo}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2"
              >
                <Undo2 className="w-5 h-5" />
                Undo Last Entry
              </button>
            )}
            
            {/* Recent Entries */}
            {recentEntries.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Recent Entries
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {recentEntries.map(entry => (
                    <div key={entry.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">#{entry.playerNumber} {entry.playerName}</div>
                        <div className="text-sm text-gray-600">
                          {entry.drill.label}: {entry.score} {entry.drill.unit}
                          {entry.overridden && <span className="text-orange-600 ml-1">(Updated)</span>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.timestamp.toLocaleTimeString()}
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