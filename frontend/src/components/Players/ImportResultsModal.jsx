import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, FileText, AlertTriangle, Check, Loader2, ChevronRight, AlertCircle, Download, RotateCcw, Info, Save, Clock, FileSpreadsheet, Edit2, Eye, Database, Camera, Link, Wand } from 'lucide-react';
import api from '../../lib/api';
import { useEvent } from '../../context/EventContext';
import { generateDefaultMapping, REQUIRED_HEADERS } from '../../utils/csvUtils';

export default function ImportResultsModal({ onClose, onSuccess, availableDrills = [], initialMode = 'create_or_update', intent = 'roster_and_scores', showModeSwitch = true, droppedFile = null }) {
  const { selectedEvent } = useEvent();
  const [step, setStep] = useState('input'); // input, parsing, sheet_selection, review, submitting, success, history
  
  // Fetch fresh schema on mount to ensure we have latest custom drills
  // This fixes issues where user adds a custom drill but Import modal has stale prop data
  const [serverDrills, setServerDrills] = useState(null);
  const [schemaError, setSchemaError] = useState(null);
  
  useEffect(() => {
      if (selectedEvent?.id) {
          setSchemaError(null);
          api.get(`/events/${selectedEvent.id}/schema`)
             .then(res => {
                 console.log("[ImportResultsModal] Fresh schema loaded:", res.data.drills.length, "drills");
                 setServerDrills(res.data.drills);
             })
             .catch(err => {
                 console.error("[ImportResultsModal] Failed to load fresh schema:", err);
                 setSchemaError("Failed to load event configuration. Import is disabled to prevent data loss. Please refresh the page.");
             });
      }
  }, [selectedEvent?.id]);

  // Use server drills if available, otherwise fallback to prop
  const effectiveDrills = useMemo(() => {
      return serverDrills || availableDrills;
  }, [serverDrills, availableDrills]);

  const [method, setMethod] = useState('file'); // file, text
  const [importMode, setImportMode] = useState(initialMode); // create_or_update, scores_only
  const [file, setFile] = useState(droppedFile); // Initialize with droppedFile if provided
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [error, setError] = useState(null);
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
                if (window.confirm("Found an unfinished import draft. Would you like to resume?")) {
                    setParseResult(draft.parseResult);
                    setEditedRows(draft.editedRows || {});
                    setRowStrategies(draft.rowStrategies || {});
                    setConflictMode(draft.conflictMode || 'overwrite');
                    setStep('review');
                } else {
                    localStorage.removeItem(draftKey);
                }
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
      { key: 'notes', label: 'Notes' }
  ];

  const MAPPING_OPTIONS = useMemo(() => {
      const baseOptions = [{ label: "Player Fields", options: STANDARD_FIELDS }];
      
      // If intent is roster_only, do NOT show drill options
      if (intent === 'roster_only') {
          return baseOptions;
      }
      
      return [...baseOptions, ...drillMappingOptions];
  }, [intent, drillMappingOptions]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
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
    
    const droppedFile = files[0];
    
    // Validate file type based on current method
    if (method === 'photo') {
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
      if (!validImageTypes.includes(droppedFile.type.toLowerCase()) && 
          !droppedFile.name.toLowerCase().match(/\.(jpg|jpeg|png|heic)$/)) {
        setError('Invalid file type. Please upload an image file (JPG, PNG, HEIC).');
        return;
      }
    } else {
      // For file method, validate CSV/Excel
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExtension = droppedFile.name.toLowerCase().substring(droppedFile.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        setError(`Invalid file type. Please upload a CSV or Excel file (${validExtensions.join(', ')})`);
        return;
      }
    }
    
    // File is valid, set it and clear any previous errors
    setFile(droppedFile);
    setError(null);
  };

  const handleDownloadTemplate = () => {
    const url = `${api.defaults.baseURL}/events/${selectedEvent.id}/import-template`;
    window.open(url, '_blank');
  };

  const handleDownloadPDF = () => {
    const url = `${api.defaults.baseURL}/events/${selectedEvent.id}/export-pdf`;
    window.open(url, '_blank');
  };

  const handleParse = async (sheetName = null) => {
    if ((method === 'file' || method === 'photo') && !file) {
      setError(method === 'photo' ? 'Please select a photo' : 'Please select a file');
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
      if (method === 'file' || method === 'photo') {
        formData.append('file', file);
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
      // Clear file to prevent re-trigger of auto-parse on error
      setFile(null);
    }
  };
  
  // If a file was dropped, auto-parse it after modal opens
  // Ref to track if we've already auto-parsed this file to prevent loops
  const hasAutoParseRef = useRef(false);
  
  useEffect(() => {
    if (droppedFile && step === 'input' && file && !hasAutoParseRef.current) {
      hasAutoParseRef.current = true; // Mark as triggered
      // Small delay to allow modal animation to complete
      const timer = setTimeout(() => {
        handleParse();
      }, 300);
      return () => clearTimeout(timer);
    }
    // Reset flag when file changes to allow new files to be auto-parsed
    if (!file) {
      hasAutoParseRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedFile, step, file]); // Track file changes to reset flag

    const [importSummary, setImportSummary] = useState(null);
    
    // Initialize required field mappings from auto-detected mapping
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
            const nameLikeColumns = sourceKeys.filter(key => {
                const lower = key.toLowerCase();
                return lower.includes('name') || lower.includes('player');
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

    const handleSubmit = async () => {
    if (!parseResult) return;
    
    // CRITICAL: Validate required fields FIRST before any other validation
    const requiredStatus = getRequiredFieldsStatus();
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
        if (invalidMappings.length > 0) {
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
                if (!window.confirm(`⚠️ WARNING: Potential Data Loss\n\nThe following columns contain data but are not mapped to any event drill:\n\n${names}\n\nThey will NOT be imported. Continue?`)) {
                    setStep('review');
                    return;
                }
            }
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

        if (ignoredWithData.length > 0) {
          const names = ignoredWithData.slice(0, 5).join(', ') + (ignoredWithData.length > 5 ? '...' : '');
          // Just a confirmation to ensure they meant to ignore data-bearing columns
          // If they say cancel, we go back. If OK, we proceed (data is dropped as requested)
          if (!window.confirm(
            `NOTE: You are choosing to ignore columns that contain data:\n\n${names}\n\nThis data will NOT be imported. Continue?`
          )) {
              setStep('review');
              return;
          }
        }

        // --- NEW: PREVENT SILENT FAILURE (0 SCORES) ---
        // Calculate how many columns are mapped to actual drill keys
        const mappedDrillCount = activeMappings.filter(([_, targetKey]) => {
            return effectiveDrills.some(d => d.key === targetKey);
        }).length;

        // Detect if there are potential drill columns (non-identity fields with numeric data)
        const identityFields = ['first_name', 'last_name', 'name', 'jersey_number', 'player_number', 'age_group', 'team_name', 'position', 'external_id', 'notes'];
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

        // Strict Block for Scores Only Mode
        if (importMode === 'scores_only' && mappedDrillCount === 0) {
            alert("❌ Import Blocked\n\nYou selected 'Upload Drill Scores' but no columns are mapped to valid drill results.\n\nPlease map your columns to the event's drills (check dropdowns) or switch to 'Add & Update Players' if you only have roster data.");
            setStep('review');
            return;
        }

        // Softer confirmation for Roster+Scores Intent with unmapped drill columns
        if (intent !== 'roster_only' && mappedDrillCount === 0 && potentialDrillColumns.length > 0) {
            // Show custom confirm dialog with helpful options
            const userChoice = window.confirm(
                `📊 Unmapped Drill Columns Detected\n\n` +
                `We found ${potentialDrillColumns.length} column(s) that look like drill scores:\n` +
                `${potentialDrillColumns.slice(0, 3).join(', ')}${potentialDrillColumns.length > 3 ? '...' : ''}\n\n` +
                `These aren't mapped yet, so no scores will be imported.\n\n` +
                `• Click OK to import players only (you can add scores later)\n` +
                `• Click Cancel to map drill columns now (scroll to Step 2)`
            );
            
            if (!userChoice) {
                // User wants to map drills - scroll to Step 2 header
                document.getElementById('step-2-header')?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
                setStep('review');
                return;
            }
        } else if (intent !== 'roster_only' && mappedDrillCount === 0 && potentialDrillColumns.length === 0) {
            // No drill-like columns detected, proceed with simple confirmation
            if (!window.confirm(
                `Import roster only?\n\nNo drill score columns detected. Click OK to import player names and info only.`
            )) {
                setStep('review');
                return;
            }
        }

    // Auto-fix: Treat invalid mappings as ignore if the target key itself isn't valid
    if (invalidMappings.length > 0) {
        // If we reached here, the unmapped columns have no data OR the user confirmed they accept data loss
        // So we can proceed. We effectively "ignore" them by not including them in the mapped payload.
    }

    setStep('submitting');
    try {
      // Merge edited data and filter based on strategy
      let playersToUpload = allRows.map(row => {
          const edited = editedRows[row.row_id] || {};
          const mergedData = { ...row.data, ...edited };
          
          // Apply column mapping (rename keys) - use updatedMapping which includes required field selections
          const mappedData = {};
          Object.keys(mergedData).forEach(k => {
              const targetKey = updatedMapping[k] || k;
              // Strict Filtering: Only include keys that are in validKeys (respects intent)
              if (targetKey !== '__ignore__' && validKeys.has(targetKey)) {
                  mappedData[targetKey] = mergedData[k];
              }
          });

          // CRITICAL FIX: Handle 'name' field by splitting into first_name/last_name
          // If user mapped a column to 'name', split it and populate first_name/last_name
          if (mappedData.name && !mappedData.first_name && !mappedData.last_name) {
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
          }

          // Strategy: if it was an error row, default to overwrite (new insert attempt)
          // unless it matches a duplicate? Error rows usually don't have is_duplicate set by backend
          const strategy = rowStrategies[row.row_id] || (row.is_duplicate ? conflictMode : 'overwrite');
          
          return {
              ...mappedData,
              merge_strategy: strategy
          };
      });
      
      // Filter out skipped rows
      const skippedCount = playersToUpload.filter(p => p.merge_strategy === 'skip').length;
      playersToUpload = playersToUpload.filter(p => p.merge_strategy !== 'skip');

      if (playersToUpload.length > 0) {
          console.log("[ImportResultsModal] Submitting first player:", playersToUpload[0]);
      }

      if (playersToUpload.length === 0) {
        setError("No players to import (all skipped).");
        setStep('review');
        return;
      }

      const response = await api.post('/players/upload', {
        event_id: selectedEvent.id,
        players: playersToUpload,
        skipped_count: skippedCount,
        method: method,
        filename: file ? file.name : (url || 'paste'),
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
    } else if (undoTimer === 0) {
        setUndoLog(null);
        setTimeout(() => {
            onSuccess?.(false); // isRevert = false
            onClose();
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, undoLog, undoTimer, onSuccess, onClose]);

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

  const renderInputStep = () => (
    <div className="space-y-6">
      {/* Import Mode Selection */}
      {showModeSwitch && (
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">Import Goal</label>
        <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              <strong>Choose one mode for this import:</strong> Use the same CSV for both modes if needed. Roster mode creates/updates players; Results mode only updates scores for existing players.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
            <button
                onClick={() => setImportMode('create_or_update')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-left flex items-start gap-3 transition-all ${
                    importMode === 'create_or_update'
                    ? 'border-cmf-primary bg-white ring-1 ring-cmf-primary'
                    : 'border-transparent bg-white hover:bg-gray-50'
                }`}
            >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                    importMode === 'create_or_update' ? 'border-cmf-primary' : 'border-gray-400'
                }`}>
                    {importMode === 'create_or_update' && <div className="w-2 h-2 rounded-full bg-cmf-primary" />}
                </div>
                <div>
                    <div className="font-semibold text-gray-900">Import Roster</div>
                    <div className="text-xs text-gray-500 mt-1">Create new players or update existing ones. Best for first imports.</div>
                    <div className="text-xs text-cmf-primary font-medium mt-1">
                        Can also upload scores in the same file.
                    </div>
                </div>
            </button>
            <button
                onClick={() => setImportMode('scores_only')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-left flex items-start gap-3 transition-all ${
                    importMode === 'scores_only'
                    ? 'border-cmf-primary bg-white ring-1 ring-cmf-primary'
                    : 'border-transparent bg-white hover:bg-gray-50'
                }`}
            >
                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                    importMode === 'scores_only' ? 'border-cmf-primary' : 'border-gray-400'
                }`}>
                    {importMode === 'scores_only' && <div className="w-2 h-2 rounded-full bg-cmf-primary" />}
                </div>
                <div>
                    <div className="font-semibold text-gray-900">Import Results</div>
                    <div className="text-xs text-gray-500 mt-1">Match existing roster. Won't create new players.</div>
                    <div className="text-xs text-cmf-primary mt-1 font-medium">
                        Only updates scores for players already in your event.
                    </div>
                </div>
            </button>
        </div>
      </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* SCORES ONLY WARNING - Placed above actions */}
        {importMode === 'scores_only' && (
            <div className="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-bold text-center shadow-sm mb-2">
                Won't create players. Unmatched rows will error.
            </div>
        )}
      </div>

      {/* PRIMARY DROPZONE - Always visible, large tile */}
      <div 
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer mb-4 ${
          isDragging 
            ? 'border-cmf-primary bg-blue-50 scale-[1.02]' 
            : 'border-gray-300 hover:bg-gray-50 hover:border-cmf-primary/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".csv,.xlsx,.xls"
        />
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        {file ? (
          <div>
            <p className="font-medium text-cmf-primary text-lg">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Choose different file
            </button>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-gray-900 text-lg mb-1">
              {isDragging ? "Drop to upload" : "Click to choose a file or drag & drop"}
            </p>
            <p className="text-sm text-gray-500">
              {isDragging ? "Release to upload your file" : "Supports CSV, Excel (.xlsx, .xls)"}
            </p>
          </div>
        )}
      </div>

      {/* ALTERNATIVE METHODS - Smaller secondary options */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2 text-center">Or use alternative method:</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setMethod('photo')}
            className="p-2 rounded-lg border border-gray-200 hover:border-cmf-primary hover:bg-blue-50 transition-all flex flex-col items-center gap-1 text-gray-600 hover:text-cmf-primary"
          >
            <Camera className="w-4 h-4" />
            <span className="text-xs font-medium">Photo OCR</span>
          </button>
          <button
            onClick={() => setMethod('sheets')}
            className="p-2 rounded-lg border border-gray-200 hover:border-cmf-primary hover:bg-blue-50 transition-all flex flex-col items-center gap-1 text-gray-600 hover:text-cmf-primary"
          >
            <Link className="w-4 h-4" />
            <span className="text-xs font-medium">Google Sheets</span>
          </button>
          <button
            onClick={() => setMethod('text')}
            className="p-2 rounded-lg border border-gray-200 hover:border-cmf-primary hover:bg-blue-50 transition-all flex flex-col items-center gap-1 text-gray-600 hover:text-cmf-primary"
          >
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">Copy & Paste</span>
          </button>
        </div>
      </div>

      {/* Show alternative method input if selected */}
      {method === 'photo' && (
        <div 
          className="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer mb-4 border-cmf-primary bg-blue-50"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
          <Camera className="w-10 h-10 text-cmf-primary mx-auto mb-3" />
          {file ? (
            <div>
              <p className="font-medium text-cmf-primary">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-700">
                {isDragging ? "Drop to upload" : "Click to take/upload photo"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {isDragging ? "Release to upload your file" : "Supports JPG, PNG, HEIC"}
              </p>
            </div>
          )}
        </div>
      )}
      
      {method === 'sheets' && (
        <div className="mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full p-4 rounded-xl border-2 border-cmf-primary focus:ring-2 focus:ring-cmf-primary focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-2">
            Paste a public Google Sheet link. Make sure "Anyone with the link" can view.
          </p>
        </div>
      )}
      
      {method === 'text' && (
        <div className="mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholderText}
            className="w-full h-48 p-4 rounded-xl border-2 border-cmf-primary focus:ring-2 focus:ring-cmf-primary focus:border-transparent font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            {supportedColumnsText}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-4">
            <button
                onClick={handleDownloadTemplate}
                className="text-sm text-cmf-primary hover:text-cmf-secondary font-medium flex items-center gap-2"
            >
                <Download className="w-4 h-4" /> Template
            </button>
            <button
                onClick={fetchHistory}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2"
            >
                <Clock className="w-4 h-4" /> History
            </button>
        </div>

        <div className="flex gap-3">
            <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
            >
            Cancel
            </button>
            <button
            onClick={() => handleParse()}
            disabled={
              (method === 'file' && !file) || 
              (method === 'photo' && !file) || 
              (method === 'text' && !text.trim()) || 
              (method === 'sheets' && !url.trim()) ||
              !!schemaError
            }
            className="px-6 py-2 bg-cmf-primary text-white rounded-lg font-medium hover:bg-cmf-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
            Review Data <ChevronRight className="w-4 h-4" />
            </button>
        </div>
      </div>
      
      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm mt-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {schemaError && (
        <div className="flex items-start gap-3 p-3 bg-red-100 text-red-800 rounded-lg text-sm mt-2 border border-red-200">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Configuration Error:</strong> {schemaError}
          </div>
        </div>
      )}
    </div>
  );

  const renderSheetSelectionStep = () => (
      <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
              <FileSpreadsheet className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                  <h3 className="font-medium text-blue-900">Multiple Sheets Detected</h3>
                  <p className="text-sm text-blue-700">Please select which sheet contains your combine results.</p>
              </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
              {sheets.map((sheet, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleParse(sheet.name)}
                    className="text-left p-4 rounded-xl border hover:border-cmf-primary hover:shadow-sm transition-all bg-white group"
                  >
                      <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-900 group-hover:text-cmf-primary">{sheet.name}</span>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-cmf-primary" />
                      </div>
                      {sheet.preview && (
                          <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded overflow-hidden whitespace-nowrap">
                              {sheet.preview.map((row, rIdx) => (
                                  <div key={rIdx} className="truncate">{row.join(' | ')}</div>
                              ))}
                          </div>
                      )}
                  </button>
              ))}
          </div>
          <button
            onClick={() => setStep('input')}
            className="text-gray-500 text-sm hover:text-gray-700"
          >
              Cancel and go back
          </button>
      </div>
  );

  const renderReviewStep = () => {
    if (!parseResult) return null;
    const { valid_rows, errors, summary, detected_sport, confidence } = parseResult;
    const hasErrors = errors.length > 0;
    const duplicates = valid_rows.filter(r => r.is_duplicate);
    const hasDuplicates = duplicates.length > 0;

    // Format errors to match row structure
    const formattedErrors = errors.map(e => ({
        row_id: e.row,
        data: e.data || {},
        errors: [e.message],
        is_error: true,
        is_duplicate: false
    }));

    const allRows = [...valid_rows, ...formattedErrors].sort((a, b) => a.row_id - b.row_id);
    
    const rowsToDisplay = reviewFilter === 'errors' ? formattedErrors 
                        : reviewFilter === 'valid' ? valid_rows 
                        : allRows;

    // Get all unique keys from data for table headers
    const allKeys = allRows.length > 0 
      ? Array.from(new Set(allRows.flatMap(r => Object.keys(r.data || {}))))
      : [];
    
    // Get source columns (for required fields dropdowns)
    const sourceColumns = allKeys.filter(k => !k.endsWith('_raw') && k !== 'merge_strategy');
    
    // CRITICAL FIX: Always show ALL source columns for mapping, not just recognized ones
    // The user needs to be able to map ANY CSV column to ANY target field
    // Previous logic filtered out columns if they weren't in priorityKeys, preventing mapping of e.g. "player_name" → "first_name"
    const priorityKeys = ['first_name', 'last_name', 'jersey_number', 'age_group'];
    const drillKeys = allKeys.filter(k => !priorityKeys.includes(k) && !k.endsWith('_raw') && k !== 'merge_strategy');
    
    // Show priority keys that exist, then all other keys
    // This ensures name fields appear first if present, but ALL columns are available for mapping
    const displayKeys = [...priorityKeys.filter(k => allKeys.includes(k)), ...drillKeys];
    
    // Check required field status
    const requiredStatus = getRequiredFieldsStatus();
    const requiredFieldsComplete = requiredStatus.valid;
    
    // Detect unmapped drill columns (potential scores user might have missed)
    const identityFields = ['first_name', 'last_name', 'name', 'jersey_number', 'age_group', 'team_name', 'position', 'external_id', 'notes'];
    const unmappedDrillColumns = requiredFieldsComplete && intent !== 'roster_only' ? sourceColumns.filter(key => {
        // Not an identity field
        if (identityFields.some(id => key.toLowerCase().includes(id.toLowerCase()))) return false;
        // Not already mapped to a drill
        if (keyMapping[key] && effectiveDrills.some(d => d.key === keyMapping[key])) return false;
        // Has numeric-looking data in first few rows
        const hasNumericData = allRows.slice(0, 5).some(row => {
            const val = row.data?.[key];
            return val && !isNaN(parseFloat(val));
        });
        return hasNumericData;
    }) : [];

    const handleCellEdit = (rowId, key, value) => {
        setEditedRows(prev => ({
            ...prev,
            [rowId]: {
                ...(prev[rowId] || {}),
                [key]: value
            }
        }));
    };

    const handleStrategyChange = (rowId, strategy) => {
        setRowStrategies(prev => ({
            ...prev,
            [rowId]: strategy
        }));
    };

    return (
      <div className="space-y-4">
        {/* Detected Sport Banner - Only show if sport was actually detected (not from event) */}
        {detected_sport && confidence !== 'event' && (
          <div className="flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100">
              <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  <span>
                      Detected Sport: <strong>{detected_sport || 'Unknown'}</strong> 
                      {confidence && <span className="opacity-75 text-xs ml-1">({confidence} confidence)</span>}
                  </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-blue-600">
                  <Save className="w-3 h-3" />
                  <span>Draft saved automatically</span>
              </div>
          </div>
        )}
        
        {/* REQUIRED FIELDS PANEL - Progressive Disclosure */}
        <div 
            id="required-fields-panel"
            className={`border-2 rounded-xl p-5 transition-all ${
                requiredFieldsComplete 
                ? 'bg-green-50 border-green-200' 
                : requiredFieldsError 
                ? 'bg-red-50 border-red-300 animate-pulse' 
                : 'bg-amber-50 border-amber-300'
            }`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    {requiredFieldsComplete ? (
                        <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                            <Check className="w-4 h-4" />
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                            !
                        </div>
                    )}
                    <h3 className="font-bold text-gray-900">
                        {requiredFieldsComplete ? '✅ Required Fields Mapped' : '📋 STEP 1: Map Required Fields'}
                    </h3>
                </div>
                {requiredFieldsComplete && (
                    <button 
                        onClick={() => {
                            // Allow user to edit even after validation passes
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                        <Edit2 className="w-3 h-3" />
                        Edit
                    </button>
                )}
            </div>
            
            {requiredFieldsError && (
                <div className="mb-3 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{requiredFieldsError}</span>
                </div>
            )}
            
            {!requiredFieldsComplete && (
                <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-700">
                        {importMode === 'scores_only' 
                            ? 'Names are required to match players in your existing roster.' 
                            : 'These fields are required to import players.'}
                    </p>
                    <p className="text-xs text-gray-500 italic">
                        Until names are mapped, rows are marked as incomplete — this is expected.
                    </p>
                </div>
            )}
            
            {requiredFieldsComplete ? (
                // Collapsed view showing current mappings
                <div className="space-y-1 text-sm text-gray-700">
                    {nameMappingMode === 'separate' ? (
                        <div>✓ Names: <strong>{firstNameColumn}</strong> + <strong>{lastNameColumn}</strong></div>
                    ) : (
                        <div>✓ Full Name: <strong>{fullNameColumn}</strong> → Auto-split into First/Last</div>
                    )}
                    {jerseyColumn && <div>✓ Jersey #: <strong>{jerseyColumn}</strong></div>}
                    {ageGroupColumn && <div>✓ Age Group: <strong>{ageGroupColumn}</strong></div>}
                </div>
            ) : (
                // Expanded view for mapping
                <div className="space-y-4">
                    {/* Name Mapping - First Class Treatment */}
                    <div className="space-y-3">
                        <label className="block font-semibold text-gray-900 text-sm">
                            Player Names <span className="text-red-500">*</span>
                        </label>
                        
                        <div className="space-y-2">
                            <label 
                                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                    nameMappingMode === 'separate' 
                                    ? 'border-cmf-primary bg-white ring-2 ring-cmf-primary/20' 
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name="nameMode" 
                                    value="separate"
                                    checked={nameMappingMode === 'separate'}
                                    onChange={(e) => setNameMappingMode(e.target.value)}
                                    className="mt-0.5"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">Separate First & Last Name columns</div>
                                    <div className="text-xs text-gray-500 mt-0.5">Best for clean data</div>
                                    {nameMappingMode === 'separate' && (
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                                                <select
                                                    value={firstNameColumn}
                                                    onChange={(e) => {
                                                        setFirstNameColumn(e.target.value);
                                                        setRequiredFieldsError('');
                                                    }}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cmf-primary focus:border-transparent"
                                                >
                                                    <option value="">Select column...</option>
                                                    {sourceColumns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                                                <select
                                                    value={lastNameColumn}
                                                    onChange={(e) => {
                                                        setLastNameColumn(e.target.value);
                                                        setRequiredFieldsError('');
                                                    }}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cmf-primary focus:border-transparent"
                                                >
                                                    <option value="">Select column...</option>
                                                    {sourceColumns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </label>
                            
                            <label 
                                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                    nameMappingMode === 'full' 
                                    ? 'border-cmf-primary bg-white ring-2 ring-cmf-primary/20' 
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name="nameMode" 
                                    value="full"
                                    checked={nameMappingMode === 'full'}
                                    onChange={(e) => setNameMappingMode(e.target.value)}
                                    className="mt-0.5"
                                />
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900 flex items-center gap-2">
                                        <Wand className="w-4 h-4 text-purple-500" />
                                        Single Full Name column (auto-split)
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        We'll split "John Smith" → First: John, Last: Smith
                                    </div>
                                    {nameMappingMode === 'full' && (
                                        <div className="mt-3">
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name Column</label>
                                            <select
                                                value={fullNameColumn}
                                                onChange={(e) => {
                                                    setFullNameColumn(e.target.value);
                                                    setRequiredFieldsError('');
                                                }}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cmf-primary focus:border-transparent"
                                            >
                                                <option value="">Select column...</option>
                                                {sourceColumns.map(col => (
                                                    <option key={col} value={col}>{col}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    {/* Optional Fields */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Player Number <span className="text-gray-400">(Optional)</span>
                            </label>
                            <select
                                value={jerseyColumn}
                                onChange={(e) => setJerseyColumn(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cmf-primary focus:border-transparent"
                            >
                                <option value="">Not mapped</option>
                                {sourceColumns.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Age Group <span className="text-gray-400">(Optional)</span>
                            </label>
                            <select
                                value={ageGroupColumn}
                                onChange={(e) => setAgeGroupColumn(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cmf-primary focus:border-transparent"
                            >
                                <option value="">Not mapped</option>
                                {sourceColumns.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Step 2: Drill Scores Mapping Header */}
        <div 
            id="step-2-header"
            className={`border-2 rounded-xl p-4 ${
                requiredFieldsComplete 
                ? 'bg-white border-gray-200' 
                : 'bg-gray-50 border-gray-200 opacity-60'
            }`}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {requiredFieldsComplete ? (
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                            2
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center font-bold text-sm">
                            2
                        </div>
                    )}
                    <h3 className="font-bold text-gray-900">
                        {intent === 'roster_only' ? 'Review Roster Data' : 'Map Drill Scores (Optional)'}
                    </h3>
                </div>
                {!requiredFieldsComplete && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <AlertCircle className="w-3 h-3" />
                        Complete Step 1 first
                    </div>
                )}
            </div>
            {requiredFieldsComplete && intent !== 'roster_only' && (
                <p className="text-sm text-gray-600">
                    Use column header dropdowns below to map your drill score columns. Unmapped columns will be ignored.
                </p>
            )}
        </div>
        
        {/* Unmapped Drill Columns Banner - Show when potential scores detected */}
        {unmappedDrillColumns.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h4 className="font-semibold text-amber-900 mb-1">
                        📊 Possible unmapped drill columns detected
                    </h4>
                    <p className="text-sm text-amber-800 mb-2">
                        We found {unmappedDrillColumns.length} numeric {unmappedDrillColumns.length === 1 ? 'column' : 'columns'} that {unmappedDrillColumns.length === 1 ? 'is' : 'are'} not yet mapped and could represent drill scores:
                    </p>
                    <div className="flex flex-wrap gap-1 mb-2">
                        {unmappedDrillColumns.slice(0, 5).map(col => (
                            <span key={col} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-mono">
                                {col}
                            </span>
                        ))}
                        {unmappedDrillColumns.length > 5 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">
                                +{unmappedDrillColumns.length - 5} more
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-amber-700 mb-2 italic">
                        Numeric columns that are already mapped or recognized as player information are not shown here.
                    </p>
                    <p className="text-sm text-amber-800">
                        <strong>Use the column header dropdowns below to map these, or ignore them to import player info only.</strong>
                    </p>
                </div>
            </div>
        )}

        <div className="flex gap-4">
          <button 
            onClick={() => setReviewFilter('valid')}
            className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                reviewFilter === 'valid' ? 'ring-2 ring-green-500 border-transparent' : ''
            } bg-green-50 border-green-100`}
          >
            <div className="text-2xl font-bold text-green-700">
                {requiredFieldsComplete ? summary.valid_count : '—'}
            </div>
            <div className="text-sm text-green-600 font-medium">
                {requiredFieldsComplete ? 'Ready to Import' : 'Awaiting Mapping'}
            </div>
          </button>
          <button 
            onClick={() => setReviewFilter('errors')}
            className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                reviewFilter === 'errors' ? 'ring-2 ring-blue-500 border-transparent' : ''
            } ${requiredFieldsComplete ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}
          >
            <div className={`text-2xl font-bold ${
                requiredFieldsComplete ? 'text-blue-700' : 'text-amber-700'
            }`}>
                {requiredFieldsComplete ? summary.error_count : summary.total_rows}
            </div>
            <div className={`text-sm font-medium ${
                requiredFieldsComplete ? 'text-blue-600' : 'text-amber-600'
            }`}>
                {requiredFieldsComplete ? 'Pending Review' : 'Action Required'}
            </div>
          </button>
          <button 
            onClick={() => setReviewFilter('all')}
            className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                reviewFilter === 'all' ? 'ring-2 ring-gray-500 border-transparent' : ''
            } bg-white border-gray-200`}
          >
            <div className="text-2xl font-bold text-gray-700">{summary.total_rows}</div>
            <div className="text-sm text-gray-500 font-medium">Total Rows</div>
          </button>
        </div>
        
        {/* Import Confidence Helper - Show when ready to import */}
        {requiredFieldsComplete && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                    <strong>Ready to import:</strong> Final validation will run when you click Import Data. 
                    Any issues will be reported before data is saved.
                </div>
            </div>
        )}
        
        {/* Within-File Duplicate Detection (from backend parse errors) */}
        {hasErrors && (() => {
            const duplicateErrors = errors.filter(e => e.message?.includes('Duplicate:'));
            const otherErrors = errors.filter(e => !e.message?.includes('Duplicate:'));
            
            if (duplicateErrors.length === 0) return null;
            
            return (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                    <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Duplicate Players Detected ({duplicateErrors.length})</span>
                    </h3>
                    <p className="text-sm text-yellow-700 mb-3">
                        The following rows match other entries in this file. 
                        Players are matched by name + jersey number (age group is ignored).
                        If the same athlete plays in multiple age groups, use a different jersey number or add a suffix to the name.
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {duplicateErrors.map((err, i) => (
                            <div key={i} className="bg-white rounded p-3 border border-yellow-200">
                                <div className="flex items-start gap-2">
                                    <span className="text-yellow-600 font-mono text-sm">
                                        Row {err.row}
                                    </span>
                                    <div className="flex-1">
                                        <div className="text-sm text-gray-800 font-medium mb-1">
                                            {err.data?.first_name} {err.data?.last_name}
                                            {err.data?.jersey_number && ` #${err.data.jersey_number}`}
                                            {err.data?.age_group && ` (${err.data.age_group})`}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            {err.message}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-yellow-200">
                        <p className="text-xs text-yellow-700">
                            <strong>How to fix:</strong> Assign different jersey numbers, 
                            remove duplicate rows, or import age groups separately.
                        </p>
                    </div>
                </div>
            );
        })()}

        {hasDuplicates && (
             <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h4 className="font-semibold text-amber-800 mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> {duplicates.length} Potential Duplicates Found
                        </h4>
                        <p className="text-xs text-amber-700">
                            Select a default action for duplicates. You can override this per row below.
                        </p>
                    </div>
                    <div className="flex bg-white rounded-lg border border-amber-200 p-1 self-start">
                        <button
                            onClick={() => setConflictMode('overwrite')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                conflictMode === 'overwrite' 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Overwrite
                        </button>
                        <button
                            onClick={() => setConflictMode('merge')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                conflictMode === 'merge' 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Merge
                        </button>
                        <button
                            onClick={() => setConflictMode('skip')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                conflictMode === 'skip' 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Skip
                        </button>
                    </div>
                </div>
             </div>
        )}

        <div className="border rounded-xl overflow-hidden flex flex-col max-h-[50vh] relative">
          {/* Overlay when required fields incomplete */}
          {!requiredFieldsComplete && (
              <div className="absolute inset-0 bg-gray-100/80 backdrop-blur-[2px] z-20 flex items-center justify-center">
                  <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm text-center border-2 border-amber-300">
                      <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                      <h4 className="font-bold text-gray-900 mb-2">Complete Required Fields First</h4>
                      <p className="text-sm text-gray-600 mb-4">
                          Map player names in <strong>Step 1</strong> above to unlock the data table.
                      </p>
                      <button
                          onClick={() => {
                              document.getElementById('required-fields-panel')?.scrollIntoView({ 
                                  behavior: 'smooth', 
                                  block: 'start' 
                              });
                          }}
                          className="px-4 py-2 bg-cmf-primary text-white rounded-lg font-medium hover:bg-cmf-secondary"
                      >
                          Go to Step 1
                      </button>
                  </div>
              </div>
          )}
          
          <div className="bg-gray-50 px-4 py-2 border-b font-medium text-gray-700 text-sm flex justify-between items-center sticky top-0 z-10">
            <span>Review Data ({rowsToDisplay.length} Rows)</span>
            <span className="text-xs text-gray-500">Click cells to edit</span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm relative">
              <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-2 w-10 bg-gray-50"></th>
                  {displayKeys.map(key => (
                    <th key={key} className="px-4 py-2 text-left font-medium whitespace-nowrap bg-gray-50 min-w-[150px]">
                      <select
                        value={keyMapping[key] || key}
                        onChange={(e) => setKeyMapping(prev => ({ ...prev, [key]: e.target.value }))}
                        className="bg-transparent border-b border-dashed border-gray-400 text-gray-700 font-semibold focus:outline-none focus:border-cmf-primary hover:text-cmf-primary cursor-pointer text-sm pr-6 py-1"
                        style={{ maxWidth: '140px' }}
                      >
                        <option value="__ignore__">Ignore Column</option>
                        {MAPPING_OPTIONS.map((group, idx) => (
                            <optgroup key={idx} label={group.label}>
                                {group.options.map(opt => (
                                    <option key={opt.key} value={opt.key}>
                                        {opt.label}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                        {/* Allow keeping original if not in list */}
                        {!MAPPING_OPTIONS.some(g => g.options.some(o => o.key === key)) && (
                            <option value={key}>{key.replace('_', ' ')} (Original)</option>
                        )}
                      </select>
                      <div className="text-xs text-gray-400 font-normal mt-0.5 truncate max-w-[140px] flex items-center gap-1">
                        Src: {key}
                        {autoMappedKeys[key] && (
                            <div className="group relative">
                                <Wand className={`w-3 h-3 ${autoMappedKeys[key] === 'high' ? 'text-purple-500' : 'text-purple-300'}`} />
                                <div className="hidden group-hover:block absolute left-0 bottom-full mb-1 bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50">
                                    Auto-mapped from "{key}"
                                </div>
                            </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-2 text-left font-medium bg-gray-50">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rowsToDisplay.map((row, i) => {
                    const rowId = row.row_id;
                    const isDup = row.is_duplicate;
                    const isErr = row.is_error;
                    const edited = editedRows[rowId] || {};
                    const currentData = { ...row.data, ...edited };
                    
                    // Determine current strategy
                    const strategy = rowStrategies[rowId] || (isDup ? conflictMode : 'overwrite');
                    const isSkipped = strategy === 'skip' && !isErr;
                    
                    // Check if any mapped columns are ignored
                    const isIgnored = displayKeys.every(k => keyMapping[k] === '__ignore__');
                    
                    if (isIgnored) return null;

                    return (
                      <tr key={i} className={`hover:bg-gray-50 group ${
                          isSkipped ? 'opacity-40 bg-gray-50' : 
                          !requiredFieldsComplete ? 'bg-gray-50' : // Neutral gray when waiting for mapping
                          isDup && !isSkipped ? 'bg-amber-50/30' : 
                          isErr && !(row.errors[0]?.toLowerCase().includes('missing') || row.errors[0]?.toLowerCase().includes('name')) ? 'bg-red-50/30' : // Only red for non-name errors
                          '' // Default white for ready rows
                      }`}>
                        <td className="px-2 py-2 text-center">
                            {isDup ? (
                                <div className="relative group-hover:visible">
                                    <select
                                        value={strategy}
                                        onChange={(e) => handleStrategyChange(rowId, e.target.value)}
                                        className={`text-xs rounded border-none focus:ring-1 cursor-pointer p-1 w-6 h-6 appearance-none text-transparent bg-transparent absolute top-0 left-0 inset-0 z-10`}
                                        title="Handle Duplicate"
                                    >
                                        <option value="overwrite">Overwrite</option>
                                        <option value="merge">Merge</option>
                                        <option value="skip">Skip</option>
                                    </select>
                                    {/* Visual Indicator */}
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                        ${strategy === 'overwrite' ? 'bg-amber-100 text-amber-700' : 
                                          strategy === 'merge' ? 'bg-blue-100 text-blue-700' : 
                                          'bg-gray-200 text-gray-500'}`
                                    }>
                                        {strategy === 'overwrite' ? 'O' : strategy === 'merge' ? 'M' : 'S'}
                                    </div>
                                </div>
                            ) : (
                                <span className="text-gray-300 text-xs">{rowId}</span>
                            )}
                        </td>
                        {displayKeys.map(key => {
                            const val = currentData[key] ?? '';
                            const isEditing = editingCell?.rowId === rowId && editingCell?.key === key;
                            const isColumnIgnored = keyMapping[key] === '__ignore__';
                            
                            return (
                              <td 
                                key={key} 
                                className={`px-4 py-2 whitespace-nowrap text-gray-700 relative ${isColumnIgnored ? 'opacity-30 bg-gray-100' : ''}`}
                                onClick={() => !isColumnIgnored && setEditingCell({ rowId, key })}
                              >
                                {isEditing ? (
                                    <input
                                        autoFocus
                                        className="w-full px-2 py-1 -mx-2 -my-1 border rounded shadow-sm text-sm"
                                        value={val}
                                        onChange={(e) => handleCellEdit(rowId, key, e.target.value)}
                                        onBlur={() => setEditingCell(null)}
                                        onKeyDown={(e) => {
                                            if(e.key === 'Enter') setEditingCell(null);
                                        }}
                                    />
                                ) : (
                                    <div className="flex items-center gap-1 min-h-[20px]">
                                        {val !== '' ? val : <span className="text-gray-300">-</span>}
                                        {edited[key] !== undefined && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" title="Edited"></span>}
                                    </div>
                                )}
                              </td>
                            );
                        })}
                        <td className="px-4 py-2">
                            {!requiredFieldsComplete ? (
                                // Before required fields mapped, all rows show "waiting" state
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Waiting for name mapping
                                </div>
                            ) : isErr ? (
                                // After mapping, check if error is about missing names (now resolved)
                                // If so, show as "Ready" instead of error
                                row.errors[0]?.toLowerCase().includes('missing') || 
                                row.errors[0]?.toLowerCase().includes('name') ? (
                                    <div className="text-xs text-blue-600 flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        Ready
                                    </div>
                                ) : (
                                    // Other errors still show as errors
                                    <div className="text-xs text-red-600 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {row.errors[0]}
                                    </div>
                                )
                            ) : isDup ? (
                                <span className="text-xs text-amber-600 font-medium">Duplicate</span>
                            ) : (
                                <div className="text-xs text-green-600 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    Ready
                                </div>
                            )}
                        </td>
                      </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <button
            onClick={() => setStep('input')}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
          >
            Back to Input
          </button>
          <button
            onClick={handleSubmit}
            disabled={!requiredFieldsComplete}
            className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
                requiredFieldsComplete
                ? 'bg-cmf-primary text-white hover:bg-cmf-secondary'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title={!requiredFieldsComplete ? 'Complete required field mappings first' : ''}
          >
            Import Data
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderHistoryStep = () => (
      <div className="space-y-4 h-full flex flex-col">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Import History</h3>
            <button onClick={() => setStep('input')} className="text-sm text-cmf-primary hover:underline">Back</button>
          </div>
          
          <div className="overflow-y-auto flex-1 border rounded-xl divide-y">
              {loadingHistory && <div className="p-8 text-center text-gray-500">Loading history...</div>}
              {!loadingHistory && importHistory.length === 0 && (
                  <div className="p-8 text-center text-gray-500">No import history found.</div>
              )}
              {importHistory.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between mb-1">
                          <span className="font-medium text-gray-900">{new Date(item.timestamp).toLocaleString()}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${item.type === 'revert' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {item.type === 'revert' ? 'Reverted' : 'Imported'}
                          </span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500">
                          <span>{item.rows_imported ?? item.restored} Rows</span>
                          <span>{item.filename || item.method}</span>
                          <span>User: {item.user_id.slice(0, 6)}...</span>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import Results</h2>
            <p className="text-sm text-gray-500">Add players and drill scores in bulk</p>
          </div>
          <button 
            onClick={() => {
              // If closing while on success screen, treat as completion so parent can redirect
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'input' && renderInputStep()}
          {step === 'sheet_selection' && renderSheetSelectionStep()}
          {step === 'history' && renderHistoryStep()}
          
          {step === 'parsing' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-cmf-primary animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Analyzing Data...</h3>
              <p className="text-gray-500">Mapping columns and validating scores</p>
            </div>
          )}

          {step === 'review' && renderReviewStep()}

          {step === 'submitting' && (
             <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Importing...</h3>
              <p className="text-gray-500">Saving players and drill results</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-12">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  importSummary?.scores === 0 && importSummary?.players === 0 && (importSummary?.errors?.length > 0)
                  ? 'bg-red-100 text-red-600'
                  : importSummary?.scores === 0 && importSummary?.players > 0 
                  ? 'bg-amber-100 text-amber-600' 
                  : 'bg-green-100 text-green-600'
              }`}>
                {importSummary?.scores === 0 && importSummary?.players === 0 && (importSummary?.errors?.length > 0) ? (
                    <AlertCircle className="w-8 h-8" />
                ) : importSummary?.scores === 0 && importSummary?.players > 0 ? (
                    <AlertTriangle className="w-8 h-8" />
                ) : (
                    <Check className="w-8 h-8" />
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {importSummary?.scores === 0 && importSummary?.players === 0 && (importSummary?.errors?.length > 0)
                   ? 'Import Failed'
                   : importSummary?.scores === 0 && importSummary?.players > 0 
                   ? 'Imported with Warnings' 
                   : 'Import Complete!'}
              </h3>
              
              {importSummary && (
                  <div className="mb-4 text-gray-600 font-medium bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-center gap-6">
                          {importSummary.created !== undefined ? (
                              <>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-800">{importSummary.created}</div>
                                    <div className="text-xs uppercase tracking-wide text-gray-500">New</div>
                                </div>
                                <div className="w-px bg-gray-300"></div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">{importSummary.updated}</div>
                                    <div className="text-xs uppercase tracking-wide text-gray-500">Updated</div>
                                </div>
                              </>
                          ) : (
                              <div className="text-center">
                                  <div className="text-2xl font-bold text-gray-800">{importSummary.players}</div>
                                  <div className="text-xs uppercase tracking-wide text-gray-500">Players Added</div>
                              </div>
                          )}
                          <div className="w-px bg-gray-300"></div>
                          <div className="text-center">
                              <div className="text-2xl font-bold text-cmf-primary">{importSummary.scores}</div>
                              <div className="text-xs uppercase tracking-wide text-gray-500">Scores</div>
                          </div>
                          {importSummary.rejected !== undefined && importSummary.rejected > 0 && (
                              <>
                                <div className="w-px bg-gray-300"></div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-yellow-600">{importSummary.rejected}</div>
                                    <div className="text-xs uppercase tracking-wide text-gray-500">Skipped</div>
                                </div>
                              </>
                          )}
                      </div>
                  </div>
              )}
              
              {importSummary?.scores === 0 && importSummary?.players > 0 && (
                  <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-left">
                      <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-amber-800">
                              <p className="font-bold mb-1">No drill scores were saved.</p>
                              <p className="mb-1">Common causes:</p>
                              <ul className="list-disc pl-4 space-y-1 text-xs">
                                  <li>This event’s schema doesn’t include the drills you mapped (custom drills not loaded)</li>
                                  <li>The CSV columns weren’t mapped to drill keys</li>
                                  <li>You imported into a different event than you’re viewing</li>
                              </ul>
                              <p className="mt-2 text-xs italic">Check the schema and event selection.</p>
                          </div>
                      </div>
                  </div>
              )}

              {importSummary?.errors?.length > 0 && (() => {
                  const duplicateErrors = importSummary.errors.filter(e => e.message?.includes('Duplicate:'));
                  const otherErrors = importSummary.errors.filter(e => !e.message?.includes('Duplicate:'));
                  
                  return (
                      <div className="max-w-md mx-auto space-y-3 mb-4">
                          {/* Duplicate Errors - Yellow (informational) */}
                          {duplicateErrors.length > 0 && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
                                  <div className="flex items-start gap-3">
                                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                      <div className="text-sm text-yellow-800 flex-1">
                                          <p className="font-bold mb-1">
                                              {duplicateErrors.length} row{duplicateErrors.length !== 1 ? 's' : ''} skipped (duplicates)
                                          </p>
                                          <details className="mt-2">
                                              <summary className="text-xs text-yellow-700 cursor-pointer hover:text-yellow-900 font-medium">
                                                  View details →
                                              </summary>
                                              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                                  {duplicateErrors.slice(0, 10).map((e, idx) => (
                                                      <div key={idx} className="text-xs bg-white rounded p-2 border border-yellow-200">
                                                          <span className="font-mono text-yellow-700">Row {e.row}:</span>
                                                          <span className="text-gray-700 ml-1">
                                                              {e.message?.split('→')[0]}
                                                          </span>
                                                      </div>
                                                  ))}
                                                  {duplicateErrors.length > 10 && (
                                                      <div className="text-xs text-gray-500 text-center mt-1">
                                                          ... and {duplicateErrors.length - 10} more
                                                      </div>
                                                  )}
                                              </div>
                                          </details>
                                      </div>
                                  </div>
                              </div>
                          )}
                          
                          {/* Other Errors - Red (actual errors) */}
                          {otherErrors.length > 0 && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                                  <div className="flex items-start gap-3">
                                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                      <div className="text-sm text-red-800">
                                          <p className="font-bold mb-1">
                                              Encountered {otherErrors.length} error{otherErrors.length !== 1 ? 's' : ''} during import:
                                          </p>
                                          <ul className="list-disc pl-4 space-y-1 text-xs max-h-32 overflow-y-auto">
                                              {otherErrors.slice(0, 10).map((e, idx) => (
                                                  <li key={idx}>Row {e.row}: {e.message}</li>
                                              ))}
                                              {otherErrors.length > 10 && (
                                                  <li>...and {otherErrors.length - 10} more.</li>
                                              )}
                                          </ul>
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  );
              })()}

              <p className="text-gray-500 mb-1">Results have been added to your event.</p>
              {selectedEvent?.name && (
                <div className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700 mb-2">
                   <Database className="w-3 h-3" /> {selectedEvent.name}
                </div>
              )}
              
              <div className="flex justify-center gap-4 mt-8 mb-8">
                   <button 
                       onClick={() => { 
                           onSuccess?.(false); 
                           onClose(); 
                           // Force navigation to players tab to ensure context is refreshed
                           window.location.href = '/players';
                       }} 
                       className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                   >
                       View Rankings
                   </button>
                   <button
                       onClick={handleDownloadPDF}
                       className="px-6 py-2 bg-cmf-primary text-white rounded-lg font-medium hover:bg-cmf-secondary flex items-center gap-2"
                   >
                       <FileText className="w-4 h-4" /> Download Results PDF
                   </button>
              </div>

              {undoLog && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200 max-w-md mx-auto">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Made a mistake?</span>
                          <span className="text-xs text-gray-500">{undoTimer}s remaining</span>
                      </div>
                      <button
                          onClick={handleUndo}
                          disabled={undoing}
                          className="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
                      >
                          {undoing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          Undo Import
                      </button>
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
