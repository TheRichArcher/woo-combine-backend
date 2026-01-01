# Drag-and-Drop Upload Flow

## Visual States

```
┌─────────────────────────────────────────────────────────────────┐
│                    IDLE STATE (Default)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────┐    ┌────────────────────────┐     │
│  │ 👤 Upload Roster       │    │ 📤 Roster + Scores     │     │
│  │                        │    │                        │     │
│  │ Names + Jersey         │    │ One upload for         │     │
│  │ Numbers only.          │    │ everything.            │     │
│  │                        │    │                        │     │
│  │ Just players           │    │ (Recommended)          │     │
│  │ (no results).          │    │                        │     │
│  │                        │    │ Players + results      │     │
│  │                        │    │ in one upload.         │     │
│  │                        │    │                        │     │
│  │ Click or drag CSV →    │    │ Click or drag CSV →    │     │
│  └────────────────────────┘    └────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

                              ↓ (User drags file)

┌─────────────────────────────────────────────────────────────────┐
│                DRAG OVER STATE (Active Highlight)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────┐    ┌──────────────────────────┐   │
│  │ 👤 Upload Roster       │    │ ╔══════════════════════╗ │   │
│  │ (normal state)         │    │ ║  📤 Roster + Scores  ║ │   │
│  │                        │    │ ║ ┌──────────────────┐ ║ │   │
│  └────────────────────────┘    │ ║ │  ⬆️ (animated)   │ ║ │   │
│                                │ ║ │                  │ ║ │   │
│                                │ ║ │ Drop to upload   │ ║ │   │
│                                │ ║ │ roster + scores  │ ║ │   │
│                                │ ║ └──────────────────┘ ║ │   │
│                                │ ╚══════════════════════╝ │   │
│                                └──────────────────────────┘   │
│                                  (Scale: 105%, Teal border)   │
│                                  (Backdrop blur overlay)      │
└─────────────────────────────────────────────────────────────────┘

                              ↓ (User releases file)

┌─────────────────────────────────────────────────────────────────┐
│                   FILE VALIDATION & PROCESSING                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  File Type Check:                                               │
│  ✅ .csv, .xlsx, .xls → Continue                               │
│  ❌ Other types → Show error toast                             │
│                                                                 │
│  If Valid:                                                      │
│  1. Show success toast: "roster_data.csv ready to import"      │
│  2. Store file in state                                        │
│  3. Open ImportResultsModal with droppedFile prop              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────┐
│               IMPORT RESULTS MODAL (Auto-Parse)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Modal opens with:                                              │
│  • File already loaded in state                                │
│  • Correct mode (create_or_update)                             │
│  • Correct intent (roster_only or roster_and_scores)           │
│                                                                 │
│  After 300ms delay:                                             │
│  • handleParse() triggered automatically                       │
│  • Shows "Parsing..." step                                     │
│  • Analyzes columns and creates mappings                       │
│  • Transitions to review step                                  │
│                                                                 │
│  User sees:                                                     │
│  • Parsed player data                                          │
│  • Smart column mappings                                       │
│  • Any errors/warnings                                         │
│  • Submit button to complete import                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Event Handler Flow

```
User drags file onto card
         ↓
handleDragEnter()
├─ e.preventDefault()
├─ Increment dragCounter ref
├─ If dragCounter === 1:
│  └─ setIsDragging[CardType](true)
└─ Visual state updates
         ↓
User moves cursor (still dragging)
         ↓
handleDragOver()
├─ e.preventDefault()  [Required to allow drop]
└─ No state changes
         ↓
User moves cursor off card
         ↓
handleDragLeave()
├─ e.preventDefault()
├─ Decrement dragCounter ref
├─ If dragCounter === 0:
│  └─ setIsDragging[CardType](false)
└─ Visual state resets
         ↓
OR: User releases file on card
         ↓
handleDrop()
├─ e.preventDefault()
├─ e.stopPropagation()
├─ Reset dragCounter to 0
├─ setIsDragging[CardType](false)
├─ Get file from e.dataTransfer.files[0]
├─ Validate file type
├─ If invalid:
│  └─ showError("Invalid file type...")
├─ If valid:
│  ├─ showSuccess("File ready to import")
│  ├─ setDroppedFileForImport(file)
│  ├─ setImportModalMode(modalMode)
│  ├─ setImportIntent(intent)
│  └─ setShowImportModal(true)
└─ ImportResultsModal opens
         ↓
ImportResultsModal useEffect
├─ Detects droppedFile prop
├─ Wait 300ms (modal animation)
├─ Trigger handleParse()
└─ File processing begins
```

## State Management

### OnboardingEvent.jsx State
```javascript
// Drag state (UI feedback only)
const [isDraggingRoster, setIsDraggingRoster] = useState(false);
const [isDraggingScores, setIsDraggingScores] = useState(false);
const dragCounterRoster = useRef(0);  // Handles nested elements
const dragCounterScores = useRef(0);

// File transfer state
const [droppedFileForImport, setDroppedFileForImport] = useState(null);

// Modal state (already existed)
const [showImportModal, setShowImportModal] = useState(false);
const [importModalMode, setImportModalMode] = useState('create_or_update');
const [importIntent, setImportIntent] = useState('roster_and_scores');
```

### ImportResultsModal.jsx State
```javascript
// Initialize file state with dropped file
const [file, setFile] = useState(droppedFile);

// Auto-parse effect
useEffect(() => {
  if (droppedFile && step === 'input' && file) {
    const timer = setTimeout(() => {
      handleParse();
    }, 300);
    return () => clearTimeout(timer);
  }
}, [droppedFile, step]);
```

## CSS Classes Applied

### Idle State
```css
/* Base card styling */
bg-white
border-2 border-brand-primary/20
rounded-xl p-4
shadow-sm
hover:border-brand-primary/50
transition-all
cursor-pointer
```

### Drag Over State
```css
/* Enhanced styling when dragging */
border-brand-primary          /* Solid teal border */
bg-brand-primary/5            /* Light teal background */
scale-105                     /* 5% larger */

/* Overlay styling */
absolute inset-0
bg-brand-primary/10
backdrop-blur-sm
border-2 border-dashed border-brand-primary
rounded-xl
```

### Upload Icon Animation
```css
/* Bouncing upload icon */
animate-bounce
w-8 h-8
text-brand-primary
```

## Cleanup & Memory Management

### Modal Close
```javascript
onClose={() => {
  setShowImportModal(false);
  setDroppedFileForImport(null);  // Clear file reference
}}
```

### Import Success
```javascript
onSuccess={async (isRevert) => {
  await fetchEventData();
  if (!isRevert) {
    setShowImportModal(false);
    setDroppedFileForImport(null);  // Clear file reference
    showSuccess("Successfully imported!");
  }
}}
```

This ensures no memory leaks from holding file references after import completes.

## Error Cases Handled

1. **No files dropped** → Error toast: "No file detected"
2. **Invalid file type** → Error toast: "Invalid file type. Please upload CSV or Excel"
3. **Parse failure** → Standard ImportResultsModal error handling
4. **Network error** → Standard API error handling
5. **Drag away** → Visual state resets cleanly

## Browser Events Captured

- `onDragEnter` - File enters drop zone
- `onDragLeave` - File leaves drop zone
- `onDragOver` - File hovers (must preventDefault)
- `onDrop` - File released in drop zone

All events call `preventDefault()` and `stopPropagation()` to ensure proper behavior.

