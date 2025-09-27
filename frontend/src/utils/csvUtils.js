// CSV parsing and validation utilities

// Required: first_name, last_name. jersey_number and age_group are optional
export const REQUIRED_HEADERS = ["first_name", "last_name"];
// Optional columns supported by backend
export const OPTIONAL_HEADERS = ["external_id", "team_name", "position", "notes"];
export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

export const SAMPLE_ROWS = [
  ["John", "Smith", "12U", "12"],
  ["Emma", "Johnson", "Mighty Mites", "25"], 
  ["Michael", "Davis", "", ""]
];

// Check if headers indicate header-based format
function hasValidHeaders(headers) {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  return REQUIRED_HEADERS.every(required => 
    normalizedHeaders.some(header => header === required.toLowerCase())
  );
}

// Parse CSV text into headers and rows with smart format detection
export function parseCsv(text) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [], mappingType: 'none' };
  
  const firstLineValues = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const dataLines = lines.slice(1);
  
  // Detect if first line contains headers or data
  const isHeaderBased = hasValidHeaders(firstLineValues);
  
  let headers, rows, mappingType;
  
  if (isHeaderBased) {
    // Header-based parsing (current behavior)
    headers = firstLineValues;
    mappingType = 'header-based';
    rows = dataLines.map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      // Backward compatibility: support 'number' -> 'jersey_number'
      if (row.number && !row.jersey_number) {
        row.jersey_number = row.number;
        delete row.number;
      }
      return row;
    });
  } else {
    // Positional-based parsing (new feature)
    mappingType = 'positional-based';
    headers = ['first_name', 'last_name', 'age_group', 'jersey_number']; // Standard headers for compatibility
    
    // Include first line as data since it's not headers
    const allDataLines = [lines[0], ...dataLines];
    rows = allDataLines.map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      return {
        first_name: values[0] || '',
        last_name: values[1] || '',
        age_group: values[2] || '',
        jersey_number: values[3] || ''
      };
    });
  }
  
  return { headers, rows, mappingType };
}

// Validate a single CSV row
export function validateRow(row) {
  const warnings = [];
  
  // Check required fields
  if (!row.first_name || row.first_name.trim() === '') {
    warnings.push('Missing first name');
  }
  if (!row.last_name || row.last_name.trim() === '') {
    warnings.push('Missing last name');
  }
  
  // Validate jersey number if provided (will be auto-assigned if blank before upload)
  if (row.jersey_number && row.jersey_number.trim() !== '' && isNaN(Number(row.jersey_number))) {
    warnings.push('Invalid jersey_number (must be numeric)');
  }
  
  // Create combined name for display
  const firstName = (row.first_name || '').trim();
  const lastName = (row.last_name || '').trim();
  const name = firstName && lastName ? `${firstName} ${lastName}` : '';
  
  return {
    ...row,
    name,
    warnings,
    isValid: warnings.length === 0 && name !== ''
  };
}

/* Note: Player numbering is now handled by utils/playerNumbering.js 
   which provides age-group-based numbering (e.g., 12U players get 1201, 1202, etc.)
   This prevents conflicts and makes player identification easier during combines. */

// Enhanced header validation that supports both formats
export function validateHeaders(headers, mappingType = 'header-based') {
  const errors = [];
  
  if (mappingType === 'header-based') {
    // Traditional header validation
    const missingHeaders = REQUIRED_HEADERS.filter(required => 
      !headers.some(header => header.toLowerCase().trim() === required.toLowerCase())
    );
    
    if (missingHeaders.length > 0) {
      errors.push(`Missing required headers: ${missingHeaders.join(", ")}. Headers must include: ${REQUIRED_HEADERS.join(", ")}`);
    }
  } else if (mappingType === 'positional-based') {
    // Positional validation - no header errors since we're using position mapping
    // This is intentionally empty since positional mapping doesn't require specific headers
  }
  
  return errors;
}

// New function to get user-friendly mapping description
export function getMappingDescription(mappingType) {
  switch (mappingType) {
    case 'header-based':
      return 'Using header names to map columns (first_name, last_name, age_group)';
    case 'positional-based':
      return 'Using column positions: A=First Name, B=Last Name, C=Age Group';
    default:
      return 'Unknown mapping type';
  }
} 

// ---- Mapping helpers: guess and apply user-selected mappings ----

// Synonyms for common headers to improve auto-mapping
const HEADER_SYNONYMS = {
  first_name: ['first_name', 'first', 'firstname', 'first name', 'fname', 'given', 'player first', 'player_first'],
  last_name: ['last_name', 'last', 'lastname', 'last name', 'lname', 'surname', 'player last', 'player_last'],
  age_group: ['age_group', 'age', 'agegroup', 'group', 'division', 'grade', 'team age', 'age grp'],
  jersey_number: ['jersey_number', 'number', '#', 'jersey', 'jersey number', 'jersey #', 'uniform', 'uniform number', 'player #'],
  external_id: ['external_id', 'external', 'playerid', 'player id', 'id'],
  team_name: ['team_name', 'team', 'squad', 'club'],
  position: ['position', 'pos'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks']
};

function normalizeHeader(header) {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ') // collapse punctuation/underscores
    .replace(/\s+/g, ' ') // single spaces
    .trim();
}

function matchHeader(headers, synonyms) {
  const normalized = headers.map(h => ({ raw: h, norm: normalizeHeader(h) }));
  for (const syn of synonyms) {
    const target = normalizeHeader(syn);
    const found = normalized.find(h => h.norm === target);
    if (found) return found.raw;
  }
  // fuzzy contains match (e.g., "player first name")
  for (const syn of synonyms) {
    const target = normalizeHeader(syn);
    const found = normalized.find(h => h.norm.includes(target));
    if (found) return found.raw;
  }
  return '';
}

// Create a suggested mapping from arbitrary CSV headers to our canonical fields
export function generateDefaultMapping(headers = []) {
  const mapping = {};
  const allKeys = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
  allKeys.forEach(key => {
    mapping[key] = matchHeader(headers, HEADER_SYNONYMS[key] || [key]);
  });
  return mapping;
}

// Apply a mapping from arbitrary headers to canonical fields
export function applyMapping(rows = [], mapping = {}) {
  const output = [];
  const canonicalKeys = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
  for (const originalRow of rows) {
    const row = {};
    canonicalKeys.forEach(key => {
      const source = mapping[key];
      if (source && source !== '__ignore__') {
        row[key] = originalRow[source] ?? '';
      } else if (originalRow[key] != null) {
        // Already canonical from positional-based parsing
        row[key] = originalRow[key];
      } else {
        row[key] = '';
      }
    });
    // Backward compatibility: support legacy 'number' header -> jersey_number
    if (!row.jersey_number && originalRow.number) {
      row.jersey_number = originalRow.number;
    }
    output.push(row);
  }
  return output;
}