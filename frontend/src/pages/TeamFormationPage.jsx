import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import TeamFormationTool from '../components/TeamFormationTool';
import EventSelector from '../components/EventSelector';
import { Users, Target, BarChart3, Shuffle, Trophy, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { logger } from '../utils/logger';

const TeamFormationPage = () => {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const [players, setPlayers] = useState([]);
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
      setPlayers(response.data || []);
    } catch (error) {
      logger.error('TEAM-FORMATION', 'Error fetching players', error);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 mt-20">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-xl">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-cmf-secondary">Intelligent Team Formation</h1>
              <p className="text-sm text-gray-600">Create balanced teams with AI algorithms</p>
            </div>
          </div>
          <div className="text-center">
            <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-medium">
              🆕 New Feature
            </span>
          </div>
        </div>

          {/* Benefits Banner */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-green-900 mb-3">Smart Team Formation Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Shuffle className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <h3 className="font-medium text-green-900">3 Formation Algorithms</h3>
                  <p className="text-sm text-green-700">Balanced, Snake Draft, and Skill-based distribution</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-purple-500 mt-1" />
                <div>
                  <h3 className="font-medium text-green-900">Real-time Balance Analysis</h3>
                  <p className="text-sm text-green-700">Visual indicators showing team balance quality</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <h3 className="font-medium text-green-900">Drag & Drop Adjustment</h3>
                  <p className="text-sm text-green-700">Fine-tune teams with manual player moves</p>
                </div>
              </div>
            </div>
          </div>

          <EventSelector />
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading players...</p>
          </div>
        ) : !selectedEvent ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Select an Event</h3>
            <p className="text-gray-600">Choose an event above to access team formation tools.</p>
          </div>
        ) : players.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Players Found</h3>
            <p className="text-gray-600 mb-4">You need players with drill scores before you can form teams.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left max-w-md mx-auto">
              <h4 className="font-medium text-amber-900 mb-2">To get started:</h4>
              <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                <li>Add players to your event</li>
                <li>Record drill results for each player</li>
                <li>Return here to create balanced teams</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Team Formation Tool */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Team Formation Tool</h3>
              <TeamFormationTool 
                players={players}
                weights={weights}
                selectedDrillTemplate="football"
              />
            </div>

            {/* Algorithm Explanation */}
            <div className="bg-white rounded-2xl shadow-lg border border-blue-200 p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">Formation Algorithms</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <h4 className="font-medium text-blue-900 mb-1">🔄 Balanced Distribution</h4>
                  <p className="text-blue-700 text-xs">Round-robin assignment ensures even distribution of talent across all teams.</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <h4 className="font-medium text-blue-900 mb-1">🐍 Snake Draft</h4>
                  <p className="text-blue-700 text-xs">Draft-style selection (1→2→3→3→2→1) mimics professional team drafts.</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <h4 className="font-medium text-blue-900 mb-1">🎯 Skill-Based</h4>
                  <p className="text-blue-700 text-xs">Advanced algorithm balances specific skills rather than overall scores.</p>
                </div>
              </div>
            </div>

            {/* Success Tips */}
            <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-3">📋 Best Practices</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <h4 className="font-medium text-green-900 mb-2">Before Formation:</h4>
                  <ul className="text-green-800 space-y-1 list-disc list-inside text-xs">
                    <li>Ensure all players have complete drill scores</li>
                    <li>Review and adjust drill weight priorities</li>
                    <li>Consider age group and skill level differences</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-green-900 mb-2">After Formation:</h4>
                  <ul className="text-green-800 space-y-1 list-disc list-inside text-xs">
                    <li>Review team balance indicators</li>
                    <li>Make manual adjustments if needed</li>
                    <li>Export final rosters for league management</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamFormationPage;