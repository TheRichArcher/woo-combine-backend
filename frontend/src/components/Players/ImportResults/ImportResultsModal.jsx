import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import api from '../../../lib/api';
import { useEvent } from '../../../context/EventContext';
import { generateDefaultMapping } from '../../../utils/csvUtils';
import { autoAssignPlayerNumbers } from '../../../utils/playerNumbering';
import { downloadWithApiAuth } from '../../../utils/authenticatedDownload';
import FileUploadStep from './FileUploadStep';
import SheetSelectionStep from './SheetSelectionStep';
import ReviewStep from './ReviewStep';
import SubmitStep from './SubmitStep';
import HistoryStep from './HistoryStep';
import { useImportSchema } from './useImportState';

export default function ImportResultsModal({ onClose, onSuccess, availableDrills = [], initialMode = 'create_or_update', intent = 'roster_and_scores', showModeSwitch = true, droppedFile = null }) {
  const { selectedEvent } = useEvent();
  const [step, setStep] = useState('input'); // input, parsing, sheet_selection, review, submitting, success, history
  
  const { effectiveDrills, schemaError } = useImportSchema(selectedEvent, availableDrills);

  const [method, setMethod] = useState('file'); // file, text
  const [importMode, setImportMode] = useState(initialMode); // create_or_update, scores_only
  const [files, setFiles] = useState(droppedFile ? [droppedFile] : []); // Initialize with droppedFile if provided
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [undoLog, setUndoLog] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [conflictMode, setConflictMode] = useState('overwrite'); // overwrite, skip, merge
  const [undoTimer, setUndoTimer] = useState(30);
  const fileInputRef = useRef(null);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  
  // Column Mapping State
  const [keyMapping, setKeyMapping] = useState({}); // { originalKey: targetKey }
  const [autoMappedKeys, setAutoMappedKeys] = useState({}); // { originalKey: confidence }
  
  // Required Fields Mapping State (Progressive Disclosure)
  const [nameMappingMode, setNameMappingMode] = useState('separate'); // 'separate' | 'full'
  const [firstNameColumn, setFirstNameColumn] = useState('');
  const [lastNameColumn, setLastNameColumn] = useState('');
  
  // Confirmation Modal State (replaces window.confirm to avoid Chrome suppression)
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm, onCancel, confirmText, cancelText, type }
  const [userConfirmedRosterOnly, setUserConfirmedRosterOnly] = useState(false); // Track if user explicitly confirmed roster-only import
  const [fullNameColumn, setFullNameColumn] = useState('');
  const [jerseyColumn, setJerseyColumn] = useState('');
  const [ageGroupColumn, setAgeGroupColumn] = useState('');
  const [requiredFieldsError, setRequiredFieldsError] = useState('');

  // Multi-sheet support
  const [sheets, setSheets] = useState([]);
  
  // Inline Editing & Strategies
  const [editedRows, setEditedRows] = useState({}); // Map<row_id, { ...data }>
  const [rowStrategies, setRowStrategies] = useState({}); // Map<row_id, strategy>
  const [editingCell, setEditingCell] = useState(null); // { rowId, key }

  // History
  const [importHistory, setImportHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all'); // all, valid, errors

  // Auto-save key
  const draftKey = `import_draft_${selectedEvent?.id}`;

  // Load draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft && step === 'input') {
        try {
            const draft = JSON.parse(savedDraft);
            // Ask user if they want to restore? For now, just show a notification or restore if it's in review step
            if (draft.step === 'review' && draft.parseResult) {
                setConfirmModal({
                    title: 'Resume Import?',
                    message: 'Found an unfinished import draft. Would you like to resume where you left off?',
                    confirmText: 'Resume',
                    cancelText: 'Start Fresh',
                    type: 'info',
                    onConfirm: () => {
                        setParseResult(draft.parseResult);
                        setEditedRows(draft.editedRows || {});
                        setRowStrategies(draft.rowStrategies || {});
                        setConflictMode(draft.conflictMode || 'overwrite');
                        setStep('review');
                        setConfirmModal(null);
                    },
                    onCancel: () => {
                        localStorage.removeItem(draftKey);
                        setConfirmModal(null);
                    }
                });
            } else {
                localStorage.removeItem(draftKey);
            }
        } catch (e) {
            console.error("Failed to load draft", e);
        }
    }
  }, [draftKey]);

  // Auto-save draft
  useEffect(() => {
    if (step === 'review' && parseResult) {
        const draft = {
            step,
            parseResult,
            editedRows,
            rowStrategies,
            conflictMode,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
    } else if (step === 'success' || step === 'input') {
        localStorage.removeItem(draftKey);
    }
  }, [step, parseResult, editedRows, rowStrategies, conflictMode, draftKey]);

  // Debug logging for available drills
  useEffect(() => {
    console.log("[ImportResultsModal] availableDrills updated:", {
      count: effectiveDrills.length,
      names: effectiveDrills.map(d => d.label),
      ids: effectiveDrills.map(d => d.key)
    });
  }, [effectiveDrills]);

  // Move detectedSport logic to top level (used in useMemo)
  const detectedSport = parseResult?.detected_sport?.toLowerCase();

  // Move drillMappingOptions to top level (was inside renderReviewStep causing Hook Error #310)
  const drillMappingOptions = useMemo(() => {
      // STRICT: Use availableDrills from the event schema (passed as prop)
      // This ensures we map to the exact keys the backend expects
      // NO FALLBACKS to legacy templates allowed per requirements
      return [{
          label: "Event Drills",
          options: (effectiveDrills || []).map(d => ({ key: d.key, label: d.label }))
      }];
  }, [effectiveDrills]);

  const STANDARD_FIELDS = [
      { key: 'name', label: 'Name (Full Name - will be split)' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'number', label: 'Player Number' },
      { key: 'age_group', label: 'Age Group' },
      { key: 'team_name', label: 'Team Name' },
      { key: 'position', label: 'Position' },
      { key: 'external_id', label: 'External ID' },
      { key: 'notes', label: 'Notes' },
      { key: 'parent_first_name', label: 'Parent First Name' },
      { key: 'parent_last_name', label: 'Parent Last Name' },
      { key: 'parent_email', label: 'Parent Email' },
      { key: 'cell_phone', label: 'Cell Phone' },
      { key: 'street', label: 'Street Address' },
      { key: 'buddy_request_raw', label: 'Buddy Request 1' },
      { key: 'sibling_separation_requested', label: 'Sibling Separation Requested' }
  ];

  const MAPPING_OPTIONS = useMemo(() => {
      const baseOptions = [{ label: "Player Fields", options: STANDARD_FIELDS }];
      
      // If intent is roster_only, do NOT show drill options
      if (intent === 'roster_only') {
          return baseOptions;
      }
      
      return [...baseOptions, ...drillMappingOptions];
  }, [intent, drillMappingOptions]);

  const isValidImportFile = (candidateFile) => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileName = candidateFile?.name || '';
    const extensionIndex = fileName.lastIndexOf('.');
    if (extensionIndex === -1) return false;
    const fileExtension = fileName.toLowerCase().substring(extensionIndex);
    return validExtensions.includes(fileExtension);
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const invalidFiles = selectedFiles.filter((f) => !isValidImportFile(f));
    if (invalidFiles.length > 0) {
      setError(`Invalid file type: ${invalidFiles[0].name}. Please upload CSV or Excel files (.csv, .xlsx, .xls).`);
      return;
    }

    setFiles(selectedFiles);
    setError(null);
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset drag state
    dragCounter.current = 0;
    setIsDragging(false);
    
    // Check if files were dropped
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      setError("No file detected. Please try again.");
      return;
    }
    
    const droppedFiles = Array.from(files);
    const invalidFile = droppedFiles.find((f) => !isValidImportFile(f));
    if (invalidFile) {
      setError(`Invalid file type: ${invalidFile.name}. Please upload CSV or Excel files (.csv, .xlsx, .xls).`);
      return;
    }
    
    // Files are valid, set them and clear any previous errors
    setFiles(droppedFiles);
    setError(null);
  };

  const handleDownloadTemplate = async () => {
    if (!selectedEvent?.id || isDownloadingTemplate) return;

    setError(null);
    setIsDownloadingTemplate(true);
    try {
      await downloadWithApiAuth(
        api,
        `/events/${selectedEvent.id}/import-template`,
        `import_template_${selectedEvent.name || 'event'}.csv`
      );
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Failed to download template. Please try again.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedEvent?.id || isDownloadingPdf) return;

    setError(null);
    setIsDownloadingPdf(true);
    try {
      await downloadWithApiAuth(
        api,
        `/events/${selectedEvent.id}/export-pdf`,
        `${selectedEvent.name || 'event'}_results.pdf`
      );
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Failed to download PDF. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

    const initializeRequiredFieldMappings = (mapping, sourceKeys) => {
        // Find which source column maps to each target
        const reverseMapping = {};
        Object.entries(mapping).forEach(([source, target]) => {
            reverseMapping[target] = source;
        });
        
        // Check if we have first_name and last_name mapped
        const hasFirstName = reverseMapping['first_name'];
        const hasLastName = reverseMapping['last_name'];
        const hasFullName = reverseMapping['name'];
        
        if (hasFirstName && hasLastName) {
            setNameMappingMode('separate');
            setFirstNameColumn(hasFirstName);
            setLastNameColumn(hasLastName);
        } else if (hasFullName) {
            setNameMappingMode('full');
            setFullNameColumn(hasFullName);
        } else {
            // No name mapping detected - try to find likely candidates
            // CRITICAL: Exclude parent/guardian/user columns from registration exports
            const PARENT_PREFIXES = ['user ', 'parent ', 'guardian ', 'emergency'];
            const nameLikeColumns = sourceKeys.filter(key => {
                const lower = key.toLowerCase();
                const isParentColumn = PARENT_PREFIXES.some(p => lower.startsWith(p));
                return !isParentColumn && (lower.includes('name') || lower.includes('player'));
            });
            
            if (nameLikeColumns.length === 1) {
                // Single name-like column, suggest full name mode
                setNameMappingMode('full');
                setFullNameColumn(nameLikeColumns[0]);
            } else {
                // Default to separate mode, user must select
                setNameMappingMode('separate');
            }
        }
        
        // CRITICAL FIX: Add guards for player number mapping
        // Player number should NEVER map to name columns and must be numeric-like
        if (reverseMapping['number']) {
            const jerseySource = reverseMapping['number'];
            const lower = jerseySource.toLowerCase();
            
            // Guard: Exclude name columns (but allow player_number, player_no, etc.)
            // Only reject if it contains "name" specifically, not just "player"
            const isNameColumn = lower.includes('name') && !lower.includes('number') && !lower.includes('num') && !lower.includes('no');
            
            // Only set if it passes guard
            if (!isNameColumn) {
                setJerseyColumn(jerseySource);
            } else {
                // Default to empty (Not mapped) when it's actually a name column
                setJerseyColumn('');
            }
        } else {
            // No jersey detected, default to empty (Not mapped)
            setJerseyColumn('');
        }
        
        // Map age_group
        if (reverseMapping['age_group']) {
            setAgeGroupColumn(reverseMapping['age_group']);
        }
    };
    
    // Check if required fields are validly mapped
  const handleParse = async (sheetName = null) => {
    if (method === 'file' && files.length === 0) {
      setError('Please select at least one file');
      return;
    }
    if (method === 'text' && !text.trim()) {
      setError('Please enter some text');
      return;
    }
    if (method === 'sheets' && !url.trim()) {
      setError('Please enter a Google Sheets URL');
      return;
    }

    setStep('parsing');
    setError(null);

    try {
      const formData = new FormData();
      if (method === 'file') {
        files.forEach((selectedFile) => {
          formData.append('files', selectedFile);
        });
      } else if (method === 'sheets') {
        formData.append('url', url);
      } else {
        formData.append('text', text);
      }
      
      if (sheetName) {
          formData.append('sheet_name', sheetName);
      }

      const response = await api.post(`/events/${selectedEvent.id}/parse-import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Check for multi-sheet response
      if (response.data.sheets && response.data.sheets.length > 0) {
          setSheets(response.data.sheets);
          setStep('sheet_selection');
          return;
      }

      setParseResult(response.data);
      
      // Initialize key mapping using smart detection
      // We use generateDefaultMapping to match the incoming keys (from backend parsing)
      // to our target schema (availableDrills)
      const initialMapping = {};
      const initialAutoMapped = {}; // Declare at top level to avoid TDZ
      const sourceKeys = (response.data.valid_rows.length > 0 || response.data.errors.length > 0)
          ? Object.keys((response.data.valid_rows[0] || response.data.errors[0]).data)
          : [];
          
      if (sourceKeys.length > 0) {
          // DEBUG: Log what we're working with for custom drill troubleshooting
          console.log("[ImportResultsModal] Generating mappings from:", {
              sourceKeys,
              effectiveDrills: effectiveDrills.map(d => ({ 
                  id: d.id, 
                  key: d.key, 
                  label: d.label || d.name 
              }))
          });
          
          // generateDefaultMapping returns { targetKey: sourceKey }
          // We need { sourceKey: targetKey } for our state
          const { mapping: suggestedMapping, confidence: mappingConfidence } = generateDefaultMapping(sourceKeys, effectiveDrills);
          
          console.log("[ImportResultsModal] Generated mapping:", {
              suggestedMapping,
              confidence: mappingConfidence
          });
          
          // Apply suggested mappings
          Object.entries(suggestedMapping).forEach(([targetKey, sourceHeader]) => {
              if (sourceHeader) {
                  // If roster_only, ensure we don't map to a drill key (unless it's standard field?)
                  // effectiveDrills contains the drill keys.
                  const isDrillKey = effectiveDrills.some(d => d.key === targetKey);
                  
                  console.log("[ImportResultsModal] Processing mapping:", {
                      targetKey,
                      sourceHeader,
                      isDrillKey,
                      intent,
                      willMap: !(intent === 'roster_only' && isDrillKey)
                  });
                  
                  if (intent === 'roster_only' && isDrillKey) {
                      // Skip mapping this drill
                      return;
                  }
                  
                  initialMapping[sourceHeader] = targetKey;
                  if (mappingConfidence[targetKey]) {
                      initialAutoMapped[sourceHeader] = mappingConfidence[targetKey];
                  }
              }
          });
          
          // For any unmapped keys, default to identity if it matches a known drill key directly
          sourceKeys.forEach(key => {
              // Skip keys that are already mapped by generateDefaultMapping
              if (initialMapping[key]) {
                  console.log("[ImportResultsModal] Skipping already mapped key:", key, "→", initialMapping[key]);
                  return;
              }
              
              // Only map if the key itself matches a drill key exactly
              if (effectiveDrills.some(d => d.key === key)) {
                  if (intent !== 'roster_only') {
                      initialMapping[key] = key;
                      initialAutoMapped[key] = 'high'; // Exact match
                      console.log("[ImportResultsModal] Identity mapping for exact drill key:", key);
                  }
              }
              // NOTE: We intentionally DO NOT create identity mappings for unrecognized keys
              // This prevents "Vertical Jump (cm)" → "Vertical Jump (cm)" which would fail validation
              // Unmapped keys will be left empty and user can manually map them via dropdowns
          });
      }
      
      setKeyMapping(initialMapping);
      setAutoMappedKeys(initialAutoMapped);
      
      // Auto-detect required field mappings for progressive disclosure
      initializeRequiredFieldMappings(initialMapping, sourceKeys);
      
      setStep('review');
    } catch (err) {
      console.error("Parse error:", err);
      setError(err.response?.data?.detail || "Failed to parse import data");
      setStep('input');
      // Clear selected files to prevent re-trigger of auto-parse on error
      setFiles([]);
    }
  };
  
  // If a file was dropped, auto-parse it after modal opens
  // Ref to track if we've already auto-parsed this file to prevent loops
  const hasAutoParseRef = useRef(false);
  
  useEffect(() => {
    if (droppedFile && step === 'input' && files.length > 0 && !hasAutoParseRef.current) {
      hasAutoParseRef.current = true; // Mark as triggered
      // Small delay to allow modal animation to complete
      const timer = setTimeout(() => {
        handleParse();
      }, 300);
      return () => clearTimeout(timer);
    }
    // Reset flag when file changes to allow new files to be auto-parsed
    if (files.length === 0) {
      hasAutoParseRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedFile, step, files]); // Track file changes to reset flag

    const [importSummary, setImportSummary] = useState(null);
    
    // Initialize required field mappings from auto-detected mapping
    const getRequiredFieldsStatus = () => {
        if (importMode === 'create_or_update') {
            // Roster mode: must have name mapping
            if (nameMappingMode === 'separate') {
                const valid = firstNameColumn && lastNameColumn;
                return {
                    valid,
                    error: valid ? '' : 'Please select both First Name and Last Name columns'
                };
            } else {
                const valid = fullNameColumn;
                return {
                    valid,
                    error: valid ? '' : 'Please select a Full Name column to split'
                };
            }
        } else {
            // Scores-only mode: also needs names for matching
            if (nameMappingMode === 'separate') {
                const valid = firstNameColumn && lastNameColumn;
                return {
                    valid,
                    error: valid ? '' : 'Names required to match players in your roster'
                };
            } else {
                const valid = fullNameColumn;
                return {
                    valid,
                    error: valid ? '' : 'Full Name required to match players'
                };
            }
        }
    };

    const handleSubmit = async (bypassValidations = false) => {
    console.log("[IMPORT DEBUG] handleSubmit called - START, bypass:", bypassValidations);
    if (!parseResult) {
        console.log("[IMPORT DEBUG] Early return - no parseResult");
        return;
    }
    console.log("[IMPORT DEBUG] parseResult exists, continuing...");
    
    // CRITICAL: Validate required fields FIRST before any other validation
    const requiredStatus = getRequiredFieldsStatus();
    console.log("[IMPORT DEBUG] Required fields status:", requiredStatus);
    if (!requiredStatus.valid) {
        setRequiredFieldsError(requiredStatus.error);
        // Scroll to required fields panel
        document.getElementById('required-fields-panel')?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
        return;
    }
    
    // Clear any previous required field errors
    setRequiredFieldsError('');
    
    // Sync required field selections into keyMapping before validation
    const updatedMapping = { ...keyMapping };
    
    if (nameMappingMode === 'separate') {
        if (firstNameColumn) updatedMapping[firstNameColumn] = 'first_name';
        if (lastNameColumn) updatedMapping[lastNameColumn] = 'last_name';
        // Remove any 'name' mapping if it exists
        Object.keys(updatedMapping).forEach(key => {
            if (updatedMapping[key] === 'name') delete updatedMapping[key];
        });
    } else {
        if (fullNameColumn) updatedMapping[fullNameColumn] = 'name';
        // Remove separate name mappings if they exist
        Object.keys(updatedMapping).forEach(key => {
            if (updatedMapping[key] === 'first_name' || updatedMapping[key] === 'last_name') {
                delete updatedMapping[key];
            }
        });
    }
    
    if (jerseyColumn) updatedMapping[jerseyColumn] = 'number';
    if (ageGroupColumn) updatedMapping[ageGroupColumn] = 'age_group';
    
    // Update keyMapping state to reflect required field selections
    setKeyMapping(updatedMapping);

    // Combine valid and errors to allow fixing - Construct EARLY to avoid TDZ
    const formattedErrors = parseResult.errors.map(e => ({
        row_id: e.row,
        data: e.data || {},
        errors: [e.message],
        is_error: true,
        is_duplicate: false
    }));
    const allRows = [...parseResult.valid_rows, ...formattedErrors];

    // Validate that all mapped columns correspond to valid schema fields
    const validKeys = new Set([
        ...STANDARD_FIELDS.map(f => f.key),
        'name', // CRITICAL: Allow 'name' for full-name auto-split transform
        ...(intent === 'roster_only' ? [] : effectiveDrills.map(d => d.key))
    ]);

    // DEBUG: Log validation setup to diagnose custom drill mapping issues
    console.log("[ImportResultsModal] Validation Setup:", {
        validKeysCount: validKeys.size,
        validKeys: Array.from(validKeys),
        effectiveDrillsCount: effectiveDrills.length,
        effectiveDrills: effectiveDrills.map(d => ({ key: d.key, label: d.label })),
        keyMappingEntries: Object.entries(updatedMapping)
    });
    
    // DEBUG: Verify canonical field is 'number' not 'jersey_number'
    const hasNumber = validKeys.has('number');
    const hasJerseyNumber = validKeys.has('jersey_number');
    console.log(`[ImportResultsModal] Canonical field check: number=${hasNumber}, jersey_number=${hasJerseyNumber}`);
    if (!hasNumber) {
        console.error("[ImportResultsModal] ❌ CRITICAL: 'number' not in validKeys! This will cause data loss.");
    }
    if (hasJerseyNumber) {
        console.warn("[ImportResultsModal] ⚠️ WARNING: 'jersey_number' in validKeys (should only be 'number')");
    }

    const activeMappings = Object.entries(updatedMapping)
        .filter(([_, targetKey]) => targetKey !== '__ignore__');

    const invalidMappings = activeMappings.filter(([sourceKey, targetKey]) => {
        // If mapped to identity (Original) and that key isn't in schema
        const isInvalid = !validKeys.has(targetKey);
        if (isInvalid) {
            console.log("[ImportResultsModal] Invalid mapping detected:", {
                sourceKey,
                targetKey,
                validKeysHas: validKeys.has(targetKey),
                matchingDrill: effectiveDrills.find(d => d.key === targetKey)
            });
        }
        return isInvalid;
    });

    // NOTE: We removed the "Missing Required Fields" check here because it's now
    // handled at the top of handleSubmit() via getRequiredFieldsStatus()
    // This prevents duplicate validation and ensures required fields panel is the source of truth

        // HARD STOP: Block import if there are unmapped columns that contain data
        // This prevents the "silent failure" scenario where users import but lose scores
        // Note: Ignored columns (mapped to __ignore__) are allowed even if they contain data
        
        // 1. Check active mappings that point to invalid/missing keys (shouldn't happen with dropdown, but safety net)
        if (!bypassValidations && invalidMappings.length > 0) {
            const unmappedKeys = invalidMappings.map(([source]) => source);
            
            // Check if any of these unmapped columns actually have data in the rows
            const hasDataLossRisk = unmappedKeys.some(key => {
                // Check first 50 rows for any non-empty value
                return allRows.slice(0, 50).some(r => {
                    const val = r.data?.[key];
                    return val !== null && val !== undefined && String(val).trim() !== '';
                });
            });

            if (hasDataLossRisk) {
                const names = unmappedKeys.slice(0, 3).join(', ') + (unmappedKeys.length > 3 ? '...' : '');
                setConfirmModal({
                    title: '⚠️ WARNING: Potential Data Loss',
                    message: `The following columns contain data but are not mapped to any event drill:\n\n${names}\n\nThey will NOT be imported. Continue?`,
                    confirmText: 'Continue Anyway',
                    cancelText: 'Go Back',
                    type: 'warning',
                    onConfirm: () => {
                        setConfirmModal(null);
                        // Re-call handleSubmit with bypass flag
                        handleSubmit(true);
                    },
                    onCancel: () => {
                        setConfirmModal(null);
                        setStep('review');
                    }
                });
                return;
            }

        // 2. CRITICAL: Check columns explicitly set to "__ignore__" but that contain data
        // This catches the case where auto-mapping failed (so defaulted to ignore) but user didn't notice
        // We ONLY warn, we DO NOT block. This supports keeping extra columns for reference.
        const sourceKeys = Object.keys(allRows?.[0]?.data || {});
        const ignoredKeys = sourceKeys.filter(
          (k) => keyMapping?.[k] === "__ignore__"
        );

        const ignoredWithData = ignoredKeys.filter((k) =>
          (allRows || []).some((r) => {
            const v = r?.data?.[k];
            return v !== null && v !== undefined && String(v).trim() !== "";
          })
        );

        if (!bypassValidations && ignoredWithData.length > 0) {
          const names = ignoredWithData.slice(0, 5).join(', ') + (ignoredWithData.length > 5 ? '...' : '');
          // Just a confirmation to ensure they meant to ignore data-bearing columns
          // If they say cancel, we go back. If OK, we proceed (data is dropped as requested)
          setConfirmModal({
              title: 'Ignored Columns Contain Data',
              message: `NOTE: You are choosing to ignore columns that contain data:\n\n${names}\n\nThis data will NOT be imported. Continue?`,
              confirmText: 'Continue',
              cancelText: 'Go Back',
              type: 'info',
              onConfirm: () => {
                  setConfirmModal(null);
                  handleSubmit(true);
              },
              onCancel: () => {
                  setConfirmModal(null);
                  setStep('review');
              }
          });
          return;
        }

        // --- NEW: PREVENT SILENT FAILURE (0 SCORES) ---
        // Calculate how many columns are mapped to actual drill keys
        const mappedDrillCount = activeMappings.filter(([_, targetKey]) => {
            return effectiveDrills.some(d => d.key === targetKey);
        }).length;

        // Detect if there are potential drill columns (non-identity fields with numeric data)
        const identityFields = [
            'first_name',
            'last_name',
            'name',
            'jersey_number',
            'player_number',
            'age_group',
            'team_name',
            'position',
            'external_id',
            'notes',
            'parent_first_name',
            'parent_last_name',
            'parent_email',
            'cell_phone',
            'street',
            'buddy_request_raw',
            'sibling_separation_requested'
        ];
        const potentialDrillColumns = Object.keys(allRows?.[0]?.data || {}).filter(key => {
            // Not an identity field (check both exact match and substring)
            if (identityFields.some(id => key.toLowerCase() === id.toLowerCase() || key.toLowerCase().includes(id.toLowerCase()))) return false;
            
            // Not already mapped to a drill (check if this source column is mapped to any valid drill)
            const mappedTarget = updatedMapping[key];
            if (mappedTarget && mappedTarget !== '__ignore__') {
                // Check if the target is a valid drill key
                if (effectiveDrills.some(d => d.key === mappedTarget)) return false;
            }
            
            // Has numeric-looking data in first few rows
            const hasNumericData = allRows.slice(0, 5).some(row => {
                const val = row.data?.[key];
                return val && !isNaN(parseFloat(val));
            });
            return hasNumericData;
        });

        // CRITICAL: Detect roster-only situation EARLY (before any bypasses)
        // Only set flag if we're CERTAIN it's intentional roster-only (no drill-like columns in CSV)
        // This prevents masking real mapping failures where scores should have been imported
        if (mappedDrillCount === 0 && importMode !== 'scores_only' && intent !== 'roster_only' && potentialDrillColumns.length === 0) {
            setUserConfirmedRosterOnly(true);
        }

        // Strict Block for Scores Only Mode
        if (!bypassValidations && importMode === 'scores_only' && mappedDrillCount === 0) {
            setConfirmModal({
                title: '❌ Import Blocked',
                message: "You selected 'Upload Drill Scores' but no columns are mapped to valid drill results.\n\nPlease map your columns to the event's drills (check dropdowns) or switch to 'Add & Update Players' if you only have roster data.",
                confirmText: 'OK',
                cancelText: null,
                type: 'error',
                onConfirm: () => {
                    setConfirmModal(null);
                    setStep('review');
                },
                onCancel: null
            });
            return;
        }

        // Softer confirmation for Roster+Scores Intent with unmapped drill columns
        if (!bypassValidations && intent !== 'roster_only' && mappedDrillCount === 0 && potentialDrillColumns.length > 0) {
            // Show custom confirm dialog with helpful options
            setConfirmModal({
                title: '📊 Unmapped Drill Columns Detected',
                message: `We found ${potentialDrillColumns.length} column(s) that look like drill scores:\n${potentialDrillColumns.slice(0, 3).join(', ')}${potentialDrillColumns.length > 3 ? '...' : ''}\n\nThese aren't mapped yet, so no scores will be imported.\n\n• Click "Import Players Only" to continue (you can add scores later)\n• Click "Map Drills Now" to return and map drill columns`,
                confirmText: 'Import Players Only',
                cancelText: 'Map Drills Now',
                type: 'warning',
                onConfirm: () => {
                    setConfirmModal(null);
                    setUserConfirmedRosterOnly(true);
                    handleSubmit(true);
                },
                onCancel: () => {
                    setConfirmModal(null);
                    // User wants to map drills - scroll to Step 2 header
                    document.getElementById('step-2-header')?.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                    setStep('review');
                }
            });
            return;
        } else if (!bypassValidations && intent !== 'roster_only' && mappedDrillCount === 0 && potentialDrillColumns.length === 0) {
            // No drill-like columns detected, proceed with simple confirmation
            setConfirmModal({
                title: 'Import roster only?',
                message: 'No drill score columns detected. This will import player names and info only.',
                confirmText: 'OK, Import Roster',
                cancelText: 'Cancel',
                type: 'info',
                onConfirm: () => {
                    setConfirmModal(null);
                    setUserConfirmedRosterOnly(true);
                    handleSubmit(true);
                },
                onCancel: () => {
                    setConfirmModal(null);
                    setStep('review');
                }
            });
            return;
        }
    }

    // Auto-fix: Treat invalid mappings as ignore if the target key itself isn't valid
    if (invalidMappings.length > 0) {
        // If we reached here, the unmapped columns have no data OR the user confirmed they accept data loss
        // So we can proceed. We effectively "ignore" them by not including them in the mapped payload.
    }

    console.log("[IMPORT DEBUG] All validations passed, setting step to 'submitting'");
    setStep('submitting');
    try {
      // Merge edited data and filter based on strategy
      let playersToUpload = allRows.map((row, mapIdx) => {
          const edited = editedRows[row.row_id] || {};
          const mergedData = { ...row.data, ...edited };
          
          // DEBUG: Log raw data for first player
          if (mapIdx === 0) {
              console.log("[UPLOAD] Row 1 - Raw data:", {
                  row_data: row.data,
                  edited: edited,
                  merged: mergedData,
                  updatedMapping: updatedMapping
              });
          }
          
          // Apply column mapping (rename keys) - use updatedMapping which includes required field selections
          const mappedData = {};
          Object.keys(mergedData).forEach(k => {
              const targetKey = updatedMapping[k] || k;
              // Strict Filtering: Only include keys that are in validKeys (respects intent)
              if (targetKey !== '__ignore__' && validKeys.has(targetKey)) {
                  mappedData[targetKey] = mergedData[k];
              } else if (mapIdx === 0) {
                  // DEBUG: Log filtered out fields for first player
                  console.warn(`[UPLOAD] Row 1 - Filtered out: ${k} → ${targetKey} (not in validKeys)`);
              }
          });
          
          // DEBUG: Log after mapping for first player
          if (mapIdx === 0) {
              console.log("[UPLOAD] Row 1 - After mapping:", mappedData);
          }

          // CRITICAL FIX: Handle 'name' field by splitting into first_name/last_name
          // If user mapped a column to 'name', split it and populate first_name/last_name
          if (mappedData.name && !mappedData.first_name && !mappedData.last_name) {
              const originalName = mappedData.name;
              const keysBefore = [...Object.keys(mappedData)];
              
              const nameParts = String(mappedData.name).trim().split(/\s+/);
              if (nameParts.length === 1) {
                  // Single name - treat as last name
                  mappedData.first_name = '';
                  mappedData.last_name = nameParts[0];
              } else if (nameParts.length >= 2) {
                  // Multiple parts - first is first_name, rest is last_name
                  mappedData.first_name = nameParts[0];
                  mappedData.last_name = nameParts.slice(1).join(' ');
              }
              // Remove the 'name' field as backend expects first_name/last_name
              delete mappedData.name;
              
              if (mapIdx === 0) {
                  console.log("[UPLOAD] Row 1 - Name split transformation:", {
                      BEFORE: { keys: keysBefore, name: originalName },
                      AFTER: { 
                          keys: Object.keys(mappedData), 
                          first_name: mappedData.first_name,
                          last_name: mappedData.last_name,
                          full_object: { ...mappedData }
                      }
                  });
              }
          } else if (mapIdx === 0) {
              console.warn("[UPLOAD] Row 1 - Name splitting skipped:", {
                  has_name: !!mappedData.name,
                  has_first_name: !!mappedData.first_name,
                  has_last_name: !!mappedData.last_name,
                  mappedData_keys: Object.keys(mappedData)
              });
          }

          // CRITICAL FIX: Normalize jersey_number to number (backward compatibility)
          // Frontend canonical is 'number' to match backend, but handle legacy jersey_number
          if (mappedData.jersey_number && !mappedData.number) {
              mappedData.number = mappedData.jersey_number;
              delete mappedData.jersey_number;
              if (mapIdx === 0) {
                  console.log("[UPLOAD] Row 1 - Normalized jersey_number to number");
              }
          } else if (mappedData.jersey_number && mappedData.number) {
              // Both present - remove jersey_number, keep number as canonical
              delete mappedData.jersey_number;
          }
          
          // DEBUG: Log final mapped data for first player
          if (mapIdx === 0) {
              console.log("[UPLOAD] Row 1 - Final mapped data:", {
                  has_first_name: !!mappedData.first_name,
                  has_last_name: !!mappedData.last_name,
                  has_number: !!mappedData.number,
                  keys: Object.keys(mappedData),
                  sample: mappedData
              });
          }

          // Strategy: if it was an error row, default to overwrite (new insert attempt)
          // unless it matches a duplicate? Error rows usually don't have is_duplicate set by backend
          const strategy = rowStrategies[row.row_id] || (row.is_duplicate ? conflictMode : 'overwrite');
          
          const returnObject = {
              ...mappedData,
              merge_strategy: strategy
          };
          
          // DEBUG: Log the exact object being returned for first row
          if (mapIdx === 0) {
              console.log("[UPLOAD] Row 1 - RETURN OBJECT:", {
                  keys: Object.keys(returnObject),
                  has_first_name: 'first_name' in returnObject,
                  has_last_name: 'last_name' in returnObject,
                  has_number: 'number' in returnObject,
                  first_name: returnObject.first_name,
                  last_name: returnObject.last_name,
                  number: returnObject.number,
                  full_object: { ...returnObject }
              });
          }
          
          return returnObject;
      });
      
      // Filter out skipped rows
      const skippedCount = playersToUpload.filter(p => p.merge_strategy === 'skip').length;
      playersToUpload = playersToUpload.filter(p => p.merge_strategy !== 'skip');

      // CRITICAL FIX: Auto-assign player numbers to prevent duplicate ID collisions
      // Players without numbers will generate identical IDs if they have the same name,
      // causing Firestore batch write failures and 500 errors
      const playersBeforeAutoNumber = playersToUpload.filter(p => !p.number && p.number !== 0).length;
      if (playersBeforeAutoNumber > 0) {
          console.log(`[ImportResultsModal] Auto-assigning numbers to ${playersBeforeAutoNumber} players...`);
          playersToUpload = autoAssignPlayerNumbers(playersToUpload);
          console.log(`[ImportResultsModal] ✅ Auto-assignment complete. All players now have unique numbers.`);
      }

      // DEBUG: Verify all players have numbers after auto-assignment
      const playersWithoutNumber = playersToUpload.filter(p => !p.number && p.number !== 0);
      if (playersWithoutNumber.length > 0) {
          console.error(`[ImportResultsModal] ❌ CRITICAL: ${playersWithoutNumber.length} players STILL missing 'number' field after auto-assignment!`);
          
          // Show first 3 examples with their raw CSV data
          playersWithoutNumber.slice(0, 3).forEach((player, idx) => {
              const rowId = player.row_id || idx + 1;
              const rawRow = allRows.find(r => r.row_id === rowId);
              console.error(`[ImportResultsModal] Missing number example ${idx + 1}:`, {
                  player_data: player,
                  raw_csv_source: rawRow ? rawRow.data : 'not found',
                  merged_edits: editedRows[rowId] || 'none'
              });
          });
      } else {
          console.log(`[ImportResultsModal] ✅ All ${playersToUpload.length} players have 'number' field`);
      }

      // NOTE: Detailed payload logging happens below in the "payload.players[0] keys" section
      // Removed misleading "Submitting first player" log that used console.log() string truncation

      if (playersToUpload.length === 0) {
        setError("No players to import (all skipped).");
        setStep('review');
        return;
      }

      // CRITICAL DEBUG: Log final payload before POST
      console.log("[UPLOAD] ═══════════════════════════════════════");
      console.log("[UPLOAD] Final payload being sent to /players/upload:");
      console.log("[UPLOAD] Event ID:", selectedEvent.id);
      console.log("[UPLOAD] Total players:", playersToUpload.length);
      console.log("[UPLOAD] Sample player (first):", playersToUpload[0]);
      console.log("[UPLOAD] Identity check for first player:", {
          has_first_name: !!playersToUpload[0]?.first_name,
          has_last_name: !!playersToUpload[0]?.last_name,
          has_number: !!playersToUpload[0]?.number,
          first_name: playersToUpload[0]?.first_name,
          last_name: playersToUpload[0]?.last_name,
          number: playersToUpload[0]?.number
      });
      console.log("[UPLOAD] ═══════════════════════════════════════");
      
      // CRITICAL DEBUG: Show exact keys in payload.players[0]
      if (playersToUpload.length > 0) {
          console.log('[UPLOAD] payload.players[0] keys:', Object.keys(playersToUpload[0]));
          console.log('[UPLOAD] payload.players[0] full object:', JSON.stringify(playersToUpload[0], null, 2));
          console.log('[UPLOAD] Explicit field check:', {
              has_first_name: 'first_name' in playersToUpload[0],
              has_last_name: 'last_name' in playersToUpload[0],
              has_number: 'number' in playersToUpload[0],
              first_name_value: playersToUpload[0].first_name,
              last_name_value: playersToUpload[0].last_name,
              number_value: playersToUpload[0].number
          });
      }

      const response = await api.post('/players/upload', {
        event_id: selectedEvent.id,
        players: playersToUpload,
        skipped_count: skippedCount,
        method: method,
        filename: method === 'file'
          ? files.map((f) => f.name).join(', ')
          : (url || 'paste'),
        mode: importMode
      });
      
      if (response.data.undo_log) {
        setUndoLog(response.data.undo_log);
      }
      
      if (response.data) {
          setImportSummary({
              players: response.data.added || 0,
              created: response.data.created_players, // Capture new fields
              updated: response.data.updated_players, // Capture new fields
              scores: response.data.scores_written_total || 0,
              rejected: response.data.rejected_count || 0,  // NEW: Count of rejected rows
              rejectedRows: response.data.rejected_rows || [],  // NEW: Full error details
              errors: response.data.errors || []
          });
      }

      setStep('success');
      localStorage.removeItem(draftKey);
    } catch (err) {
      console.error("Import error:", err);
      setError(err.response?.data?.detail || "Failed to import results");
      setStep('review');
    }
  };

  const handleUndo = async () => {
    if (!undoLog) return;
    setUndoing(true);
    try {
      await api.post('/players/revert-import', {
        event_id: selectedEvent.id,
        undo_log: undoLog
      });
      setStep('input'); 
      setUndoLog(null);
      onSuccess?.(true); // isRevert = true
      // Don't close on undo, allow user to try again
    } catch (err) {
      console.error("Undo error:", err);
      setError("Failed to undo import");
      setUndoing(false);
    }
  };
  
  useEffect(() => {
    let interval;
    if (step === 'success' && undoLog && undoTimer > 0) {
      interval = setInterval(() => {
        setUndoTimer(prev => prev - 1);
      }, 1000);
    } else if (undoTimer === 0 && undoLog) {
        // Timer expired - just hide the undo option, don't auto-close modal
        setUndoLog(null);
    }
    return () => clearInterval(interval);
  }, [step, undoLog, undoTimer]);

  const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
          const res = await api.get(`/events/${selectedEvent.id}/history`);
          setImportHistory(res.data);
          setStep('history');
      } catch (err) {
          console.error(err);
          setError("Failed to fetch history");
      } finally {
          setLoadingHistory(false);
      }
  };

  // Dynamic placeholder text
  const placeholderText = useMemo(() => {
    const exampleDrill = effectiveDrills[0] || { label: '40m Dash', key: '40m_dash' };
    const exampleValue = exampleDrill.key === '40m_dash' ? '4.5' : '10';
    return `Paste your data here...\nFirst Name, Last Name, ${exampleDrill.label}\nJohn, Doe, ${exampleValue}\nJane, Smith, ${Number(exampleValue) + 0.3}`;
  }, [effectiveDrills]);

  const supportedColumnsText = useMemo(() => {
    const drillLabels = effectiveDrills.slice(0, 3).map(d => d.label).join(', ');
    return `Supported columns: First Name, Last Name, Player Number, Age Group, Drill Names (${drillLabels || 'e.g. 40m Dash'}, etc.)`;
  }, [effectiveDrills]);

  const fileUploadProps = {
    showModeSwitch, importMode, setImportMode, isDragging, fileInputRef,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop, files, setFiles,
    method, setMethod, url, setUrl, text, setText, placeholderText, supportedColumnsText,
    handleDownloadTemplate, isDownloadingTemplate, fetchHistory, onClose, handleParse,
    schemaError, error
  };

  const reviewProps = {
    parseResult, reviewFilter, setReviewFilter, getRequiredFieldsStatus, requiredFieldsError,
    setRequiredFieldsError, importMode, nameMappingMode, setNameMappingMode, firstNameColumn,
    setFirstNameColumn, lastNameColumn, setLastNameColumn, fullNameColumn, setFullNameColumn,
    jerseyColumn, setJerseyColumn, ageGroupColumn, setAgeGroupColumn, intent, keyMapping,
    setKeyMapping, effectiveDrills, autoMappedKeys, MAPPING_OPTIONS, editedRows, setEditedRows,
    rowStrategies, setRowStrategies, editingCell, setEditingCell, conflictMode, setConflictMode,
    error, setStep, handleSubmit
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import Results</h2>
            <p className="text-sm text-gray-500">Add players and drill scores in bulk</p>
          </div>
          <button
            onClick={() => {
              if (step === 'success') {
                onSuccess?.(false);
              }
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 'input' && <FileUploadStep {...fileUploadProps} />}
          {step === 'sheet_selection' && <SheetSelectionStep sheets={sheets} handleParse={handleParse} setStep={setStep} />}
          {step === 'history' && <HistoryStep setStep={setStep} loadingHistory={loadingHistory} importHistory={importHistory} />}
          {step === 'review' && <ReviewStep {...reviewProps} />}
          {(step === 'parsing' || step === 'submitting' || step === 'success') && (
            <SubmitStep
              step={step}
              importSummary={importSummary}
              selectedEvent={selectedEvent}
              onSuccess={onSuccess}
              onClose={onClose}
              handleDownloadPDF={handleDownloadPDF}
              isDownloadingPdf={isDownloadingPdf}
              undoLog={undoLog}
              handleUndo={handleUndo}
              undoing={undoing}
              undoTimer={undoTimer}
            />
          )}
        </div>
      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in duration-200">
            <h3 className={`text-lg font-bold mb-3 ${
              confirmModal.type === 'error' ? 'text-red-600' :
              confirmModal.type === 'warning' ? 'text-amber-600' :
              'text-gray-900'
            }`}>
              {confirmModal.title}
            </h3>
            <p className="text-gray-700 whitespace-pre-line mb-6">
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              {confirmModal.cancelText && (
                <button
                  onClick={confirmModal.onCancel}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
                >
                  {confirmModal.cancelText}
                </button>
              )}
              <button
                onClick={confirmModal.onConfirm}
                className={`${confirmModal.cancelText ? 'flex-1' : 'w-full'} px-4 py-2 rounded-lg font-medium transition ${
                  confirmModal.type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' :
                  confirmModal.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 text-white' :
                  'bg-cmf-primary hover:bg-cmf-secondary text-white'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
