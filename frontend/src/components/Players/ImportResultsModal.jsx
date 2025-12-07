import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Upload, FileText, AlertTriangle, Check, Loader2, ChevronRight, AlertCircle, Download, RotateCcw, Info, Save, Clock, FileSpreadsheet, Edit2, Eye, Database, Camera, Link } from 'lucide-react';
import api from '../../lib/api';
import { useEvent } from '../../context/EventContext';
import { generateDefaultMapping } from '../../utils/csvUtils';

export default function ImportResultsModal({ onClose, onSuccess, availableDrills = [] }) {
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
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [error, setError] = useState(null);
  const [undoLog, setUndoLog] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [conflictMode, setConflictMode] = useState('overwrite'); // overwrite, skip, merge
  const [undoTimer, setUndoTimer] = useState(30);
  const fileInputRef = useRef(null);
  
  // Column Mapping State
  const [keyMapping, setKeyMapping] = useState({}); // { originalKey: targetKey }

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
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'jersey_number', label: 'Jersey Number' },
      { key: 'age_group', label: 'Age Group' },
      { key: 'team_name', label: 'Team Name' },
      { key: 'position', label: 'Position' },
      { key: 'external_id', label: 'External ID' },
      { key: 'notes', label: 'Notes' }
  ];

  const MAPPING_OPTIONS = [
      { label: "Player Fields", options: STANDARD_FIELDS },
      ...drillMappingOptions
  ];

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
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
      const sourceKeys = (response.data.valid_rows.length > 0 || response.data.errors.length > 0)
          ? Object.keys((response.data.valid_rows[0] || response.data.errors[0]).data)
          : [];
          
      if (sourceKeys.length > 0) {
          // generateDefaultMapping returns { targetKey: sourceKey }
          // We need { sourceKey: targetKey } for our state
          const { mapping: suggestedMapping } = generateDefaultMapping(sourceKeys, effectiveDrills);
          
          // Apply suggested mappings
          Object.entries(suggestedMapping).forEach(([targetKey, sourceHeader]) => {
              if (sourceHeader) {
                  initialMapping[sourceHeader] = targetKey;
              }
          });
          
          // For any unmapped keys, default to identity if it matches a known drill key directly
          sourceKeys.forEach(key => {
              if (!initialMapping[key]) {
                  // If the key itself matches a drill key exactly, map it
                  if (effectiveDrills.some(d => d.key === key)) {
                      initialMapping[key] = key;
                  } else {
                      // Fallback: Use identity mapping (key -> key)
                      // This allows backend fuzzy matching to handle it if frontend normalization wasn't perfect
                      initialMapping[key] = key; 
                  }
              }
          });
      }
      
      setKeyMapping(initialMapping);
      
      setStep('review');
    } catch (err) {
      console.error("Parse error:", err);
      setError(err.response?.data?.detail || "Failed to parse import data");
      setStep('input');
    }
  };

    const [importSummary, setImportSummary] = useState(null);

    const handleSubmit = async () => {
    if (!parseResult) return;

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
        ...effectiveDrills.map(d => d.key)
    ]);

    const activeMappings = Object.entries(keyMapping)
        .filter(([_, targetKey]) => targetKey !== '__ignore__');

    const invalidMappings = activeMappings.filter(([sourceKey, targetKey]) => {
        // If mapped to identity (Original) and that key isn't in schema
        return !validKeys.has(targetKey);
    });

    // HARD STOP: Block import if there are unmapped columns that contain data
    // This prevents the "silent failure" scenario where users import but lose scores
    
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
      if (!window.confirm(
        `WARNING: These columns contain data but are set to Ignore:\n\n${names}\n\nThey will NOT be imported. Continue?`
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
          
          // Apply column mapping (rename keys)
          const mappedData = {};
          Object.keys(mergedData).forEach(k => {
              const targetKey = keyMapping[k] || k;
              if (targetKey !== '__ignore__') {
                  mappedData[targetKey] = mergedData[k];
              }
          });

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
        filename: file ? file.name : (url || 'paste')
      });
      
      if (response.data.undo_log) {
        setUndoLog(response.data.undo_log);
      }
      
      if (response.data) {
          setImportSummary({
              players: response.data.added || 0,
              scores: response.data.scores_written_total || 0
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
    return `Supported columns: First Name, Last Name, Jersey Number, Age Group, Drill Names (${drillLabels || 'e.g. 40m Dash'}, etc.)`;
  }, [effectiveDrills]);

  const renderInputStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <button
          onClick={() => setMethod('file')}
          className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
            method === 'file' 
              ? 'border-cmf-primary bg-blue-50 text-cmf-primary' 
              : 'border-gray-200 hover:border-gray-300 text-gray-600'
          }`}
        >
          <Upload className="w-6 h-6" />
          <span className="font-medium">Upload File</span>
          <span className="text-xs text-gray-500">CSV or Excel</span>
        </button>
        <button
          onClick={() => setMethod('photo')}
          className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
            method === 'photo' 
              ? 'border-cmf-primary bg-blue-50 text-cmf-primary' 
              : 'border-gray-200 hover:border-gray-300 text-gray-600'
          }`}
        >
          <Camera className="w-6 h-6" />
          <span className="font-medium">Upload Photo</span>
          <span className="text-xs text-gray-500">OCR Scan</span>
        </button>
        <button
          onClick={() => setMethod('sheets')}
          className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
            method === 'sheets' 
              ? 'border-cmf-primary bg-blue-50 text-cmf-primary' 
              : 'border-gray-200 hover:border-gray-300 text-gray-600'
          }`}
        >
          <Link className="w-6 h-6" />
          <span className="font-medium">Google Sheets</span>
          <span className="text-xs text-gray-500">Public Link</span>
        </button>
        <button
          onClick={() => setMethod('text')}
          className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
            method === 'text' 
              ? 'border-cmf-primary bg-blue-50 text-cmf-primary' 
              : 'border-gray-200 hover:border-gray-300 text-gray-600'
          }`}
        >
          <FileText className="w-6 h-6" />
          <span className="font-medium">Copy & Paste</span>
          <span className="text-xs text-gray-500">From clipboard</span>
        </button>
      </div>

      {method === 'file' || method === 'photo' ? (
        <div 
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept={method === 'photo' ? "image/*" : ".csv,.xlsx,.xls"}
          />
          {method === 'photo' ? (
             <Camera className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          ) : (
             <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          )}
          {file ? (
            <div>
              <p className="font-medium text-cmf-primary">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-700">
                {method === 'photo' ? "Click to take/upload photo" : "Click to select file"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {method === 'photo' ? "Supports JPG, PNG, HEIC" : "Supports CSV, Excel (.xlsx)"}
              </p>
            </div>
          )}
        </div>
      ) : method === 'sheets' ? (
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cmf-primary focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-2">
            Paste a public Google Sheet link. Make sure "Anyone with the link" can view.
          </p>
        </div>
      ) : (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholderText}
            className="w-full h-48 p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cmf-primary focus:border-transparent font-mono text-sm"
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
            disabled={(!file && !text) || !!schemaError}
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
    
    const priorityKeys = ['first_name', 'last_name', 'jersey_number', 'age_group'];
    const drillKeys = allKeys.filter(k => !priorityKeys.includes(k) && !k.endsWith('_raw') && k !== 'merge_strategy');
    const displayKeys = [...priorityKeys.filter(k => allKeys.includes(k)), ...drillKeys];

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
        {/* Detected Sport Banner */}
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

        <div className="flex gap-4">
          <button 
            onClick={() => setReviewFilter('valid')}
            className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                reviewFilter === 'valid' ? 'ring-2 ring-green-500 border-transparent' : ''
            } bg-green-50 border-green-100`}
          >
            <div className="text-2xl font-bold text-green-700">{summary.valid_count}</div>
            <div className="text-sm text-green-600 font-medium">Valid Rows</div>
          </button>
          <button 
            onClick={() => setReviewFilter('errors')}
            className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                reviewFilter === 'errors' ? 'ring-2 ring-red-500 border-transparent' : ''
            } ${hasErrors ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}
          >
            <div className={`text-2xl font-bold ${hasErrors ? 'text-red-700' : 'text-gray-700'}`}>{summary.error_count}</div>
            <div className={`text-sm font-medium ${hasErrors ? 'text-red-600' : 'text-gray-600'}`}>Errors</div>
          </button>
          <button 
            onClick={() => setReviewFilter('all')}
            className={`flex-1 p-4 rounded-xl border text-left transition-all ${
                reviewFilter === 'all' ? 'ring-2 ring-blue-500 border-transparent' : ''
            } bg-white border-gray-200`}
          >
            <div className="text-2xl font-bold text-gray-700">{summary.total_rows}</div>
            <div className="text-sm text-gray-500 font-medium">Total Rows</div>
          </button>
        </div>

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

        <div className="border rounded-xl overflow-hidden flex flex-col max-h-[50vh]">
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
                      <div className="text-xs text-gray-400 font-normal mt-0.5 truncate max-w-[140px]">
                        Src: {key}
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
                      <tr key={i} className={`hover:bg-gray-50 group ${isSkipped ? 'opacity-40 bg-gray-50' : ''} ${isDup && !isSkipped ? 'bg-amber-50/30' : ''} ${isErr ? 'bg-red-50/30' : ''}`}>
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
                            {isErr ? (
                                <div className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {row.errors[0]}
                                </div>
                            ) : isDup ? (
                                <span className="text-xs text-amber-600 font-medium">Duplicate</span>
                            ) : (
                                <span className="text-xs text-green-600 font-medium">Valid</span>
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
            className="px-6 py-2 bg-cmf-primary text-white rounded-lg font-medium hover:bg-cmf-secondary flex items-center gap-2"
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
                  importSummary?.scores === 0 && importSummary?.players > 0 
                  ? 'bg-amber-100 text-amber-600' 
                  : 'bg-green-100 text-green-600'
              }`}>
                {importSummary?.scores === 0 && importSummary?.players > 0 ? (
                    <AlertTriangle className="w-8 h-8" />
                ) : (
                    <Check className="w-8 h-8" />
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {importSummary?.scores === 0 && importSummary?.players > 0 
                   ? 'Imported with Warnings' 
                   : 'Import Complete!'}
              </h3>
              
              {importSummary && (
                  <div className="mb-4 text-gray-600 font-medium">
                      Imported {importSummary.players} players, wrote {importSummary.scores} scores
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
