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
  
  // Animation state
  const [typingStates, setTypingStates] = useState({});
  const [buttonStates, setButtonStates] = useState({});
  const [showCursor, setShowCursor] = useState({});
  const [showTransition, setShowTransition] = useState(false);
  const [transitionText, setTransitionText] = useState("");
  const [stepSubState, setStepSubState] = useState("initial"); // initial, processing, success, transitioning



  // Button click animation with enhanced states
  const animateButtonClick = (buttonId, callback) => {
    setButtonStates(prev => ({ ...prev, [buttonId]: 'clicking' }));
    
    setTimeout(() => {
      setButtonStates(prev => ({ ...prev, [buttonId]: 'processing' }));
      if (callback) callback();
    }, 150);
  };

  // Show transition between steps
  const showTransitionScreen = (text, duration = 2000) => {
    setShowTransition(true);
    setTransitionText(text);
    
    setTimeout(() => {
      setShowTransition(false);
      setTransitionText("");
    }, duration);
  };

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
    setTypingStates({});
    setButtonStates({});
    setShowCursor({});
    setShowTransition(false);
    setTransitionText("");
    setStepSubState("initial");
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

  // Step-specific effects with animations
  useEffect(() => {
    const step = WORKFLOW_STEPS[currentStep];
    if (!step) return;

    switch (step.component) {
      case "CreateLeagueStep":
        setStepSubState("initial");
        // Simulate typing league name
        setTimeout(() => {
          const text = "Spring Football League";
          let index = 0;
          setLeagueName("");
          setShowCursor(prev => ({ ...prev, leagueName: true }));
          
          const typeInterval = setInterval(() => {
            if (index < text.length) {
              setLeagueName(text.slice(0, index + 1));
              index++;
            } else {
              clearInterval(typeInterval);
              setShowCursor(prev => ({ ...prev, leagueName: false }));
              
              // Animate button click after typing
              setTimeout(() => {
                animateButtonClick('create-league-btn', () => {
                  setStepSubState("processing");
                  
                  // Show processing state
                  setTimeout(() => {
                    setStepSubState("success");
                    addNotification("🏈 League created successfully!");
                    
                    // Show transition to event creation
                    setTimeout(() => {
                      showTransitionScreen("Redirecting to Event Setup...", 1500);
                      setStepSubState("transitioning");
                      
                      setTimeout(() => {
                        setButtonStates(prev => ({ ...prev, 'create-league-btn': 'normal' }));
                      }, 1500);
                    }, 1000);
                  }, 1200);
                });
              }, 800);
            }
          }, 120);
        }, 1000);
        break;
        
      case "CreateEventStep":
        setStepSubState("initial");
        // Simulate typing event name
        setTimeout(() => {
          const text = "2024 Spring Showcase";
          let index = 0;
          setEventName("");
          setShowCursor(prev => ({ ...prev, eventName: true }));
          
          const typeInterval = setInterval(() => {
            if (index < text.length) {
              setEventName(text.slice(0, index + 1));
              index++;
            } else {
              clearInterval(typeInterval);
              setShowCursor(prev => ({ ...prev, eventName: false }));
              
              // Animate button click
              setTimeout(() => {
                animateButtonClick('create-event-btn', () => {
                  setStepSubState("processing");
                  
                  setTimeout(() => {
                    setStepSubState("success");
                    addNotification("📅 Event scheduled successfully!");
                    
                    // Show event details confirmation
                    setTimeout(() => {
                      showTransitionScreen("Event created! Setting up player management...", 1800);
                      setStepSubState("transitioning");
                      
                      setTimeout(() => {
                        setButtonStates(prev => ({ ...prev, 'create-event-btn': 'normal' }));
                      }, 1800);
                    }, 1000);
                  }, 1000);
                });
              }, 800);
            }
          }, 100);
        }, 1500);
        break;
        
      case "UploadCsvStep":
        setStepSubState("initial");
        // Simulate file upload with progress
        setTimeout(() => {
          animateButtonClick('upload-csv-btn', () => {
            setStepSubState("processing");
            
            // Simulate file processing
            setTimeout(() => {
              setPlayers(DEMO_PLAYERS);
              setStepSubState("success");
              addNotification("✅ 6 players uploaded successfully!");
              
              // Show player roster preview
              setTimeout(() => {
                showTransitionScreen("Players imported! Ready for manual additions...", 1500);
                setStepSubState("transitioning");
                
                setTimeout(() => {
                  setButtonStates(prev => ({ ...prev, 'upload-csv-btn': 'normal' }));
                }, 1500);
              }, 1200);
            }, 2000);
          });
        }, 2000);
        break;
        
      case "ManualPlayerStep":
        // Simulate typing player details
        setTimeout(() => {
          animateButtonClick('add-player-btn', () => {
            setTimeout(() => {
              const newPlayer = { id: 7, name: "Sam Wilson", number: 21, age_group: "U16", fortyYardDash: null, vertical: null, catching: null, throwing: null, agility: null };
              setPlayers(prev => [...prev, newPlayer]);
              addNotification("👤 Sam Wilson added manually!");
            }, 500);
          });
        }, 2000);
        break;
        
      case "DrillResultsStep":
        setTimeout(() => {
          setCurrentDrillPlayer(players[0]);
        }, 1000);
        
        // Simulate entering drill result
        setTimeout(() => {
          animateButtonClick('record-result-btn', () => {
            setTimeout(() => {
              const updatedPlayers = players.map(player => ({
                ...player,
                ...DRILL_RESULTS[player.id]
              }));
              setPlayers(updatedPlayers);
              addNotification("⚡ All drill results recorded!");
            }, 800);
          });
        }, 3000);
        break;
        
      case "WeightsStep":
        // Simulate adjusting sliders
        setTimeout(() => {
          // Animate first slider
          let currentWeight = 30;
          const targetWeight = 45;
          const sliderInterval = setInterval(() => {
            if (currentWeight < targetWeight) {
              currentWeight += 1;
              setWeights(prev => ({ ...prev, fortyYardDash: currentWeight }));
            } else {
              clearInterval(sliderInterval);
              
              // Animate second slider
              setTimeout(() => {
                let currentWeight2 = 20;
                const targetWeight2 = 25;
                const sliderInterval2 = setInterval(() => {
                  if (currentWeight2 < targetWeight2) {
                    currentWeight2 += 1;
                    setWeights(prev => ({ ...prev, vertical: currentWeight2 }));
                  } else {
                    clearInterval(sliderInterval2);
                    addNotification("⚖️ Weights adjusted for speed emphasis!");
                  }
                }, 100);
              }, 500);
            }
          }, 80);
        }, 2000);
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
                  <div className="relative">
                    <input
                      type="text"
                      className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
                        showCursor.leagueName ? 'ring-2 ring-blue-400' : ''
                      }`}
                      placeholder="Enter league name..."
                      value={leagueName}
                      onChange={(e) => setLeagueName(e.target.value)}
                      style={{ 
                        borderColor: showCursor.leagueName ? '#3b82f6' : '#d1d5db',
                        boxShadow: showCursor.leagueName ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                      }}
                    />
                    {showCursor.leagueName && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-0.5 h-5 bg-blue-600 animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  id="create-league-btn"
                  className={`w-full py-3 rounded-lg font-semibold transition-all duration-200 ${
                    buttonStates['create-league-btn'] === 'clicking' 
                      ? 'bg-blue-700 text-white transform scale-95' 
                      : buttonStates['create-league-btn'] === 'processing'
                        ? 'bg-blue-500 text-white cursor-wait'
                        : stepSubState === 'success'
                          ? 'bg-green-600 text-white transform scale-100'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  disabled={buttonStates['create-league-btn'] === 'processing'}
                >
                  {buttonStates['create-league-btn'] === 'processing' 
                    ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Creating League...
                      </span>
                    )
                    : stepSubState === 'success'
                      ? '✓ League Created!' 
                      : 'Create League & Continue'
                  }
                </button>
              </div>
            </div>
            {stepSubState === 'success' && leagueName && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 animate-fade-in">
                <p className="text-green-800 text-sm">✅ League "{leagueName}" created successfully!</p>
                <div className="mt-2 flex items-center gap-2 text-green-700 text-xs">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Setting up event management...</span>
                </div>
              </div>
            )}
            
            {stepSubState === 'transitioning' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 animate-fade-in">
                <p className="text-blue-800 text-sm">🔄 Preparing event creation interface...</p>
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
                  <div className="relative">
                    <input
                      type="text"
                      className={`w-full px-4 py-3 border border-gray-300 rounded-lg transition ${
                        showCursor.eventName ? 'ring-2 ring-green-400' : ''
                      }`}
                      placeholder="Enter event name..."
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      style={{ 
                        borderColor: showCursor.eventName ? '#10b981' : '#d1d5db',
                        boxShadow: showCursor.eventName ? '0 0 0 3px rgba(16, 185, 129, 0.1)' : 'none'
                      }}
                    />
                    {showCursor.eventName && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-0.5 h-5 bg-green-600 animate-pulse"></div>
                      </div>
                    )}
                  </div>
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
                <button 
                  id="create-event-btn"
                  className={`w-full py-3 rounded-lg font-semibold transition-all duration-200 ${
                    buttonStates['create-event-btn'] === 'clicking' 
                      ? 'bg-green-700 text-white transform scale-95' 
                      : buttonStates['create-event-btn'] === 'processing'
                        ? 'bg-green-500 text-white cursor-wait'
                        : stepSubState === 'success'
                          ? 'bg-blue-600 text-white transform scale-100'
                          : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                  disabled={buttonStates['create-event-btn'] === 'processing'}
                >
                  {buttonStates['create-event-btn'] === 'processing' 
                    ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Scheduling Event...
                      </span>
                    )
                    : stepSubState === 'success'
                      ? '✓ Event Created!' 
                      : 'Create Event'
                  }
                </button>
              </div>
            </div>
            {stepSubState === 'success' && eventName && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 animate-fade-in">
                <p className="text-blue-800 text-sm">📅 Event "{eventName}" scheduled!</p>
                <div className="mt-2 p-2 bg-white rounded border border-blue-300">
                  <div className="text-xs text-blue-700">
                    <div className="flex justify-between mb-1">
                      <span>📅 Date:</span>
                      <span>April 15, 2024</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>📍 Location:</span>
                      <span>Central High School</span>
                    </div>
                    <div className="flex justify-between">
                      <span>👥 Players:</span>
                      <span>Ready for import</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {stepSubState === 'transitioning' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 animate-fade-in">
                <p className="text-green-800 text-sm">🔄 Loading player management tools...</p>
              </div>
            )}
          </div>
        );

      case "UploadCsvStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4">Upload Player Roster</h3>
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${
                buttonStates['upload-csv-btn'] === 'clicking' 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300'
              }`}>
                <Upload className={`w-12 h-12 mx-auto mb-4 transition-all duration-300 ${
                  buttonStates['upload-csv-btn'] === 'clicking' 
                    ? 'text-blue-600 animate-bounce' 
                    : 'text-gray-400'
                }`} />
                <p className="text-gray-600 mb-4">Drop CSV file here or click to upload</p>
                <button 
                  id="upload-csv-btn"
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    buttonStates['upload-csv-btn'] === 'clicking' 
                      ? 'bg-blue-700 text-white transform scale-95' 
                      : buttonStates['upload-csv-btn'] === 'processing'
                        ? 'bg-blue-500 text-white cursor-wait'
                        : stepSubState === 'success'
                          ? 'bg-green-600 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  disabled={buttonStates['upload-csv-btn'] === 'processing'}
                >
                  {buttonStates['upload-csv-btn'] === 'processing' 
                    ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing CSV...
                      </span>
                    )
                    : stepSubState === 'success'
                      ? '✓ Uploaded!'
                      : 'Choose File'
                  }
                </button>
              </div>
              {players.length === 0 && (
                <div className="mt-4 bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Sample CSV Format:</h4>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">{DEMO_CSV_DATA}</pre>
                </div>
              )}
            </div>
            {stepSubState === 'processing' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <p className="text-blue-800 font-medium text-sm">Processing roster file...</p>
                    <p className="text-blue-600 text-xs">Validating player data and assigning numbers</p>
                  </div>
                </div>
              </div>
            )}
            
            {stepSubState === 'success' && players.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-lg animate-fade-in">
                <h4 className="font-semibold mb-3 text-green-800">✅ Players Successfully Imported ({players.length})</h4>
                <div className="space-y-2">
                  {players.slice(0, 4).map(player => (
                    <div key={player.id} className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                      <span className="font-medium">{player.name}</span>
                      <span className="text-sm text-green-700">#{player.number} • {player.age_group}</span>
                    </div>
                  ))}
                  {players.length > 4 && (
                    <div className="text-center text-sm text-green-600">
                      +{players.length - 4} more players imported...
                    </div>
                  )}
                </div>
                <div className="mt-3 p-2 bg-green-100 rounded">
                  <p className="text-green-800 text-xs">✓ All player numbers auto-assigned • ✓ Age groups validated • ✓ Ready for manual additions</p>
                </div>
              </div>
            )}
            
            {stepSubState === 'transitioning' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 animate-fade-in">
                <p className="text-yellow-800 text-sm">🔄 Setting up manual player entry form...</p>
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
              <button 
                id="add-player-btn"
                className={`w-full mt-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
                  buttonStates['add-player-btn'] === 'clicking' 
                    ? 'bg-green-700 text-white transform scale-95' 
                    : buttonStates['add-player-btn'] === 'clicked'
                      ? 'bg-blue-600 text-white'
                      : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                {buttonStates['add-player-btn'] === 'clicked' 
                  ? '✓ Player Added!' 
                  : 'Add Player'
                }
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
                  <button 
                    id="record-result-btn"
                    className={`w-full py-2 rounded-lg font-semibold transition-all duration-200 ${
                      buttonStates['record-result-btn'] === 'clicking' 
                        ? 'bg-green-700 text-white transform scale-95' 
                        : buttonStates['record-result-btn'] === 'clicked'
                          ? 'bg-blue-600 text-white'
                          : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {buttonStates['record-result-btn'] === 'clicked' 
                      ? '✓ Recorded!' 
                      : 'Record Result'
                    }
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
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out;
          }
        `
      }} />
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

      {/* Transition Screen Overlay */}
      {showTransition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{transitionText}</h3>
            <p className="text-gray-600 text-sm">Please wait while we prepare the next step...</p>
          </div>
        </div>
      )}
      
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