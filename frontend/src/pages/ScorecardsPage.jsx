import React, { useState, useEffect, useCallback } from 'react';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PlayerScorecardGenerator from '../components/PlayerScorecardGenerator';
import EventSelector from '../components/EventSelector';
import LoadingScreen from '../components/LoadingScreen';
import ErrorDisplay from '../components/ErrorDisplay';
import { 
  getDefaultWeightsFromTemplate,
  getDrillsFromTemplate 
} from '../constants/drillTemplates';
import { FileText, Users, Search, Award, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

const ScorecardsPage = () => {
  const { selectedEvent } = useEvent();
  const { user, selectedLeagueId } = useAuth();
  const { showError } = useToast();
  
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get drill template and weights from event
  const drillTemplate = selectedEvent?.drillTemplate || 'football';
  const weights = getDefaultWeightsFromTemplate(drillTemplate);
  
  // Fetch players for the selected event
  const fetchPlayers = useCallback(async () => {
    if (!selectedEvent || !user || !selectedLeagueId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/players?event_id=${selectedEvent.id}`);
      setPlayers(res.data);
      
      // Auto-select first player if none selected (only check current state, not dependency)
      if (res.data.length > 0) {
        setSelectedPlayer(prev => prev || res.data[0]);
      }
    } catch (err) {
      if (err.response?.status === 422) {
        setError("Players may not be set up yet for this event");
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

  // Filter players based on search term with safe string handling
  const filteredPlayers = players.filter(player => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return true;
    
    const name = player.name?.toLowerCase() || '';
    const number = player.number?.toString() || '';
    const ageGroup = player.age_group?.toLowerCase() || '';
    
    return name.includes(searchLower) || 
           number.includes(searchLower) || 
           ageGroup.includes(searchLower);
  });

  // Filter players with at least some drill scores (with validation)
  const playersWithScores = filteredPlayers.filter(player => {
    try {
      const drills = getDrillsFromTemplate(drillTemplate);
      return drills.some(drill => {
        const value = player[drill.key];
        return value != null && 
               typeof value === 'number' && 
               !isNaN(value) && 
               isFinite(value);
      });
    } catch (err) {
      console.warn('Error filtering player scores:', err);
      return false;
    }
  });

  if (loading) {
    return (
      <LoadingScreen 
        title="Loading Player Scorecards"
        subtitle="Preparing player data and scorecard tools..."
        size="large"
      />
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <ErrorDisplay 
            error={error}
            onRetry={fetchPlayers}
            title="Scorecard Generation Error"
          />
        </div>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Event Selected</h2>
              <p className="text-gray-600 mb-6">
                Please select an event to generate player scorecards
              </p>
              <EventSelector />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <Award className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Player Scorecards</h1>
              <p className="text-gray-600">
                Generate professional performance reports for <span className="font-medium">{selectedEvent.name}</span>
              </p>
              <p className="text-sm text-gray-500">
                {playersWithScores.length} players available for scorecard generation
              </p>
            </div>
          </div>
        </div>

        {playersWithScores.length === 0 ? (
          /* No Players Warning */
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-2">No Players with Evaluation Scores</h3>
                <p className="text-yellow-800 mb-3">
                  Players need to have drill scores recorded before scorecards can be generated.
                  Head to the Players page to record drill scores first.
                </p>
                <Link 
                  to="/players" 
                  className="inline-flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <Users className="w-4 h-4" />
                  Go to Players Page
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Player Selection Panel */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-gray-900">Select Player</h2>
              </div>
              
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Search players by name, number, or age group"
                />
              </div>
              
              {/* Player List (compact) */}
              <div className="space-y-1 max-h-[28rem] overflow-y-auto">
                {playersWithScores.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayer(player)}
                    className={`w-full text-left p-2 rounded-md border transition-colors text-sm ${
                      selectedPlayer?.id === player.id
                        ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    aria-pressed={selectedPlayer?.id === player.id}
                    aria-label={`Select ${player.name} for scorecard generation`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{player.name}</div>
                        <div className="text-xs text-gray-600">
                          #{player.number} • {player.age_group}
                        </div>
                      </div>
                      <FileText className="w-3 h-3 text-gray-400 hidden md:block" />
                    </div>
                  </button>
                ))}
              </div>
              
              {filteredPlayers.length !== playersWithScores.length && (
                <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">
                    Showing {playersWithScores.length} of {filteredPlayers.length} players with evaluation scores
                  </p>
                </div>
              )}
            </div>
            
            {/* Scorecard Generator */}
            <div className="lg:col-span-2">
              <PlayerScorecardGenerator
                player={selectedPlayer}
                allPlayers={players}
                weights={weights}
                selectedDrillTemplate={drillTemplate}
              />
            </div>
          </div>
        )}

        {/* Benefits Section */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <Award className="w-6 h-6 text-blue-600 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Professional Player Communication</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">For Players & Parents:</h4>
                  <ul className="text-gray-700 space-y-1">
                    <li>• Detailed performance breakdown by drill</li>
                    <li>• Age group rankings and percentiles</li>
                    <li>• Specific improvement recommendations</li>
                    <li>• Professional PDF reports to keep</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">For Coaches:</h4>
                  <ul className="text-gray-700 space-y-1">
                    <li>• Build trust through transparency</li>
                    <li>• Professional program presentation</li>
                    <li>• Easy sharing via email</li>
                    <li>• Custom coach notes and feedback</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScorecardsPage;