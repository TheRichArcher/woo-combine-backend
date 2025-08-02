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
    title: "🌅 Morning Setup",
    desc: "Coach arrives, sets up combine in 60 seconds",
    icon: "📋",
    color: "from-indigo-500 to-purple-600",
    duration: 8000
  },
  {
    id: 2,
    title: "🏃 First Drill Live",
    desc: "Watch 40-yard dash results flow in real-time",
    icon: "⚡",
    color: "from-green-500 to-emerald-600",
    duration: 10000
  },
  {
    id: 3,
    title: "📱 Parent Notifications",
    desc: "Parents get instant updates on their phones",
    icon: "📲",
    color: "from-blue-500 to-cyan-600",
    duration: 7000
  },
  {
    id: 4,
    title: "⚖️ Coach Adjustments", 
    desc: "Coach tweaks weights, rankings shift instantly",
    icon: "🎯",
    color: "from-orange-500 to-red-600",
    duration: 9000
  },
  {
    id: 5,
    title: "🏆 Final Results",
    desc: "Professional reports ready in seconds",
    icon: "📊",
    color: "from-purple-500 to-pink-600",
    duration: 8000
  },
  {
    id: 6,
    title: "🎉 The WOW Factor",
    desc: "What just happened would take hours manually",
    icon: "✨",
    color: "from-yellow-500 to-orange-600",
    duration: 6000
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
  const [isRunning, setIsRunning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [notifications, setNotifications] = useState([]);

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

  // Demo automation with story-based timing
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const currentScenarioData = DEMO_SCENARIOS[currentScenario];
    const duration = currentScenarioData?.duration || 8000;
    
    const timer = setTimeout(() => {
      if (currentScenario < DEMO_SCENARIOS.length - 1) {
        setCurrentScenario(prev => prev + 1);
      } else {
        setIsAutoPlaying(false);
      }
    }, duration);
    
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
    setIsRunning(false);
    setCountdown(0);
    setNotifications([]);
  };

  const startAutoDemo = () => {
    setIsAutoPlaying(true);
    setCurrentScenario(0);
  };

  const addMissingResults = () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setCountdown(3);
    
    // Countdown timer
    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          
          // Simulate drill timing
          setTimeout(() => {
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
            
            // Add notification
            setNotifications(prev => [...prev, {
              id: Date.now(),
              message: "🔥 Morgan Davis just crushed it! New leaderboard update!",
              type: "success"
            }]);
            
            setIsRunning(false);
          }, 2000); // 2 second "run time"
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Auto-clear notifications
  useEffect(() => {
    notifications.forEach(notification => {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 4000);
    });
  }, [notifications]);

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
      {/* Floating Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse border border-green-400"
          >
            <div className="text-sm font-medium">{notification.message}</div>
          </div>
        ))}
      </div>
      
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
            
            {/* Scenario 1: Morning Setup */}
            {currentScenario === 0 && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">🧑‍🏫</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-indigo-800 text-sm">Coach Martinez arrives at the field</h3>
                      <p className="text-xs text-indigo-600">7:45 AM - 30 minutes before kids arrive</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      <span>Opens WooCombine app on tablet</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      <span>Creates "Spring Showcase 2024" event</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      <span>Uploads 24 player roster via CSV</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      <span>Shares QR code for parents to follow live</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h4 className="font-semibold text-red-800 mb-2 text-xs">❌ Old Manual Way</h4>
                    <ul className="text-xs text-red-700 space-y-1">
                      <li>• 45 min setup with clipboards</li>
                      <li>• Print 100+ scoresheets</li>
                      <li>• Assign volunteers to stations</li>
                      <li>• Hope nothing gets lost</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <h4 className="font-semibold text-green-800 mb-2 text-xs">✅ WooCombine Setup</h4>
                    <ul className="text-xs text-green-700 space-y-1">
                      <li>• 2 min digital setup</li>
                      <li>• Zero paper needed</li>
                      <li>• Automatic backups</li>
                      <li>• Parents follow live online</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-center">
                  <p className="text-green-800 font-semibold text-sm">
                    ✨ Setup Complete: 1 minute 47 seconds
                  </p>
                  <p className="text-green-700 text-xs mt-1">
                    Time saved: 43+ minutes | Coffee break earned ☕
                  </p>
                </div>
              </div>
            )}

            {/* Scenario 2: First Drill Live */}
            {currentScenario === 1 && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">⚡</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-800 text-sm">40-Yard Dash Station Active</h3>
                      <p className="text-xs text-green-600">Kids running, coach entering times instantly</p>
                    </div>
                  </div>
                  
                  <div className={`bg-white rounded-lg p-3 border-2 border-dashed transition-all duration-300 ${
                    isRunning ? 'border-yellow-400 bg-yellow-50' : 'border-green-300'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-600">
                        {countdown > 0 ? 'PREPARING:' : isRunning ? 'TIMING:' : 'NEXT UP:'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full animate-pulse ${
                        isRunning 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {countdown > 0 ? 'READY' : isRunning ? 'RUNNING' : 'WAITING'}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-green-800 mb-1">Morgan Davis #15</div>
                    <div className="text-xs text-gray-600">
                      {countdown > 0 
                        ? `Starting in ${countdown} seconds...` 
                        : isRunning 
                          ? '🏃‍♂️ GO GO GO! Timer running...' 
                          : 'Ready... Set... GO! 🏃‍♂️💨'
                      }
                    </div>
                  </div>
                </div>

                <button
                  onClick={addMissingResults}
                  disabled={isRunning}
                  className={`w-full font-semibold py-3 rounded-xl transition-all duration-200 text-sm relative overflow-hidden ${
                    isRunning 
                      ? 'bg-yellow-500 text-yellow-900 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  <span className="relative z-10">
                    {countdown > 0 
                      ? `⏱️ Starting in ${countdown}...` 
                      : isRunning 
                        ? '🏃‍♂️ Morgan Running... (Timing)' 
                        : '⚡ FINISH LINE! Record Morgan\'s Time'
                    }
                  </span>
                  {!isRunning && (
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-600 opacity-20 animate-pulse"></div>
                  )}
                  {isRunning && (
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 to-yellow-500 opacity-30 animate-pulse"></div>
                  )}
                </button>

                {/* Live Rankings Update */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-600" />
                    Live Leaderboard
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Updating...</span>
                  </h3>
                  
                  <div className="space-y-2">
                    {rankedPlayers.slice(0, 4).map((player, index) => (
                      <div 
                        key={player.id}
                        className={`flex items-center justify-between p-2 rounded bg-white text-sm transition-all duration-500 ${
                          player.name === 'Alex Johnson' ? 'ring-2 ring-green-400 bg-green-50' : ''
                        }`}
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
                            <div className="font-medium flex items-center gap-1">
                              {player.name}
                              {player.name === 'Alex Johnson' && <span className="text-xs">🔥</span>}
                            </div>
                            <div className="text-xs text-gray-500">
                              {player.fortyYardDash ? `${player.fortyYardDash}s dash` : 'Waiting...'}
                            </div>
                          </div>
                        </div>
                        <div className="font-mono text-sm font-bold text-cyan-600">
                          {player.compositeScore.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-xs">
                    📱 <strong>Meanwhile:</strong> Parents watching at home just saw Alex's result appear instantly on their phones!
                  </p>
                </div>
              </div>
            )}

            {/* Scenario 3: Parent Notifications */}
            {currentScenario === 2 && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">📱</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-800 text-sm">Parent Experience</h3>
                      <p className="text-xs text-blue-600">Real-time updates while they're at work</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm">👩</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium">Sarah Johnson</p>
                          <p className="text-xs text-gray-500">Alex's Mom • At office</p>
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <p className="text-xs text-green-800">
                          📩 <strong>WooCombine Alert:</strong><br/>
                          Alex completed 40-yard dash: 4.38s<br/>
                          Current rank: #1 overall! 🏆
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm">👨</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium">Mike Smith</p>
                          <p className="text-xs text-gray-500">Jordan's Dad • In meeting</p>
                        </div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <p className="text-xs text-blue-800">
                          📩 <strong>Live Update:</strong><br/>
                          Jordan just finished! Great job!<br/>
                          View full results: tap link 📊
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h4 className="font-semibold text-red-800 mb-2 text-xs">❌ Old Way Problems</h4>
                    <ul className="text-xs text-red-700 space-y-1">
                      <li>• "How did my kid do?"</li>
                      <li>• Wait hours for results</li>
                      <li>• No way to follow remotely</li>
                      <li>• FOMO for working parents</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <h4 className="font-semibold text-green-800 mb-2 text-xs">✅ WooCombine Magic</h4>
                    <ul className="text-xs text-green-700 space-y-1">
                      <li>• Instant text notifications</li>
                      <li>• Live leaderboard access</li>
                      <li>• Follow from anywhere</li>
                      <li>• Never miss a moment</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-800 text-sm font-semibold text-center">
                    💝 Parent Satisfaction: 98% 
                  </p>
                  <p className="text-yellow-700 text-xs text-center mt-1">
                    "Finally, I can follow my kid's performance even when I can't be there!"
                  </p>
                </div>
              </div>
            )}

            {/* Scenario 4: Coach Adjustments */}
            {currentScenario === 3 && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">🎯</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-orange-800 text-sm">Coach Makes Live Adjustments</h3>
                      <p className="text-xs text-orange-600">Halfway through - coach notices speed is most important today</p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 border border-orange-200">
                    <p className="text-orange-800 text-xs mb-3">
                      💭 <strong>Coach thinking:</strong> "These kids are really fast today. Let me emphasize speed more for scholarships..."
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm">⚡</span>
                        <span className="w-20 text-xs font-medium">40-Yard</span>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={weights.fortyYardDash}
                          onChange={(e) => adjustWeights({ ...weights, fortyYardDash: parseFloat(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="w-8 text-xs font-mono">{weights.fortyYardDash}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">📏</span>
                        <span className="w-20 text-xs font-medium">Vertical</span>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={weights.vertical}
                          onChange={(e) => adjustWeights({ ...weights, vertical: parseFloat(e.target.value) })}
                          className="flex-1"
                        />
                        <span className="w-8 text-xs font-mono">{weights.vertical}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-800 text-xs text-center font-medium">
                    ⚡ Watch the rankings shift as coach adjusts the weights above! ⚡
                  </p>
                </div>

                {/* Live Rankings with Weight Impact */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Weight-Adjusted Rankings
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full animate-pulse">Live Updates</span>
                  </h3>
                  
                  <div className="space-y-2">
                    {rankedPlayers.slice(0, 4).map((player) => (
                      <div 
                        key={player.id}
                        className="flex items-center justify-between p-2 rounded bg-white text-sm transition-all duration-300"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
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

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-xs">
                    🎯 <strong>Pro Tip:</strong> Coaches can adjust weights during or after the combine based on what they observe. Perfect for college recruiters with different priorities!
                  </p>
                </div>
              </div>
            )}

            {/* Scenario 5: Final Results */}
            {currentScenario === 4 && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">🏆</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-800 text-sm">Final Results & Professional Reports</h3>
                      <p className="text-xs text-purple-600">Combine complete - generating pro-quality reports</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <h4 className="font-semibold text-purple-800 mb-2 text-xs">📊 Individual Reports</h4>
                      <ul className="text-xs text-purple-700 space-y-1">
                        <li>• Personal scorecards</li>
                        <li>• Ranking certificates</li>
                        <li>• Performance analytics</li>
                        <li>• Improvement suggestions</li>
                      </ul>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <h4 className="font-semibold text-purple-800 mb-2 text-xs">📈 Coach Analytics</h4>
                      <ul className="text-xs text-purple-700 space-y-1">
                        <li>• Team composition tools</li>
                        <li>• Scout-ready summaries</li>
                        <li>• Age group comparisons</li>
                        <li>• CSV data exports</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-600" />
                    Final Leaderboard - All Drills Complete
                  </h3>
                  
                  <div className="space-y-2">
                    {rankedPlayers.map((player, index) => (
                      <div 
                        key={player.id}
                        className={`flex items-center justify-between p-2 rounded bg-white text-sm ${
                          index < 3 ? 'ring-1 ring-yellow-300 bg-yellow-50' : ''
                        }`}
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
                            <div className="font-medium flex items-center gap-1">
                              {player.name}
                              {index < 3 && <span className="text-xs">🏆</span>}
                            </div>
                            <div className="text-xs text-gray-500">#{player.number} • {player.ageGroup}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-cyan-600">
                            {player.compositeScore.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">Overall</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button className="bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 rounded-lg transition">
                    📄 Generate PDFs
                  </button>
                  <button className="bg-green-600 hover:bg-green-700 text-white text-xs py-2 rounded-lg transition">
                    📊 Export CSV
                  </button>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 rounded-lg transition">
                    📧 Email Results
                  </button>
                </div>
              </div>
            )}

            {/* Scenario 6: The WOW Factor */}
            {currentScenario === 5 && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-300 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">✨</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-yellow-800 text-sm">The Complete Transformation</h3>
                      <p className="text-xs text-yellow-600">What just happened in 2 hours used to take days</p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border-2 border-yellow-300">
                    <h4 className="font-bold text-yellow-800 mb-3 text-center">🎯 Mission Accomplished</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold text-red-700 text-xs mb-2">❌ OLD WAY WOULD HAVE TAKEN:</h5>
                        <ul className="text-xs text-red-600 space-y-1">
                          <li>• 45 min setup + delays</li>
                          <li>• 3+ hours manual scoring</li>
                          <li>• 2 days for final reports</li>
                          <li>• Countless errors & recalculations</li>
                          <li>• Parents left in the dark</li>
                          <li>• Coach stress through the roof</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h5 className="font-semibold text-green-700 text-xs mb-2">✅ WOOCOMBINE DELIVERED:</h5>
                        <ul className="text-xs text-green-600 space-y-1">
                          <li>• 2 min digital setup</li>
                          <li>• Real-time live scoring</li>
                          <li>• Instant professional reports</li>
                          <li>• Zero calculation errors</li>
                          <li>• Parents engaged throughout</li>
                          <li>• Coach looks like a tech hero</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-100 to-emerald-100 border border-green-300 rounded-lg p-4 text-center">
                  <h4 className="font-bold text-green-800 text-lg mb-2">
                    🎉 Time Saved: 47+ Hours
                  </h4>
                  <p className="text-green-700 text-sm mb-3">
                    Accuracy: 100% • Parent Satisfaction: 98% • Coach Stress: -90%
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white/70 rounded p-2">
                      <div className="font-bold text-green-800">24</div>
                      <div className="text-green-600">Players Tracked</div>
                    </div>
                    <div className="bg-white/70 rounded p-2">
                      <div className="font-bold text-green-800">120</div>
                      <div className="text-green-600">Results Recorded</div>
                    </div>
                    <div className="bg-white/70 rounded p-2">
                      <div className="font-bold text-green-800">∞</div>
                      <div className="text-green-600">Possibilities</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-4 text-center">
                  <h4 className="font-bold text-lg mb-2">
                    🚀 This is the Future of Youth Sports
                  </h4>
                  <p className="text-blue-100 text-sm mb-3">
                    Professional combine management that makes everyone look good
                  </p>
                  <div className="flex justify-center gap-4 text-xs">
                    <span>💼 Impress Parents</span>
                    <span>🏆 Engage Athletes</span>
                    <span>📊 Satisfy Scouts</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Compact Call to Action */}
        <div className="mt-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl shadow-lg p-6 text-white text-center">
          <h2 className="text-xl font-bold mb-2">
            🎯 Ready to Be the Hero Coach?
          </h2>
          <p className="text-cyan-100 mb-4 text-sm">
            Join 500+ coaches who've transformed their combines with WooCombine
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
              ⚡ Start Your Transformation - Free Trial
            </button>
            
            <div className="flex justify-center gap-2">
              <button
                onClick={resetDemo}
                className="border border-white text-white font-medium py-2 px-3 rounded-lg hover:bg-white/10 transition-all duration-200 text-sm"
              >
                🔄 Replay
              </button>
              
              <button
                onClick={() => navigate("/workflow-demo")}
                className="border border-white text-white font-medium py-2 px-3 rounded-lg hover:bg-white/10 transition-all duration-200 text-sm"
              >
                🔧 Workflow Demo
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