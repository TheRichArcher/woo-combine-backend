import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, AlertTriangle, Check, Loader2, ChevronRight, AlertCircle, Download, RotateCcw, Info } from 'lucide-react';
import api from '../../lib/api';
import { useEvent } from '../../context/EventContext';

export default function ImportResultsModal({ onClose, onSuccess }) {
  const { selectedEvent } = useEvent();
  const [step, setStep] = useState('input'); // input, parsing, review, submitting, success
  const [method, setMethod] = useState('file'); // file, text
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [error, setError] = useState(null);
  const [undoLog, setUndoLog] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [conflictMode, setConflictMode] = useState('overwrite'); // overwrite, skip
  const [undoTimer, setUndoTimer] = useState(30);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDownloadTemplate = () => {
    // Direct download link
    const url = `${api.defaults.baseURL}/events/${selectedEvent.id}/import-template`;
    window.open(url, '_blank');
  };

  const handleParse = async () => {
    if (method === 'file' && !file) {
      setError('Please select a file');
      return;
    }
    if (method === 'text' && !text.trim()) {
      setError('Please enter some text');
      return;
    }

    setStep('parsing');
    setError(null);

    try {
      const formData = new FormData();
      if (method === 'file') {
        formData.append('file', file);
      } else {
        formData.append('text', text);
      }

      const response = await api.post(`/events/${selectedEvent.id}/parse-import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setParseResult(response.data);
      setStep('review');
    } catch (err) {
      console.error("Parse error:", err);
      setError(err.response?.data?.detail || "Failed to parse import data");
      setStep('input');
    }
  };

  const handleSubmit = async () => {
    if (!parseResult || !parseResult.valid_rows.length) return;

    setStep('submitting');
    try {
      // Filter rows based on conflict mode
      let playersToUpload = parseResult.valid_rows;
      
      if (conflictMode === 'skip') {
        playersToUpload = playersToUpload.filter(row => !row.is_duplicate);
      }
      
      // Extract data objects
      playersToUpload = playersToUpload.map(row => row.data);

      if (playersToUpload.length === 0) {
        setError("No players to import after skipping duplicates.");
        setStep('review');
        return;
      }

      const response = await api.post('/players/upload', {
        event_id: selectedEvent.id,
        players: playersToUpload
      });
      
      if (response.data.undo_log) {
        setUndoLog(response.data.undo_log);
      }

      setStep('success');
      // Don't auto-close immediately if undo is available
      // Start timer
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
      setStep('input'); // Go back to start or close?
      setUndoLog(null);
      onSuccess?.(); // Refresh parent
      onClose();
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
        // Timer expired, clear undo log
        setUndoLog(null);
        // Auto close?
        setTimeout(() => {
            onSuccess?.();
            onClose();
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, undoLog, undoTimer, onSuccess, onClose]);

  const renderInputStep = () => (
    <div className="space-y-6">
      <div className="flex gap-4 mb-4">
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
          onClick={() => setMethod('text')}
          className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
            method === 'text' 
              ? 'border-cmf-primary bg-blue-50 text-cmf-primary' 
              : 'border-gray-200 hover:border-gray-300 text-gray-600'
          }`}
        >
          <FileText className="w-6 h-6" />
          <span className="font-medium">Copy & Paste</span>
          <span className="text-xs text-gray-500">From spreadsheets/notes</span>
        </button>
      </div>

      {method === 'file' ? (
        <div 
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".csv,.xlsx,.xls"
          />
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          {file ? (
            <div>
              <p className="font-medium text-cmf-primary">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-700">Click to select file</p>
              <p className="text-sm text-gray-500 mt-1">Supports CSV, Excel (.xlsx)</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your data here...&#10;First Name, Last Name, 40m Dash&#10;John, Doe, 4.5&#10;Jane, Smith, 4.8"
            className="w-full h-48 p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-cmf-primary focus:border-transparent font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            Supported columns: First Name, Last Name, Jersey Number, Age Group, Drill Names (40m Dash, etc.)
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
            onClick={handleDownloadTemplate}
            className="text-sm text-cmf-primary hover:text-cmf-secondary font-medium flex items-center gap-2"
        >
            <Download className="w-4 h-4" /> Download Template with My Players
        </button>

        <div className="flex gap-3">
            <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
            >
            Cancel
            </button>
            <button
            onClick={handleParse}
            disabled={!file && !text}
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
    </div>
  );

  const renderReviewStep = () => {
    if (!parseResult) return null;
    const { valid_rows, errors, summary, detected_sport, confidence } = parseResult;
    const hasErrors = errors.length > 0;
    const duplicates = valid_rows.filter(r => r.is_duplicate);
    const hasDuplicates = duplicates.length > 0;

    // Get all unique keys from data for table headers
    const allKeys = valid_rows.length > 0 
      ? Array.from(new Set(valid_rows.flatMap(r => Object.keys(r.data))))
      : [];
    
    // Prioritize certain columns
    const priorityKeys = ['first_name', 'last_name', 'jersey_number', 'age_group'];
    const drillKeys = allKeys.filter(k => !priorityKeys.includes(k) && !k.endsWith('_raw'));
    const displayKeys = [...priorityKeys.filter(k => allKeys.includes(k)), ...drillKeys];

    return (
      <div className="space-y-4">
        {/* Detected Sport Banner */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100">
            <Info className="w-4 h-4" />
            <span>
                Detected Sport: <strong>{detected_sport || 'Unknown'}</strong> 
                {confidence && <span className="opacity-75 text-xs ml-1">({confidence} confidence)</span>}
            </span>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 bg-green-50 p-4 rounded-xl border border-green-100">
            <div className="text-2xl font-bold text-green-700">{summary.valid_count}</div>
            <div className="text-sm text-green-600 font-medium">Valid Rows</div>
          </div>
          <div className={`flex-1 p-4 rounded-xl border ${hasErrors ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
            <div className={`text-2xl font-bold ${hasErrors ? 'text-red-700' : 'text-gray-700'}`}>{summary.error_count}</div>
            <div className={`text-sm font-medium ${hasErrors ? 'text-red-600' : 'text-gray-600'}`}>Errors</div>
          </div>
        </div>

        {hasErrors && (
          <div className="bg-red-50 rounded-xl p-4 border border-red-100 max-h-40 overflow-y-auto">
            <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Validation Errors
            </h4>
            <ul className="space-y-1">
              {errors.map((err, i) => (
                <li key={i} className="text-sm text-red-700">
                  <span className="font-mono font-bold">Row {err.row}:</span> {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasDuplicates && (
             <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <div className="flex items-start justify-between">
                    <div>
                        <h4 className="font-semibold text-amber-800 mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> {duplicates.length} Potential Duplicates Found
                        </h4>
                        <p className="text-xs text-amber-700 mb-2">
                            Some players in your file match existing players in this event.
                        </p>
                    </div>
                    <div className="flex bg-white rounded-lg border border-amber-200 p-1">
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
                            onClick={() => setConflictMode('skip')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                conflictMode === 'skip' 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Skip Duplicates
                        </button>
                    </div>
                </div>
             </div>
        )}

        <div className="border rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b font-medium text-gray-700 text-sm flex justify-between items-center">
            <span>Preview (First 5 Valid Rows)</span>
            <span className="text-xs text-gray-500">Total: {valid_rows.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {displayKeys.map(key => (
                    <th key={key} className="px-4 py-2 text-left font-medium capitalize whitespace-nowrap">
                      {key.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {valid_rows.slice(0, 5).map((row, i) => {
                    const isDup = row.is_duplicate;
                    const isSkipped = isDup && conflictMode === 'skip';
                    return (
                      <tr key={i} className={`hover:bg-gray-50 ${isSkipped ? 'opacity-40 bg-gray-50' : ''} ${isDup && !isSkipped ? 'bg-amber-50/50' : ''}`}>
                        {displayKeys.map(key => {
                            const isRaw = row.data[`${key}_raw`] !== undefined; // Flag if value was corrected (implicit) or raw exists
                            // Actually backend stores raw in separate key if invalid, but corrected value in main key
                            // If we want to show "Smart Correction", we'd need backend to tell us it corrected it.
                            // For now just show value.
                            return (
                              <td key={key} className="px-4 py-2 whitespace-nowrap text-gray-700">
                                {row.data[key] ?? '-'}
                              </td>
                            );
                        })}
                      </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
          {valid_rows.length > 5 && (
            <div className="bg-gray-50 px-4 py-2 border-t text-xs text-center text-gray-500">
              ...and {valid_rows.length - 5} more rows
            </div>
          )}
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
            disabled={valid_rows.length === 0}
            className="px-6 py-2 bg-cmf-primary text-white rounded-lg font-medium hover:bg-cmf-secondary disabled:opacity-50 flex items-center gap-2"
          >
            {valid_rows.length > 0 ? `Import ${valid_rows.length} Rows` : 'No Valid Data'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import Results</h2>
            <p className="text-sm text-gray-500">Add players and drill scores in bulk</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'input' && renderInputStep()}
          
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
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h3>
              <p className="text-gray-500">Results have been added to your event.</p>
              
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
