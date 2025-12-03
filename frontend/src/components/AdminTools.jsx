import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { useToast } from "../context/ToastContext";
import EventSelector from "./EventSelector";
import api from '../lib/api';
import QRCode from 'react-qr-code';
import { cacheInvalidation } from '../utils/dataCache';
import { Upload, UserPlus, RefreshCcw, Users, Copy, Link2, QrCode, Edit, Hash } from 'lucide-react';
import CreateEventModal from "./CreateEventModal";
import EditEventModal from "./EditEventModal";
import { Link } from 'react-router-dom';
import { autoAssignPlayerNumbers } from '../utils/playerNumbering';
import { parseCsv, validateRow, validateHeaders, getMappingDescription, REQUIRED_HEADERS, generateDefaultMapping, applyMapping, ALL_HEADERS, OPTIONAL_HEADERS } from '../utils/csvUtils';
import DrillManager from "./drills/DrillManager";
import StaffManagement from "./StaffManagement";

const SAMPLE_ROWS = [
  ["Jane", "Smith", "9-10"],
  ["Alex", "Lee", "U12"],
  ["Sam", "Jones", "6U"],
  ["Maria", "Garcia", ""], // Example showing age group is optional
];

export default function AdminTools() {
  const { user, userRole, selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();
  const { notifyPlayerAdded, notifyPlayersUploaded, notifyError, showSuccess, showError, showInfo } = useToast();

  // Reset tool state
  const [confirmInput, setConfirmInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  // CSV upload state
  const [csvRows, setCsvRows] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [originalCsvRows, setOriginalCsvRows] = useState([]);
  const [showMapping, setShowMapping] = useState(false);
  const [fieldMapping, setFieldMapping] = useState({});

  const [uploadStatus, setUploadStatus] = useState("idle"); // idle | loading | success | error
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
  const [_manualErrors, setManualErrors] = useState([]);
  const [manualStatus, setManualStatus] = useState('idle');
  const [manualMsg, setManualMsg] = useState('');

  // Player count state
  const [playerCount, setPlayerCount] = useState(0);
  const [playerCountLoading, setPlayerCountLoading] = useState(false);

  // Drill definitions from event schema
  const [drillDefinitions, setDrillDefinitions] = useState([]);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const fileInputRef = useRef();
  const manualFormRef = useRef(null);

  // Invite to League section state
  const [showQr, setShowQr] = useState(false); // false | 'coach' | 'viewer'
  
  // Generate consistent invite links
  const inviteLink = (() => {
    if (!selectedEvent || !selectedLeagueId) {
      return '';
    }
    
    // Always use the new format: /join-event/{leagueId}/{eventId}
    return `https://woo-combine.com/join-event/${selectedLeagueId}/${selectedEvent.id}`;
  })();
    
  

  // Edit Event Modal state
  const [showEditEventModal, setShowEditEventModal] = useState(false);

  // Scroll to player upload section if hash is present or changes
  useEffect(() => {
    const scrollToSection = () => {
      if (window.location.hash === '#player-upload-section') {
        const section = document.getElementById('player-upload-section');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      }
    };
    scrollToSection();
    window.addEventListener('hashchange', scrollToSection);
    return () => window.removeEventListener('hashchange', scrollToSection);
  }, []);

  // QA logging
  useEffect(() => {
      // AdminTools component mounted
  }, [userRole, selectedEvent]);

  const handleReset = async () => {
    if (!selectedEvent || !user || !selectedLeagueId) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      await api.delete(`/players/reset?event_id=${selectedEvent.id}`);
      setStatus("success");
      setConfirmInput("");
      showSuccess(`🗑️ All player data for "${selectedEvent.name}" has been reset`);
      // Invalidate caches after destructive change
      cacheInvalidation.playersUpdated(selectedEvent.id);
      fetchPlayerCount(); // Refresh count
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Error during reset.");
      notifyError(err);
    }
  };

  const handleCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const { headers, rows, mappingType } = parseCsv(text);

      // Generate default mapping immediately with drill definitions
      const initialMapping = generateDefaultMapping(headers, drillDefinitions);
      setFieldMapping(initialMapping);
      setOriginalCsvRows(rows); // Always save original rows

      // Enhanced validation with mapping type support
      const headerErrors = validateHeaders(headers, mappingType);

      if (headerErrors.length > 0) {
        // Case 1: Invalid headers - Force mapping, no validation yet
        setCsvHeaders(headers);
        setCsvRows(rows.map(r => ({ ...r, warnings: [] }))); // Show raw rows without warnings
        setCsvErrors(headerErrors);
        setShowMapping(true);
        showError(`⚠️ Column headers don't match. Please map fields to continue.`);
        return;
      }

      // Case 2: Valid headers (direct or synonyms) - Auto-apply mapping & validate
      const mappedRows = applyMapping(rows, initialMapping, drillDefinitions);
      const validatedRows = mappedRows.map(row => validateRow(row, drillDefinitions));

      // Determine active headers for preview (canonical + drill headers)
      const selectedCanonical = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].filter(key => {
        const source = initialMapping[key];
        return source && source !== '__ignore__';
      });
      const selectedDrills = drillDefinitions.filter(drill => {
        const source = initialMapping[drill.key];
        return source && source !== '__ignore__';
      }).map(drill => drill.key);

      const previewHeaders = [...selectedCanonical, ...selectedDrills];
      if (previewHeaders.length === 0) {
        previewHeaders.push(...REQUIRED_HEADERS);
      }

      setCsvHeaders(previewHeaders);
      setCsvRows(validatedRows);
      setCsvErrors([]);
      setShowMapping(false);

      // Count validation issues on MAPPED rows
      const rowsWithErrors = validatedRows.filter(row => row.warnings.length > 0);
      const criticalErrors = validatedRows.filter(row =>
        row.warnings.some(w => w.includes("Missing first name") || w.includes("Missing last name"))
      );
      const validPlayers = validatedRows.filter(row => row.isValid);

      // Show appropriate feedback based on TRUE validation results
      if (criticalErrors.length > 0) {
        showInfo(`⚠️ ${criticalErrors.length} players are missing first or last names. You can continue — those rows will be skipped.`);
      } else if (rowsWithErrors.length > 0) {
        showInfo(`⚠️ ${validPlayers.length} players ready, ${rowsWithErrors.length} have warnings. Review table below.`);
      } else {
        const mappingDesc = getMappingDescription(mappingType);
        showSuccess(`✅ ${rows.length} players validated successfully! ${mappingDesc}`);
      }
    };
    reader.readAsText(file);
  };

  const canonicalHeaderLabels = {
    first_name: 'First Name',
    last_name: 'Last Name',
    jersey_number: 'Jersey #',
    age_group: 'Age Group',
    external_id: 'External ID',
    team_name: 'Team Name',
    position: 'Position',
    notes: 'Notes'
  };

  const handleApplyMapping = () => {
    const mapped = applyMapping(originalCsvRows, fieldMapping, drillDefinitions);
    const validated = mapped.map(row => validateRow(row, drillDefinitions));
    const selectedCanonical = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].filter(key => {
      const source = fieldMapping[key];
      return source && source !== '__ignore__';
    });
    const selectedDrills = drillDefinitions.filter(drill => {
      const source = fieldMapping[drill.key];
      return source && source !== '__ignore__';
    }).map(drill => drill.key);

    const headersForPreview = [...selectedCanonical, ...selectedDrills];
    if (headersForPreview.length === 0) {
      headersForPreview.push(...REQUIRED_HEADERS);
    }

    setCsvHeaders(headersForPreview);
    setCsvRows(validated);
    setCsvErrors([]);
    setShowMapping(false);
    // Immediately start import after applying mapping to reduce steps
    showSuccess(`✅ Mapping applied. Importing ${validated.length} players...`);
    // Kick off upload using validated rows
    setTimeout(() => handleUpload(), 0);
  };

  // Allow upload if we have valid players with first and last names
  const hasValidPlayers = csvErrors.length === 0 && csvRows.length > 0 && csvRows.some(r => r.name && r.name.trim() !== "");

  // Fetch event schema to get drill definitions
  const fetchEventSchema = useCallback(async () => {
    if (!selectedEvent) {
      setDrillDefinitions([]);
      return;
    }

    setSchemaLoading(true);
    try {
      const response = await api.get(`/events/${selectedEvent.id}/schema`);
      setDrillDefinitions(response.data?.drills || []);
    } catch (error) {
      console.error('Failed to fetch event schema:', error);
      setDrillDefinitions([]);
    } finally {
      setSchemaLoading(false);
    }
  }, [selectedEvent]);

  // Fetch player count for summary badge
  const fetchPlayerCount = useCallback(async () => {
    if (!selectedEvent || !user || !selectedLeagueId) return;
    setPlayerCountLoading(true);
    try {
      const { data } = await api.get(`/players?event_id=${selectedEvent.id}`);
      setPlayerCount(Array.isArray(data) ? data.length : 0);
    } catch (error) {
              if (error.response?.status === 404) {
          // 404 means no players found yet - normal for new events
        setPlayerCount(0);
      } else {
        // Other errors are actual problems
        setPlayerCount(0);
      }
    } finally {
      setPlayerCountLoading(false);
    }
  }, [selectedEvent, user, selectedLeagueId]);

  useEffect(() => {
    fetchPlayerCount();
  }, [selectedEvent, user, selectedLeagueId, fetchPlayerCount]);

  useEffect(() => {
    fetchEventSchema();
  }, [selectedEvent, fetchEventSchema]);

  // Call this after upload or manual add
  const handlePostUploadSuccess = () => {
    fetchPlayerCount();
  };

  const handleUpload = async () => {
    if (!selectedEvent || !user || !selectedLeagueId) return;
    setUploadStatus("loading");
    setUploadMsg("");
    setBackendErrors([]);
    
    // Prepare players and auto-assign numbers
    const cleanedPlayers = csvRows.map(row => { const { warnings: _warnings, ...rest } = row; return rest; });
    // Normalize for numbering: use `number` field expected by autoAssign
    const rowsForNumbering = cleanedPlayers.map(r => ({ ...r, number: r.jersey_number ?? r.number }));
    // Ensure jersey_number present (auto-assign if missing)
    const playersWithNumbers = autoAssignPlayerNumbers(rowsForNumbering).map(p => ({
      ...p,
      jersey_number: p.jersey_number || p.number || p.number === 0 ? p.number : p.jersey_number
    }));
    
    // Shape per contract - include drill scores
    const payload = {
      event_id: selectedEvent.id,
      players: playersWithNumbers.map(r => {
        const playerData = {
          first_name: r.first_name,
          last_name: r.last_name,
          age_group: r.age_group,
          jersey_number: r.jersey_number || r.number,
          external_id: r.external_id,
          team_name: r.team_name,
          position: r.position,
          notes: r.notes,
        };

        // Add drill scores if they exist
        drillDefinitions.forEach(drill => {
          if (r[drill.key] && r[drill.key].trim() !== '') {
            const score = parseFloat(r[drill.key]);
            if (!isNaN(score)) {
              playerData[drill.key] = score;
            }
          }
        });

        return playerData;
      })
    };
    
    try {
       const res = await api.post(`/players/upload`, payload);
      const { data } = res;
      if (data.errors && data.errors.length > 0) {
        setUploadStatus("error");
        setUploadMsg("Some rows failed to upload. See errors below.");
        showError(`❌ Upload partially failed: ${data.errors.length} errors`);
      } else {
        setUploadStatus("success");
        const numbersAssigned = playersWithNumbers.filter(p => {
          const fn = p.first_name?.trim();
          const ln = p.last_name?.trim();
          const match = cleanedPlayers.find(cp => cp.first_name?.trim() === fn && cp.last_name?.trim() === ln && (cp.jersey_number || cp.number));
          return !match;
        }).length;
        setUploadMsg(`✅ Upload successful! ${data.added} players added${numbersAssigned > 0 ? `, ${numbersAssigned} auto-numbered` : ''}.`);
        notifyPlayersUploaded(data.added);
        setCsvRows([]);
        setCsvHeaders([]);
        setCsvFileName("");
        cacheInvalidation.playersUpdated(selectedEvent.id);
        handlePostUploadSuccess();
      }
    } catch (err) {
      setUploadStatus("error");
      setUploadMsg(`❌ ${err.message || "Upload failed."}`);
      notifyError(err);
    }
  };

  // Manual add player logic
  const handleManualChange = (e) => {
    setManualPlayer({ ...manualPlayer, [e.target.name]: e.target.value });
  };
  const validateManual = () => {
    const errors = [];
    if (!manualPlayer.first_name || manualPlayer.first_name.trim() === "") {
      errors.push("Missing first name");
    }
    if (!manualPlayer.last_name || manualPlayer.last_name.trim() === "") {
      errors.push("Missing last name");
    }
    if (manualPlayer.number && manualPlayer.number.trim() !== "" && isNaN(Number(manualPlayer.number))) {
      errors.push("Invalid number");
    }
    // Age group is flexible - any text is allowed
    return errors;
  };
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualErrors([]);
    setManualStatus('idle');
    setManualMsg('');
    const errors = validateManual();
    if (errors.length > 0) {
      setManualErrors(errors);
      showError(`❌ Please fix: ${errors.join(", ")}`);
      return;
    }
    setManualStatus('loading');
    try {
      // Auto-assign player number if not provided
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
      
      await api.post(`/players?event_id=${selectedEvent.id}`, playerPayload);
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
      // Don't hide form immediately - let user see next steps
      cacheInvalidation.playersUpdated(selectedEvent.id);
      handlePostUploadSuccess();
      // Reset status after success message is shown
      setTimeout(() => {
        setManualStatus('idle');
        setManualMsg('');
      }, 3000);
    } catch (err) {
      setManualStatus('error');
      setManualMsg(err.message || 'Failed to add player.');
      notifyError(err);
    }
  };

  // Download sample CSV
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

  // Onboarding callout for admin
  const AdminOnboardingCallout = () => (
    <div className="bg-cmf-primary/10 border-l-4 border-cmf-primary text-cmf-primary px-4 py-3 mb-6 rounded">
      <strong>Welcome, Admin.</strong> Manage your combine tools below.
    </div>
  );

  // Remove unused drill tip variable

  // Reupload button handler
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

  // Copy functionality with notifications
  const handleCopyInviteLink = (role) => {
    const linkToCopy = role ? `${inviteLink}/${role}` : inviteLink;
    navigator.clipboard.writeText(linkToCopy);
    const roleText = role ? ` (${role.charAt(0).toUpperCase() + role.slice(1)})` : '';
    showSuccess(`📋 Invite link${roleText} copied to clipboard!`);
  };

  if (userRole !== 'organizer') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">Admin Access Required</h2>
            <p className="text-gray-600 mb-6">You do not have permission to view this page. Organizer access required.</p>
            
            <div className="space-y-3">
              <Link
                to="/players/rankings"
                className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-semibold py-3 rounded-xl transition block"
              >
                View Rankings
              </Link>
              <Link
                to="/dashboard"
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition block"
              >
                Back to Dashboard
              </Link>
              {userRole === 'coach' && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    <strong>Need admin access?</strong> Contact your league organizer to request permissions.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedEvent || !selectedEvent.id) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border-2 border-cmf-primary/30">
            <div className="w-16 h-16 bg-cmf-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-cmf-primary" />
            </div>
            <h2 className="text-2xl font-bold text-cmf-primary mb-4">No Event Selected</h2>
            <p className="text-gray-600 mb-6">Click on "Select Event" in the header above to choose an event before managing players.</p>
            <button
              onClick={() => window.location.href = '/select-league'}
              className="bg-cmf-primary text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-cmf-secondary transition"
            >
              Select Event
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-4">
        
        {/* Welcome Header - matching dashboard style */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-cmf-primary/30">
          <h1 className="text-2xl font-bold text-cmf-secondary mb-2">
            Admin Tools
          </h1>
          <p className="text-gray-600 mb-4">
            Managing: <strong>{selectedEvent.name}</strong> - {selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) ? new Date(selectedEvent.date).toLocaleDateString() : "Invalid Date"}
          </p>
          
          {/* Player Summary */}
          {selectedEvent && (
            <div className="bg-cmf-primary/10 rounded-lg p-4 border border-cmf-primary/20">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-cmf-primary" />
                <span className="text-cmf-primary font-semibold">
                  {playerCountLoading ? (
                    <span className="animate-pulse">Loading players...</span>
                  ) : (
                    `${playerCount} Players Uploaded`
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Step 1: Event Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-cmf-primary text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {selectedEvent.name}</p>
              <p><strong>Date:</strong> {selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) ? new Date(selectedEvent.date).toLocaleDateString() : "Invalid Date"}</p>
              <p><strong>Location:</strong> {selectedEvent.location || 'Location TBD'}</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowEditEventModal(true)}
            className="bg-cmf-primary hover:bg-cmf-secondary text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Event Details
          </button>
        </div>

        {/* Step 2: Manage Drills */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-cmf-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <h2 className="text-lg font-semibold text-gray-900">Manage Drills</h2>
          </div>
          
          <DrillManager 
            event={selectedEvent} 
            leagueId={selectedLeagueId} 
            isLiveEntryActive={selectedEvent?.live_entry_active || false} 
          />
        </div>

        {/* Step 3: Add Players Section */}
        <div id="player-upload-section" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-cmf-primary text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <h2 className="text-lg font-semibold text-gray-900">Add Players to Your Event</h2>
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
                  Drill results will be collected during your combine event using this program.
                </p>
              </div>
            </div>
          </div>

          {/* Auto-Numbering Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Hash className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-green-800 font-medium text-sm mb-1">Smart Auto-Numbering</p>
                <p className="text-green-700 text-sm mb-2">
                  Player numbers are automatically generated for easy Live Entry lookup:
                </p>
                <div className="text-xs text-green-600 space-y-1">
                  <div>- <strong>12U players:</strong> 1201, 1202, 1203...</div>
                  <div>- <strong>8U players:</strong> 801, 802, 803...</div>
                  <div>- <strong>Lil' Ballers:</strong> 501, 502, 503...</div>
                  <div>- <strong>Other groups:</strong> Smart number ranges</div>
                </div>
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
                      placeholder="Enter first name"
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
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Player Number
                      <span className="text-xs text-gray-500 ml-1">(Auto-generated if empty)</span>
                    </label>
                    <input
                      type="number"
                      name="number"
                      value={manualPlayer.number}
                      onChange={handleManualChange}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                      placeholder="Leave empty for auto-generated"
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

          {/* CSV Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50 hover:bg-gray-100 transition">
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
              <div className="flex items-center justify-center gap-3 mb-3">
                <button
                  onClick={() => setShowMapping(true)}
                  className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg transition"
                >
                  Map Fields
                </button>
                <button
                  onClick={handleReupload}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition"
                >
                  Choose Different File
                </button>
              </div>
            )}
            
            {csvFileName && (
              <div className="text-sm text-gray-600 mb-2">
                📄 {csvFileName} loaded ({csvRows.length} players)
                <div className="text-xs text-gray-500">🎉 CSV file loaded. Next, click <span className="font-semibold">Map Fields</span> to match your columns to our fields.</div>
              </div>
            )}

            {csvErrors.length > 0 && !showMapping && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm font-medium">❌ Upload Error</p>
                <p className="text-red-600 text-sm">{csvErrors.join('; ')}</p>
              </div>
            )}

            {showMapping && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 text-left">
                <h3 className="font-medium text-gray-900 mb-2">Match Column Headers</h3>
                <p className="text-sm text-gray-600 mb-3">Match our fields to the columns in your CSV. Only First and Last Name are required. Others are optional. Select "Ignore" to skip a field.</p>

                {/* Player Fields */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Player Information</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {[...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].map((fieldKey) => (
                      <div key={fieldKey} className="flex items-center gap-3">
                        <div className="w-40 text-sm text-gray-700 font-medium">
                          {canonicalHeaderLabels[fieldKey] || fieldKey}
                          {REQUIRED_HEADERS.includes(fieldKey) && <span className="text-red-500 ml-1">*</span>}
                        </div>
                        <select
                          value={fieldMapping[fieldKey] || ''}
                          onChange={(e) => setFieldMapping(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                        >
                          <option value="">Auto</option>
                          <option value="__ignore__">Ignore</option>
                          {csvHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Drill Fields */}
                {drillDefinitions.length > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Drill Scores ({drillDefinitions.length} drills available)</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {drillDefinitions.map((drill) => (
                        <div key={drill.key} className="flex items-center gap-3">
                          <div className="w-40 text-sm text-gray-700 font-medium">
                            {drill.label}
                            <span className="text-xs text-gray-500 ml-1">({drill.unit})</span>
                          </div>
                          <select
                            value={fieldMapping[drill.key] || ''}
                            onChange={(e) => setFieldMapping(prev => ({ ...prev, [drill.key]: e.target.value }))}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
                          >
                            <option value="">Auto</option>
                            <option value="__ignore__">Ignore</option>
                            {csvHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleApplyMapping}
                    className="bg-cmf-primary hover:bg-cmf-secondary text-white font-medium px-4 py-2 rounded-lg transition"
                  >
                    Apply Mapping & Import
                  </button>
                  <button
                    onClick={() => setShowMapping(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* CSV Preview Table */}
            {Array.isArray(csvRows) && csvRows.length > 0 && csvErrors.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-3">Preview ({csvRows.length} players)</h3>
                <div className="overflow-x-auto max-h-64" role="table" aria-label="CSV Preview">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">#</th>
                        {Array.isArray(csvHeaders) && csvHeaders.map(h => (
                          <th key={h} className="px-3 py-2 text-left">
                            {h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-left">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {csvRows.map((row, i) => {
                        const hasWarnings = row.warnings.length > 0;
                        const hasCriticalErrors = row.warnings.some(w => w.includes("Missing first name") || w.includes("Missing last name"));
                        const isUploadable = row.name && row.name.trim() !== "";
                        
                        return (
                          <tr key={i} className={hasCriticalErrors ? "bg-red-50" : hasWarnings ? "bg-yellow-50" : "bg-green-50"}>
                            <td className="px-3 py-2 text-center" aria-label={isUploadable ? 'Valid row' : 'Invalid row'}>
                              {!isUploadable ? "❌" : "✅"}
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-500">{i + 1}</td>
                            {csvHeaders.map(h => (
                              <td key={h} className="px-3 py-2">{row[h]}</td>
                            ))}
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {row.warnings.length > 0 ? row.warnings.join(", ") : "Valid"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Upload Actions */}
            {Array.isArray(csvRows) && csvRows.length > 0 && (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleReupload}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Upload Different File
                </button>
                <button
                  disabled={!hasValidPlayers || uploadStatus === "loading"}
                  onClick={handleUpload}
                  className="bg-cmf-primary hover:bg-cmf-secondary disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded-lg transition"
                >
                  {uploadStatus === "loading" ? "Importing..." : "Import Players"}
                </button>
              </div>
            )}

            {/* Upload Status Messages */}
            {uploadStatus === "success" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-sm">✅</span>
                  </div>
                  <p className="text-green-800 font-medium">{uploadMsg}</p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleReupload}
                    className="w-full bg-white border border-green-300 text-green-700 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition"
                  >
                    📂 Upload More Players
                  </button>
                  <Link
                    to="/players/roster"
                    className="block w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition text-center"
                  >
                    🏈 View Roster
                  </Link>
                </div>
              </div>
            )}

            {uploadStatus === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                <p className="text-red-700 font-medium">{uploadMsg}</p>
                {Array.isArray(backendErrors) && backendErrors.length > 0 && (
                  <div className="mt-3">
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
            )}
          </div>


        </div>

        {/* Step 4: Invite Coaches & Share */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-cmf-primary text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
            <h2 className="text-lg font-semibold text-gray-900">Invite People to Event</h2>
          </div>
          
          <div className="bg-semantic-warning/10 border border-semantic-warning/30 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-semantic-warning/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-semantic-warning text-sm">🔒</span>
              </div>
              <div>
                <p className="text-semantic-warning font-medium text-sm mb-1">Secure Role-Based Invitations</p>
                <p className="text-semantic-warning/80 text-sm">
                  Share the appropriate QR code based on the access level you want to grant. This prevents unauthorized role escalation.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Coach Invitations */}
            <div className="bg-brand-light/20 border-l-4 border-brand-primary rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-brand-primary text-lg">👨‍🏫</span>
                <h3 className="text-lg font-semibold text-brand-secondary">Coach Invitations</h3>
                <span className="bg-brand-primary/20 text-brand-primary text-xs px-2 py-1 rounded-full font-medium">Read/Write Access</span>
              </div>
              <p className="text-brand-primary/80 text-sm mb-3">
                For refs, coaches, and staff who need to view and modify drill scores
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-brand-primary mb-1">Coach Invitation Link</label>
                  <div className="bg-white border border-brand-primary/20 rounded-lg p-3 text-sm text-center break-all">
                    {inviteLink ? `${inviteLink}/coach` : 'Loading...'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyInviteLink('coach')}
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-medium px-3 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    disabled={!inviteLink}
                  >
                    <Copy className="w-4 h-4" />
                    Copy Coach Link
                  </button>
                  <button
                    onClick={() => {
                      setShowQr(showQr === 'coach' ? false : 'coach');
                      if (showQr !== 'coach') showInfo('📱 Coach QR code displayed');
                    }}
                    className="bg-brand-primary/90 hover:bg-brand-primary text-white font-medium px-3 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                  >
                    <QrCode className="w-4 h-4" />
                    Coach QR
                  </button>
                </div>
                
                {showQr === 'coach' && (
                  <div className="bg-white rounded-lg p-4 text-center border border-brand-primary/20">
                    <QRCode key={`${inviteLink}/coach`} value={`${inviteLink}/coach`} size={150} className="mx-auto mb-2" />
                    <p className="text-xs text-brand-primary font-medium">🔵 COACH ACCESS QR CODE</p>
                    <p className="text-xs text-gray-500">Grants read/write permissions</p>
                  </div>
                )}
              </div>
            </div>

            {/* Viewer Invitations */}
            <div className="bg-semantic-success/10 border-l-4 border-semantic-success rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-semantic-success text-lg">👥</span>
                <h3 className="text-lg font-semibold text-semantic-success">Viewer Invitations</h3>
                <span className="bg-semantic-success/20 text-semantic-success text-xs px-2 py-1 rounded-full font-medium">Read-Only Access</span>
              </div>
              <p className="text-semantic-success/80 text-sm mb-3">
                For parents, siblings, and spectators who should only view results
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-semantic-success mb-1">Viewer Invitation Link</label>
                  <div className="bg-white border border-semantic-success/30 rounded-lg p-3 text-sm text-center break-all">
                    {inviteLink ? `${inviteLink}/viewer` : 'Loading...'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyInviteLink('viewer')}
                    className="bg-semantic-success hover:bg-green-700 text-white font-medium px-3 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                    disabled={!inviteLink}
                  >
                    <Copy className="w-4 h-4" />
                    Copy Viewer Link
                  </button>
                  <button
                    onClick={() => {
                      setShowQr(showQr === 'viewer' ? false : 'viewer');
                      if (showQr !== 'viewer') showInfo('📱 Viewer QR code displayed');
                    }}
                    className="bg-semantic-success/90 hover:bg-semantic-success text-white font-medium px-3 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                  >
                    <QrCode className="w-4 h-4" />
                    Viewer QR
                  </button>
                </div>
                
                {showQr === 'viewer' && (
                  <div className="bg-white rounded-lg p-4 text-center border border-semantic-success/30">
                    <QRCode key={`${inviteLink}/viewer`} value={`${inviteLink}/viewer`} size={150} className="mx-auto mb-2" />
                    <p className="text-xs text-semantic-success font-medium">🟢 VIEWER ACCESS QR CODE</p>
                    <p className="text-xs text-gray-500">Grants read-only permissions</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-gray-600 text-sm">💡</span>
                </div>
                <div>
                  <p className="text-gray-800 font-medium text-sm mb-1">Security Best Practices</p>
                  <ul className="text-gray-700 text-xs space-y-1">
                    <li>- Share <strong>Coach QR codes</strong> only with trusted staff who need to enter/modify scores</li>
                    <li>- Share <strong>Viewer QR codes</strong> with parents and spectators for read-only access</li>
                    <li>- Each QR code enforces the intended role - no way to escalate permissions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 5: Staff & Access Control */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-cmf-primary text-white rounded-full flex items-center justify-center text-sm font-bold">5</div>
            <h2 className="text-lg font-semibold text-gray-900">Staff & Access Control</h2>
          </div>
          
          <StaffManagement leagueId={selectedLeagueId} currentUser={user} />
        </div>

        {/* Step 6: Live Drill Entry */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-cmf-primary text-white rounded-full flex items-center justify-center text-sm font-bold">6</div>
            <h2 className="text-lg font-semibold text-gray-900">Live Drill Entry</h2>
          </div>
          
          <div className="bg-gradient-to-r from-semantic-success/10 to-semantic-success/20 border border-semantic-success/30 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-semantic-success/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-semantic-success text-sm">🚀</span>
              </div>
              <div>
                <p className="text-semantic-success font-medium text-sm mb-1">High-Speed Data Entry Mode</p>
                <p className="text-semantic-success/80 text-sm">
                  Optimized for live events - rapid player lookup, auto-focus, duplicate detection, and mobile-friendly interface for outdoor use.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2 text-sm text-gray-700">
                <p>- <strong>5 Drill Types:</strong> 40-Yard Dash, Vertical Jump, Catching, Throwing, Agility</p>
                <p>- <strong>Auto-Complete:</strong> Type player number for instant lookup</p>
                <p>- <strong>Smart Features:</strong> Duplicate detection, undo functionality, recent entries</p>
                <p>- <strong>Mobile Optimized:</strong> Large touch targets, number pad inputs</p>
              </div>
            </div>
            
            <Link
              to="/live-entry"
              className="block w-full bg-gradient-to-r from-semantic-success to-semantic-success/90 hover:from-semantic-success/90 hover:to-semantic-success text-white font-bold px-6 py-4 rounded-xl transition text-center shadow-lg"
              onClick={() => showInfo('🚀 Entering Live Entry mode - perfect for recording drill results during your event')}
            >
              🚀 Start Live Entry Mode
            </Link>
            
            {playerCount > 0 && (
              <div className="bg-brand-light/20 border border-brand-primary/20 rounded-lg p-3">
                <p className="text-brand-primary text-sm">
                  <strong>Ready to go!</strong> {playerCount} players uploaded. You can now begin entering drill results during your combine event.
                </p>
              </div>
            )}
            
            {playerCount === 0 && (
              <div className="bg-semantic-warning/10 border border-semantic-warning/30 rounded-lg p-3">
                <p className="text-semantic-warning text-sm">
                  <strong>Upload players first:</strong> Add players in Step 2 before starting live drill entry.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Step 7: Advanced Options */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gray-500 text-white rounded-full flex items-center justify-center text-sm font-bold">7</div>
            <h2 className="text-lg font-semibold text-gray-900">Advanced Options</h2>
          </div>
          
          <div className="space-y-4">
            {/* Export Options */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gray-600" />
                Export & Share
              </h3>
              <div className="space-y-2">
                <Link
                  to="/players/rankings"
                  className="block w-full bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition text-center"
                  onClick={() => showInfo('📊 Viewing comprehensive player rankings with export options')}
                >
                  📊 View Rankings & Export CSV
                </Link>
                <p className="text-xs text-gray-600">
                  Access comprehensive rankings with weight adjustments and CSV export functionality.
                </p>
              </div>
            </div>

            {/* Reset Section */}
            <div className="bg-semantic-error/10 border border-semantic-error/20 rounded-lg p-4">
              <h3 className="font-medium text-semantic-error mb-2 flex items-center gap-2">
                <RefreshCcw className="w-4 h-4 text-semantic-error" />
                Reset Event Data
              </h3>
              <p className="text-semantic-error/90 text-sm mb-3">
                ⚠️ This will permanently delete all player data for this event. Use only for testing or starting over.
              </p>
              
              <div className="space-y-3">
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type 'RESET' to confirm"
                  className="w-full border border-red-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-semantic-error focus:border-semantic-error"
                />
                
                <button
                  onClick={handleReset}
                  disabled={confirmInput !== "RESET" || status === "loading"}
                  className="w-full bg-semantic-error hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition"
                >
                  {status === "loading" ? "Resetting..." : "Reset All Event Data"}
                </button>
                
                {status === "success" && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
                    ✅ Event data has been reset successfully.
                  </div>
                )}
                
                {status === "error" && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    ❌ {errorMsg}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Event Modal */}
        {showEditEventModal && (
          <EditEventModal
            open={showEditEventModal}
            event={selectedEvent}
            onClose={() => setShowEditEventModal(false)}
            onUpdated={() => {
              setShowEditEventModal(false);
              // Refresh event data if needed
            }}
          />
        )}
      </div>
  );
}
