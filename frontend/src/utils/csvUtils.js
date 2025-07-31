// CSV parsing and validation utilities

export const REQUIRED_HEADERS = ["first_name", "last_name"];
export const OPTIONAL_HEADERS = ["number", "age_group"];
export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

export const SAMPLE_ROWS = [
  ["John", "Smith", "12", "12U"],
  ["Emma", "Johnson", "25", "12U"], 
  ["Michael", "Davis", "", "14U"]
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
      return row;
    });
  } else {
    // Positional-based parsing (new feature)
    mappingType = 'positional-based';
    headers = ['first_name', 'last_name', 'age_group']; // Standard headers for compatibility
    
    // Include first line as data since it's not headers
    const allDataLines = [lines[0], ...dataLines];
    rows = allDataLines.map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      return {
        first_name: values[0] || '',
        last_name: values[1] || '',
        age_group: values[2] || '',
        number: values[3] || '' // Support optional 4th column for numbers
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
  
  // Validate number if provided
  if (row.number && row.number.trim() !== '' && isNaN(Number(row.number))) {
    warnings.push('Invalid number (must be numeric)');
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