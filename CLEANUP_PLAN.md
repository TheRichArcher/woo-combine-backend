# EventSetup.jsx Cleanup Plan

## Goal
Remove all orphaned CSV processing code from EventSetup.jsx that's no longer used since ImportResultsModal became the canonical importer.

## Current State
- **Total lines:** 931
- **Functional imports:** ImportResultsModal (canonical), AddPlayerModal (canonical)
- **Orphaned code:** ~400-500 lines of legacy CSV processing

## Code to DELETE

### 1. Orphaned State Variables
- `drillDefinitions` (empty hotfix array)
- `confirmedRequiredFields` (unused Set)
- Any CSV-related state (csvFileName, csvHeaders, csvRows, csvErrors, fieldMapping, etc.)
- Any drag state (isDragging, dragCounter)
- Any mapping state (showMapping, mappingConfidence, originalCsvRows)
- Any upload state (uploadStatus, uploadMsg, backendErrors)
- Any schema state (schemaLoading, schemaError, setDrillDefinitions)
- `isRosterOnlyImport`

### 2. Orphaned Functions
- `handleCsv()` - CSV file upload handler
- `handleDragEnterCapture()` - Drag enter handler
- `handleDragLeaveCapture()` - Drag leave handler
- `handleDragOverCapture()` - Drag over handler
- `handleDropCapture()` - Drop handler
- `handleApplyMapping()` - Field mapping application
- `handleUpload()` - CSV upload to backend
- `handlePostUploadSuccess()` - Post upload callback
- `fetchEventSchema()` - Drill schema fetching

### 3. Orphaned Data Structures
- `canonicalHeaderLabels` object
- `fieldHelperText` object
- `hasValidPlayers` computed value

### 4. Orphaned Imports
Check if these are still used elsewhere:
- `parseCsv` (likely from csvUtils)
- `generateDefaultMapping` (likely from csvUtils)
- `validateHeaders` (likely from csvUtils)
- `applyMapping` (likely from csvUtils)
- `validateRow` (likely from csvUtils)
- `autoAssignPlayerNumbers` (likely still needed if used elsewhere?)

### 5. Orphaned UI Elements
- Any drag-and-drop zone UI
- Any CSV file input UI
- Any field mapping UI
- Any CSV preview table
- Any validation error UI related to CSV

## Code to KEEP

### Essential Functionality
✅ ImportResultsModal integration  
✅ AddPlayerModal integration  
✅ Player count fetching & display  
✅ QR code generation & display  
✅ Event edit modal  
✅ Reset functionality  
✅ Drill Manager  
✅ Staff Management  
✅ Delete Event Flow  
✅ Navigation & routing  

### State to Keep
- `showImportModal` - opens ImportResultsModal
- `showAddPlayerModal` - opens AddPlayerModal
- `players` - for AddPlayerModal
- `playerCount` / `playerCountLoading` - for summary badge
- `showQr` - QR code display state
- `showEditEventModal` - edit modal state
- `confirmInput` / `status` / `errorMsg` - for reset functionality
- `eventSnapshot` - for delete flow stability

### Functions to Keep
- `fetchPlayerCount()` - player count API call
- `handleReset()` - reset players functionality
- All QR code handlers
- Edit event handlers
- Navigation handlers

## Expected Outcome
- **Remove:** ~400-500 lines of orphaned CSV code
- **Keep:** ~450-500 lines of functional code
- **Final size:** ~450-500 lines (50% reduction)
- **Result:** Clean, maintainable component with clear single responsibility

## Verification Checklist
After cleanup, verify:
- [ ] /admin loads without errors
- [ ] /admin#player-upload-section scrolls correctly
- [ ] "Import Players from File" button opens ImportResultsModal
- [ ] ImportResultsModal works correctly
- [ ] "Add Player Manually" button opens AddPlayerModal
- [ ] AddPlayerModal works correctly
- [ ] Player count displays correctly
- [ ] QR codes generate correctly
- [ ] Edit Event works
- [ ] Reset Players works
- [ ] No undefined variable errors in console
- [ ] Build passes without errors
- [ ] No linter errors

## Notes
- This is technical debt cleanup, not a feature change
- All functionality will remain identical from user perspective
- Removes ~50% of code without changing behavior
- Eliminates risk of future undefined reference crashes

