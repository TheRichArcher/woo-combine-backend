import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EventSelector from "../components/EventSelector";
import EventJoinCode from "../components/EventJoinCode";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import { Upload, UserPlus, Users, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import { logger } from '../utils/logger';
import { autoAssignPlayerNumbers } from '../utils/playerNumbering';
import LoadingScreen from "../components/LoadingScreen";

// CSV processing utilities (simplified from AdminTools)
import { parseCsv, validateRow, validateHeaders, getMappingDescription, REQUIRED_HEADERS, SAMPLE_ROWS } from '../utils/csvUtils';

export default function OnboardingEvent() {
  const navigate = useNavigate();
  const { selectedEvent } = useEvent();
  const { user, userRole, leagues, selectedLeagueId } = useAuth();
  
  // Enhanced auth check with loading state
  if (!user) {
    return <LoadingScreen title="Checking authentication..." subtitle="Please wait while we verify your access" size="large" />;
  }
  
  if (!userRole) {
    return <LoadingScreen title="Loading your role..." subtitle="Setting up your account permissions" size="large" />;
  }
  
  if (userRole !== 'organizer') {
    navigate('/dashboard', { replace: true });
    return <LoadingScreen title="Redirecting..." subtitle="Taking you to your dashboard" size="medium" />;
  }
  
  const { notifyEventCreated, notifyPlayerAdded, notifyPlayersUploaded, notifyError, showSuccess, showError, showInfo } = useToast();
  
  // Multi-step wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [createdEvent, setCreatedEvent] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  
  // CSV upload state
  const [csvRows, setCsvRows] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  
  // Manual add player state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualPlayer, setManualPlayer] = useState({
    first_name: '',
    last_name: '',
    number: '',
    age_group: '',
  });
  const [manualStatus, setManualStatus] = useState('idle');
  const [manualMsg, setManualMsg] = useState('');
  
  const fileInputRef = useRef();
  const selectedLeague = leagues?.find(l => l.id === selectedLeagueId);

  // Fetch player count
  const fetchPlayerCount = useCallback(async () => {
    if (!createdEvent) return;
    try {
      const { data } = await api.get(`/players?event_id=${createdEvent.id}`);
      setPlayerCount(Array.isArray(data) ? data.length : 0);
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      setPlayerCount(0);
    }
  }, [createdEvent]);

  useEffect(() => {
    if (createdEvent) {
      fetchPlayerCount();
    }
  }, [createdEvent, fetchPlayerCount]);

  const handleEventCreated = (event) => {
    setCreatedEvent(event);
    setCurrentStep(2); // Move to player import step
  };

  const handleContinueToAdmin = () => {
    navigate("/admin#player-upload-section");
  };

  // CSV handling with enhanced parsing
  const handleCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const { headers, rows, mappingType } = parseCsv(text);
      
      // Enhanced validation with mapping type support
      const headerErrors = validateHeaders(headers, mappingType);
      
      // Validate rows
      const validatedRows = rows.map(row => validateRow(row));
      
      // Count validation issues
      const rowsWithErrors = validatedRows.filter(row => row.warnings.length > 0);
      const criticalErrors = validatedRows.filter(row => 
        row.warnings.some(w => w.includes("Missing first name") || w.includes("Missing last name"))
      );
      const validPlayers = validatedRows.filter(row => row.isValid);
      
      // Show appropriate feedback
      if (headerErrors.length > 0) {
        showError(`❌ CSV Error: ${headerErrors[0]}`);
      } else if (criticalErrors.length > 0) {
        showError(`❌ ${criticalErrors.length} players missing required names. Review and fix before uploading.`);
      } else if (rowsWithErrors.length > 0) {
        showInfo(`⚠️ ${validPlayers.length} players ready, ${rowsWithErrors.length} have warnings. Review table below.`);
      } else {
        const mappingDesc = getMappingDescription(mappingType);
        showSuccess(`✅ ${rows.length} players validated successfully! ${mappingDesc}`);
      }
      
      setCsvRows(validatedRows);
      setCsvErrors(headerErrors);
      
      // Log mapping type for debugging
      logger.info('ONBOARDING-EVENT', `CSV parsed using ${mappingType} mapping for ${rows.length} players`);
    };
    reader.readAsText(file);
  };

  const hasValidPlayers = csvErrors.length === 0 && csvRows.length > 0 && csvRows.some(r => r.name && r.name.trim() !== "");

  const handleUpload = async () => {
    if (!createdEvent) return;
    setUploadStatus("loading");
    setUploadMsg("");
    
    // Prepare players and auto-assign numbers
    const cleanedPlayers = csvRows.map(row => {
      // Remove warnings property and return the rest
      // eslint-disable-next-line no-unused-vars
      const { warnings, ...rest } = row;
      return rest;
    });
    const playersWithNumbers = autoAssignPlayerNumbers(cleanedPlayers);
    
    const payload = {
      event_id: createdEvent.id,
      players: playersWithNumbers
    };
    
    try {
      const res = await api.post(`/players/upload`, payload);
      const { data } = res;
      setUploadStatus("success");
      const numbersAssigned = playersWithNumbers.filter(p => !cleanedPlayers.find(cp => cp.name === p.name && cp.number)).length;
      setUploadMsg(`✅ Upload successful! ${data.added} players added${numbersAssigned > 0 ? `, ${numbersAssigned} auto-numbered` : ''}.`);
      setCsvRows([]);
      setCsvErrors([]);
      setCsvFileName("");
      fetchPlayerCount();
      
      // CRITICAL FIX: Auto-advance to step 3 after successful upload
      if (data.added > 0) {
        setTimeout(() => {
          setCurrentStep(3);
        }, 1500); // Give users time to see the success message
      }
    } catch (err) {
      setUploadStatus("error");
      setUploadMsg(`❌ ${err.message || "Upload failed."}`);
    }
  };

  // Ref for auto-scrolling to manual form
  const manualFormRef = useRef(null);

  // Manual player handling
  const handleManualChange = (e) => {
    setManualPlayer({ ...manualPlayer, [e.target.name]: e.target.value });
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualStatus('loading');
    
    try {
      let playerNumber = null;
      if (manualPlayer.number && manualPlayer.number.trim() !== "") {
        playerNumber = Number(manualPlayer.number);
      } else {
        // Auto-assign number based on age group
        const tempPlayer = { age_group: manualPlayer.age_group.trim() || null };
        const [numberedPlayer] = autoAssignPlayerNumbers([tempPlayer]);
        playerNumber = numberedPlayer.number;
      }
      
      const playerPayload = {
        name: `${manualPlayer.first_name.trim()} ${manualPlayer.last_name.trim()}`,
        number: playerNumber,
        age_group: manualPlayer.age_group.trim() || null,
      };
      
      await api.post(`/players?event_id=${createdEvent.id}`, playerPayload);
      setManualStatus('success');
      const autoNumbered = !manualPlayer.number || manualPlayer.number.trim() === "";
      setManualMsg(`Player added${autoNumbered ? ` with auto-number #${playerNumber}` : ''}!`);
      setManualPlayer({
        first_name: '',
        last_name: '',
        number: '',
        age_group: '',
      });
      fetchPlayerCount();
      // Reset status after success message is shown
      setTimeout(() => {
        setManualStatus('idle');
        setManualMsg('');
      }, 3000);
    } catch (err) {
      setManualStatus('error');
      setManualMsg(err.message || 'Failed to add player.');
    }
  };

  // Sample CSV download
  const handleSampleDownload = () => {
    let csv = REQUIRED_HEADERS.join(",") + "\n";
    SAMPLE_ROWS.forEach(row => {
      csv += row.join(",") + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_players.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReupload = () => {
    setCsvRows([]);
    setCsvErrors([]);
    setCsvFileName("");
    setUploadStatus("idle");
    setUploadMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Step navigation
  const handleStepNavigation = (newStep) => {
    setCurrentStep(newStep);
  };

  // Step 1: Event Creation/Selection
  if (currentStep === 1) {
    return (
      <WelcomeLayout contentClassName="min-h-screen" hideHeader={true} showOverlay={false}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-cmf-primary text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <h1 className="text-2xl font-bold">Select or Create an Event</h1>
          </div>
          <p className="mb-6 text-gray-600">Choose an existing event or create a new combine event for your team.</p>
          <EventSelector onEventSelected={handleEventCreated} />
          
          {selectedEvent && !createdEvent && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">
                Selected: <strong>{selectedEvent.name}</strong>
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-blue-800 text-sm">
                  <strong>Next:</strong> You'll add at least 1 player to experience how the system works. 
                  Players can also join themselves using invite codes.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedEvent(selectedEvent); 
                  setCurrentStep(2);
                }}
                className="bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] w-full flex items-center justify-center gap-2"
              >
                Continue Setup
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </WelcomeLayout>
    );
  }

  // Step 2: Player Import
  if (currentStep === 2 && createdEvent) {
    return (
      <WelcomeLayout contentClassName="min-h-screen" hideHeader={true} showOverlay={false}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
          {/* Step Header */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-cmf-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <h1 className="text-2xl font-bold">Set Up Your Roster</h1>
          </div>
          
          {/* Event Info */}
          <div className="bg-cmf-primary/10 rounded-lg p-4 mb-6 text-center">
            <p className="text-cmf-primary font-semibold">{createdEvent.name}</p>
            <p className="text-sm text-gray-600">
              {playerCount > 0 ? `${playerCount} players added` : 'No players added yet'}
            </p>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-sm">👥</span>
              </div>
              <div>
                <p className="text-blue-800 font-medium text-sm mb-1">Add At Least 1 Player to Continue</p>
                <p className="text-blue-700 text-sm">
                  Add your first player to experience how rankings and the system work. 
                  Only First Name, Last Name, and Age Group are needed. You can add more players anytime later.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => {
                const newState = !showManualForm;
                setShowManualForm(newState);
                if (newState && manualFormRef.current) {
                  // Auto-scroll to manual form after a brief delay to allow DOM update
                  setTimeout(() => {
                    manualFormRef.current.scrollIntoView({ 
                      behavior: 'smooth', 
                      block: 'start' 
                    });
                  }, 100);
                }
              }}
              className="bg-cmf-primary hover:bg-cmf-secondary text-white font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Add Manual
            </button>
            <button
              onClick={handleSampleDownload}
              className="bg-gray-500 hover:bg-gray-600 text-white font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Sample CSV
            </button>
          </div>

          {/* Manual Add Player Form */}
          {showManualForm && (
            <div ref={manualFormRef} className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cmf-primary" />
                Add Player Manually
              </h3>
              
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      name="first_name"
                      value={manualPlayer.first_name}
                      onChange={handleManualChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      name="last_name"
                      value={manualPlayer.last_name}
                      onChange={handleManualChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Player Number</label>
                    <input
                      type="number"
                      name="number"
                      value={manualPlayer.number}
                      onChange={handleManualChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                      placeholder="Leave empty for auto-generated"
                    />
                    <p className="text-xs text-gray-500 mt-1">(Auto-generated if empty)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age Group</label>
                    <input
                      type="text"
                      name="age_group"
                      value={manualPlayer.age_group}
                      onChange={handleManualChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                      placeholder="e.g., 6U, 7-8, U10"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={manualStatus === 'loading'}
                    className="flex-1 bg-cmf-primary hover:bg-cmf-secondary disabled:opacity-50 text-white font-medium py-2 rounded-lg transition"
                  >
                    {manualStatus === 'loading' ? 'Adding...' : 'Add Player'}
                  </button>
                </div>

                {manualStatus === 'success' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-700 font-medium">✅ {manualMsg}</p>
                  </div>
                )}

                {manualStatus === 'error' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 font-medium">❌ {manualMsg}</p>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* CSV Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50 hover:bg-gray-100 transition mb-6">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsv}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-6 py-3 rounded-lg cursor-pointer transition inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Choose CSV File
              </label>
            </div>
            
            {csvFileName && (
              <div className="text-sm text-gray-600 mb-2">📄 {csvFileName}</div>
            )}

            {csvErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm font-medium">❌ Upload Error</p>
                <p className="text-red-600 text-sm">{csvErrors.join('; ')}</p>
              </div>
            )}

            {/* Upload Actions */}
            {Array.isArray(csvRows) && csvRows.length > 0 && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 text-sm font-medium">✅ File validated successfully!</p>
                  <p className="text-green-700 text-xs">
                    Review the player list above, then click "Save Players" to add them to your event.
                  </p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleReupload}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition"
                  >
                    Different File
                  </button>
                  <button
                    disabled={!hasValidPlayers || uploadStatus === "loading"}
                    onClick={handleUpload}
                    className="bg-cmf-primary hover:bg-cmf-secondary disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded-lg transition"
                  >
                    {uploadStatus === "loading" ? "Saving Players..." : "Save Players to Event"}
                  </button>
                </div>
              </div>
            )}

            {uploadStatus === "success" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <p className="text-green-800 font-medium">{uploadMsg}</p>
              </div>
            )}

            {uploadStatus === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                <p className="text-red-700 font-medium">{uploadMsg}</p>
              </div>
            )}
          </div>



          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <button
              onClick={() => handleStepNavigation(1)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Event Selection
            </button>
            
            {/* Continue Button - REQUIRED: at least 1 player */}
            <button
              onClick={() => handleStepNavigation(3)}
              disabled={playerCount === 0}
              className="bg-cmf-primary hover:bg-cmf-secondary disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2"
            >
              {playerCount === 0 ? (
                <>
                  Add At Least 1 Player to Continue
                  <Users className="w-5 h-5" />
                </>
              ) : (
                <>
                  Continue with {playerCount} Player{playerCount !== 1 ? 's' : ''}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
          
          <p className="text-center text-sm text-gray-500 mt-2">
            {playerCount === 0 
              ? "🎯 Adding your first player helps you see how the ranking system works"
              : `✅ ${playerCount} player${playerCount !== 1 ? 's' : ''} ready - you can add more anytime after setup`
            }
          </p>
        </div>
      </WelcomeLayout>
    );
  }

  // Step 3: Share Event (Compact)
  if (currentStep === 3 && createdEvent) {
    return (
      <WelcomeLayout contentClassName="min-h-screen" hideHeader={true} showOverlay={false}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-green-600">Event Ready!</h1>
          </div>
          
          <p className="text-gray-600 mb-4">
            Your combine event "<strong>{createdEvent.name}</strong>" is ready.
          </p>
          
          <div data-qr-section>
            <EventJoinCode event={createdEvent} league={selectedLeague} />
          </div>
          
          {/* Continue Button */}
          <div className="mt-6">
            <button
              onClick={() => handleStepNavigation(4)}
              className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </WelcomeLayout>
    );
  }

  // Step 4: Congratulations & What's Next
  if (currentStep === 4 && createdEvent) {
    return (
      <WelcomeLayout contentClassName="min-h-screen" hideHeader={true} showOverlay={false}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-center">
          {/* CONGRATULATIONS SECTION */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="text-center mb-3">
              <h3 className="text-green-800 font-semibold text-lg">🎉 Congratulations, you have:</h3>
            </div>
            
            <div className="space-y-2 text-sm">
              {/* Completed Steps */}
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <span className="text-green-800">Set up your League</span>
              </div>
              
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <span className="text-green-800">Set up your first event: <strong>{createdEvent.name}</strong></span>
              </div>
              
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <span className="text-green-800">Added players to your event</span>
              </div>
              
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <span className="text-green-800">Invited other people to your event</span>
              </div>
            </div>
          </div>



          {/* WHAT'S NEXT SECTION */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="text-center mb-3">
              <h3 className="text-green-800 font-semibold text-lg">🎉 You're All Set!</h3>
              <p className="text-green-700 text-sm">
                Your event is ready. Now start tracking player performance and see live results.
              </p>
            </div>
            
            {/* PRIMARY ACTION - Get Started */}
            <div className="mb-4">
              <button
                onClick={() => {
                  navigate('/players');
                }}
                className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                🚀 Start Tracking Performance
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* SECONDARY ACTIONS */}
            <div className="border-t border-blue-200 pt-3">
              <h4 className="text-blue-800 font-medium text-sm mb-2 text-center">⭐ When You're Ready:</h4>
              
              <div className="space-y-2 text-sm">
                {/* Secondary Action 1 - Live Entry */}
                <div className="flex items-center justify-between">
                  <span className="text-blue-800">Familiarize with Live Entry</span>
                  <button
                    onClick={() => {
                      navigate('/live-entry');
                    }}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition text-xs font-medium"
                  >
                    ⚡ Explore
                  </button>
                </div>
                
                {/* Secondary Action 2 - QR Codes */}
                <div className="flex items-center justify-between">
                  <span className="text-blue-800">Share QR codes with staff</span>
                  <button
                    onClick={() => {
                      handleStepNavigation(3);
                    }}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition text-xs font-medium"
                  >
                    📱 Share
                  </button>
                </div>
                
                {/* Secondary Action 3 - Export */}
                <div className="flex items-center justify-between">
                  <span className="text-blue-800">Export results after event</span>
                  <button
                    onClick={() => {
                      navigate('/players?tab=exports');
                    }}
                    className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition text-xs font-medium"
                  >
                    📊 Export
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* NAVIGATION OPTIONS */}
          <div className="space-y-2">
            {/* Secondary Actions */}
            <div className="space-y-2">
              <button
                onClick={() => handleStepNavigation(2)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Add More Players
              </button>
              
              <button
                onClick={handleContinueToAdmin}
                className="w-full bg-cmf-secondary hover:bg-cmf-primary text-white font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
              >
                Advanced Admin Tools
              </button>
            </div>
          </div>
        </div>
      </WelcomeLayout>
    );
  }

  // Fallback
  return null;
} 