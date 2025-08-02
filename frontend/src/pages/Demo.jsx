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

  // Demo automation with better timing
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const timer = setTimeout(() => {
      if (currentScenario < DEMO_SCENARIOS.length - 1) {
        setCurrentScenario(prev => prev + 1);
      } else {
        setIsAutoPlaying(false);
      }
    }, 6000); // Increased to 6 seconds for better user experience
    
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

  // Auto-scroll to keep demo content in view
  useEffect(() => {
    if (isAutoPlaying) {
      const demoContent = document.getElementById('demo-content');
      if (demoContent) {
        demoContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [currentScenario, isAutoPlaying]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-5xl mx-auto px-4 py-4">
        
        {/* Compact Header */}
        <div className="text-center mb-4">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              🏈 WooCombine Demo
            </h1>
            <p className="text-gray-600 text-sm mb-3">
              See every feature in action
            </p>
            
            {/* Demo Controls & Scenario Navigation Combined */}
            <div className="flex flex-wrap justify-center items-center gap-2">
              <button
                onClick={startAutoDemo}
                disabled={isAutoPlaying}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1"
              >
                {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {isAutoPlaying ? 'Playing...' : 'Auto Demo'}
              </button>
              
              <button
                onClick={resetDemo}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>

              {/* Inline Scenario Tabs */}
              <div className="flex gap-1 ml-2">
                {DEMO_SCENARIOS.map((scenario, index) => (
                  <button
                    key={scenario.id}
                    onClick={() => setCurrentScenario(index)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                      currentScenario === index 
                        ? 'bg-cyan-600 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {scenario.icon} {scenario.title.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Focused Demo Content */}
        <div id="demo-content" className={`bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-500 ${
          isAutoPlaying ? 'ring-4 ring-green-400 shadow-2xl' : ''
        }`}>
          
          {/* Current Scenario Display */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{DEMO_SCENARIOS[currentScenario].icon}</div>
                <div>
                  <h2 className="text-xl font-bold">{DEMO_SCENARIOS[currentScenario].title}</h2>
                  <p className="text-cyan-100 text-sm">{DEMO_SCENARIOS[currentScenario].desc}</p>
                </div>
              </div>
              {isAutoPlaying && (
                <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Live Demo</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            
            {/* Compact Demo Content */}
            
            {/* Scenario 1: Live Entry Magic */}
            {currentScenario === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-3">
                    <h3 className="font-semibold text-red-800 mb-2 text-sm">❌ Old Way</h3>
                    <ul className="text-xs text-red-700 space-y-1">
                      <li>• Papers get lost</li>
                      <li>• Manual calculations</li>
                      <li>• No instant results</li>
                      <li>• Human error prone</li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                    <h3 className="font-semibold text-green-800 mb-2 text-sm">✅ WooCombine Way</h3>
                    <ul className="text-xs text-green-700 space-y-1">
                      <li>• Track 5 drills instantly</li>
                      <li>• Real-time rankings</li>
                      <li>• Instant parent access</li>
                      <li>• Zero calculations</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={addMissingResults}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm"
                >
                  ⚡ Add Missing Results & Watch Rankings Update
                </button>

                {/* Live Rankings */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-600" />
                    Live Rankings
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Real-time</span>
                  </h3>
                  
                  <div className="space-y-2">
                    {rankedPlayers.slice(0, 4).map((player) => (
                      <div 
                        key={player.id}
                        className="flex items-center justify-between p-2 rounded bg-white text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            player.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                            player.rank === 2 ? 'bg-gray-100 text-gray-700' :
                            player.rank === 3 ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            #{player.rank}
                          </div>
                          <div>
                            <div className="font-medium">{player.name}</div>
                            <div className="text-xs text-gray-500">#{player.number}</div>
                          </div>
                        </div>
                        <div className="font-mono text-sm font-bold text-cyan-600">
                          {player.compositeScore.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 2: Smart Weight System */}
            {currentScenario === 1 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-sm">
                    💡 <strong>Try this:</strong> Adjust drill importance below and watch rankings change instantly!
                  </p>
                </div>

                <div className="space-y-3">
                  {DRILLS.map(drill => (
                    <div key={drill.key} className="flex items-center gap-3">
                      <span className="text-lg">{drill.icon}</span>
                      <span className="w-16 text-xs font-medium">{drill.label.split(' ')[0]}</span>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={weights[drill.key]}
                        onChange={(e) => adjustWeights({ ...weights, [drill.key]: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="w-8 text-xs font-mono">{weights[drill.key]}%</span>
                    </div>
                  ))}
                </div>

                {/* Live Rankings with Weight Impact */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Weight-Adjusted Rankings
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Live</span>
                  </h3>
                  
                  <div className="space-y-2">
                    {rankedPlayers.slice(0, 4).map((player) => (
                      <div 
                        key={player.id}
                        className="flex items-center justify-between p-2 rounded bg-white text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            player.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                            player.rank === 2 ? 'bg-gray-100 text-gray-700' :
                            player.rank === 3 ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            #{player.rank}
                          </div>
                          <div>
                            <div className="font-medium">{player.name}</div>
                            <div className="text-xs text-gray-500">Score: {player.compositeScore.toFixed(1)}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          {player.fortyYardDash && `${player.fortyYardDash}s`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 3: Team Formation AI */}
            {currentScenario === 2 && (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-purple-800 text-sm">
                    🎯 <strong>AI Team Balance:</strong> No more parent complaints about unfair teams!
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h3 className="font-semibold text-red-800 mb-2 text-sm">🔴 Team Red</h3>
                    <div className="space-y-1">
                      {team1.slice(0, 3).map(player => (
                        <div key={player.id} className="flex justify-between text-xs">
                          <span>{player.name.split(' ')[0]}</span>
                          <span className="font-mono">{player.compositeScore.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-1 border-t border-red-300">
                      <div className="text-xs font-semibold">
                        Avg: {(team1.slice(0, 3).reduce((sum, p) => sum + p.compositeScore, 0) / 3).toFixed(1)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h3 className="font-semibold text-blue-800 mb-2 text-sm">🔵 Team Blue</h3>
                    <div className="space-y-1">
                      {team2.slice(0, 3).map(player => (
                        <div key={player.id} className="flex justify-between text-xs">
                          <span>{player.name.split(' ')[0]}</span>
                          <span className="font-mono">{player.compositeScore.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-1 border-t border-blue-300">
                      <div className="text-xs font-semibold">
                        Avg: {(team2.slice(0, 3).reduce((sum, p) => sum + p.compositeScore, 0) / 3).toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <h3 className="font-semibold text-gray-800 mb-2 text-sm">Balance Analysis</h3>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Team Difference:</span>
                      <span className="font-mono">
                        {Math.abs(
                          (team1.slice(0, 3).reduce((sum, p) => sum + p.compositeScore, 0) / 3) -
                          (team2.slice(0, 3).reduce((sum, p) => sum + p.compositeScore, 0) / 3)
                        ).toFixed(1)} pts
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fairness Rating:</span>
                      <span className="text-green-600 font-semibold">Excellent</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 4: Pro Analytics */}
            {currentScenario === 3 && (
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-orange-800 text-sm">
                    📈 <strong>Professional Reports:</strong> Generate insights that impress parents, coaches, and scouts!
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Performance Distribution */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">Performance Distribution</h3>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Top Performers</span>
                        <span className="font-semibold text-green-600">
                          {rankedPlayers.filter(p => p.compositeScore >= 80).length} players
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Above Average</span>
                        <span className="font-semibold text-blue-600">
                          {rankedPlayers.filter(p => p.compositeScore >= 60 && p.compositeScore < 80).length} players
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Developing</span>
                        <span className="font-semibold text-yellow-600">
                          {rankedPlayers.filter(p => p.compositeScore >= 40 && p.compositeScore < 60).length} players
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Age Group Comparison */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">Age Group Analysis</h3>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>U16 Average</span>
                        <span className="font-mono">
                          {(rankedPlayers.filter(p => p.ageGroup === 'U16').reduce((sum, p) => sum + p.compositeScore, 0) / 
                            rankedPlayers.filter(p => p.ageGroup === 'U16').length).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>U14 Average</span>
                        <span className="font-mono">
                          {(rankedPlayers.filter(p => p.ageGroup === 'U14').reduce((sum, p) => sum + p.compositeScore, 0) / 
                            rankedPlayers.filter(p => p.ageGroup === 'U14').length).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Export Options */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h3 className="font-semibold text-gray-800 mb-2 text-sm">Export Capabilities</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-lg">📊</div>
                      <div className="text-xs font-medium">Player Reports</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-lg">🏆</div>
                      <div className="text-xs font-medium">Team Rosters</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-lg">📈</div>
                      <div className="text-xs font-medium">Scout Reports</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Compact Call to Action */}
        <div className="mt-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl shadow-lg p-6 text-white text-center">
          <h2 className="text-xl font-bold mb-2">
            🚀 Ready to Transform Your Combines?
          </h2>
          <p className="text-cyan-100 mb-4 text-sm">
            Join hundreds of coaches using professional digital combine management
          </p>
          
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-lg font-bold">5</div>
              <div className="text-xs text-cyan-100">Drills</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-lg font-bold">∞</div>
              <div className="text-xs text-cyan-100">Players</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-lg font-bold">⚡</div>
              <div className="text-xs text-cyan-100">Real-time</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-lg font-bold">🏆</div>
              <div className="text-xs text-cyan-100">Pro</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={() => navigate("/signup")}
              className="w-full bg-white text-cyan-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all duration-200"
            >
              🎯 Start Free Trial - Setup in 60 Seconds
            </button>
            
            <div className="flex justify-center gap-2">
              <button
                onClick={resetDemo}
                className="border border-white text-white font-medium py-2 px-3 rounded-lg hover:bg-white/10 transition-all duration-200 text-sm"
              >
                🔄 Replay
              </button>
              
              <button
                onClick={() => navigate("/welcome")}
                className="border border-white text-white font-medium py-2 px-3 rounded-lg hover:bg-white/10 transition-all duration-200 text-sm"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}