import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, RotateCcw, ArrowRight, CheckCircle, Upload, UserPlus, BarChart3, Trophy, FileText, Download } from 'lucide-react';

// Simulated data for the demo
const DEMO_CSV_DATA = `name,number,age_group
Alex Johnson,12,U16
Jordan Smith,7,U16
Taylor Brown,23,U14
Morgan Davis,15,U16
Casey Williams,3,U14
Riley Martinez,8,U16`;

const DEMO_PLAYERS = [
  { id: 1, name: "Alex Johnson", number: 12, age_group: "U16", fortyYardDash: null, vertical: null, catching: null, throwing: null, agility: null },
  { id: 2, name: "Jordan Smith", number: 7, age_group: "U16", fortyYardDash: null, vertical: null, catching: null, throwing: null, agility: null },
  { id: 3, name: "Taylor Brown", number: 23, age_group: "U14", fortyYardDash: null, vertical: null, catching: null, throwing: null, agility: null },
  { id: 4, name: "Morgan Davis", number: 15, age_group: "U16", fortyYardDash: null, vertical: null, catching: null, throwing: null, agility: null },
  { id: 5, name: "Casey Williams", number: 3, age_group: "U14", fortyYardDash: null, vertical: null, catching: null, throwing: null, agility: null },
  { id: 6, name: "Riley Martinez", number: 8, age_group: "U16", fortyYardDash: null, vertical: null, catching: null, throwing: null, agility: null },
];

const DRILL_RESULTS = {
  1: { fortyYardDash: 4.38, vertical: 36, catching: 18, throwing: 85, agility: 22 },
  2: { fortyYardDash: 4.52, vertical: 34, catching: 16, throwing: 82, agility: 24 },
  3: { fortyYardDash: 4.67, vertical: 32, catching: 20, throwing: 78, agility: 26 },
  4: { fortyYardDash: 4.31, vertical: 38, catching: 19, throwing: 88, agility: 21 },
  5: { fortyYardDash: 4.89, vertical: 28, catching: 15, throwing: 75, agility: 28 },
  6: { fortyYardDash: 4.44, vertical: 35, catching: 17, throwing: 84, agility: 23 }
};

const WORKFLOW_STEPS = [
  {
    id: 1,
    title: "Create League",
    desc: "Coach enters league name and gets started",
    icon: "🏈",
    duration: 4000,
    component: "CreateLeagueStep"
  },
  {
    id: 2,
    title: "Setup Event",
    desc: "Create combine event with details",
    icon: "📅",
    duration: 5000,
    component: "CreateEventStep"
  },
  {
    id: 3,
    title: "Upload Roster",
    desc: "Import players via CSV file",
    icon: "📤",
    duration: 6000,
    component: "UploadCsvStep"
  },
  {
    id: 4,
    title: "Add Manual Player",
    desc: "Manually add a player who showed up late",
    icon: "👤",
    duration: 5000,
    component: "ManualPlayerStep"
  },
  {
    id: 5,
    title: "Enter Drill Results",
    desc: "Record 40-yard dash times live",
    icon: "⚡",
    duration: 8000,
    component: "DrillResultsStep"
  },
  {
    id: 6,
    title: "Adjust Weights",
    desc: "Coach tweaks drill importance",
    icon: "⚖️",
    duration: 6000,
    component: "WeightsStep"
  },
  {
    id: 7,
    title: "Final Rankings",
    desc: "Generate professional reports",
    icon: "🏆",
    duration: 5000,
    component: "FinalResultsStep"
  }
];

export default function WorkflowDemo() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef();

  // Demo state
  const [leagueName, setLeagueName] = useState("");
  const [eventName, setEventName] = useState("");
  const [players, setPlayers] = useState([]);
  const [weights, setWeights] = useState({
    fortyYardDash: 30,
    vertical: 20,
    catching: 15,
    throwing: 15,
    agility: 20
  });
  const [currentDrillPlayer, setCurrentDrillPlayer] = useState(null);

  // Auto-advance steps
  useEffect(() => {
    if (!isAutoPlaying) return;

    const step = WORKFLOW_STEPS[currentStep];
    if (!step) {
      setIsAutoPlaying(false);
      return;
    }

    // Progress bar animation
    setStepProgress(0);
    const progressInterval = setInterval(() => {
      setStepProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + (100 / (step.duration / 100));
      });
    }, 100);

    // Step advancement
    const timer = setTimeout(() => {
      if (currentStep < WORKFLOW_STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        setIsAutoPlaying(false);
      }
    }, step.duration);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [currentStep, isAutoPlaying]);

  const startAutoDemo = () => {
    setIsAutoPlaying(true);
    setCurrentStep(0);
    resetDemo();
  };

  const resetDemo = () => {
    setCurrentStep(0);
    setStepProgress(0);
    setIsAutoPlaying(false);
    setLeagueName("");
    setEventName("");
    setPlayers([]);
    setWeights({
      fortyYardDash: 30,
      vertical: 20,
      catching: 15,
      throwing: 15,
      agility: 20
    });
    setCurrentDrillPlayer(null);
    setNotifications([]);
  };

  const addNotification = (message, type = "success") => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const calculateCompositeScore = (player) => {
    let score = 0;
    let totalWeight = 0;
    
    const drills = ['fortyYardDash', 'vertical', 'catching', 'throwing', 'agility'];
    drills.forEach(drill => {
      const value = player[drill];
      if (value !== null && value !== undefined) {
        const weight = weights[drill];
        let normalizedScore;
        if (drill === 'fortyYardDash') {
          normalizedScore = Math.max(0, 100 - (value - 4.0) * 20);
        } else if (drill === 'vertical') {
          normalizedScore = Math.min(100, value * 2.5);
        } else {
          normalizedScore = Math.min(100, value * 5);
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

  // Step-specific effects
  useEffect(() => {
    const step = WORKFLOW_STEPS[currentStep];
    if (!step) return;

    switch (step.component) {
      case "CreateLeagueStep":
        setTimeout(() => setLeagueName("Spring Football League"), 1500);
        break;
      case "CreateEventStep":
        setTimeout(() => setEventName("2024 Spring Showcase"), 2000);
        break;
      case "UploadCsvStep":
        setTimeout(() => {
          setPlayers(DEMO_PLAYERS);
          addNotification("✅ 6 players uploaded successfully!");
        }, 3000);
        break;
      case "ManualPlayerStep":
        setTimeout(() => {
          const newPlayer = { id: 7, name: "Sam Wilson", number: 21, age_group: "U16", fortyYardDash: null, vertical: null, catching: null, throwing: null, agility: null };
          setPlayers(prev => [...prev, newPlayer]);
          addNotification("👤 Sam Wilson added manually!");
        }, 3000);
        break;
      case "DrillResultsStep":
        setTimeout(() => {
          setCurrentDrillPlayer(players[0]);
        }, 1000);
        setTimeout(() => {
          const updatedPlayers = players.map(player => ({
            ...player,
            ...DRILL_RESULTS[player.id]
          }));
          setPlayers(updatedPlayers);
          addNotification("⚡ All drill results recorded!");
        }, 5000);
        break;
      case "WeightsStep":
        setTimeout(() => {
          setWeights(prev => ({ ...prev, fortyYardDash: 45, vertical: 25 }));
        }, 3000);
        break;
    }
  }, [currentStep, players]);

  const renderStepContent = () => {
    const step = WORKFLOW_STEPS[currentStep];
    if (!step) return null;

    switch (step.component) {
      case "CreateLeagueStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Create a New League</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">League Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                    placeholder="Enter league name..."
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                  />
                </div>
                <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
                  Create League & Continue
                </button>
              </div>
            </div>
            {leagueName && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-sm">✅ League "{leagueName}" created successfully!</p>
              </div>
            )}
          </div>
        );

      case "CreateEventStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Create Combine Event</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    placeholder="Enter event name..."
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                      defaultValue="2024-04-15"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                      placeholder="Field location"
                      defaultValue="Central High School"
                    />
                  </div>
                </div>
                <button className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold">
                  Create Event
                </button>
              </div>
            </div>
            {eventName && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">📅 Event "{eventName}" scheduled!</p>
              </div>
            )}
          </div>
        );

      case "UploadCsvStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Upload Player Roster</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Drop CSV file here or click to upload</p>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  Choose File
                </button>
              </div>
              {players.length === 0 && (
                <div className="mt-4 bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Sample CSV Format:</h4>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">{DEMO_CSV_DATA}</pre>
                </div>
              )}
            </div>
            {players.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-lg">
                <h4 className="font-semibold mb-3">Uploaded Players ({players.length})</h4>
                <div className="space-y-2">
                  {players.slice(0, 4).map(player => (
                    <div key={player.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium">{player.name}</span>
                      <span className="text-sm text-gray-600">#{player.number} • {player.age_group}</span>
                    </div>
                  ))}
                  {players.length > 4 && (
                    <div className="text-center text-sm text-gray-500">
                      +{players.length - 4} more players...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case "ManualPlayerStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Add Walk-Up Player</h3>
              <p className="text-gray-600 text-sm mb-4">Sam Wilson just showed up - let's add him quickly!</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    defaultValue="Sam"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    defaultValue="Wilson"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Auto-assigned"
                    defaultValue="21"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Age Group</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg" defaultValue="U16">
                    <option value="U14">U14</option>
                    <option value="U16">U16</option>
                    <option value="U18">U18</option>
                  </select>
                </div>
              </div>
              <button className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                Add Player
              </button>
            </div>
          </div>
        );

      case "DrillResultsStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Live Drill Entry</h3>
              {currentDrillPlayer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-blue-800">Now Running: {currentDrillPlayer.name}</h4>
                      <p className="text-blue-600 text-sm">40-Yard Dash • #{currentDrillPlayer.number}</p>
                    </div>
                    <div className="text-2xl animate-pulse">🏃‍♂️</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Player #</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Enter number..."
                    defaultValue={currentDrillPlayer?.number || ""}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Drill Type</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg" defaultValue="fortyYardDash">
                    <option value="fortyYardDash">40-Yard Dash</option>
                    <option value="vertical">Vertical Jump</option>
                    <option value="catching">Catching</option>
                    <option value="throwing">Throwing</option>
                    <option value="agility">Agility</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time/Score</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="4.38"
                    defaultValue={currentDrillPlayer ? "4.38" : ""}
                  />
                </div>
                <div className="flex items-end">
                  <button className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold">
                    Record Result
                  </button>
                </div>
              </div>
            </div>
            
            {players.some(p => p.fortyYardDash) && (
              <div className="bg-white rounded-lg p-4 shadow-lg">
                <h4 className="font-semibold mb-3">Recent Entries</h4>
                <div className="space-y-2">
                  {players.filter(p => p.fortyYardDash).slice(0, 3).map(player => (
                    <div key={player.id} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="font-medium">{player.name}</span>
                      <span className="text-sm text-green-700">{player.fortyYardDash}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "WeightsStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Adjust Drill Weights</h3>
              <p className="text-gray-600 text-sm mb-4">These kids are really fast today - let's emphasize speed more!</p>
              <div className="space-y-4">
                {Object.entries(weights).map(([drill, weight]) => (
                  <div key={drill} className="flex items-center gap-4">
                    <span className="w-24 text-sm font-medium capitalize">
                      {drill.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={weight}
                      onChange={(e) => setWeights(prev => ({ ...prev, [drill]: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="w-12 text-sm font-mono">{weight}%</span>
                  </div>
                ))}
              </div>
            </div>
            
            {rankedPlayers.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Live Rankings Update
                </h4>
                <div className="space-y-2">
                  {rankedPlayers.slice(0, 4).map(player => (
                    <div key={player.id} className="flex justify-between items-center p-2 bg-gray-50 rounded transition-all duration-300">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          player.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                          player.rank === 2 ? 'bg-gray-100 text-gray-700' :
                          player.rank === 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          #{player.rank}
                        </span>
                        <span className="font-medium">{player.name}</span>
                      </div>
                      <span className="font-mono text-sm">{player.compositeScore.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "FinalResultsStep":
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
              <h3 className="text-lg font-semibold mb-4 text-purple-800">Final Results & Reports</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg p-3">
                  <h4 className="font-medium text-purple-700 mb-2">Individual Scorecards</h4>
                  <ul className="text-sm text-purple-600 space-y-1">
                    <li>• Personal performance reports</li>
                    <li>• Ranking certificates</li>
                    <li>• Improvement suggestions</li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <h4 className="font-medium text-purple-700 mb-2">Team Analytics</h4>
                  <ul className="text-sm text-purple-600 space-y-1">
                    <li>• Age group comparisons</li>
                    <li>• Scout-ready summaries</li>
                    <li>• CSV data exports</li>
                  </ul>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button className="bg-purple-600 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                  <FileText className="w-3 h-3" />
                  PDFs
                </button>
                <button className="bg-green-600 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                  <Download className="w-3 h-3" />
                  CSV
                </button>
                <button className="bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                  📧 Email
                </button>
              </div>
            </div>

            {rankedPlayers.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-600" />
                  Final Leaderboard
                </h4>
                <div className="space-y-2">
                  {rankedPlayers.map((player, index) => (
                    <div key={player.id} className={`flex justify-between items-center p-3 rounded transition-all ${
                      index < 3 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          player.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                          player.rank === 2 ? 'bg-gray-100 text-gray-700' :
                          player.rank === 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          #{player.rank}
                        </span>
                        <div>
                          <span className="font-medium">{player.name}</span>
                          {index < 3 && <span className="ml-2 text-lg">🏆</span>}
                          <div className="text-xs text-gray-500">#{player.number} • {player.age_group}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-lg text-purple-600">
                          {player.compositeScore.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500">Overall</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
              <h4 className="font-bold text-green-800 text-lg mb-2">🎉 Combine Complete!</h4>
              <p className="text-green-700 text-sm mb-2">
                Total time: 2.5 hours • Old way would have taken: 8+ hours
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white/70 rounded p-2">
                  <div className="font-bold text-green-800">{players.length}</div>
                  <div className="text-green-600">Players</div>
                </div>
                <div className="bg-white/70 rounded p-2">
                  <div className="font-bold text-green-800">{players.length * 5}</div>
                  <div className="text-green-600">Results</div>
                </div>
                <div className="bg-white/70 rounded p-2">
                  <div className="font-bold text-green-800">100%</div>
                  <div className="text-green-600">Accuracy</div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

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

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🏈 WooCombine Live Workflow Demo
            </h1>
            <p className="text-gray-600 mb-4">
              Watch a complete combine setup from start to finish
            </p>
            
            <div className="flex justify-center items-center gap-3 mb-4">
              <button
                onClick={startAutoDemo}
                disabled={isAutoPlaying}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
              >
                {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isAutoPlaying ? 'Playing...' : 'Start Auto Demo'}
              </button>
              
              <button
                onClick={resetDemo}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>

            {/* Step Progress */}
            <div className="flex justify-center gap-2 mb-4">
              {WORKFLOW_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    currentStep === index 
                      ? 'bg-blue-600 text-white' 
                      : index < currentStep
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {index < currentStep && <CheckCircle className="w-3 h-3 inline mr-1" />}
                  {step.icon} {step.title}
                </button>
              ))}
            </div>

            {/* Progress Bar */}
            {isAutoPlaying && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${stepProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>

        {/* Current Step Display */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{WORKFLOW_STEPS[currentStep]?.icon}</div>
              <div>
                <h2 className="text-xl font-bold">{WORKFLOW_STEPS[currentStep]?.title}</h2>
                <p className="text-blue-100 text-sm">{WORKFLOW_STEPS[currentStep]?.desc}</p>
              </div>
              {isAutoPlaying && (
                <div className="ml-auto flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Live Demo</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {renderStepContent()}
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-6 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl shadow-lg p-6 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">
            🚀 Ready to Transform Your Combines?
          </h2>
          <p className="text-green-100 mb-4">
            See how this complete workflow can be yours in under 60 seconds
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate("/signup")}
              className="w-full bg-white text-green-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all duration-200"
            >
              ⚡ Start Your Free Trial Now
            </button>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => navigate("/demo")}
                className="border border-white text-white font-medium py-2 px-4 rounded-lg hover:bg-white/10 transition-all duration-200 text-sm"
              >
                ← See Features Demo
              </button>
              
              <button
                onClick={() => navigate("/welcome")}
                className="border border-white text-white font-medium py-2 px-4 rounded-lg hover:bg-white/10 transition-all duration-200 text-sm"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}