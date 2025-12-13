CRITICAL FIX: Resolved silent failure in drill score import where scores were ignored due to key mismatches.

ROOT CAUSE: ImportResultsModal relied on exact string matching (e.g., "Lane Agility" vs "lane_agility"), causing the backend to ignore valid data columns that didn't match internal keys exactly.

COMPREHENSIVE SOLUTION:
1. Implemented intelligent mapping normalization using `generateDefaultMapping` from csvUtils to automatically map human labels to backend schema keys.
2. Replaced static `DRILL_TEMPLATES` with dynamic `availableDrills` prop derived from the actual event schema.
3. Added blocking validation in `handleSubmit` that prevents the import from proceeding if columns are mapped to invalid/unknown keys.
4. Ensures that "Import Complete" only appears when data is correctly mapped to valid fields.

This ensures that the official sample spreadsheet and user CSVs with plain-English headers import scores reliably.




