import React from 'react';
import { AlertTriangle, Check, ChevronRight, AlertCircle, Info, Save, Edit2, Wand, Clock } from 'lucide-react';

export default function ReviewStep(props) {
  const { parseResult, reviewFilter, setReviewFilter, getRequiredFieldsStatus, requiredFieldsError, setRequiredFieldsError, importMode, nameMappingMode, setNameMappingMode, firstNameColumn, setFirstNameColumn, lastNameColumn, setLastNameColumn, fullNameColumn, setFullNameColumn, jerseyColumn, setJerseyColumn, ageGroupColumn, setAgeGroupColumn, intent, keyMapping, setKeyMapping, effectiveDrills, autoMappedKeys, MAPPING_OPTIONS, editedRows, setEditedRows, rowStrategies, setRowStrategies, editingCell, setEditingCell, conflictMode, setConflictMode, error, setStep, handleSubmit } = props;
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
    const priorityKeys = ['first_name', 'last_name', 'number', 'jersey_number', 'age_group'];
    const drillKeys = allKeys.filter(k => !priorityKeys.includes(k) && !k.endsWith('_raw') && k !== 'merge_strategy');
    
    // Show priority keys that exist, then all other keys
    // This ensures name fields appear first if present, but ALL columns are available for mapping
    const displayKeys = [...priorityKeys.filter(k => allKeys.includes(k)), ...drillKeys];
    
    // Check required field status
    const requiredStatus = getRequiredFieldsStatus();
    const requiredFieldsComplete = requiredStatus.valid;
    
    // Detect unmapped drill columns (potential scores user might have missed)
    const identityFields = [
        'first_name',
        'last_name',
        'name',
        'jersey_number',
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
            onClick={() => {
                console.log("[IMPORT DEBUG] Import Data button clicked. requiredFieldsComplete:", requiredFieldsComplete);
                handleSubmit();
            }}
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
}
