import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { useToast } from "../context/ToastContext";
import api from '../lib/api';
import QRCode from 'react-qr-code';
import { cacheInvalidation } from '../utils/dataCache';
import { Upload, UserPlus, RefreshCcw, Users, Copy, Link2, QrCode, Edit, Hash, ArrowLeft, FileText } from 'lucide-react';
import CreateEventModal from "./CreateEventModal";
import EditEventModal from "./EditEventModal";
import ImportResultsModal from "./Players/ImportResultsModal";
import AddPlayerModal from "./Players/AddPlayerModal";
import { Link, useNavigate } from 'react-router-dom';
import DrillManager from "./drills/DrillManager";
import StaffManagement from "./StaffManagement";
import DeleteEventFlow from "./DeleteEventFlow";
import * as Sentry from '@sentry/react';

export default function EventSetup({ onBack }) {
  const { user, userRole, selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();
  const { notifyPlayerAdded, notifyPlayersUploaded, notifyError, showSuccess, showError, showInfo } = useToast();
  const navigate = useNavigate();

  // CRITICAL: Create immutable snapshot of event at component mount
  // This prevents component from unmounting during deletion flow when selectedEvent becomes null
  const [eventSnapshot] = useState(() => selectedEvent);

  // Reset tool state
  const [confirmInput, setConfirmInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  // Import modal state (replaces CSV upload state)
  const [showImportModal, setShowImportModal] = useState(false);

  // Add player modal state (replaces inline manual form)
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  
  // Players list for AddPlayerModal (empty array is fine, modal will work)
  const [players, setPlayers] = useState([]);

  // Player count state
  const [playerCount, setPlayerCount] = useState(0);
  const [playerCountLoading, setPlayerCountLoading] = useState(false);

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
      setConfirmedRequiredFields(new Set()); // Reset confirmations for new upload

      if (headerErrors.length > 0) {
        showError(`⚠️ Column headers don't match. Please map fields to continue.`);
      } else {
        // Only check if REQUIRED fields need review (not optional fields)
        // Field needs review if: missing OR (not high confidence AND not confirmed)
        const requiredFieldsNeedReview = REQUIRED_HEADERS.some(key => {
          const fieldConfidence = confidence[key] || 'low';
          const hasMappedValue = initialMapping[key] && initialMapping[key] !== '__ignore__';
          if (!hasMappedValue) return true; // Missing
          if (fieldConfidence === 'high') return false; // High confidence = no review needed
          return !confirmedRequiredFields.has(key); // Needs review if not confirmed
        });
        
        if (requiredFieldsNeedReview) {
          showInfo(`⚠️ Please confirm required field mappings before importing.`);
        } else {
          showInfo(`✓ Required fields look good! Review mappings and click Import.`);
        }
      }
    };
    reader.readAsText(file);
  };

  // ROBUST DRAG-AND-DROP: Capture-phase handlers on container
  // Safari-optimized with explicit dropEffect
  const handleDragEnterCapture = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Safari needs dropEffect set early
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    
    dragCounter.current++;
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeaveCapture = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOverCapture = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // CRITICAL for Safari: Must set dropEffect on EVERY dragover
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
      // Safari sometimes needs effectAllowed too
      e.dataTransfer.effectAllowed = 'copy';
    }
  }, []);

  const handleDropCapture = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;

    if (files && files.length > 0) {
      const file = files[0];
      
      // Check if it's a CSV file
      if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.CSV')) {
        // Trigger the same processing as file input
        setCsvFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = evt.target.result;
          const { headers, rows, mappingType } = parseCsv(text);

          // Generate default mapping immediately with drill definitions
          const { mapping: initialMapping, confidence } = generateDefaultMapping(headers, drillDefinitions);
          setFieldMapping(initialMapping);
          setMappingConfidence(confidence);
          setOriginalCsvRows(rows);

          // Enhanced validation with mapping type support
          const headerErrors = validateHeaders(headers, mappingType);

          // Always show mapping review to ensure accuracy
          setCsvHeaders(headers);
          setCsvRows(rows.map(r => ({ ...r, warnings: [] })));
          setCsvErrors(headerErrors);
          setShowMapping(true);
          setConfirmedRequiredFields(new Set()); // Reset confirmations for new upload

          if (headerErrors.length > 0) {
            showError(`⚠️ Column headers don't match. Please map fields to continue.`);
          } else {
            // Only check if REQUIRED fields need review (not optional fields)
            // Field needs review if: missing OR (not high confidence AND not confirmed)
            const requiredFieldsNeedReview = REQUIRED_HEADERS.some(key => {
              const fieldConfidence = confidence[key] || 'low';
              const hasMappedValue = initialMapping[key] && initialMapping[key] !== '__ignore__';
              if (!hasMappedValue) return true; // Missing
              if (fieldConfidence === 'high') return false; // High confidence = no review needed
              return !confirmedRequiredFields.has(key); // Needs review if not confirmed
            });
            
            if (requiredFieldsNeedReview) {
              showInfo(`⚠️ Please confirm required field mappings before importing.`);
            } else {
              showInfo(`✓ Required fields look good! Review mappings and click Import.`);
            }
          }
        };
        reader.readAsText(file);
        showSuccess('📄 CSV file dropped successfully!');
      } else {
        showError('❌ Please drop a CSV file (.csv extension required)');
      }
    }
  }, [showError, showInfo, showSuccess, drillDefinitions, confirmedRequiredFields]);

  const canonicalHeaderLabels = {
    first_name: 'First Name',
    last_name: 'Last Name',
    number: 'Player #',
    jersey_number: 'Player #', // Legacy support
    age_group: 'Age Group',
    external_id: 'External ID',
    team_name: 'Team Name',
    position: 'Position',
    notes: 'Notes'
  };

  // Helper text for each field
  const fieldHelperText = {
    first_name: "Choose the column that contains the player's first name",
    last_name: "Choose the column that contains the player's last name",
    number: "Choose the column that contains the player's jersey number",
    age_group: "Choose the column for age group (e.g., 12U, 14U)",
    external_id: "Choose the column for external/system ID if you have one",
    team_name: "Choose the column for team name if players have teams",
    position: "Choose the column for player position if applicable",
    notes: "Choose the column for additional notes or comments"
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
      
      // [DIAGNOSTIC] Log import response for debugging
      console.log('[IMPORT SUCCESS]', {
        eventId: selectedEvent.id,
        leagueId: selectedLeagueId,
        createdCount: data.added || 0,
        totalSubmitted: payload.players.length,
        samplePlayerIds: data.player_ids?.slice(0, 3) || 'N/A',
        hasErrors: data.errors?.length > 0,
        errorCount: data.errors?.length || 0
      });
      
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
        
        const successMsg = isRosterOnlyImport
          ? `✅ Roster Imported Successfully! ${data.added} players added${numbersAssigned > 0 ? `, ${numbersAssigned} auto-numbered` : ''}.`
          : `✅ Upload successful! ${data.added} players added${numbersAssigned > 0 ? `, ${numbersAssigned} auto-numbered` : ''}.`;
        
        setUploadMsg(successMsg);
        notifyPlayersUploaded(data.added);
        
        // Clear form state
        setCsvRows([]);
        setCsvHeaders([]);
        setCsvFileName("");
        setShowMapping(false); // Close mapping UI
        
        // Invalidate cache
        cacheInvalidation.playersUpdated(selectedEvent.id);
        handlePostUploadSuccess();
        
        // Show success toast and redirect to Players page
        showSuccess(`🎉 Successfully imported ${data.added} ${data.added === 1 ? 'player' : 'players'}!`);
        
        // Redirect to Players page after short delay
        setTimeout(() => {
          navigate('/players?tab=manage');
        }, 1500);
      }
    } catch (err) {
      console.error('[IMPORT ERROR]', {
        eventId: selectedEvent.id,
        leagueId: selectedLeagueId,
        error: err.message,
        response: err.response?.data
      });
      setUploadStatus("error");
      setUploadMsg(`❌ ${err.message || "Upload failed."}`);
      notifyError(err);
    }
  };

  // Manual add player logic - NOW HANDLED BY AddPlayerModal (canonical component)

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
    setConfirmedRequiredFields(new Set()); // Reset confirmations
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

        {/* Step 3: Add Players Section - STREAMLINED VERSION */}
        <div id="player-upload-section" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <h2 className="text-lg font-semibold text-gray-900">Add Players</h2>
          </div>
          
          {/* Player Count Status */}
          {playerCountLoading ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-center">
              <p className="text-gray-600">Loading player count...</p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-blue-900 font-semibold">
                    {playerCount === 0 ? 'No players yet' : `${playerCount} ${playerCount === 1 ? 'player' : 'players'} in roster`}
                  </p>
                  <p className="text-blue-700 text-sm">
                    {playerCount === 0 ? 'Add players using the options below' : 'Add more players or manage your roster on the Players page'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Primary Actions - Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Import from File - PRIMARY METHOD */}
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-brand-primary hover:bg-brand-secondary text-white font-semibold px-6 py-4 rounded-xl transition flex flex-col items-center justify-center gap-2 shadow-sm"
              type="button"
            >
              <FileText className="w-6 h-6" />
              <span>Import Players from File</span>
              <span className="text-xs opacity-90">CSV or Excel</span>
            </button>
            
            {/* Manual Add - SECONDARY METHOD */}
            <button
              onClick={() => setShowAddPlayerModal(true)}
              className="bg-white hover:bg-gray-50 text-gray-900 font-semibold px-6 py-4 rounded-xl transition flex flex-col items-center justify-center gap-2 shadow-sm border-2 border-gray-200"
              type="button"
            >
              <UserPlus className="w-6 h-6" />
              <span>Add Player Manually</span>
              <span className="text-xs text-gray-600">One at a time</span>
            </button>
          </div>

          {/* Help Text */}
          <div className="text-sm text-gray-600 text-center mt-4">
            <p><strong>Tip:</strong> For bulk uploads, use "Import Players from File" to add multiple players at once.</p>
            <p className="mt-1">View and manage your roster on the <Link to="/players" className="text-brand-primary hover:underline font-medium">Players page</Link>.</p>
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

        {/* Import Results Modal - SINGLE CANONICAL IMPORTER */}
        {showImportModal && (
          <ImportResultsModal
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              setShowImportModal(false);
              cacheInvalidation.playersUpdated(selectedEvent.id);
              fetchPlayerCount();
              showSuccess(`✅ Players imported successfully!`);
              // Redirect to Players page
              setTimeout(() => {
                navigate('/players?tab=manage');
              }, 1500);
            }}
            initialMode="create_or_update"
            intent="roster_and_scores"
            showModeSwitch={false}
            availableDrills={[]}
          />
        )}

        {/* Add Player Modal - SINGLE CANONICAL MANUAL ADD */}
        {showAddPlayerModal && (
          <AddPlayerModal
            allPlayers={players}
            onClose={() => setShowAddPlayerModal(false)}
            onSave={() => {
              setShowAddPlayerModal(false);
              cacheInvalidation.playersUpdated(selectedEvent.id);
              fetchPlayerCount();
            }}
          />
        )}
      </div>
    </div>
  );
}
