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
      
      <div className="max-w-5xl mx-auto px-4 py-4">
        
        {/* Compact Header */}
        <div className="text-center mb-4">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              🚀 WooCombine: The Revolution
            </h1>
            <p className="text-gray-600 text-sm mb-3">
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
            
            {/* REVOLUTIONARY DEMO CONTENT - PAIN → FEATURES → WORKFLOW → RESULTS */}
            
            {/* Scenario 1: PAIN POINT SETUP */}
            {currentScenario === 0 && (
              <div className="space-y-6">
                {/* Dramatic Header */}
                <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl p-6 text-center">
                  <div className="text-6xl mb-4">😰</div>
                  <h3 className="text-2xl font-bold mb-2">Every Coach's Nightmare</h3>
                  <p className="text-red-100 text-lg">
                    This is what coaches deal with EVERY combine day...
                  </p>
                </div>

                {/* Pain Points Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {PAIN_POINTS.map((pain, index) => (
                    <div key={pain.id} className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center transform hover:scale-105 transition-all">
                      <div className="text-4xl mb-3">{pain.visual}</div>
                      <h4 className="font-bold text-red-800 mb-2">{pain.title}</h4>
                      <p className="text-red-700 text-sm mb-2">{pain.desc}</p>
                      <div className="text-xs text-red-600 italic bg-red-100 rounded p-2">
                        "{pain.impact}"
                      </div>
                    </div>
                  ))}
                </div>

                {/* The Cost */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-6">
                  <h4 className="text-xl font-bold mb-4 text-center">💸 The TRUE Cost of Manual Combines</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-400">47+</div>
                      <div className="text-sm text-gray-300">Hours Wasted</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-400">38%</div>
                      <div className="text-sm text-gray-300">Error Rate</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-400">76%</div>
                      <div className="text-sm text-gray-300">Parent Frustration</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-2xl font-bold text-red-400">$2,400</div>
                      <div className="text-sm text-gray-300">Lost Time Value</div>
                    </div>
                  </div>
                </div>

                {/* Dramatic Transition */}
                <div className="bg-gradient-to-r from-gray-700 to-blue-600 text-white rounded-lg p-4 text-center">
                  <p className="text-lg font-bold">
                    😤 Sound familiar? You're not alone...
                  </p>
                  <p className="text-blue-100 mt-2">
                    But what if we told you there's a COMPLETELY different way? 
                  </p>
                  <div className="mt-3 text-2xl animate-pulse">
                    👆 Keep watching to see the magic...
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 2: HERO FEATURE - THE GAME CHANGER */}
            {currentScenario === 1 && (
              <div className="space-y-6">
                {/* Dramatic Reveal Header */}
                <div className="bg-gradient-to-r from-green-400 to-blue-600 text-white rounded-xl p-8 text-center">
                  <div className="text-7xl mb-4">⚡</div>
                  <h3 className="text-3xl font-bold mb-2">The Game Changer</h3>
                  <p className="text-xl text-green-100 mb-4">
                    Watch REAL-TIME magic happen!
                  </p>
                  <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                    <p className="text-2xl font-bold text-yellow-300">
                      Everything updates INSTANTLY as drills happen! ✨
                    </p>
                  </div>
                </div>

                {/* Triple Screen Demo */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Coach Tablet */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4">
                    <div className="bg-blue-600 text-white text-center py-2 rounded-t-lg mb-3">
                      📱 Coach's Tablet
                    </div>
                    <div className="space-y-2">
                      <div className="bg-white rounded p-2 border-l-4 border-green-500">
                        <div className="font-bold text-green-800">Alex Johnson</div>
                        <div className="text-sm text-green-600">40-yard: 4.38s ⚡</div>
                        <div className="text-xs text-green-500 animate-pulse">Just recorded!</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="font-bold">Jordan Smith</div>
                        <div className="text-sm text-gray-600">Next up...</div>
                      </div>
                    </div>
                  </div>

                  {/* Parent Phone */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-4">
                    <div className="bg-green-600 text-white text-center py-2 rounded-t-lg mb-3">
                      📱 Parent's Phone
                    </div>
                    <div className="bg-white rounded p-3 border border-green-200">
                      <div className="text-sm text-green-800 mb-2">
                        <strong>🏃 Live Update!</strong>
                      </div>
                      <div className="text-green-700">
                        Alex just ran 4.38s! 
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        Current rank: #1 🏆
                      </div>
                      <div className="text-xs text-green-500 italic mt-2 animate-pulse">
                        Received 0.03 seconds ago
                      </div>
                    </div>
                  </div>

                  {/* Live Leaderboard */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-4">
                    <div className="bg-purple-600 text-white text-center py-2 rounded-t-lg mb-3">
                      📊 Live Rankings
                    </div>
                    <div className="space-y-2">
                      <div className="bg-yellow-100 border border-yellow-300 rounded p-2 animate-pulse">
                        <div className="flex justify-between">
                          <span className="font-bold">#1 Alex</span>
                          <span className="text-sm">87.3</span>
                        </div>
                        <div className="text-xs text-yellow-700">↑ Just moved up!</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="flex justify-between">
                          <span>#2 Morgan</span>
                          <span className="text-sm">82.1</span>
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="flex justify-between">
                          <span>#3 Jordan</span>
                          <span className="text-sm">79.8</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* The Magic Happens */}
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg p-6">
                  <h4 className="text-xl font-bold mb-3 text-center">🪄 Here's What Just Happened (in 3 seconds)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/20 rounded-lg p-3">
                      <div className="font-bold mb-2">⚡ INSTANT Actions:</div>
                      <ul className="text-sm space-y-1">
                        <li>✅ Result recorded on tablet</li>
                        <li>✅ Database updated automatically</li>
                        <li>✅ Rankings recalculated</li>
                        <li>✅ Parents notified by text</li>
                        <li>✅ Leaderboard refreshed</li>
                      </ul>
                    </div>
                    <div className="bg-white/20 rounded-lg p-3">
                      <div className="font-bold mb-2">💀 Manual Way Would Take:</div>
                      <ul className="text-sm space-y-1 text-red-200">
                        <li>❌ 15 min: Write on clipboard</li>
                        <li>❌ 30 min: Transfer to spreadsheet</li>
                        <li>❌ 45 min: Recalculate rankings</li>
                        <li>❌ 60 min: Update leaderboard</li>
                        <li>❌ Never: Parent notifications</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Interactive Demo Button */}
                <div className="text-center">
                  <button
                    onClick={addMissingResults}
                    disabled={isRunning}
                    className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl text-lg transform hover:scale-105 transition-all duration-300 shadow-2xl"
                  >
                    {isRunning ? '⚡ WATCH THE MAGIC...' : '🎯 TRIGGER THE MAGIC!'}
                  </button>
                  <p className="text-gray-600 text-sm mt-2">
                    Click to see real-time updates in action
                  </p>
                </div>

                {/* Impact Stats */}
                <div className="bg-gradient-to-r from-gray-800 to-blue-900 text-white rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-400">{WOW_STATS.setupTime}</div>
                      <div className="text-sm text-gray-300">Setup Time</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-400">{WOW_STATS.realTimeUpdates}</div>
                      <div className="text-sm text-gray-300">Results Delay</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-400">{WOW_STATS.parentSatisfaction}</div>
                      <div className="text-sm text-gray-300">Parent Satisfaction</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scenario 3: SMART PARENT ENGAGEMENT */}
            {currentScenario === 2 && (
              <div className="space-y-6">
                {/* Dramatic Header */}
                <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl p-8 text-center">
                  <div className="text-6xl mb-4">📱</div>
                  <h3 className="text-3xl font-bold mb-2">Parent Engagement Revolution</h3>
                  <p className="text-xl text-blue-100 mb-4">
                    No more "How did my kid do?" questions - EVER!
                  </p>
                  <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                    <p className="text-2xl font-bold text-yellow-300">
                      Parents connected LIVE from anywhere! 💖
                    </p>
                  </div>
                </div>

                {/* Before/After Problem → Solution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* THE PROBLEM */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-lg p-6">
                    <h4 className="text-xl font-bold text-red-800 mb-4 text-center">😤 The Old Parent Experience</h4>
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 border border-red-200">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center">
                            <span className="text-2xl">😰</span>
                          </div>
                          <div>
                            <div className="font-bold text-red-800">Sarah (Working Mom)</div>
                            <div className="text-sm text-red-600">Missing her child's combine</div>
                          </div>
                        </div>
                        <div className="bg-red-100 rounded p-3">
                          <div className="text-sm text-red-800">
                            💭 "I wonder how Alex is doing... Should I text the coach? I hope I get updates..."
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-red-200 rounded-lg p-4">
                        <h5 className="font-bold text-red-900 mb-2">❌ What Parents Actually Get:</h5>
                        <ul className="text-sm text-red-800 space-y-1">
                          <li>• Hours of anxiety and wondering</li>
                          <li>• Constant "How did my kid do?" texts</li>
                          <li>• Results 3+ hours later (maybe)</li>
                          <li>• Feeling disconnected and left out</li>
                          <li>• FOMO on their child's achievements</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* THE SOLUTION */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-6">
                    <h4 className="text-xl font-bold text-green-800 mb-4 text-center">🎉 The WooCombine Experience</h4>
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                            <span className="text-2xl">😊</span>
                          </div>
                          <div>
                            <div className="font-bold text-green-800">Sarah (Same Mom)</div>
                            <div className="text-sm text-green-600">Watching LIVE from office</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="bg-green-100 rounded p-2">
                            <div className="text-xs text-green-700 font-medium">📱 LIVE UPDATE:</div>
                            <div className="text-sm text-green-800">"Alex just ran 4.38s! Current rank: #1 🏆"</div>
                          </div>
                          <div className="text-xs text-green-600 italic">Received 2 seconds after finish line</div>
                        </div>
                      </div>
                      
                      <div className="bg-green-200 rounded-lg p-4">
                        <h5 className="font-bold text-green-900 mb-2">✅ What Parents NOW Get:</h5>
                        <ul className="text-sm text-green-800 space-y-1">
                          <li>• Instant notifications as drills complete</li>
                          <li>• Live rankings and progress updates</li>
                          <li>• Feel connected from anywhere</li>
                          <li>• Share excitement in real-time</li>
                          <li>• Zero stress, maximum pride</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multiple Parent Perspectives */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-6">
                  <h4 className="text-xl font-bold mb-4 text-center">📱 Meanwhile, Around Town...</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                      <div className="text-center mb-3">
                        <div className="text-3xl mb-2">👩‍💼</div>
                        <div className="font-bold">Mom at Work</div>
                        <div className="text-sm text-purple-200">Downtown Office</div>
                      </div>
                      <div className="bg-green-500 rounded p-2 text-sm">
                        "🏃 Alex just completed vertical jump: 38 inches! Amazing improvement!"
                      </div>
                    </div>
                    
                    <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                      <div className="text-center mb-3">
                        <div className="text-3xl mb-2">👨‍💻</div>
                        <div className="font-bold">Dad in Meeting</div>
                        <div className="text-sm text-purple-200">Video Conference</div>
                      </div>
                      <div className="bg-blue-500 rounded p-2 text-sm">
                        "⚡ Jordan finished agility drill! Ranking: #3 overall 🎯"
                      </div>
                    </div>
                    
                    <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                      <div className="text-center mb-3">
                        <div className="text-3xl mb-2">👵</div>
                        <div className="font-bold">Grandma</div>
                        <div className="text-sm text-purple-200">At Home</div>
                      </div>
                      <div className="bg-purple-500 rounded p-2 text-sm">
                        "🏆 Taylor moved to #2! So proud to watch live! ❤️"
                      </div>
                    </div>
                  </div>
                </div>

                {/* Impact Statistics */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-6">
                  <h4 className="text-xl font-bold mb-4 text-center">📊 Parent Engagement Impact</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-3xl font-bold text-green-400">{WOW_STATS.parentSatisfaction}</div>
                      <div className="text-sm text-gray-300">Satisfaction Rate</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-3xl font-bold text-blue-400">{FEATURE_IMPACTS.parentNotifications.increases}</div>
                      <div className="text-sm text-gray-300">Engagement</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-3xl font-bold text-purple-400">0.03s</div>
                      <div className="text-sm text-gray-300">Notification Speed</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <div className="text-3xl font-bold text-yellow-400">Zero</div>
                      <div className="text-sm text-gray-300">"How did they do?" texts</div>
                    </div>
                  </div>
                </div>

                {/* Testimonials */}
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg p-6 text-center">
                  <h4 className="text-xl font-bold mb-4">💖 What Parents Are Saying</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                      <p className="font-bold mb-2">"Game changer for working parents!"</p>
                      <p className="text-sm text-yellow-100">
                        "I felt like I was right there cheering him on, even from 20 miles away!"
                      </p>
                      <p className="text-xs text-yellow-200 mt-2">- Sarah, Working Mom</p>
                    </div>
                    <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                      <p className="font-bold mb-2">"Finally, no more stress!"</p>
                      <p className="text-sm text-yellow-100">
                        "I used to worry all day. Now I get instant updates and can focus on work."
                      </p>
                      <p className="text-xs text-yellow-200 mt-2">- Mike, Business Dad</p>
                    </div>
                  </div>
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