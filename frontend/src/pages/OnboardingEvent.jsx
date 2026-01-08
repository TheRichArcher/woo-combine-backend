import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EventSelector from "../components/EventSelector";
import EventJoinCode from "../components/EventJoinCode";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
// WelcomeLayout removed to support persistent navigation
import OnboardingCard from "../components/OnboardingCard";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { Upload, UserPlus, Users, ArrowRight, ArrowLeft, CheckCircle, Info } from 'lucide-react';
import api from '../lib/api';
import { logger } from '../utils/logger';
import { autoAssignPlayerNumbers } from '../utils/playerNumbering';
import LoadingScreen from "../components/LoadingScreen";
import DrillManager from "../components/drills/DrillManager";
import ImportResultsModal from "../components/Players/ImportResultsModal";
import { useDrills } from "../hooks/useDrills";

// CSV processing utilities
import { parseCsv, validateRow, validateHeaders, getMappingDescription, REQUIRED_HEADERS, generateDefaultMapping, applyMapping, OPTIONAL_HEADERS, detectColumnTypes } from '../utils/csvUtils';

// Common wrapper style for persistent navigation support
const OnboardingWrapper = ({ children }) => (
  <div className="min-h-[calc(100vh-64px)] bg-surface-subtle flex flex-col items-center justify-start pt-8 pb-8 px-4">
    {children}
  </div>
);

export default function OnboardingEvent() {
  const navigate = useNavigate();
  const { selectedEvent } = useEvent();
  const { user, userRole, leagues, selectedLeagueId } = useAuth();
  const { notifyPlayerAdded, notifyPlayersUploaded, notifyError, showSuccess, showError, showInfo } = useToast();
  
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

  const organizerMissingLeague = userRole === 'organizer' && (!selectedLeagueId || selectedLeagueId.trim() === '');
  if (organizerMissingLeague) {
    const hasExistingLeagues = Array.isArray(leagues) && leagues.length > 0;
    return (
      <LoadingScreen
        title={hasExistingLeagues ? "Choose a league to continue" : "Create your league to continue"}
        subtitle={hasExistingLeagues ? "Redirecting you to your league list" : "Redirecting you to the Create League step"}
        size="large"
      />
    );
  }
  
  // Multi-step wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [createdEvent, setCreatedEvent] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [hasScores, setHasScores] = useState(false);
  
  // CSV upload state
  const [csvRows, setCsvRows] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  const [backendErrors, setBackendErrors] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [originalCsvRows, setOriginalCsvRows] = useState([]);
  const [showMapping, setShowMapping] = useState(false);
  const [fieldMapping, setFieldMapping] = useState({});
  const [mappingConfidence, setMappingConfidence] = useState({});
  const [mappingApplied, setMappingApplied] = useState(false);
  const [forcedIgnoreFields, setForcedIgnoreFields] = useState([]);
  
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
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importModalMode, setImportModalMode] = useState('create_or_update');
  const [importIntent, setImportIntent] = useState('roster_and_scores');
  const [drillRefreshTrigger, setDrillRefreshTrigger] = useState(0);
  const { drills: allDrills } = useDrills(createdEvent, drillRefreshTrigger);
  const [droppedFileForImport, setDroppedFileForImport] = useState(null);

  const fileInputRef = useRef();
  const selectedLeague = leagues?.find(l => l.id === selectedLeagueId);
  
  // Drag and drop state
  const [isDraggingRoster, setIsDraggingRoster] = useState(false);
  const [isDraggingScores, setIsDraggingScores] = useState(false);
  const dragCounterRoster = useRef(0);
  const dragCounterScores = useRef(0);

  const StepIndicator = ({ activeStep }) => {
    const steps = [1, 2, 3, 4, 5];
    return (
      <div className="flex justify-center mb-6">
        <div className="flex items-center space-x-2">
          {steps.map((step, idx) => {
            const status = activeStep === step ? "active" : activeStep > step ? "complete" : "upcoming";
            const circleClasses =
              status === "complete"
                ? "bg-semantic-success text-white"
                : status === "active"
                  ? "bg-brand-primary text-white"
                  : "bg-gray-200 text-gray-500";
            return (
              <React.Fragment key={step}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${circleClasses}`}>
                  {status === "complete" ? <CheckCircle className="w-5 h-5" /> : step}
                </div>
                {idx !== steps.length - 1 && (
                  <div className={`w-8 h-1 rounded ${activeStep > step ? "bg-brand-primary" : "bg-gray-200"}`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  // Enforce league context: organizers must intentionally create/select a league first
  useEffect(() => {
    if (!userRole || userRole !== 'organizer') return;
    const hasSelectedLeague = !!(selectedLeagueId && selectedLeagueId.trim() !== '');
    if (hasSelectedLeague) return;

    // If organizer already has leagues, send them to select page; otherwise force league creation
    if (Array.isArray(leagues) && leagues.length > 0) {
      navigate('/select-league', { replace: true, state: { from: 'onboarding-event' } });
    } else {
      navigate('/create-league', { replace: true, state: { from: 'onboarding-event' } });
    }
  }, [userRole, selectedLeagueId, leagues, navigate]);

  // Fetch event data (players and scores)
  const fetchEventData = useCallback(async () => {
    if (!createdEvent?.id) return;
    try {
      const { data } = await api.get(`/players?event_id=${createdEvent.id}`);
      const players = Array.isArray(data) ? data : [];
      setPlayerCount(players.length);
      
      // Check if any player has scores (non-empty scores object)
      const scoresExist = players.some(p => p.scores && Object.keys(p.scores).length > 0);
      setHasScores(scoresExist);
      return { playerCount: players.length, hasScores: scoresExist };
    } catch (_error) {
      setPlayerCount(0);
      setHasScores(false);
      return { playerCount: 0, hasScores: false };
    }
  }, [createdEvent]);

  useEffect(() => {
    if (createdEvent) {
      fetchEventData();
    }
  }, [createdEvent, fetchEventData]);

  // Auto-advance REMOVED to prevent skipping the Sport Selection step.
  // Users will see the "Continue" button in Step 1 if an event is already selected.
  /*
  useEffect(() => {
    if (currentStep === 1 && selectedEvent && !createdEvent) {
      setCreatedEvent(selectedEvent);
      setCurrentStep(2);
    }
  }, [currentStep, selectedEvent, createdEvent]);
  */

  const handleEventCreated = (event) => {
    setCreatedEvent(event);
    setCurrentStep(2); // Move to configure drills step
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
      
      // Generate default mapping immediately
      const { mapping: initialMapping, confidence } = generateDefaultMapping(headers);
      
      // NEW: Auto-detect numeric columns to prevent score mapping errors
      const columnTypes = detectColumnTypes(headers, rows);
      
      // Check if all remaining columns (not auto-mapped) are numeric
      const mappedHeaders = Object.values(initialMapping);
      const remainingHeaders = headers.filter(h => !mappedHeaders.includes(h));
      const allRemainingAreNumeric = remainingHeaders.length > 0 && remainingHeaders.every(h => columnTypes[h] === 'numeric');
      
      const forcedFields = [];
      if (allRemainingAreNumeric) {
        // If only numeric columns remain, they are likely scores - safely ignore unmapped roster fields
        [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].forEach(key => {
            if (!initialMapping[key]) {
                initialMapping[key] = '__ignore__';
                forcedFields.push(key);
            }
        });
        if (forcedFields.length > 0) {
             showInfo('⚠️ Numeric columns detected - score fields automatically set to Ignore.');
        }
      }
      setForcedIgnoreFields(forcedFields);

      setFieldMapping(initialMapping);
      setMappingConfidence(confidence);
      setOriginalCsvRows(rows); // Always save original rows
      
      // Enhanced validation with mapping type support
      const headerErrors = validateHeaders(headers, mappingType);
      
      // Always show mapping for confirmation
      setCsvHeaders(headers);
      setCsvRows(rows.map(r => ({ ...r, warnings: [] }))); // Show raw rows without warnings
      setCsvErrors(headerErrors);
      setShowMapping(true);
      setMappingApplied(false);

      if (headerErrors.length > 0) {
        showError(`⚠️ Column headers don't match. Please map fields to continue.`);
      } else {
        // Check confidence
        const needsReview = Object.values(confidence).some(c => c !== 'high');
        if (needsReview) {
          showInfo(`⚠️ Some columns need review. Please check mappings.`);
        } else {
          showInfo(`📋 Please review and confirm field mappings.`);
        }
      }
      
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
  const handleUpload = async (rowsOverride) => {
    if (!createdEvent?.id) {
      showError("No event selected. Please create an event first.");
      return;
    }

    const sourceRows = Array.isArray(rowsOverride) ? rowsOverride : csvRows;
    if (!sourceRows || sourceRows.length === 0) {
      showError("No players to upload. Please select a CSV file first.");
      return;
    }

    const validRows = sourceRows.filter(row => row.name && row.name.trim() !== "");
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
      // Assign player numbers automatically if missing
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
      await fetchEventData();
      
      // Move to next step after brief delay
      setTimeout(() => {
        setCurrentStep(4);
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
      await fetchEventData();
      
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

  // Drag and drop handlers
  const handleDragEnter = (e, cardType) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (cardType === 'roster') {
      dragCounterRoster.current++;
      if (dragCounterRoster.current === 1) {
        setIsDraggingRoster(true);
      }
    } else if (cardType === 'scores') {
      dragCounterScores.current++;
      if (dragCounterScores.current === 1) {
        setIsDraggingScores(true);
      }
    }
  };

  const handleDragLeave = (e, cardType) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (cardType === 'roster') {
      dragCounterRoster.current--;
      if (dragCounterRoster.current === 0) {
        setIsDraggingRoster(false);
      }
    } else if (cardType === 'scores') {
      dragCounterScores.current--;
      if (dragCounterScores.current === 0) {
        setIsDraggingScores(false);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e, cardType, modalMode, intent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset drag state
    if (cardType === 'roster') {
      dragCounterRoster.current = 0;
      setIsDraggingRoster(false);
    } else if (cardType === 'scores') {
      dragCounterScores.current = 0;
      setIsDraggingScores(false);
    }
    
    // Check if files were dropped
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      showError("No file detected. Please try again.");
      return;
    }
    
    const file = files[0];
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      showError(`Invalid file type. Please upload a CSV or Excel file (${validExtensions.join(', ')})`);
      return;
    }
    
    // Show success feedback
    showSuccess(`File "${file.name}" ready to import`);
    
    // Store file in state so ImportResultsModal can access it
    setDroppedFileForImport(file);
    
    // Trigger the modal with the appropriate mode and intent
    setDrillRefreshTrigger(t => t + 1);
    setImportModalMode(modalMode);
    setImportIntent(intent);
    setShowImportModal(true);
  };

  // STEP 1: Event Creation
  if (currentStep === 1) {
    return (
      <OnboardingWrapper>
        <div className="w-full max-w-md text-center">
          <OnboardingCard title="🏆 Create Your Event" subtitle="Set up your combine event and start timing athletes">

            <StepIndicator activeStep={1} />

            {/* Event Creation */}
            <EventSelector onEventSelected={handleEventCreated} />
            {/* If an event is already selected (e.g., user hit browser back), allow continuing */}
            {selectedEvent && (
              <div className="mt-4">
                <Button onClick={() => { setCreatedEvent(selectedEvent); setCurrentStep(2); }} className="w-full flex items-center justify-center gap-2">
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            )}
          </OnboardingCard>
        </div>
      </OnboardingWrapper>
    );
  }

  // STEP 2: Configure Drills
  if (currentStep === 2) {
    return (
        <OnboardingWrapper>
            <div className="w-full max-w-md text-center">
                <OnboardingCard 
                    title="⚙️ Configure Drills" 
                    subtitle={
                        <>
                            <span className="block">Event: <strong>{createdEvent?.name}</strong></span>
                            <span className="text-sm text-gray-500">Review standard drills or add custom ones</span>
                        </>
                    }
                >
                    <StepIndicator activeStep={2} />
                    
                    <div className="mb-6 text-left">
                        <DrillManager 
                            event={createdEvent} 
                            leagueId={selectedLeagueId} 
                            isLiveEntryActive={false} // New events are not active yet
                            onDrillsChanged={() => setDrillRefreshTrigger(t => t + 1)}
                        />
                    </div>

                    <div className="space-y-3">
                        <Button onClick={() => handleStepNavigation(3)} className="w-full flex items-center justify-center gap-2">
                            Continue to Add Players
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                        <Button variant="subtle" onClick={() => handleStepNavigation(1)} className="w-full flex items-center justify-center gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>
                    </div>
                </OnboardingCard>
            </div>
        </OnboardingWrapper>
    );
  }

  // STEP 3: Player Import
  if (currentStep === 3) {
    return (
      <OnboardingWrapper>
        <div className="w-full max-w-md text-center">
          <OnboardingCard
            title="📋 Add Players"
            subtitle={
              <>
                <span className="block">Event: <strong>{createdEvent?.name}</strong></span>
                <span className="text-sm text-gray-500">Import your roster to get started</span>
              </>
            }
          >

            <StepIndicator activeStep={3} />

            {/* Header Copy */}
            <div className="text-sm text-gray-600 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2 text-left">
                <Info className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" />
                <span>Roster creates players. Scores-only updates existing players.</span>
            </div>

            {/* CSV Upload Section */}
            <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Roster Only */}
                      <div 
                           role="button"
                           tabIndex={0}
                           aria-label="Upload roster CSV or Excel file - Names and Player Numbers only"
                           className={`bg-white border-2 rounded-xl p-4 shadow-sm transition-all cursor-pointer group text-left relative overflow-hidden flex flex-col h-full focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${
                             isDraggingRoster 
                               ? 'border-brand-primary bg-brand-primary/5 scale-105' 
                               : 'border-brand-primary/20 hover:border-brand-primary/50'
                           }`}
                           onClick={() => {
                               setDrillRefreshTrigger(t => t + 1);
                               setImportModalMode('create_or_update');
                               setImportIntent('roster_only');
                               setShowImportModal(true);
                           }}
                           onKeyDown={(e) => {
                               if (e.key === 'Enter' || e.key === ' ') {
                                   e.preventDefault();
                                   setDrillRefreshTrigger(t => t + 1);
                                   setImportModalMode('create_or_update');
                                   setImportIntent('roster_only');
                                   setShowImportModal(true);
                               }
                           }}
                           onDragEnter={(e) => handleDragEnter(e, 'roster')}
                           onDragLeave={(e) => handleDragLeave(e, 'roster')}
                           onDragOver={handleDragOver}
                           onDrop={(e) => handleDrop(e, 'roster', 'create_or_update', 'roster_only')}
                      >
                          {isDraggingRoster && (
                            <div className="absolute inset-0 bg-brand-primary/10 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl border-2 border-dashed border-brand-primary">
                              <div className="text-center">
                                <Upload className="w-8 h-8 text-brand-primary mx-auto mb-2 animate-bounce" />
                                <p className="text-sm font-semibold text-brand-primary">Drop to upload roster</p>
                              </div>
                            </div>
                          )}
                          <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="bg-brand-primary/10 p-1.5 rounded-lg">
                                      <UserPlus className="w-5 h-5 text-brand-primary" />
                                  </div>
                                  <h3 className="font-bold text-gray-900 text-md">Upload Roster</h3>
                              </div>
                              <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                                  Names + Player Numbers only.
                              </p>
                              <div className="space-y-1">
                                  <p className="text-[10px] text-brand-primary font-semibold">
                                      Step 1 of 2: Import your roster
                                  </p>
                                  <p className="text-[10px] text-gray-500 font-medium">
                                      You'll import results after players are added.
                                  </p>
                              </div>
                          </div>
                          <div className="mt-auto pt-2">
                              <span className="text-xs font-semibold text-brand-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                  {isDraggingRoster ? 'Drop file here' : 'Click or drag CSV'} <ArrowRight className="w-3 h-3" />
                              </span>
                          </div>
                      </div>

                      {/* Option 2: Roster + Scores */}
                      <div 
                           role="button"
                           tabIndex={0}
                           aria-label="Upload roster and scores CSV or Excel file - One upload for everything (Recommended)"
                           className={`bg-white border-2 rounded-xl p-4 shadow-sm transition-all cursor-pointer group text-left relative overflow-hidden flex flex-col h-full focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${
                             isDraggingScores 
                               ? 'border-brand-primary bg-brand-primary/5 scale-105' 
                               : 'border-brand-primary/20 hover:border-brand-primary/50'
                           }`}
                           onClick={() => {
                               setDrillRefreshTrigger(t => t + 1);
                               setImportModalMode('create_or_update');
                               setImportIntent('roster_and_scores');
                               setShowImportModal(true);
                           }}
                           onKeyDown={(e) => {
                               if (e.key === 'Enter' || e.key === ' ') {
                                   e.preventDefault();
                                   setDrillRefreshTrigger(t => t + 1);
                                   setImportModalMode('create_or_update');
                                   setImportIntent('roster_and_scores');
                                   setShowImportModal(true);
                               }
                           }}
                           onDragEnter={(e) => handleDragEnter(e, 'scores')}
                           onDragLeave={(e) => handleDragLeave(e, 'scores')}
                           onDragOver={handleDragOver}
                           onDrop={(e) => handleDrop(e, 'scores', 'create_or_update', 'roster_and_scores')}
                      >
                          {isDraggingScores && (
                            <div className="absolute inset-0 bg-brand-primary/10 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl border-2 border-dashed border-brand-primary">
                              <div className="text-center">
                                <Upload className="w-8 h-8 text-brand-primary mx-auto mb-2 animate-bounce" />
                                <p className="text-sm font-semibold text-brand-primary">Drop to upload roster + scores</p>
                              </div>
                            </div>
                          )}
                          <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="bg-brand-primary/10 p-1.5 rounded-lg">
                                      <Upload className="w-5 h-5 text-brand-primary" />
                                  </div>
                                  <h3 className="font-bold text-gray-900 text-md">Roster + Scores</h3>
                              </div>
                              <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                                  One upload for everything.
                              </p>
                              <p className="text-[10px] text-brand-secondary font-medium">
                                  (Recommended)
                              </p>
                              <p className="text-[10px] text-gray-400 font-medium">
                                  Players + results in one upload.
                              </p>
                          </div>
                          <div className="mt-auto pt-2">
                              <span className="text-xs font-semibold text-brand-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                  {isDraggingScores ? 'Drop file here' : 'Click or drag CSV'} <ArrowRight className="w-3 h-3" />
                              </span>
                          </div>
                      </div>
                  </div>

                  {/* Manual Add Link */}
                  <div className="text-center py-1">
                      <button 
                        onClick={() => setShowManualForm(!showManualForm)}
                        className="text-xs text-gray-500 underline hover:text-brand-primary transition-colors"
                      >
                        Don’t have a spreadsheet? Add players manually
                      </button>
                  </div>

                  {/* Manual Add Section */}
                  {showManualForm && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-left animate-in fade-in slide-in-from-top-2">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
                        <UserPlus className="w-4 h-4 text-gray-600" />
                        Add Single Player
                        </h3>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Input type="text" placeholder="First Name *" value={manualPlayer.first_name} onChange={(e) => setManualPlayer(prev => ({...prev, first_name: e.target.value}))} className="text-sm" />
                                <Input type="text" placeholder="Last Name *" value={manualPlayer.last_name} onChange={(e) => setManualPlayer(prev => ({...prev, last_name: e.target.value}))} className="text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input type="text" placeholder="Number" value={manualPlayer.number} onChange={(e) => setManualPlayer(prev => ({...prev, number: e.target.value}))} className="text-sm" />
                                <Input type="text" placeholder="Age Group" value={manualPlayer.age_group} onChange={(e) => setManualPlayer(prev => ({...prev, age_group: e.target.value}))} className="text-sm" />
                            </div>
                            <Button onClick={handleAddPlayer} disabled={manualStatus === 'adding'} className="w-full text-sm py-2">
                            {manualStatus === 'adding' ? 'Adding...' : 'Add Player'}
                            </Button>
                            
                            {manualMsg && (
                            <div className={`text-xs ${manualStatus === 'error' ? 'text-semantic-error' : manualStatus === 'success' ? 'text-semantic-success' : 'text-brand-primary'}`}>
                                {manualMsg}
                            </div>
                            )}
                        </div>
                    </div>
                  )}

                  {/* Secondary CTA: Scores Only */}
                  <div className={`border border-gray-200 rounded-xl p-3 text-left flex items-center justify-between transition-all ${playerCount === 0 ? 'opacity-60 bg-gray-50' : 'hover:border-gray-300 bg-white'}`}>
                      <div>
                          <h3 className="font-semibold text-gray-700 text-sm">Upload scores only</h3>
                          <p className="text-[10px] text-gray-500">Results only. Must match roster.</p>
                      </div>
                      <Button 
                        size="sm"
                        variant="outline"
                        disabled={playerCount === 0}
                        onClick={() => {
                            if (playerCount === 0) return;
                            setDrillRefreshTrigger(t => t + 1);
                            setImportModalMode('scores_only');
                            setImportIntent('scores_only');
                            setShowImportModal(true);
                        }}
                        className="text-xs h-7 px-3"
                      >
                        Upload Scores
                      </Button>
                  </div>
                  {playerCount === 0 && <p className="text-xs text-gray-400 text-center -mt-2">Add players to enable scores upload</p>}
            </div>

            {/* Current Player Count */}
            {playerCount > 0 && (
              <div className="bg-semantic-success/10 border border-semantic-success/20 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-5 h-5 text-semantic-success" />
                  <span className="font-semibold text-semantic-success">
                    {playerCount} players added to this event
                  </span>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="space-y-3 mt-6">
              <Button 
                onClick={() => handleStepNavigation(4)} 
                className="w-full flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="subtle" onClick={() => handleStepNavigation(2)} className="w-full flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </div>
            
            {/* Import Modal */}
            {showImportModal && (
              <ImportResultsModal
                onClose={() => {
                  setShowImportModal(false);
                  setDroppedFileForImport(null);
                }}
                initialMode={importModalMode}
                intent={importIntent}
                showModeSwitch={false}
                onSuccess={async (isRevert) => {
                  await fetchEventData();
                  if (!isRevert) {
                    setShowImportModal(false);
                    setDroppedFileForImport(null);
                    showSuccess(`Successfully imported players/scores!`);
                    // Navigate to Players page to keep user in event context
                    // Prevents landing back on Admin Dashboard after import
                    navigate('/players');
                  }
                }}
                availableDrills={allDrills}
                droppedFile={droppedFileForImport}
              />
            )}

          </OnboardingCard>
        </div>
      </OnboardingWrapper>
    );
  }

  // STEP 4: Share event with staff
  if (currentStep === 4) {
    return (
      <OnboardingWrapper>
        <div className="w-full max-w-lg text-center space-y-4">
          <StepIndicator activeStep={4} />
          {createdEvent && selectedLeague ? (
            <div className="bg-white rounded-2xl shadow-2xl p-4">
              <EventJoinCode event={createdEvent} league={selectedLeague} />
            </div>
          ) : (
            <OnboardingCard
              title="Share codes after selecting an event"
              subtitle="We couldn't find your event details. Head back one step and make sure an event is selected."
            >
              <Button onClick={() => handleStepNavigation(3)} className="w-full flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Return to Add Players
              </Button>
            </OnboardingCard>
          )}

          <div className="space-y-3">
            <Button onClick={() => handleStepNavigation(5)} className="w-full flex items-center justify-center gap-2">
              Done and/or Skip and Start Tracking
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="subtle" onClick={() => handleStepNavigation(3)} className="w-full flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Add More Players
            </Button>
          </div>
        </div>
      </OnboardingWrapper>
    );
  }

  // STEP 5: Completion and next steps
  if (currentStep === 5) {
    return (
      <OnboardingWrapper>
        <div className="w-full max-w-md text-center">
          <OnboardingCard title={"🎉 You're All Set!"} subtitle={`${createdEvent?.name || 'Your event'} is ready with ${playerCount} players`}>
            <StepIndicator activeStep={5} />

            <div className="bg-semantic-success/10 border border-semantic-success/20 rounded-lg p-4 mb-4">
              <div className="text-center mb-3">
                {hasScores ? (
                  <>
                    <h3 className="text-semantic-success font-semibold text-lg">✅ Results Ready!</h3>
                    <p className="text-semantic-success/80 text-sm">
                      Scores already uploaded — review rankings or explore analytics.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-semantic-success font-semibold text-lg">🎉 Time to Track Performance</h3>
                    <p className="text-semantic-success/80 text-sm">
                      Launch Live Entry to record drill results and watch rankings update in real-time.
                    </p>
                  </>
                )}
              </div>

              <div className="mb-4">
                {hasScores ? (
                  <Button onClick={() => { navigate('/players'); }} className="w-full flex items-center justify-center gap-2" size="lg">
                    🏆 Analyze Player Rankings
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button onClick={() => { navigate('/live-entry'); }} className="w-full flex items-center justify-center gap-2" size="lg">
                    🚀 Start Tracking Performance
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                )}

                {/* New Section: Upload Results Option */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500 font-medium">OR</span>
                  </div>
                </div>

                <div className="text-center mb-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setDrillRefreshTrigger(t => t + 1);
                      setShowImportModal(true);
                    }} 
                    className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-50 text-gray-700 py-3"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Drill Results Instead
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    If you already recorded scores on a spreadsheet, upload them here.
                  </p>
                </div>
              </div>

              <div className="border-t border-brand-primary/30 pt-3">
                <h4 className="text-brand-secondary font-medium text-sm mb-2 text-center">⭐ When You're Ready:</h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-brand-secondary">Review Live Entry tips</span>
                    <Button size="sm" onClick={() => { navigate('/live-entry'); }}>
                      ⚡ Explore
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-brand-secondary">Share QR codes with staff</span>
                    <Button size="sm" onClick={() => handleStepNavigation(4)}>
                      📱 Share
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-brand-secondary">Export results after event</span>
                    <Button size="sm" onClick={() => { navigate('/players?tab=exports'); }}>
                      📊 Export
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button variant="subtle" onClick={() => handleStepNavigation(3)} className="w-full flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Add More Players
              </Button>
              
              <Button variant="subtle" onClick={() => handleStepNavigation(4)} className="w-full flex items-center justify-center gap-2">
                📱 Share Invitations Again
              </Button>
              
              <Button onClick={handleContinueToPlayers} className="w-full flex items-center justify-center gap-2">
                View Players & Analytics
              </Button>
            </div>

            {showImportModal && (
              <ImportResultsModal
                onClose={() => {
                  setShowImportModal(false);
                  setDroppedFileForImport(null);
                }}
                // Pre-select correct mode if opened from "Skip Roster"
                initialMode="scores_only"
                onSuccess={async (isRevert) => {
                  // Always fetch fresh data to update local state, but don't block redirect
                  await fetchEventData();
                  
                  // If import successful (not revert), redirect immediately to Players page
                  // This exits the onboarding flow since the user has successfully imported data
                  if (!isRevert) {
                    setShowImportModal(false);
                    setDroppedFileForImport(null);
                    showSuccess("Drill scores imported successfully!");
                    navigate('/players');
                  }
                }}
                availableDrills={allDrills} // REQUIRED: Pass event-specific drills
                droppedFile={droppedFileForImport}
              />
            )}
          </OnboardingCard>
        </div>
      </OnboardingWrapper>
    );
  }

  // Fallback
  return null;
}
