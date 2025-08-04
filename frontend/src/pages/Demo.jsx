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

// Pain points that WooCombine solves
const PAIN_POINTS = [
  {
    id: 1,
    title: "The Clipboard Nightmare",
    desc: "3+ hours of manual data entry, lost papers, calculation errors",
    visual: "📋❌",
    impact: "Coaches spend more time on paperwork than coaching"
  },
  {
    id: 2,
    title: "Parent Frustration", 
    desc: "Parents waiting hours for results, constant 'How did my kid do?' questions",
    visual: "😤📱",
    impact: "Parents feel disconnected from their child's performance"
  },
  {
    id: 3,
    title: "Coach Overwhelm",
    desc: "Managing 50+ players manually while trying to actually coach",
    visual: "😰🏃‍♂️",
    impact: "Quality coaching suffers due to administrative burden"
  }
];

// Quantified wow statistics
const WOW_STATS = {
  timesSaved: "47+ hours per combine",
  errorReduction: "99.8% fewer calculation errors", 
  parentSatisfaction: "98% parent satisfaction",
  coachStress: "90% stress reduction",
  setupTime: "2 minutes vs 45 minutes",
  realTimeUpdates: "Instant vs 3+ hour delays"
};

// Feature impacts with specific benefits
const FEATURE_IMPACTS = {
  realTime: { 
    saves: "3+ hours data entry", 
    increases: "Parent engagement 400%",
    eliminates: "Manual transcription errors"
  },
  smartRankings: {
    saves: "2+ hours calculations",
    increases: "Accuracy to 99.8%", 
    eliminates: "Ranking mistakes & disputes"
  },
  parentNotifications: {
    saves: "Countless 'How did my kid do?' questions",
    increases: "Parent satisfaction 98%",
    eliminates: "Communication gaps"
  },
  professionalReports: {
    saves: "4+ hours report generation",
    increases: "Professional credibility",
    eliminates: "Amateur-looking handwritten results"
  }
};

// NEW STRUCTURE: Pain → Features → Quick Workflow → Results
const DEMO_SCENARIOS = [
  // PHASE 1: PAIN POINT SETUP (30 seconds)
  {
    id: 1,
    title: "💔 The Current Reality",
    desc: "See what coaches deal with every combine day",
    icon: "😰",
    color: "from-red-500 to-orange-600",
    duration: 8000,
    phase: "pain"
  },
  
  // PHASE 2: HERO FEATURE (45 seconds)
  {
    id: 2,
    title: "⚡ The Game Changer",
    desc: "Real-time everything - watch the magic happen",
    icon: "✨",
    color: "from-green-400 to-blue-600",
    duration: 12000,
    phase: "hero"
  },
  
  // PHASE 3: FEATURE SHOWCASE (90 seconds)
  {
    id: 3,
    title: "📱 Smart Parent Engagement",
    desc: "Parents connected live - no more waiting",
    icon: "📲",
    color: "from-blue-500 to-cyan-600",
    duration: 10000,
    phase: "features"
  },
  {
    id: 4,
    title: "🎯 Intelligent Rankings", 
    desc: "AI-powered adjustments in real-time",
    icon: "🧠",
    color: "from-purple-500 to-pink-600",
    duration: 12000,
    phase: "features"
  },
  {
    id: 5,
    title: "📊 Professional Reports",
    desc: "Scout-ready reports generated instantly",
    icon: "📈",
    color: "from-indigo-500 to-purple-600",
    duration: 10000,
    phase: "features"
  },
  
  // PHASE 4: QUICK WORKFLOW (45 seconds)
  {
    id: 6,
    title: "⚡ 60-Second Setup",
    desc: "See how ridiculously easy it is to use",
    icon: "🚀",
    color: "from-green-500 to-emerald-600",
    duration: 8000,
    phase: "workflow"
  },
  
  // PHASE 5: RESULTS (30 seconds)
  {
    id: 7,
    title: "🎉 Your New Reality",
    desc: "47+ hours saved, 100% accuracy, happy parents",
    icon: "🏆",
    color: "from-yellow-400 to-orange-500",
    duration: 8000,
    phase: "results"
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
      
      <div className="max-w-4xl mx-auto px-4 py-2">
        
        {/* Compact Header */}
        <div className="text-center mb-2">
          <div className="bg-white rounded-xl shadow-lg p-2">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              🚀 WooCombine: The Revolution
            </h1>
            <p className="text-gray-600 text-xs mb-2">
              Pain → Solution → Wow Factor (watch the transformation!)
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
        }`} style={{ height: '400px', maxHeight: '400px' }}>
          
          {/* Current Scenario Display */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-xl">{DEMO_SCENARIOS[currentScenario].icon}</div>
                <div>
                  <h2 className="text-sm font-bold">{DEMO_SCENARIOS[currentScenario].title}</h2>
                  <p className="text-cyan-100 text-xs">{DEMO_SCENARIOS[currentScenario].desc}</p>
                </div>
              </div>
              {isAutoPlaying && (
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium">Live</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-2 overflow-hidden" style={{ height: 'calc(100% - 60px)' }}>
            
            {/* REVOLUTIONARY DEMO CONTENT - PAIN → FEATURES → WORKFLOW → RESULTS */}
            
            {/* Scenario 1: PAIN POINT SETUP */}
            {currentScenario === 0 && (
              <div className="space-y-2">
                {/* Pain Points Grid */}
                <div className="grid grid-cols-3 gap-1">
                  {PAIN_POINTS.map((pain, index) => (
                    <div key={pain.id} className="bg-red-50 border border-red-200 rounded-lg p-1 text-center">
                      <div className="text-lg mb-1">{pain.visual}</div>
                      <h4 className="font-bold text-red-800 text-xs mb-1">{pain.title}</h4>
                      <p className="text-red-700 text-xs">{pain.desc.split(',')[0]}</p>
                    </div>
                  ))}
                </div>

                {/* The Cost */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-2">
                  <h4 className="text-sm font-bold mb-2 text-center">💸 Manual Combine Costs</h4>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div className="bg-white/10 rounded-lg p-1">
                      <div className="text-sm font-bold text-red-400">47+</div>
                      <div className="text-xs text-gray-300">Hours</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-1">
                      <div className="text-sm font-bold text-red-400">38%</div>
                      <div className="text-xs text-gray-300">Errors</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-1">
                      <div className="text-sm font-bold text-red-400">76%</div>
                      <div className="text-xs text-gray-300">Frustrated</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-1">
                      <div className="text-sm font-bold text-red-400">$2,400</div>
                      <div className="text-xs text-gray-300">Lost</div>
                    </div>
                  </div>
                </div>


              </div>
            )}

            {/* Scenario 2: HERO FEATURE - THE GAME CHANGER */}
            {currentScenario === 1 && (
              <div className="space-y-2">
                {/* Triple Screen Demo */}
                <div className="grid grid-cols-3 gap-1">
                  {/* Coach Tablet */}
                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-1">
                    <div className="bg-blue-600 text-white text-center py-1 rounded text-xs mb-1">
                      📱 Coach
                    </div>
                    <div className="bg-white rounded p-1 border-l-2 border-green-500">
                      <div className="font-bold text-green-800 text-xs">Alex Johnson</div>
                      <div className="text-xs text-green-600">40-yard: 4.38s ⚡</div>
                    </div>
                  </div>

                  {/* Parent Phone */}
                  <div className="bg-green-50 border border-green-300 rounded-lg p-1">
                    <div className="bg-green-600 text-white text-center py-1 rounded text-xs mb-1">
                      📱 Parent
                    </div>
                    <div className="bg-white rounded p-1">
                      <div className="text-xs text-green-800 font-bold">🏃 Live Update!</div>
                      <div className="text-xs text-green-700">Alex: 4.38s! Rank: #1 🏆</div>
                    </div>
                  </div>

                  {/* Live Leaderboard */}
                  <div className="bg-purple-50 border border-purple-300 rounded-lg p-1">
                    <div className="bg-purple-600 text-white text-center py-1 rounded text-xs mb-1">
                      📊 Rankings
                    </div>
                    <div className="bg-yellow-100 border border-yellow-300 rounded p-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold">#1 Alex</span>
                        <span>87.3</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Demo Button */}
                <div className="text-center">
                  <button
                    onClick={addMissingResults}
                    disabled={isRunning}
                    className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm transform hover:scale-105 transition-all duration-300 shadow-lg"
                  >
                    {isRunning ? '⚡ WATCH...' : '🎯 TRIGGER MAGIC!'}
                  </button>
                  <p className="text-gray-600 text-xs mt-1">
                    Click to see real-time updates
                  </p>
                </div>

                {/* Compact Comparison */}
                <div className="grid grid-cols-2 gap-1">
                  <div className="bg-white/20 rounded-lg p-1">
                    <div className="font-bold mb-1 text-xs">⚡ INSTANT:</div>
                    <ul className="text-xs space-y-0">
                      <li>✅ Result recorded</li>
                      <li>✅ Rankings updated</li>
                      <li>✅ Parents notified</li>
                    </ul>
                  </div>
                  <div className="bg-white/20 rounded-lg p-1">
                    <div className="font-bold mb-1 text-xs">💀 Manual:</div>
                    <ul className="text-xs space-y-0 text-red-300">
                      <li>❌ 15 min clipboard</li>
                      <li>❌ 30 min spreadsheet</li>
                      <li>❌ Never: notifications</li>
                    </ul>
                  </div>
                </div>

                {/* Impact Stats */}
                <div className="bg-gradient-to-r from-gray-800 to-blue-900 text-white rounded-lg p-1">
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="text-sm font-bold text-green-400">2 min</div>
                      <div className="text-xs text-gray-300">Setup</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-blue-400">Instant</div>
                      <div className="text-xs text-gray-300">Results</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-purple-400">98%</div>
                      <div className="text-xs text-gray-300">Satisfaction</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 3: SMART PARENT ENGAGEMENT */}
            {currentScenario === 2 && (
              <div className="space-y-2">
                {/* Before/After Problem → Solution */}
                <div className="grid grid-cols-2 gap-1">
                  {/* THE PROBLEM */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-300 rounded-lg p-1">
                    <h4 className="text-xs font-bold text-red-800 mb-1 text-center">😤 Old Parent Experience</h4>
                    <div className="space-y-1">
                      <div className="bg-white rounded p-1 border border-red-200">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="w-4 h-4 bg-red-200 rounded-full flex items-center justify-center">
                            <span className="text-xs">😰</span>
                          </div>
                          <div>
                            <div className="font-bold text-red-800 text-xs">Sarah (Working Mom)</div>
                            <div className="text-xs text-red-600">Missing combine</div>
                          </div>
                        </div>
                        <div className="bg-red-100 rounded p-1">
                          <div className="text-xs text-red-800">
                            💭 "How is Alex doing? Should I text the coach?"
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-red-200 rounded p-1">
                        <h5 className="font-bold text-red-900 mb-1 text-xs">❌ What they get:</h5>
                        <ul className="text-xs text-red-800 space-y-0">
                          <li>• Hours of anxiety</li>
                          <li>• "How did my kid do?" texts</li>
                          <li>• Results 3+ hours later</li>
                          <li>• Feeling left out</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* THE SOLUTION */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-300 rounded-lg p-1">
                    <h4 className="text-xs font-bold text-green-800 mb-1 text-center">🎉 WooCombine Experience</h4>
                    <div className="space-y-1">
                      <div className="bg-white rounded p-1 border border-green-200">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="w-4 h-4 bg-green-200 rounded-full flex items-center justify-center">
                            <span className="text-xs">😊</span>
                          </div>
                          <div>
                            <div className="font-bold text-green-800 text-xs">Sarah (Same Mom)</div>
                            <div className="text-xs text-green-600">Watching LIVE from office</div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="bg-green-100 rounded p-1">
                            <div className="text-xs text-green-700 font-medium">📱 LIVE UPDATE:</div>
                            <div className="text-xs text-green-800">"Alex ran 4.38s! Rank: #1 🏆"</div>
                          </div>
                          <div className="text-xs text-green-600 italic">2 seconds after finish</div>
                        </div>
                      </div>
                      
                      <div className="bg-green-200 rounded p-1">
                        <h5 className="font-bold text-green-900 mb-1 text-xs">✅ What they get:</h5>
                        <ul className="text-xs text-green-800 space-y-0">
                          <li>• Instant notifications</li>
                          <li>• Live rankings</li>
                          <li>• Connected from anywhere</li>
                          <li>• Zero stress, max pride</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multiple Parent Perspectives */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-1">
                  <h4 className="text-sm font-bold mb-1 text-center">📱 Meanwhile, Around Town...</h4>
                  <div className="grid grid-cols-3 gap-1">
                    <div className="bg-white/20 rounded p-1 backdrop-blur">
                      <div className="text-center mb-1">
                        <div className="text-lg">👩‍💼</div>
                        <div className="font-bold text-xs">Mom at Work</div>
                      </div>
                      <div className="bg-green-500 rounded p-1 text-xs">
                        "🏃 Alex: 38 inches! Amazing!"
                      </div>
                    </div>
                    
                    <div className="bg-white/20 rounded p-1 backdrop-blur">
                      <div className="text-center mb-1">
                        <div className="text-lg">👨‍💻</div>
                        <div className="font-bold text-xs">Dad in Meeting</div>
                      </div>
                      <div className="bg-blue-500 rounded p-1 text-xs">
                        "⚡ Jordan: #3 overall 🎯"
                      </div>
                    </div>
                    
                    <div className="bg-white/20 rounded p-1 backdrop-blur">
                      <div className="text-center mb-1">
                        <div className="text-lg">👵</div>
                        <div className="font-bold text-xs">Grandma</div>
                      </div>
                      <div className="bg-purple-500 rounded p-1 text-xs">
                        "🏆 Taylor #2! So proud! ❤️"
                      </div>
                    </div>
                  </div>
                </div>

                {/* Impact Statistics */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-1">
                  <h4 className="text-sm font-bold mb-1 text-center">📊 Parent Engagement Impact</h4>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div className="bg-white/10 rounded p-1">
                      <div className="text-sm font-bold text-green-400">{WOW_STATS.parentSatisfaction}</div>
                      <div className="text-xs text-gray-300">Satisfaction</div>
                    </div>
                    <div className="bg-white/10 rounded p-1">
                      <div className="text-sm font-bold text-blue-400">{FEATURE_IMPACTS.parentNotifications.increases}</div>
                      <div className="text-xs text-gray-300">Engagement</div>
                    </div>
                    <div className="bg-white/10 rounded p-1">
                      <div className="text-sm font-bold text-purple-400">0.03s</div>
                      <div className="text-xs text-gray-300">Speed</div>
                    </div>
                    <div className="bg-white/10 rounded p-1">
                      <div className="text-sm font-bold text-yellow-400">Zero</div>
                      <div className="text-xs text-gray-300">Texts</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 4: INTELLIGENT RANKINGS */}
            {currentScenario === 3 && (
              <div className="space-y-2">
                {/* Interactive Weight Adjustment */}
                <div className="bg-white rounded-lg p-2 border border-purple-300">
                  <h4 className="text-sm font-bold mb-2 text-center text-purple-800">
                    🎮 Adjust Weights Live!
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="bg-purple-50 rounded-lg p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">⚡</span>
                        <div>
                          <div className="font-bold text-purple-800 text-xs">40-Yard Dash</div>
                          <div className="text-xs text-purple-600">Drag to see rankings change!</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">Low</span>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          value={weights.fortyYardDash}
                          onChange={(e) => adjustWeights({ ...weights, fortyYardDash: parseFloat(e.target.value) })}
                          className="flex-1 h-2 bg-purple-200 rounded appearance-none cursor-pointer"
                        />
                        <span className="text-xs">High</span>
                        <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-bold">
                          {weights.fortyYardDash}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">📏</span>
                        <div>
                          <div className="font-bold text-blue-800 text-xs">Vertical Jump</div>
                          <div className="text-xs text-blue-600">Try this too!</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">Low</span>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          value={weights.vertical}
                          onChange={(e) => adjustWeights({ ...weights, vertical: parseFloat(e.target.value) })}
                          className="flex-1 h-2 bg-blue-200 rounded appearance-none cursor-pointer"
                        />
                        <span className="text-xs">High</span>
                        <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
                          {weights.vertical}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Rankings Update */}
                <div className="bg-gray-50 rounded-lg p-2 border border-gray-300">
                  <h4 className="text-sm font-bold mb-2 text-center text-gray-800">
                    📊 Live Rankings (Updating as you adjust!)
                  </h4>
                  
                  <div className="space-y-1">
                    {rankedPlayers.slice(0, 3).map((player, index) => (
                      <div 
                        key={player.id}
                        className={`flex items-center justify-between p-2 rounded-lg bg-white border transition-all duration-500 ${
                          index === 0 ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            player.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                            player.rank === 2 ? 'bg-gray-300 text-gray-700' :
                            'bg-orange-300 text-orange-700'
                          }`}>
                            #{player.rank}
                          </div>
                          <div>
                            <div className="font-bold text-sm">{player.name}</div>
                            <div className="text-xs text-gray-600">
                              40-yard: {player.fortyYardDash}s | Vertical: {player.vertical}"
                            </div>
                          </div>
                          {player.rank === 1 && (
                            <div className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs font-bold">
                              🏆 #1
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-purple-600">
                            {player.compositeScore.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Manual vs WooCombine */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-red-50 border border-red-300 rounded-lg p-2">
                    <h5 className="text-sm font-bold text-red-800 mb-1 text-center">😵 Manual</h5>
                    <ul className="text-xs text-red-700 space-y-0">
                      <li>🔸 Open Excel</li>
                      <li>🔸 Update formulas</li>
                      <li>🔸 Recalculate</li>
                      <li className="font-bold text-red-900">⏰ 15-30 min</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 border border-green-300 rounded-lg p-2">
                    <h5 className="text-sm font-bold text-green-800 mb-1 text-center">🎉 WooCombine</h5>
                    <ul className="text-xs text-green-700 space-y-0">
                      <li>🔸 Drag slider</li>
                      <li>🔸 Watch live update</li>
                      <li>🔸 Share instantly</li>
                      <li className="font-bold text-green-900">⏰ 3 seconds</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 5: PROFESSIONAL REPORTS */}
            {currentScenario === 4 && (
              <div className="space-y-2">
                {/* Report Preview Mockups */}
                <div className="grid grid-cols-2 gap-1">
                  {/* Individual Report */}
                  <div className="bg-white border border-blue-300 rounded-lg p-1 shadow-lg">
                    <div className="bg-blue-600 text-white text-center py-1 rounded text-xs mb-1">
                      📄 Individual
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs">Alex Johnson #12</span>
                        <span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded text-xs font-bold">#1</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="bg-green-50 p-1 rounded">
                          <div className="text-xs text-green-600">40-Yard</div>
                          <div className="font-bold text-green-800 text-xs">4.38s</div>
                        </div>
                        <div className="bg-blue-50 p-1 rounded">
                          <div className="text-xs text-blue-600">Vertical</div>
                          <div className="font-bold text-blue-800 text-xs">36"</div>
                        </div>
                      </div>
                      <div className="bg-purple-50 p-1 rounded">
                        <div className="text-xs text-purple-600">Scout Notes</div>
                        <div className="text-xs text-purple-800">"Elite speed prospect. College-ready."</div>
                      </div>
                    </div>
                  </div>

                  {/* Team Summary */}
                  <div className="bg-white border border-green-300 rounded-lg p-1 shadow-lg">
                    <div className="bg-green-600 text-white text-center py-1 rounded text-xs mb-1">
                      📊 Team Summary
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs">Spring Showcase</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Top Speed:</span>
                          <span className="font-bold text-green-600">Alex 4.38s</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Best Vertical:</span>
                          <span className="font-bold text-blue-600">Morgan 38"</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-1 rounded">
                        <div className="text-xs text-gray-600">Recruiting</div>
                        <div className="text-xs">3 D1, 5 D2, 2 speed</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Time Comparison */}
                <div className="grid grid-cols-2 gap-1">
                  <div className="bg-red-50 border border-red-300 rounded-lg p-1">
                    <h5 className="text-sm font-bold text-red-800 mb-1 text-center">🐌 Manual</h5>
                    <div className="space-y-1 text-xs">
                      <div className="bg-white rounded p-1 border border-red-200">
                        <div className="text-red-700">📝 Hand-write scorecards</div>
                        <div className="text-red-600">45+ min</div>
                      </div>
                      <div className="bg-red-200 rounded p-1 text-center">
                        <div className="font-bold text-red-900">⏰ TOTAL: 2+ HOURS</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-300 rounded-lg p-1">
                    <h5 className="text-sm font-bold text-green-800 mb-1 text-center">⚡ WooCombine</h5>
                    <div className="space-y-1 text-xs">
                      <div className="bg-white rounded p-1 border border-green-200">
                        <div className="text-green-700">📄 Generate all</div>
                        <div className="text-green-600">0.3 sec</div>
                      </div>
                      <div className="bg-green-200 rounded p-1 text-center">
                        <div className="font-bold text-green-900">⏰ TOTAL: 0.5 SECONDS</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Actions */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-1">
                  <h4 className="text-sm font-bold mb-1 text-center">🚀 One-Click Generation</h4>
                  <div className="grid grid-cols-3 gap-1">
                    <button className="bg-white/20 rounded p-1 text-center">
                      <div className="text-lg">📄</div>
                      <div className="font-bold text-xs">PDFs</div>
                    </button>
                    <button className="bg-white/20 rounded p-1 text-center">
                      <div className="text-lg">📊</div>
                      <div className="font-bold text-xs">Export</div>
                    </button>
                    <button className="bg-white/20 rounded p-1 text-center">
                      <div className="text-lg">📧</div>
                      <div className="font-bold text-xs">Email</div>
                    </button>
                  </div>
                </div>


              </div>
            )}

            {/* Scenario 6: YOUR NEW REALITY - THE ULTIMATE WOW FACTOR */}
            {currentScenario === 5 && (
              <div className="space-y-2">
                {/* The Transformation */}
                <div className="bg-gradient-to-br from-red-600 to-green-600 text-white rounded-lg p-2">
                  <h4 className="text-sm font-bold mb-2 text-center">🔥 THE COMPLETE TRANSFORMATION</h4>
                  
                  <div className="grid grid-cols-2 gap-1">
                    {/* OLD NIGHTMARE */}
                    <div className="bg-red-800/50 rounded p-1 backdrop-blur">
                      <h5 className="text-sm font-bold mb-1 text-center">😵 OLD NIGHTMARE</h5>
                      <div className="space-y-1 text-xs">
                        <div className="bg-red-700/60 rounded p-1">
                          <div className="font-bold text-red-100">⏰ Setup:</div>
                          <div className="text-red-200">45+ minutes of chaos</div>
                        </div>
                        <div className="bg-red-700/60 rounded p-1">
                          <div className="font-bold text-red-100">📝 Data Entry:</div>
                          <div className="text-red-200">3+ hours manual</div>
                        </div>
                        <div className="bg-red-700/60 rounded p-1">
                          <div className="font-bold text-red-100">📊 Reports:</div>
                          <div className="text-red-200">2+ days + errors</div>
                        </div>
                        <div className="bg-red-900 rounded p-1 text-center">
                          <div className="text-sm font-bold text-red-100">💀 NIGHTMARE</div>
                        </div>
                      </div>
                    </div>

                    {/* NEW REALITY */}
                    <div className="bg-green-600/50 rounded p-1 backdrop-blur">
                      <h5 className="text-sm font-bold mb-1 text-center">🎉 NEW REALITY</h5>
                      <div className="space-y-1 text-xs">
                        <div className="bg-green-500/60 rounded p-1">
                          <div className="font-bold text-green-100">⚡ Setup:</div>
                          <div className="text-green-200">2 minutes digital</div>
                        </div>
                        <div className="bg-green-500/60 rounded p-1">
                          <div className="font-bold text-green-100">📱 Data:</div>
                          <div className="text-green-200">Real-time, zero errors</div>
                        </div>
                        <div className="bg-green-500/60 rounded p-1">
                          <div className="font-bold text-green-100">📈 Reports:</div>
                          <div className="text-green-200">0.5 sec, pro quality</div>
                        </div>
                        <div className="bg-green-800 rounded p-1 text-center">
                          <div className="text-sm font-bold text-green-100">🚀 HERO STATUS</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Impact Numbers */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-1">
                  <h4 className="text-sm font-bold mb-1 text-center">📊 BY THE NUMBERS</h4>
                  <div className="grid grid-cols-4 gap-1">
                    <div className="bg-white/20 rounded p-1 text-center backdrop-blur">
                      <div className="text-sm font-bold text-yellow-300">{WOW_STATS.timesSaved}</div>
                      <div className="text-xs text-purple-100">Saved</div>
                    </div>
                    <div className="bg-white/20 rounded p-1 text-center backdrop-blur">
                      <div className="text-sm font-bold text-green-300">{WOW_STATS.parentSatisfaction}</div>
                      <div className="text-xs text-purple-100">Parent</div>
                    </div>
                    <div className="bg-white/20 rounded p-1 text-center backdrop-blur">
                      <div className="text-sm font-bold text-blue-300">{WOW_STATS.errorReduction}</div>
                      <div className="text-xs text-purple-100">Errors</div>
                    </div>
                    <div className="bg-white/20 rounded p-1 text-center backdrop-blur">
                      <div className="text-sm font-bold text-cyan-300">$2.4k</div>
                      <div className="text-xs text-purple-100">Value</div>
                    </div>
                  </div>
                </div>

                {/* What You Just Witnessed */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-1">
                  <h4 className="text-sm font-bold mb-1 text-center">✅ WHAT YOU SAW</h4>
                  <div className="grid grid-cols-4 gap-1">
                    <div className="bg-white/10 rounded p-1 text-center">
                      <div className="text-lg">😰</div>
                      <div className="font-bold text-xs">Pain Points</div>
                    </div>
                    <div className="bg-white/10 rounded p-1 text-center">
                      <div className="text-lg">⚡</div>
                      <div className="font-bold text-xs">Real-Time</div>
                    </div>
                    <div className="bg-white/10 rounded p-1 text-center">
                      <div className="text-lg">📱</div>
                      <div className="font-bold text-xs">Parents</div>
                    </div>
                    <div className="bg-white/10 rounded p-1 text-center">
                      <div className="text-lg">🧠</div>
                      <div className="font-bold text-xs">Smart</div>
                    </div>
                  </div>
                </div>

                {/* Call to Action Preview */}
                <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg p-1 text-center">
                  <h4 className="text-sm font-bold mb-1">🚀 YOUR TRANSFORMATION STARTS NOW</h4>
                  <p className="text-xs mb-1 text-green-100">
                    Join 500+ coaches who've made the switch
                  </p>
                  <div className="text-lg">👇</div>
                  <p className="text-xs text-blue-100">
                    Start your free trial and become the coach your players deserve!
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Compact Call to Action */}
        <div className="mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl shadow-lg p-2 text-white text-center">
          <h2 className="text-sm font-bold mb-1">
            🎯 Ready to Be the Hero Coach?
          </h2>
          <p className="text-cyan-100 mb-2 text-xs">
            Join 500+ coaches who've transformed their combines
          </p>
          
          <div className="space-y-1">
            <button
              onClick={() => navigate("/signup")}
              className="w-full bg-white text-cyan-600 font-semibold py-2 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm"
            >
              ⚡ Start Your Transformation - Free Trial
            </button>
            
            <div className="flex justify-center gap-2">
              <button
                onClick={resetDemo}
                className="border border-white text-white font-medium py-1 px-2 rounded-lg hover:bg-white/10 transition-all duration-200 text-xs"
              >
                🔄 Replay
              </button>
              <button
                onClick={() => navigate("/welcome")}
                className="border border-white text-white font-medium py-1 px-2 rounded-lg hover:bg-white/10 transition-all duration-200 text-xs"
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