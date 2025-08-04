import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EventSelector from "../components/EventSelector";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Navigation from "../components/Navigation";
import { Upload, UserPlus, Users, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import { logger } from '../utils/logger';
import LoadingScreen from "../components/LoadingScreen";

// CSV processing utilities (simplified from AdminTools)
import { parseCsv, validateRow, validateHeaders, getMappingDescription } from '../utils/csvUtils';

// AuthenticatedLayout wrapper
function AuthenticatedLayout({ children }) {
  return (
    <>
      <Navigation />
      {children}
    </>
  );
}

export default function CreateEvent() {
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
    navigate('/dashboard');
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
      logger.info('CREATE-EVENT', `CSV parsed using ${mappingType} mapping for ${rows.length} players`);
    };
    reader.readAsText(file);
  };

  // Navigate between steps
  const handleStepNavigation = (stepNumber) => {
    setCurrentStep(stepNumber);
  };

  // Step 1: Event Creation
  if (currentStep === 1) {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-blue-200">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-cmf-secondary mb-2">
                  Create New Event
                </h1>
                <p className="text-gray-600">
                  Set up your combine event with guided step-by-step process
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                    <span className="ml-2 text-sm font-medium text-blue-600">Create Event</span>
                  </div>
                  <div className="w-8 h-1 bg-gray-200 rounded"></div>
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <span className="ml-2 text-sm text-gray-500">Add Players</span>
                  </div>
                  <div className="w-8 h-1 bg-gray-200 rounded"></div>
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <span className="ml-2 text-sm text-gray-500">Ready!</span>
                  </div>
                </div>
              </div>

              {/* Event Creation Form */}
              <EventSelector onEventSelected={handleEventCreated} />
              
              {/* Back to Dashboard */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Step 2: Player Import (reuse OnboardingEvent logic)
  if (currentStep === 2) {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-blue-200">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-cmf-secondary mb-2">
                  Add Players to {createdEvent?.name}
                </h1>
                <p className="text-gray-600">
                  Import your player roster to get started
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <span className="ml-2 text-sm font-medium text-green-600">Event Created</span>
                  </div>
                  <div className="w-8 h-1 bg-blue-600 rounded"></div>
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <span className="ml-2 text-sm font-medium text-blue-600">Add Players</span>
                  </div>
                  <div className="w-8 h-1 bg-gray-200 rounded"></div>
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                    <span className="ml-2 text-sm text-gray-500">Ready!</span>
                  </div>
                </div>
              </div>

              {/* Player Import Options */}
              <div className="space-y-4 mb-6">
                {/* CSV Upload Option */}
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
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition"
                  >
                    Choose CSV File
                  </button>
                  
                  {csvFileName && (
                    <p className="text-sm text-green-600 mt-2">
                      📄 {csvFileName} loaded ({csvRows.length} players)
                    </p>
                  )}
                </div>

                {/* Manual Add Option */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-green-600" />
                    Add Players Manually
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Add players one by one if you have a small group
                  </p>
                  
                  <button
                    onClick={() => navigate('/admin')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition"
                  >
                    Open Player Management
                  </button>
                </div>
              </div>

              {/* Current Player Count */}
              {playerCount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2">
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
                  onClick={() => setCurrentStep(3)}
                  className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  Continue to Next Step
                  <ArrowRight className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => setCurrentStep(1)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Event Creation
                </button>
              </div>
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Step 3: Completion
  if (currentStep === 3) {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-green-200">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-green-800 mb-2">
                  🎉 Event Ready!
                </h1>
                <p className="text-gray-600">
                  {createdEvent?.name} is set up and ready to go
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <span className="ml-2 text-sm font-medium text-green-600">Event Created</span>
                  </div>
                  <div className="w-8 h-1 bg-green-600 rounded"></div>
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <span className="ml-2 text-sm font-medium text-green-600">Players Added</span>
                  </div>
                  <div className="w-8 h-1 bg-green-600 rounded"></div>
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <span className="ml-2 text-sm font-medium text-green-600">Ready!</span>
                  </div>
                </div>
              </div>

              {/* SUCCESS MESSAGE */}
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
                    onClick={() => navigate('/players')}
                    className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    🚀 Start Tracking Performance
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

                {/* SECONDARY ACTIONS */}
                <div className="border-t border-green-200 pt-3">
                  <h4 className="text-green-800 font-medium text-sm mb-2 text-center">⭐ When You're Ready:</h4>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-green-800">Familiarize with Live Entry</span>
                      <button
                        onClick={() => navigate('/live-entry')}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition text-xs font-medium"
                      >
                        ⚡ Explore
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-green-800">Export results after event</span>
                      <button
                        onClick={() => navigate('/players?tab=exports')}
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
                <button
                  onClick={() => setCurrentStep(2)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Add More Players
                </button>
                
                <button
                  onClick={() => navigate('/admin')}
                  className="w-full bg-cmf-secondary hover:bg-cmf-primary text-white font-medium py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
                >
                  Advanced Admin Tools
                </button>
              </div>
            </div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Fallback
  return null;
}