import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Timer, Trophy, Users, ArrowRight, Star, BarChart3, Zap, Target, Settings, Download, ChevronRight, Play, Pause, RotateCcw } from "lucide-react";

// Comprehensive demo data - full combine results
const INITIAL_DEMO_PLAYERS = [
  { 
    id: 1, 
    name: "Alex Johnson", 
    number: 12, 
    ageGroup: "U16",
    fortyYardDash: 4.38, 
    vertical: 36, 
    catching: 18, 
    throwing: 85, 
    agility: 22,
    compositeScore: null
  },
  { 
    id: 2, 
    name: "Jordan Smith", 
    number: 7, 
    ageGroup: "U16",
    fortyYardDash: 4.52, 
    vertical: 34, 
    catching: 16, 
    throwing: 82, 
    agility: 24,
    compositeScore: null
  },
  { 
    id: 3, 
    name: "Taylor Brown", 
    number: 23, 
    ageGroup: "U14",
    fortyYardDash: 4.67, 
    vertical: 32, 
    catching: 20, 
    throwing: 78, 
    agility: 26,
    compositeScore: null
  },
  { 
    id: 4, 
    name: "Morgan Davis", 
    number: 15, 
    ageGroup: "U16",
    fortyYardDash: null, 
    vertical: null, 
    catching: null, 
    throwing: null, 
    agility: null,
    compositeScore: null
  },
  { 
    id: 5, 
    name: "Casey Williams", 
    number: 3, 
    ageGroup: "U14",
    fortyYardDash: 4.89, 
    vertical: 28, 
    catching: 15, 
    throwing: 75, 
    agility: 28,
    compositeScore: null
  },
  { 
    id: 6, 
    name: "Riley Martinez", 
    number: 8, 
    ageGroup: "U16",
    fortyYardDash: 4.44, 
    vertical: 35, 
    catching: null, 
    throwing: null, 
    agility: null,
    compositeScore: null
  }
];

const DRILLS = [
  { key: "fortyYardDash", label: "40-Yard Dash", unit: "sec", lowerIsBetter: true, icon: "⚡" },
  { key: "vertical", label: "Vertical Jump", unit: "in", lowerIsBetter: false, icon: "📏" },
  { key: "catching", label: "Catching", unit: "pts", lowerIsBetter: false, icon: "🏈" },
  { key: "throwing", label: "Throwing", unit: "pts", lowerIsBetter: false, icon: "🎯" },
  { key: "agility", label: "Agility", unit: "pts", lowerIsBetter: false, icon: "🏃" },
];

const DEMO_SCENARIOS = [
  {
    id: 1,
    title: "Live Entry Magic",
    desc: "Track multiple drills in real-time",
    icon: "⚡",
    color: "from-green-500 to-emerald-600"
  },
  {
    id: 2,
    title: "Smart Weight System",
    desc: "Adjust drill importance instantly",
    icon: "⚖️",
    color: "from-blue-500 to-cyan-600"
  },
  {
    id: 3,
    title: "Team Formation AI",
    desc: "Auto-balance teams by skill",
    icon: "🤖",
    color: "from-purple-500 to-indigo-600"
  },
  {
    id: 4,
    title: "Pro Analytics",
    desc: "Deep performance insights",
    icon: "📊",
    color: "from-orange-500 to-red-600"
  }
];

export default function Demo() {
  const navigate = useNavigate();
  const [currentScenario, setCurrentScenario] = useState(0);
  const [players, setPlayers] = useState(INITIAL_DEMO_PLAYERS);
  const [weights, setWeights] = useState({
    fortyYardDash: 25,
    vertical: 20,
    catching: 20,
    throwing: 20,
    agility: 15
  });
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Calculate composite scores and rankings
  const calculateCompositeScore = (player) => {
    let score = 0;
    let totalWeight = 0;
    
    DRILLS.forEach(drill => {
      const value = player[drill.key];
      if (value !== null && value !== undefined) {
        const weight = weights[drill.key];
        // Normalize scores (simplified scoring system)
        let normalizedScore;
        if (drill.lowerIsBetter) {
          normalizedScore = Math.max(0, 100 - (value - 4.0) * 20); // 40-yard dash scoring
        } else if (drill.key === 'vertical') {
          normalizedScore = Math.min(100, value * 2.5); // Vertical jump scoring
        } else {
          normalizedScore = Math.min(100, value * 5); // Points-based scoring
        }
        score += normalizedScore * (weight / 100);
        totalWeight += weight;
      }
    });
    
    return totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  };

  const rankedPlayers = players
    .map(player => ({
      ...player,
      compositeScore: calculateCompositeScore(player)
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((player, index) => ({ ...player, rank: index + 1 }));

  // Demo automation
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const timer = setTimeout(() => {
      if (currentScenario < DEMO_SCENARIOS.length - 1) {
        setCurrentScenario(prev => prev + 1);
      } else {
        setIsAutoPlaying(false);
      }
    }, 4000);
    
    return () => clearTimeout(timer);
  }, [currentScenario, isAutoPlaying]);

  const resetDemo = () => {
    setCurrentScenario(0);
    setPlayers(INITIAL_DEMO_PLAYERS);
    setWeights({
      fortyYardDash: 25,
      vertical: 20,
      catching: 20,
      throwing: 20,
      agility: 15
    });
    setIsAutoPlaying(false);
    setSelectedPlayer(null);
  };

  const startAutoDemo = () => {
    setIsAutoPlaying(true);
    setCurrentScenario(0);
  };

  const addMissingResults = () => {
    setPlayers(current => current.map(player => 
      player.id === 4 
        ? { 
            ...player, 
            fortyYardDash: 4.31, 
            vertical: 38, 
            catching: 19, 
            throwing: 88, 
            agility: 21 
          }
        : player.id === 6
        ? {
            ...player,
            catching: 17,
            throwing: 84,
            agility: 23
          }
        : player
    ));
  };

  const adjustWeights = (newWeights) => {
    setWeights(newWeights);
  };

  const balanceTeams = () => {
    // Simple team balancing demo
    const team1 = rankedPlayers.filter((_, index) => index % 2 === 0);
    const team2 = rankedPlayers.filter((_, index) => index % 2 === 1);
    return { team1, team2 };
  };

  const { team1, team2 } = balanceTeams();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🏈 WooCombine Complete Demo
            </h1>
            <p className="text-gray-600">
              Experience the full power of digital combine management
            </p>
            
            {/* Demo Controls */}
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={startAutoDemo}
                disabled={isAutoPlaying}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
              >
                {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isAutoPlaying ? 'Playing...' : 'Auto Demo'}
              </button>
              
              <button
                onClick={resetDemo}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Scenario Navigation */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {DEMO_SCENARIOS.map((scenario, index) => (
            <button
              key={scenario.id}
              onClick={() => setCurrentScenario(index)}
              className={`bg-gradient-to-r ${scenario.color} text-white p-4 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 ${
                currentScenario === index ? 'ring-4 ring-white scale-105' : ''
              }`}
            >
              <div className="text-2xl mb-2">{scenario.icon}</div>
              <div className="font-semibold text-sm">{scenario.title}</div>
              <div className="text-xs opacity-90">{scenario.desc}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Main Demo Content */}
          <div className="space-y-6">
            
            {/* Scenario 1: Live Entry Magic */}
            {currentScenario === 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  ⚡ Live Entry Magic
                  <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full">Real-time</span>
                </h2>
                
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-2">❌ Old Way: Paper & Calculators</h3>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li>• Papers get lost in the wind</li>
                      <li>• Manual calculations take forever</li>
                      <li>• No instant results for parents</li>
                      <li>• Prone to human error</li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-2">✅ WooCombine Way: Digital Magic</h3>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• Track all 5 drills instantly</li>
                      <li>• Real-time rankings and scorecards</li>
                      <li>• Parents see results immediately</li>
                      <li>• Zero manual calculations</li>
                    </ul>
                  </div>

                  <button
                    onClick={addMissingResults}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-all duration-200"
                  >
                    ⚡ Add Missing Results & Watch Magic
                  </button>
                </div>
              </div>
            )}

            {/* Scenario 2: Smart Weight System */}
            {currentScenario === 1 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  ⚖️ Smart Weight System
                  <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">AI-Powered</span>
                </h2>
                
                <p className="text-gray-600 mb-4">
                  Adjust drill importance and watch rankings change instantly!
                </p>

                <div className="space-y-3">
                  {DRILLS.map(drill => (
                    <div key={drill.key} className="flex items-center gap-3">
                      <span className="text-lg">{drill.icon}</span>
                      <span className="w-20 text-sm font-medium">{drill.label}</span>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={weights[drill.key]}
                        onChange={(e) => adjustWeights({ ...weights, [drill.key]: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="w-8 text-sm font-mono">{weights[drill.key]}%</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    💡 <strong>Try this:</strong> Increase 40-Yard Dash to 40% and watch Morgan Davis climb the rankings!
                  </p>
                </div>
              </div>
            )}

            {/* Scenario 3: Team Formation AI */}
            {currentScenario === 2 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  🤖 Team Formation AI
                  <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Balanced</span>
                </h2>
                
                <p className="text-gray-600 mb-4">
                  Automatically create balanced teams based on performance data
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 mb-2">🔴 Team Red</h3>
                    <div className="space-y-2">
                      {team1.slice(0, 3).map(player => (
                        <div key={player.id} className="flex justify-between text-sm">
                          <span>{player.name}</span>
                          <span className="font-mono">{player.compositeScore.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-red-300">
                      <div className="text-sm font-semibold">
                        Avg: {(team1.slice(0, 3).reduce((sum, p) => sum + p.compositeScore, 0) / 3).toFixed(1)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">🔵 Team Blue</h3>
                    <div className="space-y-2">
                      {team2.slice(0, 3).map(player => (
                        <div key={player.id} className="flex justify-between text-sm">
                          <span>{player.name}</span>
                          <span className="font-mono">{player.compositeScore.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-300">
                      <div className="text-sm font-semibold">
                        Avg: {(team2.slice(0, 3).reduce((sum, p) => sum + p.compositeScore, 0) / 3).toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                  <p className="text-purple-800 text-sm">
                    🎯 <strong>Perfect Balance:</strong> AI ensures fair teams every time, no more complaints from parents!
                  </p>
                </div>
              </div>
            )}

            {/* Scenario 4: Pro Analytics */}
            {currentScenario === 3 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  📊 Pro Analytics & Insights
                  <span className="text-sm bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Advanced</span>
                </h2>
                
                <div className="space-y-4">
                  {/* Performance Distribution */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Performance Distribution</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Top Performers (80-100)</span>
                        <span className="font-semibold text-green-600">
                          {rankedPlayers.filter(p => p.compositeScore >= 80).length} players
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Above Average (60-79)</span>
                        <span className="font-semibold text-blue-600">
                          {rankedPlayers.filter(p => p.compositeScore >= 60 && p.compositeScore < 80).length} players
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Developing (40-59)</span>
                        <span className="font-semibold text-yellow-600">
                          {rankedPlayers.filter(p => p.compositeScore >= 40 && p.compositeScore < 60).length} players
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Age Group Comparison */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Age Group Analysis</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>U16 Average</span>
                        <span className="font-mono">
                          {(rankedPlayers.filter(p => p.ageGroup === 'U16').reduce((sum, p) => sum + p.compositeScore, 0) / 
                            rankedPlayers.filter(p => p.ageGroup === 'U16').length).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>U14 Average</span>
                        <span className="font-mono">
                          {(rankedPlayers.filter(p => p.ageGroup === 'U14').reduce((sum, p) => sum + p.compositeScore, 0) / 
                            rankedPlayers.filter(p => p.ageGroup === 'U14').length).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-orange-50 rounded-lg">
                    <p className="text-orange-800 text-sm">
                      📈 <strong>Export Ready:</strong> Generate professional PDF reports for coaches, parents, and scouts!
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Live Rankings & Player Details */}
          <div className="space-y-6">
            
            {/* Current Rankings */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600" />
                Live Rankings
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Real-time</span>
              </h3>
              
              <div className="space-y-2">
                {rankedPlayers.slice(0, 6).map((player) => (
                  <div 
                    key={player.id}
                    onClick={() => setSelectedPlayer(player)}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        player.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                        player.rank === 2 ? 'bg-gray-100 text-gray-700' :
                        player.rank === 3 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        #{player.rank}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{player.name}</div>
                        <div className="text-xs text-gray-500">#{player.number} • {player.ageGroup}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-cyan-600">
                        {player.compositeScore.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">composite</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drill Results Matrix */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Drill Results Matrix
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium">Player</th>
                      {DRILLS.map(drill => (
                        <th key={drill.key} className="text-center py-2 font-medium w-12">
                          {drill.icon}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rankedPlayers.slice(0, 4).map(player => (
                      <tr key={player.id} className="border-b border-gray-100">
                        <td className="py-2 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 bg-gray-200 rounded text-center text-xs">
                              {player.rank}
                            </span>
                            {player.name.split(' ')[0]}
                          </div>
                        </td>
                        {DRILLS.map(drill => (
                          <td key={drill.key} className="text-center py-2">
                            {player[drill.key] !== null && player[drill.key] !== undefined ? (
                              <span className="font-mono text-xs">
                                {typeof player[drill.key] === 'number' ? player[drill.key].toFixed(2) : player[drill.key]}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-8 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl shadow-lg p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">
            🚀 Ready to Transform Your Combines?
          </h2>
          <p className="text-cyan-100 mb-6">
            Join hundreds of coaches already using WooCombine for professional digital combine management
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold">5</div>
              <div className="text-sm text-cyan-100">Drill Types</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold">∞</div>
              <div className="text-sm text-cyan-100">Players</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold">⚡</div>
              <div className="text-sm text-cyan-100">Real-time</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold">🏆</div>
              <div className="text-sm text-cyan-100">Pro Features</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate("/signup")}
              className="w-full bg-white text-cyan-600 font-semibold py-4 rounded-xl hover:bg-gray-50 transition-all duration-200 text-lg"
            >
              🎯 Start Free Trial - Setup in 60 Seconds
            </button>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={resetDemo}
                className="border-2 border-white text-white font-medium py-2 px-4 rounded-xl hover:bg-white/10 transition-all duration-200"
              >
                🔄 Replay Demo
              </button>
              
              <button
                onClick={() => navigate("/welcome")}
                className="border-2 border-white text-white font-medium py-2 px-4 rounded-xl hover:bg-white/10 transition-all duration-200"
              >
                ← Back to Welcome
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}