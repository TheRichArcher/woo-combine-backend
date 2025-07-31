// CSV parsing and validation utilities

export const REQUIRED_HEADERS = ["first_name", "last_name"];
export const OPTIONAL_HEADERS = ["number", "age_group"];
export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

export const SAMPLE_ROWS = [
  ["John", "Smith", "12", "12U"],
  ["Emma", "Johnson", "25", "12U"], 
  ["Michael", "Davis", "", "14U"]
];

// Parse CSV text into headers and rows
export function parseCsv(text) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });
  
  return { headers, rows };
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

// Validate CSV headers
export function validateHeaders(headers) {
  const errors = [];
  const missingHeaders = REQUIRED_HEADERS.filter(required => 
    !headers.some(header => header.toLowerCase().trim() === required.toLowerCase())
  );
  
  if (missingHeaders.length > 0) {
    errors.push(`Missing required headers: ${missingHeaders.join(", ")}. Headers must include: ${REQUIRED_HEADERS.join(", ")}`);
  }
  
  return errors;
} 