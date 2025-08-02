import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import TeamFormationTool from '../components/TeamFormationTool';
import EventSelector from '../components/EventSelector';
import LoadingScreen from '../components/LoadingScreen';
import ErrorDisplay from '../components/ErrorDisplay';
import { 
  getDrillsFromTemplate, 
  getDefaultWeightsFromTemplate,
  getTemplateById 
} from '../constants/drillTemplates';
import { Settings, Users, Target, AlertTriangle } from 'lucide-react';
import api from '../lib/api';

const TeamFormationPage = () => {
  const { selectedEvent } = useEvent();
  const { user, selectedLeagueId, userRole } = useAuth();
  const { showError, showSuccess } = useToast();
  
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWeightControls, setShowWeightControls] = useState(false);
  
  // Get drill template from event or default to football
  const drillTemplate = selectedEvent?.drillTemplate || 'football';
  const template = getTemplateById(drillTemplate);
  
  // Weight management state
  const [weights, setWeights] = useState(() => {
    const defaultWeights = getDefaultWeightsFromTemplate(drillTemplate);
    // Convert to percentage format that TeamFormationTool expects
    const percentageWeights = {};
    Object.entries(defaultWeights).forEach(([key, value]) => {
      percentageWeights[key] = value * 100; // Convert 0.2 to 20
    });
    return percentageWeights;
  });
  
  // Update weights when drill template changes
  useEffect(() => {
    const defaultWeights = getDefaultWeightsFromTemplate(drillTemplate);
    const percentageWeights = {};
    Object.entries(defaultWeights).forEach(([key, value]) => {
      percentageWeights[key] = value * 100;
    });
    setWeights(percentageWeights);
  }, [drillTemplate]);
  
  // Normalize weights for TeamFormationTool (expects decimal format)
  const normalizedWeights = useMemo(() => {
    const normalized = {};
    Object.entries(weights).forEach(([key, value]) => {
      normalized[key] = value / 100; // Convert 20 to 0.2
    });
    return normalized;
  }, [weights]);
  
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

  // Filter players with drill scores
  const playersWithScores = useMemo(() => {
    const drills = getDrillsFromTemplate(drillTemplate);
    return players.filter(player => 
      drills.some(drill => player[drill.key] != null && typeof player[drill.key] === 'number')
    );
  }, [players, drillTemplate]);

  // Weight preset functions
  const applyPreset = (presetKey) => {
    if (!template?.presets?.[presetKey]) return;
    
    const presetWeights = template.presets[presetKey].weights;
    const percentageWeights = {};
    Object.entries(presetWeights).forEach(([key, value]) => {
      percentageWeights[key] = value * 100;
    });
    setWeights(percentageWeights);
    showSuccess(`Applied ${template.presets[presetKey].name} weight preset`);
  };

  const handleWeightChange = (drillKey, value) => {
    setWeights(prev => ({
      ...prev,
      [drillKey]: value
    }));
  };

  const resetWeights = () => {
    const defaultWeights = getDefaultWeightsFromTemplate(drillTemplate);
    const percentageWeights = {};
    Object.entries(defaultWeights).forEach(([key, value]) => {
      percentageWeights[key] = value * 100;
    });
    setWeights(percentageWeights);
    showSuccess('Reset to default weights');
  };

  if (loading) {
    return (
      <LoadingScreen 
        title="Loading Team Formation"
        subtitle="Preparing player data and team formation tools..."
        size="large"
      />
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <ErrorDisplay 
            error={error}
            onRetry={fetchPlayers}
            title="Team Formation Error"
          />
        </div>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="text-center">
              <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Event Selected</h2>
              <p className="text-gray-600 mb-6">
                Please select an event to begin team formation
              </p>
              <EventSelector />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentDrills = getDrillsFromTemplate(drillTemplate);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Team Formation</h1>
                <p className="text-gray-600">
                  Create balanced teams for <span className="font-medium">{selectedEvent.name}</span>
                </p>
                <p className="text-sm text-gray-500">
                  Using {template?.name || 'Football'} template • {playersWithScores.length} players with scores
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowWeightControls(!showWeightControls)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showWeightControls 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              Weight Settings
            </button>
          </div>
        </div>

        {/* Weight Controls */}
        {showWeightControls && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Drill Weight Configuration</h3>
            <p className="text-sm text-gray-600 mb-4">
              Adjust the importance of each drill in team formation calculations
            </p>
            
            {/* Weight Presets */}
            {template?.presets && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Presets</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(template.presets).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className="px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors"
                      title={preset.description}
                    >
                      {preset.name}
                    </button>
                  ))}
                  <button
                    onClick={resetWeights}
                    className="px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            )}
            
            {/* Weight Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentDrills.map(drill => (
                <div key={drill.key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-700">
                      {drill.label}
                    </label>
                    <span className="text-sm text-gray-600 font-mono">
                      {weights[drill.key]?.toFixed(0) || 0}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="0.1"
                    value={weights[drill.key] || 0}
                    onChange={(e) => handleWeightChange(drill.key, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="text-xs text-gray-500">
                    {drill.unit} • {drill.lowerIsBetter ? 'Lower is better' : 'Higher is better'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Players Warning */}
        {playersWithScores.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900 mb-1">No Players with Scores</h4>
                <p className="text-sm text-yellow-800">
                  Players need to have drill scores recorded before they can be formed into teams.
                  Head to the <Link to="/players" className="underline">Players page</Link> to record drill scores first.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Team Formation Tool */}
        <TeamFormationTool
          players={playersWithScores}
          weights={normalizedWeights}
          selectedDrillTemplate={drillTemplate}
        />
      </div>
    </div>
  );
};

export default TeamFormationPage;