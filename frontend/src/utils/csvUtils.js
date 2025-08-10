// CSV parsing and validation utilities

// Required by data contract: first_name, last_name, jersey_number, age_group
// Note: Files may omit jersey_number; we auto-assign later. We keep the full list
// for canonical output, but header detection is flexible.
export const REQUIRED_HEADERS = ["first_name", "last_name", "jersey_number", "age_group"];
// Optional columns supported by backend
export const OPTIONAL_HEADERS = ["external_id", "team_name", "position", "notes"];
export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

export const SAMPLE_ROWS = [
  ["John", "Smith", "12", "12U"],
  ["Emma", "Johnson", "25", "12U"], 
  ["Michael", "Davis", "", "14U"]
];

// Flexible header recognition
const HEADER_SYNONYMS = {
  first_name: [/^first[_\s]*name$/i, /^player[_\s]*first[_\s]*name$/i, /^fname$/i, /^first$/i],
  last_name: [/^last[_\s]*name$/i, /^player[_\s]*last[_\s]*name$/i, /^lname$/i, /^last$/i],
  jersey_number: [/^jersey[_\s]*number$/i, /^player[_\s]*number$/i, /^number$/i, /^#$/],
  age_group: [/^age[_\s]*group$/i, /^group$/i, /^division$/i, /^age$/i]
};

function findCanonicalForHeader(header) {
  const norm = String(header || '').trim();
  for (const [key, patterns] of Object.entries(HEADER_SYNONYMS)) {
    if (patterns.some((re) => re.test(norm))) return key;
  }
  return null;
}

function mapHeadersToCanonical(headers) {
  const indexToKey = {};
  headers.forEach((h, idx) => {
    const canonical = findCanonicalForHeader(h);
    if (canonical) indexToKey[idx] = canonical;
  });
  const canonicalHeaders = Array.from(new Set(Object.values(indexToKey)));
  return { canonicalHeaders, indexToKey };
}

// Check if headers indicate header-based format (flexible)
function hasValidHeaders(headers) {
  const { canonicalHeaders } = mapHeadersToCanonical(headers);
  // Consider header-based if at least first and last name are present
  return canonicalHeaders.includes('first_name') && canonicalHeaders.includes('last_name');
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
    mappingType = 'header-based';
    const { canonicalHeaders, indexToKey } = mapHeadersToCanonical(firstLineValues);
    headers = canonicalHeaders;
    rows = dataLines.map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      Object.entries(indexToKey).forEach(([idxStr, key]) => {
        const idx = parseInt(idxStr, 10);
        row[key] = values[idx] || '';
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
    // Expected orders (flexible):
    // - 4 columns: A=first_name, B=last_name, C=jersey_number, D=age_group
    // - 3 columns: A=first_name, B=last_name, C=age_group (no jersey number)
    mappingType = 'positional-based';
    // Include first line as data since it's not headers
    const allDataLines = [lines[0], ...dataLines];
    // Peek first data row to decide mapping
    const sampleValues = allDataLines[0].split(',').map(v => v.trim().replace(/"/g, ''));
    const hasFour = sampleValues.length >= 4;
    const hasThree = sampleValues.length === 3;
    if (hasThree) {
      headers = ['first_name', 'last_name', 'age_group'];
      rows = allDataLines.map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return {
          first_name: values[0] || '',
          last_name: values[1] || '',
          age_group: values[2] || '',
          jersey_number: ''
        };
      });
    } else {
      headers = ['first_name', 'last_name', 'jersey_number', 'age_group'];
      rows = allDataLines.map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return {
          first_name: values[0] || '',
          last_name: values[1] || '',
          jersey_number: values[2] || '',
          age_group: values[3] || ''
        };
      });
    }
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
      return 'Using header names (flexible: First Name, Last Name, Jersey Number, Age Group)';
    case 'positional-based':
      return 'Using positions: 4-col A=First, B=Last, C=Number, D=Age Group; or 3-col A=First, B=Last, C=Age Group';
    default:
      return 'Unknown mapping type';
  }
} 