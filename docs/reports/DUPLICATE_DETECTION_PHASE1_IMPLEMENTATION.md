# Phase 1 Implementation: Enhanced Duplicate Detection Error Messages

## Backend Changes

### File: `backend/routes/players.py`

**Change 1: Track first occurrence row numbers**

```python
# Line 341-342 (OLD)
# Local duplicate detection within upload batch
seen_keys = set()

# NEW
# Local duplicate detection within upload batch
# Track first occurrence row number for better error messages
seen_keys = {}  # Changed from set() to dict: key -> (row_number, player_data)
```

**Change 2: Enhanced duplicate error message**

```python
# Lines 465-472 (OLD)
# Check local batch duplicates
key = (first_name.lower(), last_name.lower(), num)
if key in seen_keys:
    errors.append({"row": idx + 1, "message": "Duplicate player in file"})
    continue
seen_keys.add(key)

# NEW
# Check local batch duplicates
key = (first_name.lower(), last_name.lower(), num)
if key in seen_keys:
    first_row_num, first_player = seen_keys[key]
    
    # Build detailed error message with context
    jersey_display = f"#{num}" if num is not None else "(no jersey number)"
    age_display = f"({age_group})" if age_group else "(no age group)"
    
    error_msg = (
        f"Duplicate: {first_name} {last_name} {jersey_display} {age_display} "
        f"matches Row {first_row_num}. "
        f"→ Players are matched by name + jersey number (age group is ignored). "
    )
    
    # Add contextual tip based on scenario
    if num is None:
        error_msg += "TIP: Assign unique jersey numbers to differentiate players with the same name."
    elif age_group and first_player.get('age_group') and age_group != first_player.get('age_group'):
        error_msg += f"TIP: Even though age groups differ ({first_player.get('age_group')} vs {age_group}), players with the same name and number are considered duplicates. Change the jersey number or merge into a single row."
    else:
        error_msg += "TIP: Remove this duplicate row or assign a different jersey number."
    
    errors.append({
        "row": idx + 1, 
        "message": error_msg,
        "data": player,
        "duplicate_of_row": first_row_num,
        "identity_key": {
            "first_name": first_name,
            "last_name": last_name,
            "jersey_number": num
        }
    })
    continue

# Store first occurrence with player data for context
seen_keys[key] = (idx + 1, player)
```

**Change 3: Enhanced response summary**

```python
# Around line 600+ (where response is returned)
# OLD
return {
    "added": total_players,
    "created_players": created_players,
    "updated_players": updated_players,
    "scores_written_total": scores_written_total,
    "errors": errors,
    "undo_log": undo_log_serializable
}

# NEW
return {
    "added": total_players,
    "created_players": created_players,
    "updated_players": updated_players,
    "scores_written_total": scores_written_total,
    "rejected_count": len(errors),  # NEW: Count of rejected rows
    "rejected_rows": errors,         # NEW: Full error details with row numbers
    "errors": errors,                # Keep for backward compatibility
    "undo_log": undo_log_serializable
}
```

---

## Frontend Changes

### File: `frontend/src/components/Players/ImportResultsModal.jsx`

**Change 1: Display rejected rows section**

```jsx
// Around line 1180+ in renderReviewStep()
const renderReviewStep = () => {
    if (!parseResult) return null;
    const { valid_rows, errors, summary, detected_sport, confidence } = parseResult;
    const hasErrors = errors.length > 0;
    
    // NEW: Separate duplicates from other errors
    const duplicateErrors = errors.filter(e => e.message?.includes('Duplicate:'));
    const otherErrors = errors.filter(e => !e.message?.includes('Duplicate:'));
    const hasDuplicates = duplicateErrors.length > 0;
    
    // ... existing code ...
    
    return (
        <div>
            {/* Existing error display */}
            {otherErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-red-800 mb-2">
                        ⚠️ Import Errors ({otherErrors.length})
                    </h3>
                    {/* ... existing error rendering ... */}
                </div>
            )}
            
            {/* NEW: Duplicate detection section */}
            {hasDuplicates && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>Duplicate Players Detected ({duplicateErrors.length})</span>
                    </h3>
                    <p className="text-sm text-yellow-700 mb-3">
                        The following rows match existing entries in this file. 
                        Players are matched by name + jersey number (age group is ignored).
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
                                        {err.duplicate_of_row && (
                                            <div className="text-xs text-yellow-700 mt-1">
                                                → Matches Row {err.duplicate_of_row}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-yellow-200">
                        <p className="text-xs text-yellow-700">
                            <strong>How to fix:</strong> Assign different jersey numbers, 
                            remove duplicate rows, or import age groups separately.
                            <a 
                                href="https://docs.woo-combine.com/guides/duplicate-detection" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="ml-1 underline hover:text-yellow-900"
                            >
                                Learn more →
                            </a>
                        </p>
                    </div>
                </div>
            )}
            
            {/* ... rest of existing code ... */}
        </div>
    );
};
```

**Change 2: Enhanced success summary**

```jsx
// Around line 800+ in handleSubmit success handling
if (response.data) {
    setImportSummary({
        players: response.data.added || 0,
        created: response.data.created_players,
        updated: response.data.updated_players,
        scores: response.data.scores_written_total || 0,
        rejected: response.data.rejected_count || 0,  // NEW
        rejectedRows: response.data.rejected_rows || [],  // NEW
        errors: response.data.errors || []
    });
}
```

```jsx
// Around line 1000+ in renderSuccessStep()
const renderSuccessStep = () => {
    if (!importSummary) return null;
    
    return (
        <div className="text-center py-6">
            {/* Existing success UI */}
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Import Complete!
            </h2>
            
            {/* Enhanced summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left max-w-md mx-auto">
                <div className="space-y-2">
                    {importSummary.created > 0 && (
                        <div className="flex justify-between">
                            <span className="text-gray-600">New players:</span>
                            <span className="font-semibold text-green-600">
                                {importSummary.created}
                            </span>
                        </div>
                    )}
                    {importSummary.updated > 0 && (
                        <div className="flex justify-between">
                            <span className="text-gray-600">Updated players:</span>
                            <span className="font-semibold text-blue-600">
                                {importSummary.updated}
                            </span>
                        </div>
                    )}
                    {importSummary.scores > 0 && (
                        <div className="flex justify-between">
                            <span className="text-gray-600">Drill scores:</span>
                            <span className="font-semibold text-gray-800">
                                {importSummary.scores}
                            </span>
                        </div>
                    )}
                    
                    {/* NEW: Rejected rows summary */}
                    {importSummary.rejected > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Rows skipped:</span>
                                <span className="font-semibold text-yellow-600">
                                    {importSummary.rejected}
                                </span>
                            </div>
                            {importSummary.rejectedRows.length > 0 && (
                                <details className="mt-2">
                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                        View rejected rows →
                                    </summary>
                                    <div className="mt-2 space-y-1 text-xs">
                                        {importSummary.rejectedRows.slice(0, 10).map((err, i) => (
                                            <div key={i} className="bg-yellow-50 rounded p-2 border border-yellow-200">
                                                <span className="font-mono text-yellow-700">Row {err.row}:</span>
                                                <span className="text-gray-700 ml-1">{err.message?.split('→')[0]}</span>
                                            </div>
                                        ))}
                                        {importSummary.rejectedRows.length > 10 && (
                                            <div className="text-gray-500 text-center">
                                                ... and {importSummary.rejectedRows.length - 10} more
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* ... rest of existing success UI ... */}
        </div>
    );
};
```

---

## Testing Checklist

### Backend Tests

```python
# backend/tests/test_duplicate_detection.py

def test_duplicate_error_message_includes_row_number():
    """Verify duplicate errors show first occurrence row number"""
    players = [
        {"first_name": "John", "last_name": "Smith", "jersey_number": 42},
        {"first_name": "John", "last_name": "Smith", "jersey_number": 42}
    ]
    response = upload_players(event_id, players)
    
    assert len(response["errors"]) == 1
    assert "Row 1" in response["errors"][0]["message"]
    assert "Duplicate" in response["errors"][0]["message"]

def test_duplicate_with_different_age_groups():
    """Verify error message explains age group is ignored"""
    players = [
        {"first_name": "Ryan", "last_name": "Johnson", "jersey_number": 1038, "age_group": "12U"},
        {"first_name": "Ryan", "last_name": "Johnson", "jersey_number": 1038, "age_group": "14U"}
    ]
    response = upload_players(event_id, players)
    
    assert len(response["errors"]) == 1
    assert "age groups differ" in response["errors"][0]["message"]
    assert "12U" in response["errors"][0]["message"]
    assert "14U" in response["errors"][0]["message"]

def test_duplicate_without_jersey_number():
    """Verify error message suggests assigning jersey numbers"""
    players = [
        {"first_name": "Alex", "last_name": "Williams"},
        {"first_name": "Alex", "last_name": "Williams"}
    ]
    response = upload_players(event_id, players)
    
    assert len(response["errors"]) == 1
    assert "jersey number" in response["errors"][0]["message"].lower()
    assert "TIP" in response["errors"][0]["message"]

def test_rejected_count_in_summary():
    """Verify rejected_count and rejected_rows in response"""
    players = [
        {"first_name": "John", "last_name": "Smith", "jersey_number": 1},
        {"first_name": "John", "last_name": "Smith", "jersey_number": 1},
        {"first_name": "Jane", "last_name": "Doe", "jersey_number": 2}
    ]
    response = upload_players(event_id, players)
    
    assert response["rejected_count"] == 1
    assert len(response["rejected_rows"]) == 1
    assert response["created_players"] == 2  # Only John and Jane
```

### Frontend Tests

```javascript
// frontend/src/components/Players/ImportResultsModal.test.jsx

test('displays duplicate errors in separate yellow section', () => {
    const parseResult = {
        valid_rows: [],
        errors: [
            {
                row: 2,
                message: "Duplicate: John Smith #42 matches Row 1",
                data: { first_name: "John", last_name: "Smith", jersey_number: 42 }
            }
        ]
    };
    
    render(<ImportResultsModal parseResult={parseResult} />);
    
    expect(screen.getByText(/Duplicate Players Detected/)).toBeInTheDocument();
    expect(screen.getByText(/Row 2/)).toBeInTheDocument();
    expect(screen.getByText(/matches Row 1/)).toBeInTheDocument();
});

test('shows rejected rows in success summary', () => {
    const importSummary = {
        created: 48,
        updated: 0,
        rejected: 5,
        rejectedRows: [
            { row: 2, message: "Duplicate: John Smith #42" }
        ]
    };
    
    render(<ImportResultsModal importSummary={importSummary} />);
    
    expect(screen.getByText(/Rows skipped: 5/)).toBeInTheDocument();
    expect(screen.getByText(/View rejected rows/)).toBeInTheDocument();
});
```

---

## Deployment Plan

### Step 1: Backend Deployment
1. ✅ Update `backend/routes/players.py` with enhanced error messages
2. ✅ Deploy backend to staging
3. ✅ Run regression tests
4. ✅ Deploy backend to production

### Step 2: Frontend Deployment
1. ✅ Update `ImportResultsModal.jsx` with duplicate display UI
2. ✅ Test with sample CSVs containing duplicates
3. ✅ Deploy frontend to production

### Step 3: Documentation
1. ✅ Publish user guide to docs site
2. ✅ Update changelog
3. ✅ Notify users via email/in-app message

---

## Rollback Plan

If issues arise:
1. Backend changes are **backward compatible** (only enhance error messages)
2. Frontend changes are **additive** (only add UI sections, don't break existing)
3. Rollback: Revert to previous commit (no data migration required)

---

**Estimated Effort:** 2-3 hours  
**Risk Level:** Low  
**Breaking Changes:** None

