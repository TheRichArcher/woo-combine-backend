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
import { autoAssignPlayerNumbers } from '../utils/playerNumbering';

// CSV processing utilities (simplified from AdminTools)
const REQUIRED_HEADERS = ["first_name", "last_name", "age_group"];
const SAMPLE_ROWS = [
  ["Jane", "Smith", "9-10"],
  ["Alex", "Lee", "U12"],
  ["Sam", "Jones", "6U"],
  ["Maria", "Garcia", ""], // Example showing age group is optional
];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split(",").map(cell => cell.trim()));
  return { headers, rows };
}

function validateRow(row, headers) {
  const rowWarnings = [];
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = row[i] ?? "";
  });
  
  // Require first_name and last_name
  if (!obj.first_name || obj.first_name.trim() === "") {
    rowWarnings.push("Missing first name");
  }
  if (!obj.last_name || obj.last_name.trim() === "") {
    rowWarnings.push("Missing last name");
  }
  
  // Combine first and last name for backend compatibility
  if (obj.first_name && obj.last_name) {
    obj.name = `${obj.first_name.trim()} ${obj.last_name.trim()}`;
  }
  
  return { ...obj, warnings: rowWarnings };
}

export default function OnboardingEvent() {
  const navigate = useNavigate();
  const { selectedEvent } = useEvent();
  const { leagues, selectedLeagueId } = useAuth();
  const { notifyEventCreated, notifyPlayerAdded, notifyPlayersUploaded, notifyError, showSuccess, showError, showInfo } = useToast();
  
  // Multi-step wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [createdEvent, setCreatedEvent] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  
  // CSV upload state
  const [csvRows, setCsvRows] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
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
    } catch (error) {
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
    notifyEventCreated(event.name);
    showInfo('🎯 Next step: Add players to your event roster');
    setCurrentStep(2); // Move to player import step
  };

  const handleContinueToAdmin = () => {
    showInfo('🛠️ Opening Admin Tools for advanced event management');
    navigate("/admin#player-upload-section");
  };

  // CSV handling
  const handleCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const { headers, rows } = parseCsv(text);
      
      // Validate headers
      const headerErrors = [];
      const missingHeaders = REQUIRED_HEADERS.filter(required => 
        !headers.some(header => header.toLowerCase().trim() === required.toLowerCase())
      );
      if (missingHeaders.length > 0) {
        headerErrors.push(`Missing required headers: ${missingHeaders.join(", ")}`);
        showError(`❌ CSV Error: Missing headers ${missingHeaders.join(", ")}`);
      } else {
        showInfo(`📄 CSV loaded successfully: ${rows.length} players found`);
      }
      
      // Validate rows
      const validatedRows = rows.map(row => validateRow(row, headers));
      setCsvHeaders(headers);
      setCsvRows(validatedRows);
      setCsvErrors(headerErrors);
    };
    reader.readAsText(file);
  };

  const hasValidPlayers = csvErrors.length === 0 && csvRows.length > 0 && csvRows.some(r => r.name && r.name.trim() !== "");

  const handleUpload = async () => {
    if (!createdEvent) return;
    setUploadStatus("loading");
    setUploadMsg("");
    
    // Prepare players and auto-assign numbers
    const cleanedPlayers = csvRows.map(row => { const { warnings, ...rest } = row; return rest; });
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
      notifyPlayersUploaded(data.added);
      setCsvRows([]);
      setCsvHeaders([]);
      setCsvFileName("");
      fetchPlayerCount();
      
      // CRITICAL FIX: Auto-advance to step 3 after successful upload
      if (data.added > 0) {
        setTimeout(() => {
          setCurrentStep(3);
          showInfo('🎉 Players uploaded successfully! Ready to share your event with coaches.');
        }, 1500); // Give users time to see the success message
      }
    } catch (err) {
      setUploadStatus("error");
      setUploadMsg(`❌ ${err.message || "Upload failed."}`);
      notifyError(err);
    }
  };

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
      const playerName = `${manualPlayer.first_name} ${manualPlayer.last_name}`;
      notifyPlayerAdded(playerName);
      setManualPlayer({
        first_name: '',
        last_name: '',
        number: '',
        age_group: '',
      });
      fetchPlayerCount();
    } catch (err) {
      setManualStatus('error');
      setManualMsg(err.message || 'Failed to add player.');
      notifyError(err);
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
    showInfo('📥 Sample CSV downloaded - check your Downloads folder');
  };

  const handleReupload = () => {
    setCsvRows([]);
    setCsvHeaders([]);
    setCsvErrors([]);
    setCsvFileName("");
    setUploadStatus("idle");
    setUploadMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    showInfo('🔄 Ready for new CSV file');
  };

  // Step navigation with notifications
  const handleStepNavigation = (newStep, message) => {
    setCurrentStep(newStep);
    if (message) showInfo(message);
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
              <p className="text-sm text-gray-600 mb-4">
                Selected: <strong>{selectedEvent.name}</strong>
              </p>
              <button
                onClick={() => {
                  setCreatedEvent(selectedEvent); 
                  showInfo('📝 Event selected - ready to add players');
                  setCurrentStep(2);
                }}
                className="bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] w-full flex items-center justify-center gap-2"
              >
                Continue to Add Players
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
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8">
          {/* Step Header */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-cmf-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <h1 className="text-2xl font-bold">Add Players to Your Event</h1>
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
                <span className="text-blue-600 text-sm">💡</span>
              </div>
              <div>
                <p className="text-blue-800 font-medium text-sm mb-1">Simplified Upload Process</p>
                <p className="text-blue-700 text-sm">
                  Only First Name, Last Name, and Age Group (optional) are needed. 
                  Drill results will be collected during your combine event.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={handleSampleDownload}
              className="bg-cmf-primary hover:bg-cmf-secondary text-white font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Sample CSV
            </button>
            <button
              onClick={() => setShowManualForm(v => !v)}
              className="bg-cmf-secondary hover:bg-cmf-primary text-white font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Add Manual
            </button>
          </div>

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
                  {uploadStatus === "loading" ? "Uploading..." : "Confirm Upload"}
                </button>
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

          {/* Manual Add Player Form */}
          {showManualForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
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
                      placeholder="Optional"
                    />
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

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <button
              onClick={() => handleStepNavigation(1, '🔙 Back to event selection')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Event Selection
            </button>
            
            <div className="flex items-center gap-4">
              {/* Skip Option */}
              <button
                onClick={() => handleStepNavigation(3, '⏭️ Skipping player import - you can add players later in Admin Tools')}
                className="text-gray-500 hover:text-gray-700 font-medium underline"
              >
                Skip for now
              </button>
              
              {/* Continue Button - enabled if players added */}
              <button
                onClick={() => handleStepNavigation(3, '🎉 Ready to share your event with coaches!')}
                disabled={playerCount === 0}
                className="bg-cmf-primary hover:bg-cmf-secondary disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2"
              >
                Continue to Share Event
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {playerCount === 0 && (
            <p className="text-center text-sm text-gray-500 mt-2">
              Add at least one player to continue, or skip for now
            </p>
          )}
        </div>
      </WelcomeLayout>
    );
  }

  // Step 3: Share Event
  if (currentStep === 3 && createdEvent) {
    return (
      <WelcomeLayout contentClassName="min-h-screen" hideHeader={true} showOverlay={false}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-green-600">Event Ready!</h1>
          </div>
          
          <EventJoinCode event={createdEvent} league={selectedLeague} />
          
          {/* WIZARD GUIDANCE: What's Next */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 mt-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-sm">🧭</span>
              </div>
              <div className="text-left">
                <p className="text-blue-800 font-medium text-sm mb-1">What's Next?</p>
                <p className="text-blue-700 text-sm mb-2">
                  Your event is set up! Here are your next steps:
                </p>
                <ul className="text-blue-700 text-xs space-y-1 list-disc list-inside">
                  <li>Share the code/QR with coaches</li>
                  <li>Manage players and view rankings</li>
                  <li>Use Live Entry during your event</li>
                  <li>Export results when complete</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* IMPROVED NAVIGATION OPTIONS */}
          <div className="space-y-3">
            {/* Primary Actions */}
            <button
              onClick={() => {
                showSuccess('🎯 Opening Player Management - manage your roster and view real-time rankings');
                navigate('/players');
              }}
              className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              Manage Players & Rankings
            </button>
            
            <button
              onClick={() => {
                showSuccess('🚀 Opening Live Entry Mode - perfect for collecting drill results during your event');
                navigate('/live-entry');
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              ⚡ Start Live Entry Mode
            </button>
            
            {/* Secondary Actions */}
            <div className="pt-2 border-t border-gray-200 space-y-2">
              <button
                onClick={() => handleStepNavigation(2, '👥 Back to player management')}
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