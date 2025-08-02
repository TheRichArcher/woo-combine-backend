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
  // === PHASE 1: WORKFLOW - "How to use WooCombine" ===
  {
    id: 1,
    title: "Create League",
    desc: "Coach enters league name and gets started",
    icon: "🏈",
    phase: "workflow",
    duration: 10000,
    component: "CreateLeagueStep"
  },
  {
    id: 2,
    title: "Setup Event",
    desc: "Create combine event with details",
    icon: "📅",
    phase: "workflow",
    duration: 9000,
    component: "CreateEventStep"
  },
  {
    id: 3,
    title: "Upload Roster",
    desc: "Import players via CSV file",
    icon: "📤",
    phase: "workflow",
    duration: 8000,
    component: "UploadCsvStep"
  },
  {
    id: 4,
    title: "Add Manual Player",
    desc: "Manually add a player who showed up late",
    icon: "👤",
    phase: "workflow",
    duration: 5000,
    component: "ManualPlayerStep"
  },
  {
    id: 5,
    title: "Enter Drill Results",
    desc: "Record 40-yard dash times live",
    icon: "⚡",
    phase: "workflow",
    duration: 8000,
    component: "DrillResultsStep"
  },
  {
    id: 6,
    title: "Adjust Weights",
    desc: "Coach tweaks drill importance",
    icon: "⚖️",
    phase: "workflow",
    duration: 60000,
    component: "WeightsStep"
  },
  {
    id: 7,
    title: "Basic Rankings",
    desc: "Generate initial rankings",
    icon: "📊",
    phase: "workflow",
    duration: 6000,
    component: "BasicRankingsStep"
  },
  
  // === TRANSITION: WORKFLOW → FEATURES ===
  {
    id: 8,
    title: "🚀 Power Features",
    desc: "Now let's see why WooCombine is revolutionary...",
    icon: "✨",
    phase: "transition",
    duration: 4000,
    component: "TransitionStep"
  },

  // === PHASE 2: FEATURES - "Why WooCombine is powerful" ===
  {
    id: 9,
    title: "Live Updates",
    desc: "Watch results flow in real-time as drills happen",
    icon: "📱",
    phase: "features",
    duration: 8000,
    component: "LiveUpdatesStep"
  },
  {
    id: 10,
    title: "Parent Notifications",
    desc: "Parents get instant updates on their phones",
    icon: "📲",
    phase: "features",
    duration: 7000,
    component: "ParentNotificationsStep"
  },
  {
    id: 11,
    title: "Advanced Analytics",
    desc: "Deep insights that transform recruiting",
    icon: "📈",
    phase: "features",
    duration: 9000,
    component: "AdvancedAnalyticsStep"
  },
  {
    id: 12,
    title: "Team Formation",
    desc: "AI-powered balanced team creation",
    icon: "👥",
    phase: "features",
    duration: 8000,
    component: "TeamFormationStep"
  },
  {
    id: 13,
    title: "🎉 The WOW Factor",
    desc: "What just happened would take HOURS manually!",
    icon: "🎯",
    phase: "features",
    duration: 10000,
    component: "WowFactorStep"
  }
];

export default function UnifiedDemo() {
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
  
  // Manual player form state
  const [manualPlayerFirstName, setManualPlayerFirstName] = useState("");
  const [manualPlayerLastName, setManualPlayerLastName] = useState("");
  const [manualPlayerNumber, setManualPlayerNumber] = useState("");
  const [manualPlayerAgeGroup, setManualPlayerAgeGroup] = useState("");
  
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

  // Progress bar animation only - step advancement handled by animations
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

    return () => {
      clearInterval(progressInterval);
    };
  }, [currentStep, isAutoPlaying]);

  // Advance to next step function
  const advanceToNextStep = () => {
    if (currentStep < WORKFLOW_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsAutoPlaying(false);
    }
  };

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
    setManualPlayerFirstName("");
    setManualPlayerLastName("");
    setManualPlayerNumber("");
    setManualPlayerAgeGroup("");
    setNotifications([]);
    setTypingStates({});
    setButtonStates({});
    setShowCursor({});
    setShowTransition(false);
    setTransitionText("");
    setStepSubState("initial");
  };

  // Clear all notifications 
  const clearNotifications = () => {
    setNotifications([]);
  };

  const addNotification = (message, type = "success", duration = 2500) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
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

    // Reset states when starting a new step
    setStepSubState("initial");
    setShowTransition(false);
    setTransitionText("");
    setButtonStates({});
    setShowCursor({});
    
    // CRITICAL: Clear all notifications when starting new step
    clearNotifications();

    // Track timeouts for cleanup
    const timeouts = [];
    const intervals = [];

    switch (step.component) {
      case "CreateLeagueStep":
        // Simulate typing league name
        timeouts.push(setTimeout(() => {
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
              timeouts.push(setTimeout(() => {
                animateButtonClick('create-league-btn', () => {
                  setStepSubState("processing");
                  
                  // Show processing state
                  timeouts.push(setTimeout(() => {
                    setStepSubState("success");
                    addNotification("🏈 League created successfully!", "success", 2500);
                    
                    // Show transition to event creation
                    timeouts.push(setTimeout(() => {
                      showTransitionScreen("Redirecting to Event Setup...", 1500);
                      setStepSubState("transitioning");
                      
                      timeouts.push(setTimeout(() => {
                        setButtonStates(prev => ({ ...prev, 'create-league-btn': 'normal' }));
                        setStepSubState("ready");
                        // Step controls its own advancement
                        advanceToNextStep();
                      }, 1500));
                    }, 1000));
                  }, 1200));
                });
              }, 800));
            }
          }, 120);
          intervals.push(typeInterval);
        }, 1000));
        break;
        
      case "CreateEventStep":
        // Simulate typing event name
        timeouts.push(setTimeout(() => {
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
              timeouts.push(setTimeout(() => {
                animateButtonClick('create-event-btn', () => {
                  setStepSubState("processing");
                  
                  timeouts.push(setTimeout(() => {
                    setStepSubState("success");
                    addNotification("📅 Event scheduled successfully!", "success", 2500);
                    
                    // Show event details confirmation
                    timeouts.push(setTimeout(() => {
                      showTransitionScreen("Event created! Setting up player management...", 1800);
                      setStepSubState("transitioning");
                      
                      timeouts.push(setTimeout(() => {
                        setButtonStates(prev => ({ ...prev, 'create-event-btn': 'normal' }));
                        setStepSubState("ready");
                        // Step controls its own advancement
                        advanceToNextStep();
                      }, 1800));
                    }, 1000));
                  }, 1000));
                });
              }, 800));
            }
          }, 100);
          intervals.push(typeInterval);
        }, 1500));
        break;
        
      case "UploadCsvStep":
        // Simulate file upload with progress
        timeouts.push(setTimeout(() => {
          animateButtonClick('upload-csv-btn', () => {
            setStepSubState("processing");
            
            // Simulate file processing
            timeouts.push(setTimeout(() => {
              setPlayers(DEMO_PLAYERS);
              setStepSubState("success");
              addNotification("✅ 6 players uploaded successfully!", "success", 2500);
              
              // Show player roster preview
              timeouts.push(setTimeout(() => {
                showTransitionScreen("Players imported! Ready for manual additions...", 1500);
                setStepSubState("transitioning");
                
                timeouts.push(setTimeout(() => {
                  setButtonStates(prev => ({ ...prev, 'upload-csv-btn': 'normal' }));
                  setStepSubState("ready");
                  // Step controls its own advancement
                  advanceToNextStep();
                }, 1500));
              }, 1200));
            }, 2000));
          });
        }, 2000));
        break;
        
      case "ManualPlayerStep":
        // Reset form fields and start typing animation sequence
        setManualPlayerFirstName("");
        setManualPlayerLastName("");
        setManualPlayerNumber("");
        setManualPlayerAgeGroup("");
        
        // Step 1: Type First Name
        timeouts.push(setTimeout(() => {
          addNotification("📝 Coach typing player details...", "success", 2500);
          const firstName = "Sam";
          let index = 0;
          setShowCursor(prev => ({ ...prev, manualPlayerFirstName: true }));
          
          const typeFirstNameInterval = setInterval(() => {
            if (index < firstName.length) {
              setManualPlayerFirstName(firstName.slice(0, index + 1));
              index++;
            } else {
              clearInterval(typeFirstNameInterval);
              setShowCursor(prev => ({ ...prev, manualPlayerFirstName: false }));
              
              // Step 2: Type Last Name after first name is done
              timeouts.push(setTimeout(() => {
                const lastName = "Wilson";
                let lastNameIndex = 0;
                setShowCursor(prev => ({ ...prev, manualPlayerLastName: true }));
                
                const typeLastNameInterval = setInterval(() => {
                  if (lastNameIndex < lastName.length) {
                    setManualPlayerLastName(lastName.slice(0, lastNameIndex + 1));
                    lastNameIndex++;
                  } else {
                    clearInterval(typeLastNameInterval);
                    setShowCursor(prev => ({ ...prev, manualPlayerLastName: false }));
                    
                    // Step 3: Type Number
                    timeouts.push(setTimeout(() => {
                      const number = "21";
                      let numberIndex = 0;
                      setShowCursor(prev => ({ ...prev, manualPlayerNumber: true }));
                      
                      const typeNumberInterval = setInterval(() => {
                        if (numberIndex < number.length) {
                          setManualPlayerNumber(number.slice(0, numberIndex + 1));
                          numberIndex++;
                        } else {
                          clearInterval(typeNumberInterval);
                          setShowCursor(prev => ({ ...prev, manualPlayerNumber: false }));
                          
                          // Step 4: Select Age Group (simulate dropdown)
                          timeouts.push(setTimeout(() => {
                            addNotification("🎯 Selecting age group...", "success", 2500);
                            setManualPlayerAgeGroup("U16");
                            
                            // Step 5: Click Add Player button
                            timeouts.push(setTimeout(() => {
                              animateButtonClick('add-player-btn', () => {
                                timeouts.push(setTimeout(() => {
                                  const newPlayer = { 
                                    id: 7, 
                                    name: "Sam Wilson", 
                                    number: 21, 
                                    age_group: "U16", 
                                    fortyYardDash: null, 
                                    vertical: null, 
                                    catching: null, 
                                    throwing: null, 
                                    agility: null 
                                  };
                                  setPlayers(prev => [...prev, newPlayer]);
                                  addNotification("👤 Sam Wilson added manually!", "success", 2500);
                                  
                                  // Advance to next step
                                  timeouts.push(setTimeout(() => {
                                    advanceToNextStep();
                                  }, 1200));
                                }, 500));
                              });
                            }, 800));
                          }, 600));
                        }
                      }, 180);
                      intervals.push(typeNumberInterval);
                    }, 400));
                  }
                }, 140);
                intervals.push(typeLastNameInterval);
              }, 500));
            }
          }, 130);
          intervals.push(typeFirstNameInterval);
        }, 1000));
        break;
        
      case "DrillResultsStep":
        timeouts.push(setTimeout(() => {
          setCurrentDrillPlayer(players[0]);
        }, 1000));
        
        // Simulate entering drill result
        timeouts.push(setTimeout(() => {
          animateButtonClick('record-result-btn', () => {
            timeouts.push(setTimeout(() => {
              const updatedPlayers = players.map(player => ({
                ...player,
                ...DRILL_RESULTS[player.id]
              }));
              setPlayers(updatedPlayers);
              addNotification("⚡ All drill results recorded!", "success", 2500);
              
              // Advance to next step after drill results complete
              timeouts.push(setTimeout(() => {
                advanceToNextStep();
              }, 1000));
            }, 800));
          });
        }, 3000));
        break;
        
      case "WeightsStep":
        // DRAMATIC WEIGHT ADJUSTMENT SHOWCASE
        timeouts.push(setTimeout(() => {
          addNotification("🎯 Coach realizes speed is most important for today's scouts!", "success", 2500);
          setStepSubState("analyzing");
        }, 1000));

        // Show current rankings before adjustment - MUCH LONGER
        timeouts.push(setTimeout(() => {
          addNotification("🧠 Coach realizing: 'These scouts want SPEED - let me adjust!'", "success", 4000);
          setStepSubState("coach-thinking");
        }, 4000));

        // Start dramatic weight adjustments with explanation - MUCH SLOWER
        timeouts.push(setTimeout(() => {
          addNotification("⚖️ WATCH: Dramatically adjusting weights for speed emphasis", "success", 8000);
          setStepSubState("adjusting-speed");
          
          // DRAMATICALLY SLOW adjustment of 40-yard dash weight  
          let currentWeight = 30;
          const targetWeight = 45;
          const sliderInterval = setInterval(() => {
            if (currentWeight < targetWeight) {
              currentWeight += 0.3; // Smaller increments for smoother visual movement
              setWeights(prev => ({ ...prev, fortyYardDash: Math.round(currentWeight * 10) / 10 }));
            } else {
              clearInterval(sliderInterval);
              intervals.push(sliderInterval);
              
              // LONG pause to show impact
              timeouts.push(setTimeout(() => {
                addNotification("📈 Rankings transforming as speed becomes priority!", "success", 6000);
                
                // Continue with vertical and throwing adjustments
                timeouts.push(setTimeout(() => {
                  setStepSubState("adjusting-vertical");
                  let currentWeight2 = 20;
                  const targetWeight2 = 30;
                  const sliderInterval2 = setInterval(() => {
                    if (currentWeight2 < targetWeight2) {
                      currentWeight2 += 0.25;
                      setWeights(prev => ({ ...prev, vertical: Math.round(currentWeight2 * 10) / 10 }));
                    } else {
                      clearInterval(sliderInterval2);
                      intervals.push(sliderInterval2);
                      
                      timeouts.push(setTimeout(() => {
                        setStepSubState("adjusting-throwing");
                        let currentWeight3 = 15;
                        const targetWeight3 = 25;
                        const sliderInterval3 = setInterval(() => {
                          if (currentWeight3 < targetWeight3) {
                            currentWeight3 += 0.2;
                            setWeights(prev => ({ ...prev, throwing: Math.round(currentWeight3 * 10) / 10 }));
                          } else {
                            clearInterval(sliderInterval3);
                            intervals.push(sliderInterval3);
                            
                            timeouts.push(setTimeout(() => {
                              setStepSubState("dramatic-reveal");
                              addNotification("🚀 BOOM! Rankings completely transformed!", "success", 6000);
                              
                              timeouts.push(setTimeout(() => {
                                advanceToNextStep();
                              }, 8000));
                            }, 4000));
                          }
                        }, 500);
                      }, 6000));
                    }
                  }, 400);
                }, 6000));
              }, 4000));
            }
          }, 300); // MUCH slower 40-yard adjustment - 300ms per step!
          intervals.push(sliderInterval);
        }, 15000)); // MUCH later start
        break;
        
      case "BasicRankingsStep":
        timeouts.push(setTimeout(() => {
          addNotification("📊 Generating comprehensive rankings...", "success", 2500);
          setStepSubState("processing");
          
          timeouts.push(setTimeout(() => {
            addNotification("🏆 Rankings complete! Moving to power features...", "success", 2500);
            setStepSubState("complete");
            
            timeouts.push(setTimeout(() => {
              advanceToNextStep();
            }, 2000));
          }, 3000));
        }, 1000));
        break;
        
      case "TransitionStep":
        timeouts.push(setTimeout(() => {
          addNotification("🚀 Workflow complete! Now let's see the REAL power...", "success", 2500);
          setStepSubState("dramatic");
          
          timeouts.push(setTimeout(() => {
            addNotification("✨ These next features will blow your mind!", "success", 2500);
            
            timeouts.push(setTimeout(() => {
              advanceToNextStep();
            }, 2000));
          }, 2000));
        }, 1000));
        break;
        
      case "LiveUpdatesStep":
        timeouts.push(setTimeout(() => {
          addNotification("📱 Live drill results flowing in real-time...", "success", 3000);
          setStepSubState("live-demo");
          
          timeouts.push(setTimeout(() => {
            addNotification("📊 Rankings updating automatically as athletes complete drills!", "success", 3000);
            
            timeouts.push(setTimeout(() => {
              advanceToNextStep();
            }, 3500));
          }, 3000));
        }, 1000));
        break;
        
      case "ParentNotificationsStep":
        timeouts.push(setTimeout(() => {
          addNotification("📲 Parents receiving instant updates on their phones...", "success", 3000);
          setStepSubState("notifications");
          
          timeouts.push(setTimeout(() => {
            addNotification("📱 Families stay engaged throughout the entire combine!", "success", 3000);
            
            timeouts.push(setTimeout(() => {
              advanceToNextStep();
            }, 3500));
          }, 3000));
        }, 1000));
        break;
        
      case "AdvancedAnalyticsStep":
        timeouts.push(setTimeout(() => {
          addNotification("📈 AI generating advanced analytics and insights...", "success", 4000);
          setStepSubState("analytics");
          
          timeouts.push(setTimeout(() => {
            addNotification("🎯 Scout recommendations and predictive insights ready!", "success", 4000);
            
            timeouts.push(setTimeout(() => {
              advanceToNextStep();
            }, 4500));
          }, 4000));
        }, 1000));
        break;
        
      case "TeamFormationStep":
        timeouts.push(setTimeout(() => {
          addNotification("👥 AI creating perfectly balanced teams in seconds...", "success", 4000);
          setStepSubState("team-formation");
          
          timeouts.push(setTimeout(() => {
            addNotification("🏆 Perfect balance achieved! (vs 30+ minutes manually)", "success", 4000);
            
            timeouts.push(setTimeout(() => {
              advanceToNextStep();
            }, 4500));
          }, 4000));
        }, 1000));
        break;
        
      case "WowFactorStep":
        timeouts.push(setTimeout(() => {
          addNotification("🎉 DEMO COMPLETE! 3 minutes vs 4+ HOURS manually", "success", 5000);
          setStepSubState("wow-reveal");
          
          timeouts.push(setTimeout(() => {
            addNotification("🚀 Ready to transform your combine? Let's get started!", "success", 5000);
            setStepSubState("call-to-action");
          }, 5000));
        }, 1000));
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
                  <div className="relative">
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg transition-all duration-300 ${
                        showCursor.manualPlayerFirstName 
                          ? 'border-blue-500 bg-blue-50 shadow-lg' 
                          : 'border-gray-300'
                      }`}
                      value={manualPlayerFirstName}
                      readOnly
                    />
                    {showCursor.manualPlayerFirstName && (
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 animate-pulse">|</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      className={`w-full px-3 py-2 border rounded-lg transition-all duration-300 ${
                        showCursor.manualPlayerLastName 
                          ? 'border-blue-500 bg-blue-50 shadow-lg' 
                          : 'border-gray-300'
                      }`}
                      value={manualPlayerLastName}
                      readOnly
                    />
                    {showCursor.manualPlayerLastName && (
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 animate-pulse">|</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number</label>
                  <div className="relative">
                    <input
                      type="number"
                      className={`w-full px-3 py-2 border rounded-lg transition-all duration-300 ${
                        showCursor.manualPlayerNumber 
                          ? 'border-blue-500 bg-blue-50 shadow-lg' 
                          : 'border-gray-300'
                      }`}
                      placeholder="Auto-assigned"
                      value={manualPlayerNumber}
                      readOnly
                    />
                    {showCursor.manualPlayerNumber && (
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 animate-pulse">|</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Age Group</label>
                  <select 
                    className={`w-full px-3 py-2 border rounded-lg transition-all duration-300 ${
                      manualPlayerAgeGroup ? 'border-green-500 bg-green-50' : 'border-gray-300'
                    }`} 
                    value={manualPlayerAgeGroup}
                    disabled
                  >
                    <option value="">Select age group...</option>
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
            {/* Dramatic Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-6 shadow-lg">
              <h3 className="text-2xl font-bold mb-2">⚖️ The WooCombine Game Changer</h3>
              <p className="text-blue-100">Watch how intelligent weight adjustments completely transform rankings!</p>
              {stepSubState === "coach-thinking" && (
                <div className="mt-3 bg-white/20 rounded-lg p-3 animate-pulse">
                  <p className="text-sm">💭 "Speed scouts are here today. Time to emphasize what matters most..."</p>
                </div>
              )}
            </div>

            {/* Before/After Rankings Comparison */}
            {(stepSubState === "before-rankings" || stepSubState === "dramatic-reveal") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-lg border-2 border-gray-300">
                  <h4 className="font-semibold mb-3 text-gray-600">📊 Before (Default Weights)</h4>
                  <div className="space-y-2">
                    {[
                      { name: "Taylor Brown", rank: 1, score: "73.2" },
                      { name: "Alex Johnson", rank: 2, score: "71.8" },
                      { name: "Morgan Davis", rank: 3, score: "69.5" },
                      { name: "Jordan Smith", rank: 4, score: "68.1" }
                    ].map(player => (
                      <div key={player.name} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">
                            #{player.rank}
                          </span>
                          <span className="font-medium text-gray-700">{player.name}</span>
                        </div>
                        <span className="font-mono text-sm text-gray-600">{player.score}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {stepSubState === "dramatic-reveal" && (
                  <div className="bg-white rounded-lg p-4 shadow-lg border-2 border-green-400 animate-pulse">
                    <h4 className="font-semibold mb-3 text-green-600">🚀 After (Speed Emphasis!)</h4>
                    <div className="space-y-2">
                      {rankedPlayers.slice(0, 4).map(player => (
                        <div key={player.id} className="flex justify-between items-center p-2 bg-green-50 rounded transform transition-all duration-500 hover:scale-105">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              player.rank === 1 ? 'bg-yellow-400 text-yellow-900 animate-bounce' :
                              player.rank === 2 ? 'bg-gray-300 text-gray-700' :
                              player.rank === 3 ? 'bg-orange-300 text-orange-700' :
                              'bg-blue-200 text-blue-600'
                            }`}>
                              #{player.rank}
                            </span>
                            <span className="font-medium text-green-700">{player.name}</span>
                            {player.rank === 1 && <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">NEW #1!</span>}
                          </div>
                          <span className="font-mono text-sm text-green-600 font-bold">{player.compositeScore.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Weight Adjustment Interface */}
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                ⚖️ Dynamic Weight Adjustment
                {stepSubState === "adjusting-speed" && <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full animate-pulse">Adjusting...</span>}
              </h3>
              
              <div className="space-y-4">
                {Object.entries(weights).map(([drill, weight]) => (
                  <div key={drill} className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-300 relative ${
                    (drill === 'fortyYardDash' && stepSubState === 'adjusting-speed') ||
                    (drill === 'vertical' && stepSubState === 'adjusting-vertical') ||
                    (drill === 'throwing' && stepSubState === 'adjusting-throwing') 
                      ? 'bg-gradient-to-r from-blue-100 to-blue-200 border-4 border-blue-500 transform scale-110 shadow-2xl animate-pulse ring-4 ring-blue-300 ring-opacity-50' 
                      : 'bg-gray-50'
                  }`}>
                    <span className="w-32 text-sm font-medium capitalize">
                      {drill.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={weight}
                      readOnly
                      className={`flex-1 transition-all duration-300 ${
                        (drill === 'fortyYardDash' && stepSubState === 'adjusting-speed') ||
                        (drill === 'vertical' && stepSubState === 'adjusting-vertical') ||
                        (drill === 'throwing' && stepSubState === 'adjusting-throwing')
                          ? 'accent-blue-600 scale-125 h-4 shadow-lg'
                          : 'accent-gray-400 h-2'
                      }`}
                      style={(drill === 'fortyYardDash' && stepSubState === 'adjusting-speed') ||
                             (drill === 'vertical' && stepSubState === 'adjusting-vertical') ||
                             (drill === 'throwing' && stepSubState === 'adjusting-throwing') ? {
                        background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                        borderRadius: '10px',
                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.3)'
                      } : {}}
                    />
                    <span className={`w-20 font-mono font-bold transition-all duration-300 ${
                      (drill === 'fortyYardDash' && stepSubState === 'adjusting-speed') ||
                      (drill === 'vertical' && stepSubState === 'adjusting-vertical') ||
                      (drill === 'throwing' && stepSubState === 'adjusting-throwing')
                        ? 'text-2xl text-blue-600 animate-bounce bg-yellow-200 px-3 py-1 rounded-full border-2 border-yellow-400 shadow-lg'
                        : weight > 30 ? 'text-blue-600 text-sm' : 'text-gray-600 text-sm'
                    }`}>
                      {weight}%
                    </span>
                    {weight > 35 && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full animate-bounce">HIGH</span>}
                    {((drill === 'fortyYardDash' && stepSubState === 'adjusting-speed') ||
                      (drill === 'vertical' && stepSubState === 'adjusting-vertical') ||
                      (drill === 'throwing' && stepSubState === 'adjusting-throwing')) && 
                      <>
                        <span className="text-sm bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-full animate-bounce font-bold shadow-lg">
                          ⚡ ADJUSTING LIVE!
                        </span>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
                        <div className="absolute left-0 top-0 w-full h-full bg-blue-300 opacity-20 rounded-lg animate-pulse"></div>
                        {/* Animated Arrow Pointer */}
                        <div className="absolute -left-8 top-1/2 transform -translate-y-1/2">
                          <div className="flex items-center animate-bounce">
                            <span className="text-3xl text-red-500 animate-pulse">👉</span>
                            <span className="text-red-500 font-bold text-xs ml-1 animate-pulse">WATCH!</span>
                          </div>
                        </div>
                      </>
                    }
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-purple-800 text-sm font-medium">💡 Pro Tip: Weight adjustments let coaches customize rankings for specific needs:</p>
                <ul className="text-purple-700 text-xs mt-2 space-y-1 ml-4">
                  <li>• Speed scouts → Boost 40-yard dash & agility</li>
                  <li>• Position coaches → Emphasize position-specific skills</li>
                  <li>• Development → Balance all attributes equally</li>
                </ul>
              </div>
            </div>
            
            {/* Live Rankings Update */}
            {rankedPlayers.length > 0 && stepSubState !== "before-rankings" && stepSubState !== "dramatic-reveal" && (
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

      case "BasicRankingsStep":
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

      case "TransitionStep":
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg p-8 shadow-2xl text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h3 className="text-3xl font-bold mb-4">Workflow Complete!</h3>
              <p className="text-xl mb-6 text-purple-100">
                You just saw how easy WooCombine is to use...
              </p>
              <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                <p className="text-2xl font-bold text-yellow-300">
                  Now let's see why it's REVOLUTIONARY! ✨
                </p>
              </div>
            </div>
          </div>
        );

      case "LiveUpdatesStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                📱 Real-Time Updates
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full animate-pulse">LIVE</span>
              </h3>
              <p className="text-gray-600 mb-4">Watch results flow in as athletes complete drills...</p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <div className="font-medium">Alex Johnson - 40 Yard Dash</div>
                    <div className="text-sm text-gray-600">4.32 seconds • Just completed</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <div>
                    <div className="font-medium">Jordan Smith - Vertical Jump</div>
                    <div className="text-sm text-gray-600">38 inches • Rankings updated</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                  <div>
                    <div className="font-medium">Taylor Brown - Catching</div>
                    <div className="text-sm text-gray-600">22 points • Parents notified</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "ParentNotificationsStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                📲 Parent Notifications
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full animate-pulse">SENDING</span>
              </h3>
              <p className="text-gray-600 mb-4">Parents get instant updates on their phones...</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-100 rounded-lg p-4 border-2 border-gray-300 shadow-sm">
                  <div className="text-center">
                    <div className="text-3xl mb-2">📱</div>
                    <div className="font-medium text-sm">Alex's Dad</div>
                    <div className="text-xs text-gray-600 mt-2 bg-green-100 rounded p-2">
                      "🏃 Alex just ran a 4.32 forty! Amazing speed improvement!"
                    </div>
                  </div>
                </div>
                <div className="bg-gray-100 rounded-lg p-4 border-2 border-gray-300 shadow-sm">
                  <div className="text-center">
                    <div className="text-3xl mb-2">📱</div>
                    <div className="font-medium text-sm">Jordan's Mom</div>
                    <div className="text-xs text-gray-600 mt-2 bg-blue-100 rounded p-2">
                      "📏 38 inch vertical! So proud of that jump!"
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-yellow-800 text-sm">💡 Parents stay engaged and informed throughout the entire combine!</p>
              </div>
            </div>
          </div>
        );

      case "AdvancedAnalyticsStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                📈 Advanced Analytics
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full animate-pulse">ANALYZING</span>
              </h3>
              <p className="text-gray-600 mb-4">AI-powered insights that transform recruiting...</p>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-800">+15%</div>
                  <div className="text-xs text-blue-600">Speed Improvement vs Last Season</div>
                </div>
                <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-800">3</div>
                  <div className="text-xs text-green-600">Varsity Prospects Identified</div>
                </div>
                <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-800">92%</div>
                  <div className="text-xs text-purple-600">Prediction Accuracy</div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">🎯 Scout Recommendations</h4>
                <ul className="text-sm space-y-1">
                  <li>• Alex Johnson: Elite speed, track & field potential</li>
                  <li>• Morgan Davis: Well-rounded athlete, varsity ready</li>
                  <li>• Jordan Smith: Strong fundamentals, coachable</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case "TeamFormationStep":
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                👥 AI Team Formation
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full animate-pulse">OPTIMIZING</span>
              </h3>
              <p className="text-gray-600 mb-4">Perfect team balance in seconds...</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-2">🔵 Team Alpha</h4>
                  <div className="space-y-1 text-sm">
                    <div>Alex Johnson (Speed Leader)</div>
                    <div>Taylor Brown (Skill Balance)</div>
                    <div>Casey Williams (Agility)</div>
                  </div>
                  <div className="mt-3 text-xs text-blue-600 bg-blue-100 rounded p-2">
                    Average Score: 73.2 | Balance: 94%
                  </div>
                </div>
                
                <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
                  <h4 className="font-medium text-red-800 mb-2">🔴 Team Beta</h4>
                  <div className="space-y-1 text-sm">
                    <div>Morgan Davis (Power)</div>
                    <div>Jordan Smith (Consistency)</div>
                    <div>Riley Martinez (Versatility)</div>
                  </div>
                  <div className="mt-3 text-xs text-red-600 bg-red-100 rounded p-2">
                    Average Score: 73.1 | Balance: 96%
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-green-800 text-sm">⚡ Perfect balance achieved in 3 seconds vs 30+ minutes manually!</p>
              </div>
            </div>
          </div>
        );

      case "WowFactorStep":
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg p-8 shadow-2xl text-center">
              <div className="text-8xl mb-4">🎉</div>
              <h3 className="text-4xl font-bold mb-4">The WOW Factor!</h3>
              <p className="text-xl mb-6">What you just witnessed...</p>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                  <div className="text-3xl font-bold text-yellow-100">3 Minutes</div>
                  <div className="text-yellow-200">With WooCombine</div>
                </div>
                <div className="bg-white/20 rounded-lg p-4 backdrop-blur">
                  <div className="text-3xl font-bold text-yellow-100">4+ Hours</div>
                  <div className="text-yellow-200">Manual Process</div>
                </div>
              </div>
              
              <div className="bg-white/30 rounded-lg p-6 backdrop-blur">
                <h4 className="text-xl font-bold mb-3">You Just Automated:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>✅ League & Event Setup</div>
                  <div>✅ Player Management</div>
                  <div>✅ Data Collection</div>
                  <div>✅ Real-time Rankings</div>
                  <div>✅ Parent Notifications</div>
                  <div>✅ Advanced Analytics</div>
                  <div>✅ Team Formation</div>
                  <div>✅ Professional Reports</div>
                </div>
              </div>
              
              <div className="mt-6">
                <button 
                  onClick={() => navigate('/signup')}
                  className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-orange-50 transition-all transform hover:scale-105 shadow-xl"
                >
                  🚀 Transform Your Combine Today!
                </button>
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
              🏈 WooCombine Complete Demo: Workflow + Features
            </h1>
            <p className="text-gray-600 mb-4">
              See how easy it is to use + why it's revolutionary (Workflow → Power Features)
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
          <div className={`text-white p-4 ${
            WORKFLOW_STEPS[currentStep]?.phase === 'workflow' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600' 
              : WORKFLOW_STEPS[currentStep]?.phase === 'transition'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                : 'bg-gradient-to-r from-orange-500 to-red-600'
          }`}>
            <div className="flex items-center gap-3">
              <div className="text-3xl">{WORKFLOW_STEPS[currentStep]?.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">{WORKFLOW_STEPS[currentStep]?.title}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    WORKFLOW_STEPS[currentStep]?.phase === 'workflow' 
                      ? 'bg-blue-200 text-blue-800' 
                      : WORKFLOW_STEPS[currentStep]?.phase === 'transition'
                        ? 'bg-purple-200 text-purple-800'
                        : 'bg-orange-200 text-orange-800'
                  }`}>
                    {WORKFLOW_STEPS[currentStep]?.phase === 'workflow' 
                      ? '📋 WORKFLOW' 
                      : WORKFLOW_STEPS[currentStep]?.phase === 'transition'
                        ? '🔄 TRANSITION'
                        : '🚀 FEATURES'
                    }
                  </span>
                </div>
                <p className={
                  WORKFLOW_STEPS[currentStep]?.phase === 'workflow' 
                    ? 'text-blue-100 text-sm' 
                    : WORKFLOW_STEPS[currentStep]?.phase === 'transition'
                      ? 'text-purple-100 text-sm'
                      : 'text-orange-100 text-sm'
                }>{WORKFLOW_STEPS[currentStep]?.desc}</p>
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
            
            <div className="flex justify-center">
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
}// Force rebuild Sat Aug  2 14:41:10 EDT 2025
