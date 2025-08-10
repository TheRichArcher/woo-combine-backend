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
  const { user, userRole, leagues, selectedLeagueId, setSelectedLeagueId, setLeagues } = useAuth();
  const { notifyEventCreated, notifyPlayerAdded, notifyPlayersUploaded, notifyError, showSuccess, showError, showInfo } = useToast();
  
  // Enhanced auth check with loading state
  if (!user) {
    return <LoadingScreen title="Checking authentication..." subtitle="Please wait while we verify your access" size="large" />;
  }
  
  if (!userRole) {
    return <LoadingScreen title="Loading your role..." subtitle="Setting up your account permissions" size="large" />;
  }
  
  // Redirect non-organizers safely via effect to avoid hook order issues
  useEffect(() => {
    if (userRole && userRole !== 'organizer') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);
  if (userRole !== 'organizer') {
    return <LoadingScreen title="Redirecting..." subtitle="Taking you to your dashboard" size="medium" />;
  }
  
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
  const [backendErrors, setBackendErrors] = useState([]);
  
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

  // Auto-setup: ensure an organizer has a league context
  useEffect(() => {
    let cancelled = false;
    const ensureLeagueContext = async () => {
      if (userRole !== 'organizer') return;
      const hasSelectedLeague = !!(selectedLeagueId && selectedLeagueId.trim() !== '');
      if (hasSelectedLeague) return;
      // 1) If leagues already loaded, pick the first
      if (Array.isArray(leagues) && leagues.length > 0) {
        setSelectedLeagueId(leagues[0].id);
        return;
      }
      // 2) Check localStorage (guards against race conditions)
      try {
        const stored = localStorage.getItem('selectedLeagueId');
        if (stored && stored !== 'null' && stored.trim() !== '') {
          setSelectedLeagueId(stored);
          return;
        }
      } catch {}
      // 3) Try fetching leagues from API (in case AuthContext fetch lagged)
      try {
        const res = await api.get('/leagues/me');
        if (cancelled) return;
        const leagueArray = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.leagues) ? res.data.leagues : []);
        if (leagueArray.length > 0) {
          const first = leagueArray[0];
          setSelectedLeagueId(first.id);
          setLeagues(prev => {
            const prevArr = Array.isArray(prev) ? prev : [];
            const exists = prevArr.some(l => l.id === first.id);
            return exists ? prevArr : [first, ...prevArr];
          });
          return;
        }
      } catch {}
      // Otherwise create a default league seamlessly
      try {
        const defaultName = 'My First League';
        const res = await api.post('/leagues', { name: defaultName });
        if (cancelled) return;
        const newLeagueId = res?.data?.league_id;
        if (newLeagueId) {
          setSelectedLeagueId(newLeagueId);
          setLeagues(prev => {
            const exists = Array.isArray(prev) && prev.some(l => l.id === newLeagueId);
            if (exists) return prev;
            return [...(prev || []), { id: newLeagueId, name: defaultName, role: 'organizer' }];
          });
        }
      } catch {
        // Silent fail; UI already shows guidance and manual Create League button
      }
    };
    ensureLeagueContext();
    return () => { cancelled = true; };
  }, [userRole, selectedLeagueId, leagues, setSelectedLeagueId, setLeagues]);

  // Fetch player count
  const fetchPlayerCount = useCallback(async () => {
    if (!createdEvent?.id) return;
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

  const handleContinueToPlayers = () => {
    navigate("/players", { replace: true });
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

  // Navigate between steps
  const handleStepNavigation = (stepNumber) => {
    setCurrentStep(stepNumber);
  };

  // Upload CSV players to backend
  const handleUpload = async () => {
    if (!createdEvent?.id) {
      showError("No event selected. Please create an event first.");
      return;
    }

    if (!csvRows || csvRows.length === 0) {
      showError("No players to upload. Please select a CSV file first.");
      return;
    }

    const validRows = csvRows.filter(row => row.name && row.name.trim() !== "");
    if (validRows.length === 0) {
      showError("No valid players found. Please check your CSV file.");
      return;
    }

    setUploadStatus("uploading");
    setUploadMsg("Uploading players...");
    setBackendErrors([]);

    try {
      // Normalize for numbering: use `number` field expected by autoAssign
      const rowsForNumbering = validRows.map(r => ({ ...r, number: r.jersey_number ?? r.number }));
      // Assign jersey numbers automatically if missing
      const playersWithNumbers = autoAssignPlayerNumbers(rowsForNumbering).map(p => ({
        ...p,
        jersey_number: p.jersey_number || p.number
      }));
      
      // Create player objects for API per contract
      const players = playersWithNumbers.map(row => ({
        first_name: row.first_name,
        last_name: row.last_name,
        age_group: row.age_group || '',
        jersey_number: row.jersey_number || '',
        external_id: row.external_id,
        team_name: row.team_name,
        position: row.position,
        notes: row.notes,
      }));

      // Upload to backend
      const { data } = await api.post('/players/upload', { 
        event_id: createdEvent.id,
        players: players 
      });
      
        if (data?.errors && data.errors.length > 0) {
          setUploadStatus("error");
          setBackendErrors(Array.isArray(data.errors) ? data.errors : []);
          setUploadMsg(`Some rows failed to upload. ${data.added || 0} added, ${data.errors.length} error${data.errors.length === 1 ? '' : 's'}. See errors below.`);
        } else {
        setUploadStatus("success");
        setUploadMsg(`✅ Successfully uploaded ${data.added} players!`);
        notifyPlayersUploaded(data.added);
      }
      
      // Refresh player count
      await fetchPlayerCount();
      
      // Move to next step after brief delay
      setTimeout(() => {
        setCurrentStep(3);
      }, 1500);
      
    } catch (error) {
      setUploadStatus("error");
      const backendDetail = error.response?.data;
      if (Array.isArray(backendDetail?.errors)) {
        setBackendErrors(backendDetail.errors);
        setUploadMsg(`Failed to upload players. ${backendDetail.errors.length} error${backendDetail.errors.length === 1 ? '' : 's'}. See errors below.`);
      } else {
        setUploadMsg(error.response?.data?.detail || "Failed to upload players. Please try again.");
      }
      notifyError(error.response?.data?.detail || "Upload failed");
    }
  };

  // Add single player manually
  const handleAddPlayer = async () => {
    if (!createdEvent?.id) {
      showError("No event selected. Please create an event first.");
      return;
    }

    if (!manualPlayer.first_name || !manualPlayer.last_name) {
      setManualMsg("First name and last name are required.");
      return;
    }

    setManualStatus('adding');
    setManualMsg('Adding player...');

    try {
      // Transform data to match backend PlayerCreate model
      const playerData = {
        name: `${manualPlayer.first_name} ${manualPlayer.last_name}`.trim(),
        number: manualPlayer.number ? parseInt(manualPlayer.number) : null,
        age_group: manualPlayer.age_group || null,
        photo_url: null
      };

      await api.post(`/players?event_id=${createdEvent.id}`, playerData);
      
      setManualStatus('success');
      setManualMsg('✅ Player added successfully!');
      notifyPlayerAdded(manualPlayer.first_name, manualPlayer.last_name);
      
      // Reset form
      setManualPlayer({
        first_name: '',
        last_name: '',
        number: '',
        age_group: '',
      });
      
      // Refresh player count
      await fetchPlayerCount();
      
      // Reset status after brief delay
      setTimeout(() => {
        setManualStatus('idle');
        setManualMsg('');
      }, 2000);
      
    } catch (error) {
      setManualStatus('error');
      setManualMsg(error.response?.data?.detail || "Failed to add player. Please try again.");
    }
  };

  const hasValidPlayers = csvErrors.length === 0 && csvRows.length > 0 && csvRows.some(r => r.name && r.name.trim() !== "");

  // STEP 1: Event Creation
  if (currentStep === 1) {
    return (
      <WelcomeLayout>
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
            <h1 className="text-2xl font-bold text-brand-secondary mb-4">
              🏆 Create Your Event
            </h1>
            <p className="text-gray-600 mb-6">
              Set up your combine event and start timing athletes
            </p>

            {/* Step Indicator */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <div className="w-8 h-1 bg-gray-200 rounded"></div>
                <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <div className="w-8 h-1 bg-gray-200 rounded"></div>
                <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-bold">3</div>
              </div>
            </div>

            {/* Event Creation */}
            <EventSelector onEventSelected={handleEventCreated} />
             {/* If no league is selected yet but user is organizer, background auto-setup will create one */}
            {(!selectedLeagueId || selectedLeagueId.trim() === '') && (
              <div className="text-xs text-gray-500 mt-4">Preparing your league... this will update automatically in a moment.</div>
            )}
          </div>
        </div>
      </WelcomeLayout>
    );
  }

  // STEP 2: Player Import
  if (currentStep === 2) {
    return (
      <WelcomeLayout>
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
            <h1 className="text-2xl font-bold text-brand-secondary mb-2">
              📋 Add Players
            </h1>
            <p className="text-gray-600 mb-1">
              Event: <strong>{createdEvent?.name}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Import your roster to get started
            </p>

            {/* Step Indicator */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="w-8 h-1 bg-blue-600 rounded"></div>
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <div className="w-8 h-1 bg-gray-200 rounded"></div>
                <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-bold">3</div>
              </div>
            </div>

            {/* CSV Upload Section */}
            <div className="space-y-4 mb-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Upload CSV File (Recommended)
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Quickly import all your players at once
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsv}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition mb-3"
                >
                  Choose CSV File
                </button>
                
                {csvFileName && (
                  <div className="text-left">
                    <p className="text-sm text-green-600 mb-2">
                      📄 {csvFileName} loaded ({csvRows.length} players)
                    </p>
                    
                    {hasValidPlayers && (
                      <button
                        onClick={handleUpload}
                        disabled={uploadStatus === "uploading"}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
                      >
                        {uploadStatus === "uploading" ? "Uploading..." : "Confirm Upload"}
                      </button>
                    )}
                  </div>
                )}
                
                {uploadMsg && (
                  <div className={`text-sm mt-2 ${uploadStatus === "error" ? "text-red-600" : uploadStatus === "success" ? "text-green-600" : "text-blue-600"}`}>
                    {uploadMsg}
                  </div>
                )}
                {uploadStatus === 'error' && backendErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                    <div className="text-sm text-red-800 font-medium mb-1">Row Errors</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-red-100">
                            <th className="px-2 py-1 text-left">Row</th>
                            <th className="px-2 py-1 text-left">Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backendErrors.map((err, idx) => (
                            <tr key={idx} className="border-t border-red-200">
                              <td className="px-2 py-1">{err.row}</td>
                              <td className="px-2 py-1 whitespace-pre-wrap">{err.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Add Section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-green-600" />
                  Add Players Manually
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Add players one by one if you have a small group
                </p>
                
                <button
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition"
                >
                  {showManualForm ? "Hide Form" : "Show Manual Entry"}
                </button>
                
                {showManualForm && (
                  <div className="mt-3 space-y-3">
                    <input
                      type="text"
                      placeholder="First Name *"
                      value={manualPlayer.first_name}
                      onChange={(e) => setManualPlayer(prev => ({...prev, first_name: e.target.value}))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Last Name *"
                      value={manualPlayer.last_name}
                      onChange={(e) => setManualPlayer(prev => ({...prev, last_name: e.target.value}))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Player Number (optional)"
                      value={manualPlayer.number}
                      onChange={(e) => setManualPlayer(prev => ({...prev, number: e.target.value}))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Age Group (e.g., A, B, C, U12, 9-10)"
                      value={manualPlayer.age_group}
                      onChange={(e) => setManualPlayer(prev => ({...prev, age_group: e.target.value}))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleAddPlayer}
                      disabled={manualStatus === 'adding'}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
                    >
                      {manualStatus === 'adding' ? 'Adding...' : 'Add Player'}
                    </button>
                    
                    {manualMsg && (
                      <div className={`text-sm ${manualStatus === 'error' ? 'text-red-600' : manualStatus === 'success' ? 'text-green-600' : 'text-blue-600'}`}>
                        {manualMsg}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Current Player Count */}
            {playerCount > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">
                    {playerCount} players added to this event
                  </span>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="space-y-3">
              <button
                onClick={() => handleStepNavigation(3)}
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-3 px-6 rounded-lg shadow transition flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => handleStepNavigation(1)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Event Creation
              </button>
            </div>
          </div>
        </div>
      </WelcomeLayout>
    );
  }

  // STEP 3: Completion
  if (currentStep === 3) {
    return (
      <WelcomeLayout>
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
            <h1 className="text-2xl font-bold text-green-800 mb-4">
              🎉 You're All Set!
            </h1>
            <p className="text-gray-600 mb-6">
              {createdEvent?.name} is ready with {playerCount} players
            </p>

            {/* Step Indicator */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="w-8 h-1 bg-green-600 rounded"></div>
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div className="w-8 h-1 bg-green-600 rounded"></div>
                <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                  <CheckCircle className="w-5 h-5" />
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
                  className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"
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
                  onClick={handleContinueToPlayers}
                  className="w-full bg-brand-secondary hover:bg-brand-primary text-white font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  View Players & Rankings
                </button>
              </div>
            </div>
          </div>

          {/* QR CODE SECTION - Moved outside main card */}
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-lg font-bold text-brand-secondary mb-4">
              📱 Share with Staff
            </h2>
            
            <EventJoinCode event={createdEvent} />
          </div>
        </div>
      </WelcomeLayout>
    );
  }

  // Fallback
  return null;
}