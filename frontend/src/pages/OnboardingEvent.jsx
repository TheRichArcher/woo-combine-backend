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

// CSV processing utilities
import { parseCsv, validateRow, validateHeaders, getMappingDescription, REQUIRED_HEADERS, generateDefaultMapping, applyMapping, OPTIONAL_HEADERS } from '../utils/csvUtils';

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
  const [mappingApplied, setMappingApplied] = useState(false);
  
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

  const StepIndicator = ({ activeStep }) => {
    const steps = [1, 2, 3, 4, 5];
    return (
      <div className="flex justify-center mb-6">
        <div className="flex items-center space-x-2">
          {steps.map((step, idx) => {
            const status = activeStep === step ? "active" : activeStep > step ? "complete" : "upcoming";
            const circleClasses =
              status === "complete"
                ? "bg-green-600 text-white"
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
    navigate("/players/roster", { replace: true });
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
        // Non-blocking warning: allow user to proceed; we'll skip invalid name rows on upload
        showInfo(`⚠️ ${criticalErrors.length} players are missing first or last names. You can continue — those rows will be skipped.`);
      } else if (rowsWithErrors.length > 0) {
        showInfo(`⚠️ ${validPlayers.length} players ready, ${rowsWithErrors.length} have warnings. Review table below.`);
      } else {
        const mappingDesc = getMappingDescription(mappingType);
        showSuccess(`✅ ${rows.length} players validated successfully! ${mappingDesc}`);
      }
      
      setCsvRows(validatedRows);
      setCsvErrors(headerErrors);
      setCsvHeaders(headers);
      setOriginalCsvRows(rows);
      setMappingApplied(false);
      try {
        const initialMapping = generateDefaultMapping(headers);
        setFieldMapping(initialMapping);
        setShowMapping(headerErrors.length > 0);
      } catch {}
      
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
      await fetchPlayerCount();
      
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
            <div className="w-full max-w-2xl text-center">
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
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-brand-primary" />
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
                
                <Button onClick={() => fileInputRef.current?.click()} className="w-full mb-3">
                  Choose CSV File
                </Button>
                
                {csvFileName && (
                  <div className="text-left">
                    <p className="text-sm text-green-600">
                      📄 {csvFileName} loaded ({csvRows.length} players)
                    </p>
                    <p className="text-xs text-gray-600 mb-2">🎉 CSV file loaded ({csvRows.length} players). Next, click <span className="font-semibold">Map Fields</span> to match your columns to our fields.</p>
                    
                    {!mappingApplied ? (
                      <>
                        <Button onClick={() => setShowMapping(true)} className="w-full">
                          Map Fields
                        </Button>
                        <p className="text-[11px] text-gray-500 mt-2">Step 1 of 2: Match your CSV columns to our fields.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-600 mb-2">✅ Fields matched. Click <span className="font-semibold">Import Players</span> to complete the upload.</p>
                        {hasValidPlayers && (
                          <Button onClick={handleUpload} disabled={uploadStatus === "uploading"} className="w-full">
                            {uploadStatus === "uploading" ? "Importing..." : "Import Players"}
                          </Button>
                        )}
                        <p className="text-[11px] text-gray-500 mt-2">Step 2 of 2: Import {csvRows.filter(r => r.name && r.name.trim() !== "").length} players. Rows without names will be skipped.</p>
                      </>
                    )}
                  </div>
                )}
                
                {uploadMsg && (
                  <div className={`text-sm mt-2 ${uploadStatus === "error" ? "text-red-600" : uploadStatus === "success" ? "text-green-600" : "text-brand-primary"}`}>
                    {uploadMsg}
                  </div>
                )}
                {showMapping && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4 mt-3 text-left">
                    <h4 className="font-semibold text-gray-900 mb-2">Match Column Headers</h4>
                    <p className="text-sm text-gray-600 mb-3">Match our fields to the headers in your CSV. Only First and Last Name are required. Others are optional. Choose “Ignore” to skip a field.</p>
                    <div className="grid grid-cols-1 gap-3">
                      {[...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].map((fieldKey) => {
                        const selectedHeader = fieldMapping[fieldKey] || '';
                        const sampleValue = selectedHeader && selectedHeader !== '__ignore__'
                          ? (originalCsvRows.find(row => (row?.[selectedHeader] || '').trim() !== '')?.[selectedHeader] || '')
                          : '';
                        return (
                          <div key={fieldKey} className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <div className="w-40 text-sm text-gray-700 font-medium">
                                {fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                {REQUIRED_HEADERS.includes(fieldKey) && <span className="text-red-500 ml-1">*</span>}
                              </div>
                              <select
                                value={selectedHeader}
                                onChange={(e) => setFieldMapping(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                              >
                                <option value="">Auto</option>
                                <option value="__ignore__">Ignore</option>
                                {csvHeaders.map(h => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                            <div className="pl-40 text-xs text-gray-500">
                              {selectedHeader === '__ignore__' && 'Ignored for this import'}
                              {!selectedHeader && 'Auto-detecting based on header name'}
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
                          // Immediately begin import after mapping for smoother UX
                          handleUpload(validated);
                        }}
                      >
                        Apply Mapping & Import
                      </Button>
                      <Button variant="subtle" onClick={() => setShowMapping(false)}>Cancel</Button>
                    </div>
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
                      <div className={`text-sm ${manualStatus === 'error' ? 'text-red-600' : manualStatus === 'success' ? 'text-green-600' : 'text-brand-primary'}`}>
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
              <Button onClick={() => handleStepNavigation(4)} className="w-full flex items-center justify-center gap-2">
                Continue
                <ArrowRight className="w-5 h-5" />
              </Button>
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

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="text-center mb-3">
                <h3 className="text-green-800 font-semibold text-lg">🎉 Time to Track Performance</h3>
                <p className="text-green-700 text-sm">
                  Launch Live Entry to record drill results and watch rankings update in real-time.
                </p>
              </div>

              <div className="mb-4">
                <Button onClick={() => { navigate('/live-entry'); }} className="w-full flex items-center justify-center gap-2" size="lg">
                  🚀 Start Tracking Performance
                  <ArrowRight className="w-5 h-5" />
                </Button>
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
                View Players & Rankings
              </Button>
            </div>
          </OnboardingCard>
        </div>
      </WelcomeLayout>
    );
  }

  // Fallback
  return null;
}