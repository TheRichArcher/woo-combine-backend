import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EventSelector from "../components/EventSelector";
import EventJoinCode from "../components/EventJoinCode";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import OnboardingCard from "../components/OnboardingCard";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { Upload, UserPlus, Users, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import { logger } from '../utils/logger';
import { autoAssignPlayerNumbers } from '../utils/playerNumbering';
import LoadingScreen from "../components/LoadingScreen";
import DrillManager from "../components/drills/DrillManager";
import ImportResultsModal from "../components/Players/ImportResultsModal";
import { useDrills } from "../hooks/useDrills";

// CSV processing utilities
import { parseCsv, validateRow, validateHeaders, getMappingDescription, REQUIRED_HEADERS, generateDefaultMapping, applyMapping, OPTIONAL_HEADERS, detectColumnTypes } from '../utils/csvUtils';

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
  const [drillRefreshTrigger, setDrillRefreshTrigger] = useState(0);
  const { drills: allDrills } = useDrills(createdEvent, drillRefreshTrigger);

  const fileInputRef = useRef();
  const selectedLeague = leagues?.find(l => l.id === selectedLeagueId);

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

  // STEP 1: Event Creation
  if (currentStep === 1) {
    return (
      <WelcomeLayout showOverlay={false} backgroundColor="bg-surface-subtle">
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
      </WelcomeLayout>
    );
  }

  // STEP 2: Configure Drills
  if (currentStep === 2) {
    return (
        <WelcomeLayout showOverlay={false} backgroundColor="bg-surface-subtle">
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
        </WelcomeLayout>
    );
  }

  // STEP 3: Player Import
  if (currentStep === 3) {
    return (
      <WelcomeLayout showOverlay={false} backgroundColor="bg-surface-subtle">
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

            {/* CSV Upload Section */}
            <div className="space-y-4 mb-6">
              
              {/* NEW: Import Goal Guidance */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <p className="text-blue-800 font-medium mb-1">Uploading a roster or uploading scores?</p>
                  <p className="text-blue-700 mb-2">
                      This step creates your roster. If you already have a roster and just need to add scores, 
                      skip this and use <strong>"Upload Drill Results"</strong> on the completion screen.
                  </p>
                  <div className="flex gap-4 text-xs mt-2">
                      <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-brand-primary"></div>
                          <span className="text-blue-900"><strong>Roster Import:</strong> Creates players</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-semantic-success"></div>
                          <span className="text-blue-900"><strong>Score Import:</strong> Matches existing players</span>
                      </div>
                  </div>
              </div>

              {/* Step 1: Upload File */}
              <div className={`border border-gray-200 rounded-lg transition-all duration-300 overflow-hidden ${csvFileName ? 'bg-gray-50 p-3' : 'p-4'}`}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className={`font-semibold text-gray-900 flex items-center gap-2 ${csvFileName ? 'text-sm' : ''}`}>
                    <div className={`flex items-center justify-center rounded-full bg-brand-primary text-white font-bold ${csvFileName ? 'w-6 h-6 text-xs' : 'w-6 h-6 text-sm'}`}>1</div>
                    Upload CSV File
                  </h3>
                  {csvFileName && (
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-8 px-2">
                      Change File
                    </Button>
                  )}
                </div>
                
                {!csvFileName ? (
                  <div className="ml-8">
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
                    
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full mb-3">
                      Choose CSV File
                    </Button>
                  </div>
                ) : (
                  <div className="ml-8 flex items-center gap-2 text-sm text-semantic-success font-medium">
                    <CheckCircle className="w-4 h-4" />
                    <span>{csvFileName} loaded ({csvRows.length} rows)</span>
                  </div>
                )}
              </div>

              {/* Step 2: Import Players */}
              {csvFileName && uploadStatus !== 'success' && (
                <div className="border-2 border-brand-primary/20 bg-white rounded-lg p-4 shadow-lg animate-in fade-in slide-in-from-top-4 relative ring-4 ring-brand-primary/5">
                  <div className="absolute -left-3 top-4 w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold shadow-sm z-10">
                    2
                  </div>
                  
                  <div className="pl-6">
                    <h3 className="font-bold text-gray-900 text-lg mb-3">Import Players</h3>
                    
                    {/* Mandatory Banner */}
                    <div className="bg-blue-50 border-l-4 border-brand-secondary p-4 mb-5 rounded-r-md">
                      <p className="font-bold text-gray-800 text-base">
                        CSV uploaded. Now import your players to complete the process.
                      </p>
                    </div>
                    
                    {/* Instructional Banner for Mapping */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-amber-600 text-sm font-bold">!</span>
                            </div>
                            <div>
                                <p className="text-amber-800 font-bold text-sm mb-1">Only map roster information here.</p>
                                <p className="text-amber-700 text-sm">
                                    Drill scores will be imported separately on the Players page. 
                                    All score columns should be set to <strong>"Ignore / Don't Import."</strong>
                                </p>
                            </div>
                        </div>
                    </div>

                    {!mappingApplied ? (
                      <>
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 mb-3">Match your CSV columns to our fields.</p>
                          <Button onClick={() => setShowMapping(true)} variant="outline" className="w-full">
                            Review Field Mapping
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {hasValidPlayers && (
                          <Button 
                            onClick={() => handleUpload()} 
                            disabled={uploadStatus === "uploading"} 
                            className="w-full py-4 text-lg font-bold shadow-md hover:shadow-lg transition-all transform active:scale-[0.98]"
                          >
                            {uploadStatus === "uploading" ? (
                              "Importing..."
                            ) : (
                              `Import ${csvRows.filter(r => r.name && r.name.trim() !== "").length} Players`
                            )}
                          </Button>
                        )}
                        <p className="text-xs text-gray-500 mt-3 text-center">
                          Rows without names will be automatically skipped.
                        </p>
                      </>
                    )}
                    
                    {uploadMsg && (
                      <div className={`text-sm mt-3 font-medium p-2 rounded ${uploadStatus === "error" ? "bg-semantic-error/10 text-semantic-error" : "text-brand-primary"}`}>
                        {uploadMsg}
                      </div>
                    )}
                  </div>
                  
                  {/* Mapping UI Modal/Expandable */}
                  {showMapping && (
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mt-4 text-left animate-in zoom-in-95">
                      <h4 className="font-semibold text-gray-900 mb-2">Match Column Headers</h4>
                      <p className="text-sm text-gray-600 mb-3">Match our fields to the headers in your CSV.</p>
                      <div className="grid grid-cols-1 gap-3">
                        {[...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].map((fieldKey) => {
                          const selectedHeader = fieldMapping[fieldKey] || '';
                          const isForcedIgnore = forcedIgnoreFields.includes(fieldKey);
                          
                          const sampleValue = selectedHeader && selectedHeader !== '__ignore__'
                            ? (originalCsvRows.find(row => (row?.[selectedHeader] || '').trim() !== '')?.[selectedHeader] || '')
                            : '';
                          return (
                            <div key={fieldKey} className="flex flex-col gap-1">
                              <div className="flex items-center gap-3">
                                <div className="w-40 text-sm text-gray-700 font-medium">
                                  <div className="flex items-center">
                                    {fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    {REQUIRED_HEADERS.includes(fieldKey) && <span className="text-semantic-error ml-1">*</span>}
                                  </div>
                                  {/* Show Review warning if confidence is low OR if unmapped */}
                                  {((fieldMapping[fieldKey] && fieldMapping[fieldKey] !== '__ignore__' && mappingConfidence[fieldKey] && mappingConfidence[fieldKey] !== 'high') || (!selectedHeader && !isForcedIgnore)) && (
                                    <div className="text-xs text-amber-600 font-semibold mt-0.5">⚠️ Review Required</div>
                                  )}
                                </div>
                                <div className="flex-1 relative">
                                    <select
                                    value={selectedHeader}
                                    onChange={(e) => setFieldMapping(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                    disabled={isForcedIgnore}
                                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary ${
                                        (!selectedHeader && !isForcedIgnore) || (selectedHeader && selectedHeader !== '__ignore__' && mappingConfidence[fieldKey] && mappingConfidence[fieldKey] !== 'high')
                                        ? 'border-amber-300 bg-amber-50' 
                                        : 'border-gray-300'
                                    } ${isForcedIgnore ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                    >
                                    <option value="">Select Column...</option>
                                    <option value="__ignore__">Ignore (Don't Import)</option>
                                    {csvHeaders.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                    </select>
                                    {isForcedIgnore && (
                                        <div className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                                            🔒
                                        </div>
                                    )}
                                </div>
                              </div>
                              <div className="pl-40 text-xs text-gray-500">
                                {isForcedIgnore && (
                                    <span className="text-amber-600 font-medium">Auto-ignored (Numeric column detected)</span>
                                )}
                                {!isForcedIgnore && selectedHeader === '__ignore__' && 'Ignored for this import'}
                                {!selectedHeader && !isForcedIgnore && <span className="text-amber-600 font-medium">Please select a column or choose Ignore</span>}
                                {selectedHeader && selectedHeader !== '__ignore__' && (
                                  <>
                                    Mapped to “{selectedHeader}”
                                    {sampleValue && ` (e.g., ${sampleValue})`}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-3 mt-4">
                        <Button
                          onClick={() => {
                            const mapped = applyMapping(originalCsvRows, fieldMapping);
                            const validated = mapped.map(row => validateRow(row));
                            setCsvRows(validated);
                            setCsvErrors([]);
                            setShowMapping(false);
                            setMappingApplied(true);
                            // Auto-start import not requested, but "Import X Players" button will now show
                          }}
                          className="flex-1"
                        >
                          Save Mapping
                        </Button>
                        <Button variant="subtle" onClick={() => setShowMapping(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  
                  {uploadStatus === 'error' && backendErrors.length > 0 && (
                    <div className="bg-semantic-error/10 border border-semantic-error/20 rounded-lg p-3 mt-3">
                      <div className="text-sm text-semantic-error font-medium mb-1">Row Errors</div>
                      <div className="overflow-x-auto max-h-40">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-semantic-error/10">
                              <th className="px-2 py-1 text-left">Row</th>
                              <th className="px-2 py-1 text-left">Message</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backendErrors.map((err, idx) => (
                              <tr key={idx} className="border-t border-semantic-error/20">
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
              )}

              {/* Success Message */}
              {uploadStatus === 'success' && (
                <div className="bg-semantic-success/10 border border-semantic-success/20 rounded-lg p-4 flex items-center gap-3 animate-in fade-in zoom-in">
                  <CheckCircle className="w-6 h-6 text-semantic-success" />
                  <div>
                    <h3 className="font-bold text-semantic-success">Import Complete!</h3>
                    <p className="text-sm text-gray-600">Successfully imported {csvRows.length} players.</p>
                  </div>
                </div>
              )}
            </div>

              {/* Manual Add Section */}
              <div className="border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-semantic-success" />
                  Add Players Manually
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Add players one by one if you have a small group
                </p>
                
                <Button variant="subtle" onClick={() => setShowManualForm(!showManualForm)} className="w-full">
                  {showManualForm ? "Hide Form" : "Show Manual Entry"}
                </Button>
                
                {showManualForm && (
                  <div className="mt-3 space-y-3">
                    <Input type="text" placeholder="First Name *" value={manualPlayer.first_name} onChange={(e) => setManualPlayer(prev => ({...prev, first_name: e.target.value}))} />
                    <Input type="text" placeholder="Last Name *" value={manualPlayer.last_name} onChange={(e) => setManualPlayer(prev => ({...prev, last_name: e.target.value}))} />
                    <Input type="text" placeholder="Player Number (optional)" value={manualPlayer.number} onChange={(e) => setManualPlayer(prev => ({...prev, number: e.target.value}))} />
                    <Input type="text" placeholder="Age Group (e.g., A, B, C, U12, 9-10)" value={manualPlayer.age_group} onChange={(e) => setManualPlayer(prev => ({...prev, age_group: e.target.value}))} />
                    <Button onClick={handleAddPlayer} disabled={manualStatus === 'adding'} className="w-full">
                      {manualStatus === 'adding' ? 'Adding...' : 'Add Player'}
                    </Button>
                    
                    {manualMsg && (
                      <div className={`text-sm ${manualStatus === 'error' ? 'text-semantic-error' : manualStatus === 'success' ? 'text-semantic-success' : 'text-brand-primary'}`}>
                        {manualMsg}
                      </div>
                    )}
                  </div>
                )}
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
            <div className="space-y-3">
              <Button 
                onClick={() => handleStepNavigation(4)} 
                disabled={!!csvFileName && uploadStatus !== 'success'}
                className="w-full flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </Button>
              {!!csvFileName && uploadStatus !== 'success' && (
                <p className="text-xs text-center text-gray-500 -mt-1">
                  Finish importing players to continue.
                </p>
              )}
              <Button variant="subtle" onClick={() => handleStepNavigation(2)} className="w-full flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </div>
          </OnboardingCard>
        </div>
      </WelcomeLayout>
    );
  }

  // STEP 4: Share event with staff
  if (currentStep === 4) {
    return (
      <WelcomeLayout showOverlay={false} backgroundColor="bg-surface-subtle">
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
      </WelcomeLayout>
    );
  }

  // STEP 5: Completion and next steps
  if (currentStep === 5) {
    return (
      <WelcomeLayout showOverlay={false} backgroundColor="bg-surface-subtle">
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
                onClose={() => setShowImportModal(false)}
                onSuccess={async (isRevert) => {
                  // Always fetch fresh data to update local state, but don't block redirect
                  await fetchEventData();
                  
                  // If import successful (not revert), redirect immediately to Players page
                  // This exits the onboarding flow since the user has successfully imported data
                  if (!isRevert) {
                    setShowImportModal(false);
                    showSuccess("Drill scores imported successfully!");
                    navigate('/players');
                  }
                }}
                availableDrills={allDrills} // REQUIRED: Pass event-specific drills
              />
            )}
          </OnboardingCard>
        </div>
      </WelcomeLayout>
    );
  }

  // Fallback
  return null;
}