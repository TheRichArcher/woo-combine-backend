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
const WORKFLOW_STEPS = [
  // PHASE 1: PAIN POINT SETUP (30 seconds)
  {
    id: 1,
    title: "💔 The Current Reality",
    desc: "See what coaches deal with every combine day",
    icon: "😰",
    color: "from-red-500 to-orange-600",
    duration: 5000, // Optimized for reading speed
    phase: "pain"
  },
  
  // PHASE 2: HERO FEATURE (45 seconds)
  {
    id: 2,
    title: "⚡ The Game Changer",
    desc: "Real-time everything - watch the magic happen",
    icon: "✨",
    color: "from-green-400 to-blue-600",
    duration: 6000, // Auto-triggers during demo, no manual click needed
    phase: "hero"
  },
  
  // PHASE 3: WORKFLOW + FEATURES ALTERNATING (150 seconds)
  
  // WORKFLOW EASE: Setup Demo
  {
    id: 3,
    title: "⚡ Setup in 60 Seconds",
    desc: "Watch how fast you can go from zero to running a combine",
    icon: "🏃‍♂️",
    color: "from-green-500 to-teal-600",
    duration: 8000, // Better reading time
    phase: "workflow_ease"
  },
  
  // FEATURE POWER: Parent Engagement  
  {
    id: 4,
    title: "📱 Smart Parent Engagement",
    desc: "Parents connected live - no more waiting",
    icon: "📲",
    color: "from-blue-500 to-cyan-600",
    duration: 7000, // Better reading time
    phase: "features"
  },
  
  // WORKFLOW EASE: Live Data Entry
  {
    id: 5,
    title: "📝 Live Data Entry Magic",
    desc: "See how ridiculously easy it is to enter drill results",
    icon: "⚡",
    color: "from-orange-500 to-red-600",
    duration: 8000, // Better demo time
    phase: "workflow_ease"
  },
  
  // FEATURE POWER: Intelligent Rankings
  {
    id: 6,
    title: "🎯 Intelligent Rankings", 
    desc: "AI-powered adjustments in real-time",
    icon: "🧠",
    color: "from-purple-500 to-pink-600",
    duration: 7000, // Better ranking demo time
    phase: "features"
  },
  
  // WORKFLOW EASE: Instant Reports
  {
    id: 7,
    title: "📊 Instant Professional Reports",
    desc: "From raw data to scout-ready reports in 0.5 seconds",
    icon: "📈",
    color: "from-indigo-500 to-purple-600",
    duration: 7000, // Better report time
    phase: "workflow_ease"
  },
  
  // PHASE 4: RESULTS (30 seconds)
  {
    id: 8,
    title: "🎉 Your New Reality",
    desc: "47+ hours saved, 100% accuracy, happy parents",
    icon: "🏆",
    color: "from-yellow-400 to-orange-500",
    duration: 10000, // Important final message needs time
    phase: "results"
  }
];

export default function UnifiedDemo() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef();

  // Auto-start the demo when component mounts
  useEffect(() => {
    const autoStartTimer = setTimeout(() => {
      setIsAutoPlaying(true);
    }, 1000); // Start after 1 second to allow component to fully load

    return () => clearTimeout(autoStartTimer);
  }, []);

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

  // Auto demo progression with progress bar animation
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

    // Auto advance to next step after duration
    const stepTimer = setTimeout(() => {
      if (currentStep < WORKFLOW_STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        setIsAutoPlaying(false);
        // Demo complete notification
        setTimeout(() => {
          addNotification("🎉 Revolutionary demo complete! Ready to transform your combines?", "success", 5000);
        }, 500);
      }
    }, step.duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stepTimer);
    };
  }, [currentStep, isAutoPlaying]);

  // Auto-trigger magic for "The Game Changer" step
  useEffect(() => {
    if (isAutoPlaying && currentStep === 1) {
      const autoTriggerTimer = setTimeout(() => {
        // Simplified notification sequence for demo
        addNotification("⚡ MAGIC INITIATED: Multi-evaluator sync!", "success", 3000);
        setTimeout(() => {
          addNotification("📱 Parent phones exploding with updates!", "success", 3000);
        }, 1000);
        setTimeout(() => {
          addNotification("🧠 AI rankings updated instantly!", "success", 3000);
        }, 2000);
        setTimeout(() => {
          addNotification("📊 Professional reports generated!", "success", 3000);
        }, 3000);
        setTimeout(() => {
          addNotification("🎉 47 HOURS SAVED! Welcome to the future!", "success", 4000);
        }, 4000);
      }, 1500); // Auto-trigger after 1.5 seconds in auto-play mode

      return () => clearTimeout(autoTriggerTimer);
    }
  }, [isAutoPlaying, currentStep]);

  // Advance to next step function
  const advanceToNextStep = () => {
    if (currentStep < WORKFLOW_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsAutoPlaying(false);
    }
  };

  const startAutoDemo = () => {
    // Reset demo first, THEN start auto playing (order matters!)
    resetDemo();
    setCurrentStep(0);
    setIsAutoPlaying(true);
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

  // Auto-scroll to keep demo content in view
  useEffect(() => {
    if (isAutoPlaying) {
      const demoContent = document.getElementById('demo-step-content');
      if (demoContent) {
        demoContent.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest' 
        });
      }
    }
  }, [currentStep, isAutoPlaying]);

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

    // NEW REVOLUTIONARY STEP LOGIC - Simple and effective!
    if (currentStep === 1 && isAutoPlaying) {
      // For "The Game Changer" step, add some demo data after a delay
      timeouts.push(setTimeout(() => {
        addNotification("⚡ Real-time magic is happening!", "success", 3000);
      }, 2000));
      
      timeouts.push(setTimeout(() => {
        addNotification("📱 Parents are getting instant updates!", "info", 3000); 
      }, 4000));
    }

    // OLD LOGIC DISABLED - keeping for reference but not executed
    switch (step.component) {
      case "CreateLeagueStep_DISABLED":
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
        // Step 1: Show player getting ready (1s)
        timeouts.push(setTimeout(() => {
          setCurrentDrillPlayer(players[0]);
          addNotification("📋 Alex Johnson stepping up to the line...", "success", 2000);
        }, 1000));
        
        // Step 2: Show drill in progress (3s)  
        timeouts.push(setTimeout(() => {
          addNotification("🏃‍♂️ Running 40-yard dash... timing in progress!", "success", 2000);
        }, 3000));
        
        // Step 3: Drill complete, coach enters result (5s)
        timeouts.push(setTimeout(() => {
          addNotification("⏱️ Finished! Coach enters: 4.38 seconds", "success", 2000);
          animateButtonClick('record-result-btn', () => {
            // Update just Alex's results first for clarity
            timeouts.push(setTimeout(() => {
              setPlayers(prev => prev.map(player => 
                player.id === 1 ? { ...player, ...DRILL_RESULTS[1] } : player
              ));
            }, 500));
          });
        }, 5000));
        
        // Step 4: Show instant ranking update (7.5s)
        timeouts.push(setTimeout(() => {
          addNotification("⚡ Rankings updated instantly! Alex moves to #1!", "success", 3000);
        }, 7500));
        
        // Step 5: Complete all results and advance (11s)
        timeouts.push(setTimeout(() => {
          // Add all remaining results at once
          const updatedPlayers = players.map(player => ({
            ...player,
            ...DRILL_RESULTS[player.id]
          }));
          setPlayers(updatedPlayers);
          addNotification("✅ All drill results complete! Moving to weight adjustments...", "success", 2000);
          
          // Advance to next step
          timeouts.push(setTimeout(() => {
            advanceToNextStep();
          }, 2000));
        }, 11000));
        break;
        
      case "WeightsStep":
        // Step 1: Coach realizes speed is key (1s)
        timeouts.push(setTimeout(() => {
          addNotification("🎯 Coach: 'Speed scouts are here - let me adjust weights!'", "success", 3000);
          setStepSubState("coach-thinking");
        }, 1000));

        // Step 2: Adjust 40-yard dash weight (4s)
        timeouts.push(setTimeout(() => {
          addNotification("⚖️ Increasing 40-yard dash importance...", "success", 2000);
          setStepSubState("adjusting-speed");
          
          // Simple weight adjustment animation
          let currentWeight = 30;
          const targetWeight = 45;
          const sliderInterval = setInterval(() => {
            if (currentWeight < targetWeight) {
              currentWeight += 1;
              setWeights(prev => ({ ...prev, fortyYardDash: currentWeight }));
            } else {
              clearInterval(sliderInterval);
              intervals.push(sliderInterval);
            }
          }, 100);
        }, 4000));

        // Step 3: Show ranking changes (7s)
        timeouts.push(setTimeout(() => {
          addNotification("📈 Watch rankings shift as speed becomes priority!", "success", 3000);
          setStepSubState("dramatic-reveal");
        }, 7000));

        // Step 4: Complete and advance (10.5s)
        timeouts.push(setTimeout(() => {
          addNotification("✅ Weight adjustments complete! Moving to final rankings...", "success", 2000);
          
          timeouts.push(setTimeout(() => {
            advanceToNextStep();
          }, 2000));
        }, 10500));
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
          addNotification("📱 Results flowing in real-time as athletes finish!", "success", 2500);
          setStepSubState("live-demo");
        }, 1000));
        
        timeouts.push(setTimeout(() => {
          addNotification("⚡ No manual data entry needed - everything automatic!", "success", 2500);
        }, 4000));
        
        timeouts.push(setTimeout(() => {
          advanceToNextStep();
        }, 7000));
        break;
        
      case "ParentNotificationsStep":
        timeouts.push(setTimeout(() => {
          addNotification("📲 Parents get instant updates while at work!", "success", 2500);
          setStepSubState("notifications");
        }, 1000));
        
        timeouts.push(setTimeout(() => {
          addNotification("🎯 No more 'How did my kid do?' questions!", "success", 2500);
        }, 4000));
        
        timeouts.push(setTimeout(() => {
          advanceToNextStep();
        }, 7000));
        break;
        
      case "AdvancedAnalyticsStep":
        timeouts.push(setTimeout(() => {
          addNotification("📈 AI analyzing performance patterns...", "success", 2500);
          setStepSubState("analytics");
        }, 1000));
        
        timeouts.push(setTimeout(() => {
          addNotification("🔍 Identifying top prospects automatically!", "success", 2500);
        }, 4000));
        
        timeouts.push(setTimeout(() => {
          addNotification("🎯 What takes scouts HOURS done in seconds!", "success", 2500);
        }, 7000));
        
        timeouts.push(setTimeout(() => {
          advanceToNextStep();
        }, 10000));
        break;
        
      case "TeamFormationStep":
        timeouts.push(setTimeout(() => {
          addNotification("👥 AI analyzing player data for optimal teams...", "success", 2500);
          setStepSubState("team-formation");
        }, 1000));
        
        timeouts.push(setTimeout(() => {
          addNotification("⚖️ Balancing speed, strength, and skill!", "success", 2500);
        }, 4000));
        
        timeouts.push(setTimeout(() => {
          addNotification("🏆 Perfect teams created in 30 seconds vs 30+ minutes manually!", "success", 2500);
        }, 7000));
        
        timeouts.push(setTimeout(() => {
          advanceToNextStep();
        }, 10000));
        break;
        
      case "WowFactorStep":
        timeouts.push(setTimeout(() => {
          addNotification("🎉 DEMO COMPLETE! 3 minutes vs 4+ HOURS manually", "success", 3000);
          setStepSubState("wow-reveal");
        }, 1000));
        
        timeouts.push(setTimeout(() => {
          addNotification("🚀 Ready to transform your combine? Let's get started!", "success", 3000);
          setStepSubState("call-to-action");
        }, 4500));
        break;
    }
  }, [currentStep, players]);

  const renderStepContent = () => {
    const step = WORKFLOW_STEPS[currentStep];
    if (!step) return null;

    // NEW REVOLUTIONARY CONTENT BASED ON STEP INDEX
    switch (currentStep) {
      // PAIN POINT SETUP
      case 0:
        return (
          <div className="space-y-1">
            {/* Compact Pain Points */}
            <div className="grid grid-cols-3 gap-1">
              {PAIN_POINTS.map((pain, index) => (
                <div key={pain.id} className="bg-red-50 border border-red-200 rounded p-1 text-center">
                  <div className="text-lg">{pain.visual}</div>
                  <h4 className="font-bold text-red-800 text-xs">{pain.title}</h4>
                  <p className="text-red-700 text-xs leading-tight">{pain.desc.split(',')[0]}</p>
                </div>
              ))}
            </div>

            {/* Compact Cost Stats */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-1">
              <h4 className="text-xs font-bold mb-1 text-center">💸 Manual Combine Costs</h4>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-red-400">47+ Hours</div>
                </div>
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-red-400">38% Errors</div>
                </div>
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-red-400">76% Frustrated</div>
                </div>
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-red-400">$2,400 Lost</div>
                </div>
              </div>
            </div>


          </div>
        );

      // HERO FEATURE - THE GAME CHANGER  
      case 1:

        return (
          <div className="space-y-1">
            {/* Compact Button - Auto-triggers during demo */}
            <div className="text-center">
              <button
                onClick={() => {
                  // Manual trigger for non-auto mode
                  addNotification("⚡ MAGIC INITIATED: Multi-evaluator sync!", "success", 3000);
                  setTimeout(() => {
                    addNotification("📱 Parent phones exploding with updates!", "success", 3000);
                  }, 1000);
                  setTimeout(() => {
                    addNotification("🧠 AI rankings updated instantly!", "success", 3000);
                  }, 2000);
                  setTimeout(() => {
                    addNotification("📊 Professional reports generated!", "success", 3000);
                  }, 3000);
                  setTimeout(() => {
                    addNotification("🎉 47 HOURS SAVED! Welcome to the future!", "success", 4000);
                  }, 4000);
                }}
                className={`bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm transform hover:scale-105 transition-all duration-300 shadow-lg ${isAutoPlaying ? 'animate-pulse opacity-75' : 'animate-pulse'}`}
                disabled={isAutoPlaying}
              >
                🎯 {isAutoPlaying ? 'AUTO-TRIGGERING...' : 'TRIGGER THE MAGIC!'}
              </button>
              <p className="text-gray-600 text-xs mt-1">{isAutoPlaying ? 'Magic happening automatically!' : 'Click to see real-time updates'}</p>
            </div>

            {/* Compact Stats */}
            <div className="bg-gradient-to-r from-gray-800 to-blue-900 text-white rounded-lg p-1">
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-green-400">2 min setup</div>
                </div>
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-blue-400">Instant results</div>
                </div>
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-purple-400">98% satisfaction</div>
                </div>
              </div>
            </div>
          </div>
        );

      // MISSING CASE 2 - WORKFLOW EASE: Setup in 60 Seconds  
      case 2:
        return (
          <div className="space-y-2">
            {/* Ultra Compact Header */}
            <div className="bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg p-1 text-center">
              <div className="text-2xl mb-1">🏃‍♂️</div>
              <h3 className="text-base font-bold">Setup in 60 Seconds</h3>
              <p className="text-green-100 text-xs">Zero → running combine in 1 minute! ⚡</p>
            </div>

            {/* Compact Quick Steps Demo */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-lg p-1 border-2 border-green-200 text-center">
                <div className="text-2xl mb-1">📝</div>
                <h4 className="font-bold text-green-800 text-sm mb-1">Name It</h4>
                <p className="text-green-700 text-xs">10 seconds</p>
              </div>
              
              <div className="bg-white rounded-lg p-1 border-2 border-teal-200 text-center">
                <div className="text-2xl mb-1">📤</div>
                <h4 className="font-bold text-teal-800 text-sm mb-1">Upload CSV</h4>
                <p className="text-teal-700 text-xs">15 seconds</p>
              </div>
              
              <div className="bg-white rounded-lg p-1 border-2 border-blue-200 text-center">
                <div className="text-2xl mb-1">🚀</div>
                <h4 className="font-bold text-blue-800 text-sm mb-1">Go Live!</h4>
                <p className="text-blue-700 text-xs">5 seconds</p>
              </div>
            </div>

            {/* Compact Comparison */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-1">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-red-600/20 rounded p-2 border border-red-500">
                  <div className="text-sm font-bold text-red-400">Traditional: 45+ min</div>
                </div>
                <div className="bg-green-600/20 rounded p-2 border border-green-500">
                  <div className="text-sm font-bold text-green-400">WooCombine: 30 sec</div>
                </div>
              </div>
            </div>
          </div>
        );

      // CASE 3 - SMART PARENT ENGAGEMENT (Feature Power)
      case 3:
        return (
          <div className="space-y-1">
            {/* Parent Phone Demo */}
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-white rounded-lg p-1 border-2 border-blue-200">
                <h4 className="font-bold text-blue-800 mb-1 text-center text-xs">📱 Parent's Phone</h4>
                <div className="space-y-1">
                  <div className="bg-green-50 border border-green-200 rounded p-1 text-xs">
                    <strong>Alex Johnson</strong> 40-yard: <strong>4.38s</strong> 🏃‍♂️
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-1 text-xs">
                    Ranking: <strong>#2 overall</strong> 🥈
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded p-1 text-xs">
                    Next: <strong>Vertical Jump</strong> 📍
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-1 border-2 border-gray-300">
                <h4 className="font-bold text-gray-800 mb-1 text-center text-xs">🚫 Before</h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>"How did my kid do?" ❌</div>
                  <div>"When will results be ready?" ❌</div>
                  <div>"What's his ranking?" ❌</div>
                  <div className="text-red-600 font-bold">Frustrated parents</div>
                </div>
              </div>
            </div>

            {/* Impact Stats */}
            <div className="bg-gradient-to-r from-gray-800 to-blue-900 text-white rounded-lg p-1">
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="bg-white/10 rounded-lg p-1">
                  <div className="text-xs font-bold text-green-400">98%</div>
                  <div className="text-xs text-gray-300">Satisfaction</div>
                </div>
                <div className="bg-white/10 rounded-lg p-1">
                  <div className="text-xs font-bold text-blue-400">Instant</div>
                  <div className="text-xs text-gray-300">Updates</div>
                </div>
                <div className="bg-white/10 rounded-lg p-1">
                  <div className="text-xs font-bold text-purple-400">Zero</div>
                  <div className="text-xs text-gray-300">Questions</div>
                </div>
              </div>
            </div>
          </div>
        );

      // CASE 4 - LIVE DATA ENTRY MAGIC (Workflow Ease)
      case 4:
        return (
          <div className="space-y-1">
            {/* Compact Demo Interface */}
            <div className="bg-white rounded-lg p-1 shadow-lg border border-orange-200">
              <h4 className="text-xs font-bold text-gray-800 mb-1 text-center">🏃‍♂️ 40-Yard Dash Station</h4>
              
              <div className="grid grid-cols-2 gap-1 mb-1">
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">Current Player</div>
                  <div className="bg-blue-50 rounded p-1 border border-blue-200">
                    <div className="font-bold text-blue-800 text-xs">#12 Alex Johnson</div>
                    <div className="text-xs text-blue-600">U16 - Ready</div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-xs text-gray-600 mb-1">Enter Time</div>
                  <div className="bg-green-50 rounded p-1 border border-green-200">
                    <div className="text-sm font-bold text-green-800">4.38</div>
                    <div className="text-xs text-green-600">seconds</div>
                  </div>
                </div>
              </div>
              
              <button className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold py-1 rounded text-xs">
                ✅ SAVE & NEXT PLAYER
              </button>
            </div>

            {/* Compact Magic Stats */}
            <div className="bg-gradient-to-r from-gray-800 to-blue-900 text-white rounded-lg p-1">
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-green-400">0.5s</div>
                  <div className="text-xs text-gray-300">Entry</div>
                </div>
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-blue-400">Instant</div>
                  <div className="text-xs text-gray-300">Parent</div>
                </div>
                <div className="bg-white/10 rounded p-1">
                  <div className="text-xs font-bold text-purple-400">Auto</div>
                  <div className="text-xs text-gray-300">Ranking</div>
                </div>
              </div>
            </div>
          </div>
        );

      // CASE 5 - INTELLIGENT RANKINGS (Feature Power)
      case 5:
        return (
          <div className="space-y-1">
            {/* Weight Adjustment Demo */}
            <div className="bg-white rounded-lg p-1 shadow-lg border border-purple-200">
              <h4 className="text-xs font-bold text-gray-800 mb-1 text-center">⚖️ Adjust Drill Weights</h4>
              
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">40-Yard Dash</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 bg-gray-200 rounded-full h-1">
                      <div className="bg-blue-600 h-1 rounded-full" style={{width: '40%'}}></div>
                    </div>
                    <span className="text-xs font-bold text-blue-600">40%</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">Vertical Jump</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 bg-gray-200 rounded-full h-1">
                      <div className="bg-green-600 h-1 rounded-full" style={{width: '30%'}}></div>
                    </div>
                    <span className="text-xs font-bold text-green-600">30%</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">Agility</span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 bg-gray-200 rounded-full h-1">
                      <div className="bg-orange-600 h-1 rounded-full" style={{width: '30%'}}></div>
                    </div>
                    <span className="text-xs font-bold text-orange-600">30%</span>
                  </div>
                </div>
              </div>
              
              <div className="text-center text-xs text-gray-600">
                🔄 Rankings update instantly
              </div>
            </div>

            {/* Live Rankings */}
            <div className="grid grid-cols-2 gap-1">
              <div className="bg-gray-50 rounded p-1 border border-gray-300">
                <h5 className="font-bold text-gray-800 mb-1 text-center text-xs">📊 Live Rankings</h5>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between bg-yellow-100 p-1 rounded">
                    <span>🥇 Morgan</span>
                    <span className="font-bold">94.2</span>
                  </div>
                  <div className="flex justify-between bg-gray-100 p-1 rounded">
                    <span>🥈 Alex</span>
                    <span className="font-bold">91.8</span>
                  </div>
                  <div className="flex justify-between bg-orange-100 p-1 rounded">
                    <span>🥉 Riley</span>
                    <span className="font-bold">89.4</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded p-1 border border-green-300">
                <h5 className="font-bold text-green-800 mb-1 text-center text-xs">⚡ The Magic</h5>
                <div className="space-y-0 text-xs text-green-700">
                  <div>✅ Instant recalc</div>
                  <div>✅ 99.8% accuracy</div>
                  <div>✅ No manual math</div>
                  <div>✅ Parent alerts</div>
                </div>
              </div>
            </div>
          </div>
        );

      // CASE 6 - INSTANT PROFESSIONAL REPORTS (Workflow Ease)
      case 6:
        return (
          <div className="space-y-1">
            {/* Compact Report Preview */}
            <div className="bg-white rounded-lg p-1 shadow-lg border border-indigo-200">
              <div className="text-center mb-1">
                <h4 className="text-xs font-bold text-gray-800">📋 Spring Football League Results</h4>
                <div className="text-xs text-gray-600">Generated in 0.5 seconds • Scout-ready</div>
              </div>
              
              <div className="grid grid-cols-2 gap-1">
                <div className="bg-gray-50 rounded p-1">
                  <h5 className="font-bold text-gray-800 mb-1 text-xs">🏆 Top 3</h5>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Morgan</span>
                      <span className="font-bold text-green-600">94.2</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Alex</span>
                      <span className="font-bold text-blue-600">91.8</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Riley</span>
                      <span className="font-bold text-purple-600">89.4</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded p-1">
                  <h5 className="font-bold text-gray-800 mb-1 text-xs">📈 Stats</h5>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Athletes:</span>
                      <span className="font-bold">24</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg 40:</span>
                      <span className="font-bold">4.52s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Vert:</span>
                      <span className="font-bold">33.2"</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <button className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-1 rounded text-xs">
                📧 EMAIL TO SCOUTS & PARENTS
              </button>
            </div>

            {/* Compact Speed Comparison */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-1">
              <div className="grid grid-cols-2 gap-1 text-center">
                <div className="bg-red-600/20 rounded p-1 border border-red-500">
                  <div className="text-xs font-bold text-red-400">Manual: 4+ hours</div>
                  <div className="text-xs text-red-200">Calculate, format, type</div>
                </div>
                <div className="bg-green-600/20 rounded p-1 border border-green-500">
                  <div className="text-xs font-bold text-green-400">WooCombine: 0.5s</div>
                  <div className="text-xs text-green-200">One click → Pro PDF</div>
                </div>
              </div>
            </div>
          </div>
        );

      // CASE 7 - YOUR NEW REALITY (Results)
      case 7:
        return (
          <div className="space-y-2">
            {/* Compact Before/After Comparison */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-red-50 rounded-lg p-2 border border-red-200 text-center">
                <h4 className="font-bold text-red-800 text-sm mb-1">😰 Before WooCombine</h4>
                <div className="space-y-1 text-xs text-red-700">
                  <div>47+ hours of manual work</div>
                  <div>38% error rate</div>
                  <div>Frustrated parents</div>
                  <div>$2,400 lost time value</div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-2 border border-green-200 text-center">
                <h4 className="font-bold text-green-800 text-sm mb-1">✅ With WooCombine</h4>
                <div className="space-y-1 text-xs text-green-700">
                  <div>30 seconds setup</div>
                  <div>99.8% accuracy</div>
                  <div>98% parent satisfaction</div>
                  <div>Focus on actual coaching</div>
                </div>
              </div>
            </div>

            {/* Compact Statistics */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg p-2 text-center">
              <h4 className="text-sm font-bold mb-1">Join thousands of coaches who've revolutionized their workflow</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold">5,000+</div>
                  <div className="text-xs text-blue-200">Coaches</div>
                </div>
                <div>
                  <div className="text-lg font-bold">50,000+</div>
                  <div className="text-xs text-blue-200">Athletes</div>
                </div>
                <div>
                  <div className="text-lg font-bold">99.8%</div>
                  <div className="text-xs text-blue-200">Satisfaction</div>
                </div>
              </div>
            </div>
          </div>
        );





      // DEFAULT FOR OTHER SCENARIOS (keeping simple for now)
      default:
        return (
          <div className="space-y-2">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg p-2 text-center">
              <div className="text-2xl mb-1">{step.icon}</div>
              <h3 className="text-sm font-bold mb-1">{step.title}</h3>
              <p className="text-sm text-purple-100 mb-1">{step.desc}</p>
              <div className="bg-white/20 rounded-lg p-2 backdrop-blur">
                <p className="text-base font-bold text-yellow-300">
                  Revolutionary feature coming soon! ✨
                </p>
              </div>
            </div>

            {/* Feature Impact */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg p-6">
              <h4 className="text-sm font-bold mb-4 text-center">💼 Professional Impact</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1 text-center">
                <div className="bg-white/10 rounded-lg p-2">
                  <div className="text-sm font-bold text-green-400">{WOW_STATS.timesSaved}</div>
                  <div className="text-sm text-gray-300">Time Saved</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <div className="text-sm font-bold text-blue-400">{WOW_STATS.parentSatisfaction}</div>
                  <div className="text-sm text-gray-300">Parent Satisfaction</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                  <div className="text-sm font-bold text-purple-400">{WOW_STATS.errorReduction}</div>
                  <div className="text-sm text-gray-300">Fewer Errors</div>
                </div>
              </div>
            </div>
          </div>
        );
    }

    // Fallback for any undefined steps
    return (
      <div className="space-y-2">
        <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">{step.icon}</div>
          <h3 className="text-lg font-bold mb-1">{step.title}</h3>
          <p className="text-sm text-gray-100">{step.desc}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-2 rounded-lg shadow-lg transition-all duration-300 transform ${
                notification.type === 'success' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-red-600 text-white'
              } animate-slide-in`}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}
      
      <div className="max-w-4xl mx-auto px-4 py-2">
        {/* Header */}
        <div className="text-center mb-1">
          <div className="bg-white rounded-xl shadow-lg p-1">
            <h1 className="text-base md:text-sm font-bold text-gray-900 mb-1">
              🚀 WooCombine: The Revolution
            </h1>
            <p className="text-gray-600 text-xs mb-1">
              Pain → Solution → Wow Factor (watch the transformation!)
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-1">
              <button
                onClick={resetDemo}
                className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Demo
              </button>
            </div>

            {/* Step Progress */}
            <div className="flex flex-wrap justify-center gap-1 mb-1">
              {WORKFLOW_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={`px-1 md:px-2 py-1 rounded text-xs font-medium transition-all ${
                    currentStep === index 
                      ? 'bg-blue-600 text-white' 
                      : index < currentStep
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {index < currentStep && <CheckCircle className="w-2 h-2 inline mr-0.5" />}
                  <span className="hidden lg:inline">{step.icon} {step.title}</span>
                  <span className="lg:hidden">{step.icon}</span>
                </button>
              ))}
            </div>

            {/* Progress Bar */}
            {isAutoPlaying && (
              <div className="w-full bg-gray-200 rounded-full h-1 mb-1">
                <div 
                  className="bg-blue-600 h-1 rounded-full transition-all duration-100"
                  style={{ width: `${stepProgress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>

        {/* Main Demo Content */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Step Header */}
          <div className={`text-white p-2 ${
            WORKFLOW_STEPS[currentStep]?.phase === 'workflow_ease' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600' 
              : WORKFLOW_STEPS[currentStep]?.phase === 'features'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                : WORKFLOW_STEPS[currentStep]?.phase === 'pain'
                  ? 'bg-gradient-to-r from-red-500 to-orange-600'
                  : WORKFLOW_STEPS[currentStep]?.phase === 'hero'
                    ? 'bg-gradient-to-r from-green-400 to-blue-600'
                    : 'bg-gradient-to-r from-yellow-400 to-orange-500'
          }`}>
            <div className="flex items-center gap-2">
              <div className="text-xl">{WORKFLOW_STEPS[currentStep]?.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-bold">{WORKFLOW_STEPS[currentStep]?.title}</h2>
                  <span className="text-xs px-1 py-0.5 rounded-full font-medium bg-white/20">
                    {WORKFLOW_STEPS[currentStep]?.phase?.toUpperCase()}
                  </span>
                </div>
                <p className="text-white/90 text-xs">{WORKFLOW_STEPS[currentStep]?.desc}</p>
              </div>
              {isAutoPlaying && (
                <div className="ml-auto flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium">Live</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-2 overflow-hidden flex-1">
            {renderStepContent()}
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-1 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl shadow-lg p-1 text-white text-center">
          <h2 className="text-xs font-bold mb-1">
            🚀 Ready to Transform Your Combines?
          </h2>
          
          <div className="space-y-1">
            <button
              onClick={() => navigate("/signup")}
              className="w-full bg-white text-green-600 font-medium py-1 text-xs rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              ⚡ Start Your Free Trial Now
            </button>
            
            <div className="flex justify-center gap-1">
              <button
                onClick={resetDemo}
                className="border border-white text-white font-medium py-0.5 px-1 rounded text-xs hover:bg-white/10 transition-all duration-200"
              >
                🔄 Replay
              </button>
              
              <button
                onClick={() => navigate("/welcome")}
                className="border border-white text-white font-medium py-0.5 px-1 rounded text-xs hover:bg-white/10 transition-all duration-200"
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
