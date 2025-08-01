import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import PlayerScorecardGenerator from '../components/PlayerScorecardGenerator';
import EventSelector from '../components/EventSelector';
import { FileText, Download, Mail, Award, Users, Star, BarChart3 } from 'lucide-react';
import api from '../lib/api';
import { logger } from '../utils/logger';

const ScorecardsPage = () => {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weights, setWeights] = useState({
    "40m_dash": 0.3,
    "vertical_jump": 0.2,
    "catching": 0.15,
    "throwing": 0.15,
    "agility": 0.2,
  });

  // Fetch players when event changes
  useEffect(() => {
    if (selectedEvent?.id) {
      setLoading(true);
      fetchPlayers();
    }
  }, [selectedEvent]);

  const fetchPlayers = async () => {
    try {
      const response = await api.get(`/players?event_id=${selectedEvent.id}`);
      const playersData = response.data || [];
      setPlayers(playersData);
      
      // Auto-select first player with scores for demo
      const playerWithScores = playersData.find(p => 
        p['40m_dash'] || p.vertical_jump || p.catching || p.throwing || p.agility
      );
      if (playerWithScores && !selectedPlayer) {
        setSelectedPlayer(playerWithScores);
      }
    } catch (error) {
      logger.error('SCORECARDS-PAGE', 'Error fetching players', error);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const playersWithScores = players.filter(p => 
    p['40m_dash'] || p.vertical_jump || p.catching || p.throwing || p.agility
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 mt-20">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-orange-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-xl">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-cmf-secondary">Professional Player Scorecards</h1>
              <p className="text-sm text-gray-600">Generate detailed PDF reports & share results</p>
            </div>
          </div>
          <div className="text-center">
            <span className="bg-orange-100 text-orange-800 text-xs px-3 py-1 rounded-full font-medium">
              🆕 New Feature
            </span>
          </div>
        </div>

          {/* Benefits Banner */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-orange-900 mb-3">Professional Communication Benefits</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-yellow-500 mt-1" />
                <div>
                  <h3 className="font-medium text-orange-900">Detailed Analysis</h3>
                  <p className="text-sm text-orange-700">Comprehensive breakdown with percentiles and rankings</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <h3 className="font-medium text-orange-900">Easy Sharing</h3>
                  <p className="text-sm text-orange-700">One-click email sharing with professional formatting</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-purple-500 mt-1" />
                <div>
                  <h3 className="font-medium text-orange-900">Development Focus</h3>
                  <p className="text-sm text-orange-700">Improvement recommendations for each player</p>
                </div>
              </div>
            </div>
          </div>

          <EventSelector />
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading players...</p>
          </div>
        ) : !selectedEvent ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Select an Event</h3>
            <p className="text-gray-600">Choose an event above to generate player scorecards.</p>
          </div>
        ) : playersWithScores.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <BarChart3 className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Player Data Available</h3>
            <p className="text-gray-600 mb-4">You need players with drill scores before you can generate scorecards.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left max-w-md mx-auto">
              <h4 className="font-medium text-amber-900 mb-2">To get started:</h4>
              <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                <li>Add players to your event</li>
                <li>Record drill results for each player</li>
                <li>Return here to generate professional scorecards</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Player Selection */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sticky top-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Select Player
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {playersWithScores.map(player => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayer(player)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedPlayer?.id === player.id
                          ? 'border-orange-500 bg-orange-50 text-orange-900'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="font-medium">{player.name}</div>
                      <div className="text-sm text-gray-500">
                        #{player.number} • {player.age_group}
                      </div>
                      <div className="text-xs mt-1">
                        {[player['40m_dash'], player.vertical_jump, player.catching, player.throwing, player.agility]
                          .filter(Boolean).length} drills completed
                      </div>
                    </button>
                  ))}
                </div>
                
                {playersWithScores.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">
                      <strong>{playersWithScores.length}</strong> players ready for scorecards
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Scorecard Generator */}
            <div className="lg:col-span-2">
              {selectedPlayer ? (
                <PlayerScorecardGenerator
                  player={selectedPlayer}
                  allPlayers={players}
                  weights={weights}
                  selectedDrillTemplate="football"
                />
              ) : (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Player</h3>
                  <p className="text-gray-600">Choose a player from the list to generate their professional scorecard.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature Showcase */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">📋 What's Included in Professional Scorecards</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <h4 className="font-medium text-blue-900 mb-2">📊 Performance Analysis</h4>
              <ul className="text-blue-700 space-y-1 text-xs">
                <li>• Individual drill scores</li>
                <li>• Age group rankings</li>
                <li>• Percentile comparisons</li>
                <li>• Composite scoring</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <h4 className="font-medium text-blue-900 mb-2">🎯 Development Focus</h4>
              <ul className="text-blue-700 space-y-1 text-xs">
                <li>• Strength identification</li>
                <li>• Improvement areas</li>
                <li>• Training recommendations</li>
                <li>• Next steps guidance</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <h4 className="font-medium text-blue-900 mb-2">🏆 Professional Format</h4>
              <ul className="text-blue-700 space-y-1 text-xs">
                <li>• Clean PDF layout</li>
                <li>• Event branding</li>
                <li>• Coach notes section</li>
                <li>• Summary statistics</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <h4 className="font-medium text-blue-900 mb-2">📧 Easy Sharing</h4>
              <ul className="text-blue-700 space-y-1 text-xs">
                <li>• One-click email</li>
                <li>• PDF download</li>
                <li>• Parent-friendly format</li>
                <li>• Multiple recipients</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Benefits for Different Users */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h4 className="font-semibold text-green-900 mb-3">👨‍🏫 For Coaches</h4>
            <ul className="text-sm text-green-800 space-y-2">
              <li>• Professional communication with families</li>
              <li>• Data-driven player development plans</li>
              <li>• Transparent evaluation process</li>
              <li>• Enhanced program credibility</li>
            </ul>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h4 className="font-semibold text-blue-900 mb-3">👨‍👩‍👧‍👦 For Parents</h4>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Clear understanding of child's performance</li>
              <li>• Specific areas for improvement</li>
              <li>• Objective, unbiased evaluation</li>
              <li>• Keepsake documentation</li>
            </ul>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
            <h4 className="font-semibold text-purple-900 mb-3">🏃‍♂️ For Players</h4>
            <ul className="text-sm text-purple-800 space-y-2">
              <li>• Motivation through clear goals</li>
              <li>• Recognition of strengths</li>
              <li>• Constructive improvement feedback</li>
              <li>• Personal development tracking</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScorecardsPage;