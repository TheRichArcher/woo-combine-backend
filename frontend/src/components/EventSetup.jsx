import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { useToast } from "../context/ToastContext";
import api from '../lib/api';
import QRCode from 'react-qr-code';
import { cacheInvalidation } from '../utils/dataCache';
import { Upload, UserPlus, RefreshCcw, Users, Copy, Link2, QrCode, Edit, Hash, ArrowLeft } from 'lucide-react';
import CreateEventModal from "./CreateEventModal";
import EditEventModal from "./EditEventModal";
import { Link } from 'react-router-dom';
import { autoAssignPlayerNumbers } from '../utils/playerNumbering';
import { parseCsv, validateRow, validateHeaders, getMappingDescription, REQUIRED_HEADERS, generateDefaultMapping, applyMapping, ALL_HEADERS, OPTIONAL_HEADERS } from '../utils/csvUtils';
import DrillManager from "./drills/DrillManager";
import StaffManagement from "./StaffManagement";
import DeleteEventFlow from "./DeleteEventFlow";

const SAMPLE_ROWS = [
  ["Jane", "Smith", "9-10"],
  ["Alex", "Lee", "U12"],
  ["Sam", "Jones", "6U"],
  ["Maria", "Garcia", ""], // Example showing age group is optional
];

export default function EventSetup({ onBack }) {
  const { user, userRole, selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();
  const { notifyPlayerAdded, notifyPlayersUploaded, notifyError, showSuccess, showError, showInfo } = useToast();

  // CRITICAL: Create immutable snapshot of event at component mount
  // This prevents component from unmounting during deletion flow when selectedEvent becomes null
  const [eventSnapshot] = useState(() => selectedEvent);

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
  const [mappingConfidence, setMappingConfidence] = useState({});

  const [uploadStatus, setUploadStatus] = useState("idle"); // idle | loading | success | error
  const [uploadMsg, setUploadMsg] = useState("");
  const [backendErrors, setBackendErrors] = useState([]);
  const [isRosterOnlyImport, setIsRosterOnlyImport] = useState(false);

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
  const [schemaError, setSchemaError] = useState(null);

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
      if (window.location.hash === '#player-upload-section' || window.location.hash === '#player-upload') {
        const section = document.getElementById('player-upload-section');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      }
    };
    scrollToSection();
    window.addEventListener('hashchange', scrollToSection);
    return () => window.removeEventListener('hashchange', scrollToSection);
  }, []);

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
      const { mapping: initialMapping, confidence } = generateDefaultMapping(headers, drillDefinitions);
      setFieldMapping(initialMapping);
      setMappingConfidence(confidence);
      setOriginalCsvRows(rows); // Always save original rows

      // Enhanced validation with mapping type support
      const headerErrors = validateHeaders(headers, mappingType);

      // Always show mapping review to ensure accuracy
      setCsvHeaders(headers);
      setCsvRows(rows.map(r => ({ ...r, warnings: [] }))); // Show raw rows without warnings initially
      setCsvErrors(headerErrors);
      setShowMapping(true);

      if (headerErrors.length > 0) {
        showError(`⚠️ Column headers don't match. Please map fields to continue.`);
      } else {
        // Check if any fields need review
        const needsReview = Object.values(confidence).some(c => c !== 'high');
        if (needsReview) {
          showInfo(`⚠️ Some columns need review. Please check mappings marked "Review".`);
        } else {
          showInfo(`📋 Please confirm column mappings before importing.`);
        }
      }
    };
    reader.readAsText(file);
  };

  const canonicalHeaderLabels = {
    first_name: 'First Name',
    last_name: 'Last Name',
    jersey_number: 'Player #',
    age_group: 'Age Group',
    external_id: 'External ID',
    team_name: 'Team Name',
    position: 'Position',
    notes: 'Notes'
  };

  const handleApplyMapping = () => {
    // Check for roster-only import (no drill columns detected)
    const isRosterOnly = drillDefinitions.length === 0;
    if (isRosterOnly) {
      if (!window.confirm("Import roster only?\n\nNo drill score columns were detected.\nThis will import player names and info only — you can add scores later.\n\nHave scores now? Cancel and upload a file with drill columns.")) {
        return;
      }
      setIsRosterOnlyImport(true);
    } else {
      setIsRosterOnlyImport(false);
    }

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
      setSchemaError(null);
      return;
    }

    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const response = await api.get(`/events/${selectedEvent.id}/schema`);
      const drills = response.data?.drills || [];
      setDrillDefinitions(drills);
      if (drills.length === 0) {
        console.warn('Event schema returned no drills');
      }
    } catch (error) {
      console.error('Failed to fetch event schema:', error);
      setSchemaError("Failed to load event configuration. Drill scores may not import correctly.");
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
      
      // Filter out score-related errors for roster-only imports
      let relevantErrors = data.errors || [];
      if (isRosterOnlyImport && relevantErrors.length > 0) {
        // For roster-only imports, only show errors about missing required fields (names)
        relevantErrors = relevantErrors.filter(err => {
          const msg = err.message?.toLowerCase() || '';
          // Keep only critical errors about missing names
          return msg.includes('first name') || msg.includes('last name') || msg.includes('required');
        });
      }
      
      if (relevantErrors.length > 0) {
        setUploadStatus("error");
        setBackendErrors(relevantErrors);
        
        if (isRosterOnlyImport) {
          // Roster-only: downgrade to "rows skipped" language
          const skippedCount = relevantErrors.length;
          setUploadMsg(`${data.added || 0} players imported successfully. ${skippedCount} ${skippedCount === 1 ? 'row was' : 'rows were'} skipped due to missing required fields.`);
          showInfo(`📋 ${data.added || 0} players added. ${skippedCount} ${skippedCount === 1 ? 'row' : 'rows'} skipped.`);
        } else {
          // Normal import: show errors
          setUploadMsg("Some rows failed to upload. See errors below.");
          showError(`❌ Upload partially failed: ${relevantErrors.length} errors`);
        }
      } else {
        setUploadStatus("success");
        setBackendErrors([]);
        const numbersAssigned = playersWithNumbers.filter(p => {
          const fn = p.first_name?.trim();
          const ln = p.last_name?.trim();
          const match = cleanedPlayers.find(cp => cp.first_name?.trim() === fn && cp.last_name?.trim() === ln && (cp.jersey_number || cp.number));
          return !match;
        }).length;
        
        if (isRosterOnlyImport) {
          // Roster-only: confident success message
          setUploadMsg(`✅ Roster Imported Successfully! ${data.added} players added${numbersAssigned > 0 ? `, ${numbersAssigned} auto-numbered` : ''}.`);
        } else {
          // Normal import: standard success message
          setUploadMsg(`✅ Upload successful! ${data.added} players added${numbersAssigned > 0 ? `, ${numbersAssigned} auto-numbered` : ''}.`);
        }
        
        notifyPlayersUploaded(data.added);
        setCsvRows([]);
        setCsvHeaders([]);
        setCsvFileName("");
        cacheInvalidation.playersUpdated(selectedEvent.id);
        handlePostUploadSuccess();
        
        // Guidance for next steps
        setTimeout(() => {
            showInfo("🚀 Pro Tip: View your roster on the Players page or start Live Entry to add more results.");
        }, 1000);
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

  // Reupload button handler
  const handleReupload = () => {
    setCsvRows([]);
    setCsvHeaders([]);
    setCsvErrors([]);
    setCsvFileName("");
    setUploadStatus("idle");
    setUploadMsg("");
    setBackendErrors([]);
    setIsRosterOnlyImport(false);
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
        <div className="bg-white rounded-xl shadow-md p-6 text-center border-2 border-red-200">
            <h2 className="text-xl font-bold text-red-600 mb-2">Access Denied</h2>
            <p>You must be an organizer to view this page.</p>
        </div>
    );
  }

  // CRITICAL: Use eventSnapshot (immutable) instead of selectedEvent for validation
  // This keeps component mounted during deletion flow even after selectedEvent is cleared
  if (!eventSnapshot || !eventSnapshot.id) {
    return null; // Should be handled by parent
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-lg mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
            <button 
                onClick={onBack}
                className="bg-white p-2 rounded-full shadow-sm hover:bg-gray-50 border border-gray-200 transition"
            >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Event Setup</h1>
        </div>
        
        {/* Welcome Header */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-4 border-l-4 border-brand-primary">
          <h2 className="text-lg font-bold text-brand-secondary mb-1">
             {eventSnapshot.name}
          </h2>
          <p className="text-sm text-gray-600">
             {eventSnapshot.date && !isNaN(Date.parse(eventSnapshot.date)) ? new Date(eventSnapshot.date).toLocaleDateString() : "Date not set"} • {eventSnapshot.location || 'Location TBD'}
          </p>
        </div>

        {/* Step 1: Event Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {eventSnapshot.name}</p>
              <p><strong>Date:</strong> {eventSnapshot.date && !isNaN(Date.parse(eventSnapshot.date)) ? new Date(eventSnapshot.date).toLocaleDateString() : "Date not set"}</p>
              <p><strong>Location:</strong> {eventSnapshot.location || 'Location TBD'}</p>
              {eventSnapshot.notes && <p><strong>Notes:</strong> {eventSnapshot.notes}</p>}
            </div>
          </div>
          
          <button
            onClick={() => setShowEditEventModal(true)}
            className="bg-brand-primary hover:bg-brand-secondary text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Event Details
          </button>
        </div>

        {/* Step 2: Manage Drills */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <h2 className="text-lg font-semibold text-gray-900">Manage Drills</h2>
          </div>
          
          <DrillManager 
            event={eventSnapshot} 
            leagueId={selectedLeagueId} 
            isLiveEntryActive={eventSnapshot?.live_entry_active || false} 
          />
        </div>

        {/* Step 3: Add Players Section */}
        <div id="player-upload-section" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <h2 className="text-lg font-semibold text-gray-900">Add Players</h2>
          </div>
          
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 text-sm">💡</span>
              </div>
              <div>
                <p className="text-blue-800 font-medium text-sm mb-1">Upload Roster</p>
                <p className="text-blue-700 text-sm mb-2">
                  Upload your player list here. Only roster information is needed to start.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
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
              className="bg-brand-primary hover:bg-brand-secondary text-white font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Add Manual
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-semantic-success hover:bg-semantic-success/90 text-white font-medium px-4 py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Upload CSV
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
            <div ref={manualFormRef} className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-primary" />
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
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
                    className="flex-1 bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 text-white font-medium py-2 rounded-lg transition"
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
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition">
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
                <p className="text-sm text-gray-600 mb-3">Match our fields to the columns in your CSV. Only First and Last Name are required. Others are optional.</p>

                {/* Player Fields */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Player Information</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {[...REQUIRED_HEADERS, ...OPTIONAL_HEADERS].map((fieldKey) => (
                      <div key={fieldKey} className="flex items-center gap-3">
                        <div className="w-40 text-sm text-gray-700 font-medium">
                          <div className="flex items-center">
                            {canonicalHeaderLabels[fieldKey] || fieldKey}
                            {REQUIRED_HEADERS.includes(fieldKey) && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          {((fieldMapping[fieldKey] && fieldMapping[fieldKey] !== '__ignore__' && mappingConfidence[fieldKey] && mappingConfidence[fieldKey] !== 'high') || (!fieldMapping[fieldKey])) && (
                            <div className="text-xs text-amber-600 font-semibold mt-0.5">⚠️ Review Required</div>
                          )}
                        </div>
                        <select
                          value={fieldMapping[fieldKey] || ''}
                          onChange={(e) => setFieldMapping(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                          className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary ${
                            (!fieldMapping[fieldKey]) || (fieldMapping[fieldKey] && fieldMapping[fieldKey] !== '__ignore__' && mappingConfidence[fieldKey] && mappingConfidence[fieldKey] !== 'high')
                              ? 'border-amber-300 bg-amber-50' 
                              : 'border-gray-300'
                          }`}
                        >
                          <option value="">Select Column...</option>
                          <option value="__ignore__">Ignore (Don't Import)</option>
                          {csvHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleApplyMapping}
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-medium px-4 py-2 rounded-lg transition"
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
                  className="bg-brand-primary hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded-lg transition"
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
                </div>
              </div>
            )}

            {uploadStatus === "error" && (
              <div className={`${isRosterOnlyImport ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4 mt-4`}>
                <p className={`${isRosterOnlyImport ? 'text-blue-700' : 'text-red-700'} font-medium`}>{uploadMsg}</p>
                {Array.isArray(backendErrors) && backendErrors.length > 0 && (
                  <div className="mt-3">
                    <div className={`text-sm ${isRosterOnlyImport ? 'text-blue-800' : 'text-red-800'} font-medium mb-1`}>
                      {isRosterOnlyImport ? 'Rows Skipped' : 'Row Errors'}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className={isRosterOnlyImport ? 'bg-blue-100' : 'bg-red-100'}>
                            <th className="px-2 py-1 text-left">Row</th>
                            <th className="px-2 py-1 text-left">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backendErrors.map((err, idx) => (
                            <tr key={idx} className={`border-t ${isRosterOnlyImport ? 'border-blue-200' : 'border-red-200'}`}>
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
            <h2 className="text-lg font-semibold text-gray-900">Invite People to Event</h2>
          </div>
          
          <div className="space-y-6">
            {/* Coach Invitations */}
            <div className="bg-brand-light/20 border-l-4 border-brand-primary rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-brand-primary text-lg">👨‍🏫</span>
                <h3 className="text-lg font-semibold text-brand-secondary">Coach Invitations</h3>
                <span className="bg-brand-primary/20 text-brand-primary text-xs px-2 py-1 rounded-full font-medium">Read/Write Access</span>
              </div>
              
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
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step 5: Staff & Access Control */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">5</div>
            <h2 className="text-lg font-semibold text-gray-900">Staff & Access Control</h2>
          </div>
          
          <StaffManagement leagueId={selectedLeagueId} currentUser={user} />
        </div>

        {/* Step 6: Danger Zone - Advanced Options */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-red-300 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">⚠️</div>
            <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
          </div>
          
          <p className="text-sm text-gray-600 mb-6">
            These actions are destructive and cannot be easily undone. Use with extreme caution.
          </p>

          <div className="space-y-6">
            {/* Reset Player Data Section */}
            <div className="bg-orange-50/50 border border-orange-200 rounded-lg p-4">
              <h3 className="font-medium text-orange-700 mb-2 flex items-center gap-2">
                <RefreshCcw className="w-4 h-4 text-orange-600" />
                Reset Player Data
              </h3>
              <p className="text-orange-700/90 text-sm mb-3">
                ⚠️ This will permanently delete all player data for this event. The event itself will remain. Use only for testing or starting over.
              </p>
              
              <div className="space-y-3">
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type 'RESET' to confirm"
                  className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                
                <button
                  onClick={handleReset}
                  disabled={confirmInput !== "RESET" || status === "loading"}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition"
                >
                  {status === "loading" ? "Resetting..." : "Reset Player Data Only"}
                </button>
                
                {status === "success" && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
                    ✅ Player data has been reset successfully.
                  </div>
                )}
                
                {status === "error" && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    ❌ {errorMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-red-200"></div>

            {/* Delete Entire Event Section */}
            <div className="bg-red-50/50 border-2 border-red-300 rounded-lg p-4">
              <h3 className="font-bold text-red-700 mb-2 flex items-center gap-2 text-lg">
                🗑️ Delete Entire Event
              </h3>
              <p className="text-red-700 text-sm mb-4">
                <strong>EXTREME CAUTION:</strong> This permanently deletes the entire event including all players, scores, and settings. This action is intentionally difficult to prevent accidents.
              </p>
              
              <DeleteEventFlow 
                event={eventSnapshot}
                isCurrentlySelected={true}  // Always true when in Event Setup
                onSuccess={() => {
                  // Navigate away after successful deletion
                  if (onBack) onBack();
                }}
              />
            </div>
          </div>
        </div>

        {/* Edit Event Modal */}
        {showEditEventModal && (
          <EditEventModal
            open={showEditEventModal}
            event={eventSnapshot}
            onClose={() => setShowEditEventModal(false)}
            onUpdated={() => {
              setShowEditEventModal(false);
              // Refresh event data if needed
            }}
          />
        )}
      </div>
    </div>
  );
}
