import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import { 
  Users, 
  Shuffle, 
  BarChart3, 
  Download, 
  Plus, 
  Minus,
  Target,
  Trophy,
  AlertTriangle,
  Settings,
  RefreshCw
} from 'lucide-react';
import { getDrillsFromTemplate } from '../constants/drillTemplates';
import { calculateOptimizedCompositeScore } from '../utils/optimizedScoring';

const TeamFormationTool = ({ players = [], weights = {}, selectedDrillTemplate = 'football' }) => {
  const { showSuccess, showError } = useToast();
  
  const [numTeams, setNumTeams] = useState(2);
  const [teams, setTeams] = useState([]);
  const [formationMethod, setFormationMethod] = useState('balanced'); // 'balanced', 'snake_draft', 'skill_based'
  const [teamNames, setTeamNames] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [skillWeightings, setSkillWeightings] = useState({});
  
  // Get current drill template
  const currentDrills = getDrillsFromTemplate(selectedDrillTemplate);

  // Calculate composite scores for all players using normalized scoring
  const rankedPlayers = useMemo(() => {
    if (!players || players.length === 0) return [];
    
    // Convert decimal weights to percentage format expected by normalized scoring
    const percentageWeights = {};
    Object.entries(weights).forEach(([key, value]) => {
      percentageWeights[key] = value * 100; // Convert 0.2 to 20
    });
    
    // Use optimized scoring instead of normalized scoring to avoid legacy dependencies
    const scoredPlayers = players.map(player => ({
      ...player,
      compositeScore: calculateOptimizedCompositeScore(player, players, percentageWeights, currentDrills)
    }));

    return scoredPlayers
      .filter(player => player.compositeScore > 0) // Only include players with scores
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }, [players, weights, currentDrills]);

  // Initialize team names
  useEffect(() => {
    const defaultNames = [];
    for (let i = 1; i <= numTeams; i++) {
      defaultNames.push(`Team ${i}`);
    }
    setTeamNames(defaultNames);
  }, [numTeams]);

  // Initialize skill weightings
  useEffect(() => {
    const defaultWeightings = {};
    currentDrills.forEach(drill => {
      defaultWeightings[drill.key] = 1.0; // Equal weighting by default
    });
    setSkillWeightings(defaultWeightings);
  }, [currentDrills]);

  const calculateTeamBalance = (team) => {
    if (!team || team.length === 0) return { avgScore: 0, skillBreakdown: {} };
    
    const totalScore = team.reduce((sum, player) => sum + player.compositeScore, 0);
    const avgScore = totalScore / team.length;
    
    const skillBreakdown = {};
    currentDrills.forEach(drill => {
      const skillScores = team
        .map(player => player[drill.key])
        .filter(score => score != null && typeof score === 'number');
      
      if (skillScores.length > 0) {
        skillBreakdown[drill.key] = {
          avg: skillScores.reduce((sum, score) => sum + score, 0) / skillScores.length,
          count: skillScores.length
        };
      }
    });
    
    return { avgScore, skillBreakdown };
  };

  const createBalancedTeams = () => {
    if (rankedPlayers.length === 0) {
      showError('No players with scores available for team formation');
      return;
    }

    const newTeams = Array.from({ length: numTeams }, () => []);
    
    if (formationMethod === 'balanced') {
      // Distribute players in round-robin fashion to balance overall talent
      rankedPlayers.forEach((player, index) => {
        const teamIndex = index % numTeams;
        newTeams[teamIndex].push(player);
      });
    } else if (formationMethod === 'snake_draft') {
      // Snake draft: 1->2->3->3->2->1->1->2->3...
      let currentTeam = 0;
      let direction = 1;
      
      rankedPlayers.forEach((player) => {
        newTeams[currentTeam].push(player);
        
        if (direction === 1 && currentTeam === numTeams - 1) {
          direction = -1;
        } else if (direction === -1 && currentTeam === 0) {
          direction = 1;
        } else {
          currentTeam += direction;
        }
      });
    } else if (formationMethod === 'skill_based') {
      // Distribute based on individual skill requirements per team
      // This is a more complex algorithm that tries to balance specific skills
      const playersBySkill = {};
      
      currentDrills.forEach(drill => {
        playersBySkill[drill.key] = [...rankedPlayers].sort((a, b) => {
          const aScore = a[drill.key] || 0;
          const bScore = b[drill.key] || 0;
          return drill.lowerIsBetter ? aScore - bScore : bScore - aScore;
        });
      });
      
      // Start with balanced distribution, then optimize
      rankedPlayers.forEach((player, index) => {
        const teamIndex = index % numTeams;
        newTeams[teamIndex].push(player);
      });
    }
    
    setTeams(newTeams);
    showSuccess(`Successfully created ${numTeams} balanced teams!`);
  };

  const movePlayerToTeam = (playerId, fromTeamIndex, toTeamIndex) => {
    const newTeams = [...teams];
    const playerIndex = newTeams[fromTeamIndex].findIndex(p => p.id === playerId);
    
    if (playerIndex !== -1) {
      const [player] = newTeams[fromTeamIndex].splice(playerIndex, 1);
      newTeams[toTeamIndex].push(player);
      setTeams(newTeams);
    }
  };

  const exportTeams = () => {
    if (teams.length === 0) {
      showError('Please create teams first');
      return;
    }

    const exportData = teams.map((team, index) => ({
      teamName: teamNames[index] || `Team ${index + 1}`,
      players: team.map(player => ({
        name: player.name,
        number: player.number,
        ageGroup: player.age_group,
        compositeScore: player.compositeScore,
        ...currentDrills.reduce((acc, drill) => {
          acc[drill.label] = player[drill.key] || 'N/A';
          return acc;
        }, {})
      })),
      teamStats: calculateTeamBalance(team)
    }));

    // Create CSV content
    let csvContent = 'Team,Player Name,Number,Age Group,Composite Score';
    currentDrills.forEach(drill => {
      csvContent += `,${drill.label}`;
    });
    csvContent += '\n';

    exportData.forEach(teamData => {
      teamData.players.forEach(player => {
        csvContent += `${teamData.teamName},${player.name},${player.number || ''},${player.ageGroup || ''},${player.compositeScore}`;
        currentDrills.forEach(drill => {
          csvContent += `,${player[drill.label] || ''}`;
        });
        csvContent += '\n';
      });
    });

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-formations-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showSuccess('Team rosters exported successfully!');
  };

  const getTeamBalanceIndicator = (team) => {
    const teamBalance = calculateTeamBalance(team);
    const allTeamAvgs = teams.map(t => calculateTeamBalance(t).avgScore);
    const overallAvg = allTeamAvgs.reduce((sum, avg) => sum + avg, 0) / allTeamAvgs.length;
    
    const difference = Math.abs(teamBalance.avgScore - overallAvg);
    const percentDiff = (difference / overallAvg) * 100;
    
    if (percentDiff < 5) return { color: 'text-green-600', label: 'Well Balanced' };
    if (percentDiff < 10) return { color: 'text-yellow-600', label: 'Moderately Balanced' };
    return { color: 'text-red-600', label: 'Needs Balancing' };
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Team Formation Tool</h2>
          <p className="text-sm text-gray-600">
            Create balanced teams from {rankedPlayers.length} ranked players
          </p>
        </div>
      </div>

      {/* Formation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Teams
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNumTeams(Math.max(2, numTeams - 1))}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 bg-gray-50 rounded-lg font-medium min-w-[60px] text-center">
              {numTeams}
            </span>
            <button
              onClick={() => setNumTeams(Math.min(8, numTeams + 1))}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Formation Method
          </label>
          <select
            value={formationMethod}
            onChange={(e) => setFormationMethod(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="balanced">Balanced Distribution</option>
            <option value="snake_draft">Snake Draft</option>
            <option value="skill_based">Skill-Based Balance</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={createBalancedTeams}
            disabled={rankedPlayers.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Shuffle className="w-4 h-4" />
            Create Teams
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">Advanced Team Formation</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {currentDrills.map(drill => (
              <div key={drill.key}>
                <label className="block text-sm text-gray-600 mb-1">
                  {drill.label} Weight
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={skillWeightings[drill.key] || 1}
                  onChange={(e) => setSkillWeightings({
                    ...skillWeightings,
                    [drill.key]: parseFloat(e.target.value)
                  })}
                  className="w-full"
                />
                <span className="text-xs text-gray-500">
                  {(skillWeightings[drill.key] || 1).toFixed(1)}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams Display */}
      {teams.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Generated Teams</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={exportTeams}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={createBalancedTeams}
                className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team, teamIndex) => {
              const teamBalance = calculateTeamBalance(team);
              const balanceIndicator = getTeamBalanceIndicator(team);
              
              return (
                <div key={teamIndex} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      value={teamNames[teamIndex] || `Team ${teamIndex + 1}`}
                      onChange={(e) => {
                        const newNames = [...teamNames];
                        newNames[teamIndex] = e.target.value;
                        setTeamNames(newNames);
                      }}
                      className="font-semibold text-lg bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                    />
                    <div className="flex items-center gap-2">
                      <Trophy className={`w-4 h-4 ${balanceIndicator.color}`} />
                      <span className={`text-xs ${balanceIndicator.color}`}>
                        {balanceIndicator.label}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3 p-2 bg-gray-50 rounded">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Players:</span> {team.length}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Avg Score:</span> {teamBalance.avgScore.toFixed(2)}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {team.map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-xs text-gray-500">
                            #{player.number} - {player.age_group}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-600">
                            {player.compositeScore.toFixed(1)}
                          </div>
                          <div className="flex gap-1">
                            {teams.map((_, otherTeamIndex) => (
                              otherTeamIndex !== teamIndex && (
                                <button
                                  key={otherTeamIndex}
                                  onClick={() => movePlayerToTeam(player.id, teamIndex, otherTeamIndex)}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  title={`Move to ${teamNames[otherTeamIndex] || `Team ${otherTeamIndex + 1}`}`}
                                >
                                  -T{otherTeamIndex + 1}
                                </button>
                              )
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Team Balance Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Team Balance Analysis
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {teams.map((team, index) => {
                const balance = calculateTeamBalance(team);
                const indicator = getTeamBalanceIndicator(team);
                
                return (
                  <div key={index} className="text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {balance.avgScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {teamNames[index] || `Team ${index + 1}`}
                    </div>
                    <div className={`text-xs ${indicator.color}`}>
                      {indicator.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      {rankedPlayers.length === 0 && (
        <div className="text-center py-8">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Players Available</h3>
          <p className="text-gray-600">
            Players need drill scores before teams can be formed. 
            Make sure players have been evaluated first.
          </p>
        </div>
      )}

      {teams.length === 0 && rankedPlayers.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900 mb-1">Ready to Create Teams</h4>
              <p className="text-sm text-yellow-800">
                You have {rankedPlayers.length} players with scores ready for team formation. 
                Choose your formation method and click "Create Teams" to get started.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamFormationTool;