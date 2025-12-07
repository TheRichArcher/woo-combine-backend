// CSV parsing and validation utilities

// Required: first_name, last_name
export const REQUIRED_HEADERS = ["first_name", "last_name"];

// Optional columns supported by backend
// Added age_group and jersey_number to ensure they appear in mapping UI
export const OPTIONAL_HEADERS = ["age_group", "jersey_number", "external_id", "team_name", "position", "notes"];
export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

// Function to get drill headers from schema (called with event schema)
export function getDrillHeaders(drillDefinitions = []) {
  return drillDefinitions.map(drill => drill.key);
}

// Function to get all headers including drills
export function getAllHeadersWithDrills(drillDefinitions = []) {
  return [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS, ...getDrillHeaders(drillDefinitions)];
}

export const SAMPLE_ROWS = [
  ["John", "Smith", "12U", "12"],
  ["Emma", "Johnson", "Mighty Mites", "25"],
  ["Michael", "Davis", "", ""]
];

// Synonyms for common headers to improve auto-mapping & detection - lazy initialized to avoid TDZ
let headerSynonymsCache = null;

function getHeaderSynonyms() {
  if (!headerSynonymsCache) {
    headerSynonymsCache = {
      first_name: ['first_name', 'first', 'firstname', 'first name', 'fname', 'given', 'player first', 'player_first', 'player first name'],
      last_name: ['last_name', 'last', 'lastname', 'last name', 'lname', 'surname', 'player last', 'player_last', 'player last name'],
      age_group: ['age_group', 'age', 'agegroup', 'group', 'division', 'grade', 'team age', 'age grp'],
      jersey_number: ['jersey_number', 'number', '#', 'jersey', 'jersey number', 'jersey #', 'uniform', 'uniform number', 'player #'],
      external_id: ['external_id', 'external', 'playerid', 'player id', 'id'],
      team_name: ['team_name', 'team', 'squad', 'club'],
      position: ['position', 'pos'],
      notes: ['notes', 'note', 'comments', 'comment', 'remarks'],
      // Common drill synonyms - these will be extended based on schema
      '40m_dash': ['40m_dash', '40m dash', '40 yard dash', '40-yard dash', '40yd dash', '40-dash', '40dash', 'sprint', 'speed'],
      'vertical_jump': ['vertical_jump', 'vertical jump', 'vert jump', 'vj', 'jump', 'vertical'],
      'catching': ['catching', 'catch', 'reception', 'receiving', 'hands'],
      'throwing': ['throwing', 'throw', 'passing', 'pass'],
      'agility': ['agility', 'agile', 'cone drill', 'cones', 'weave', 'ladder'],
      'lane_agility': ['lane_agility', 'lane agility', 'lane', 'basketball agility', 'bb agility'],
      'free_throws': ['free_throws', 'free throws', 'ft', 'free throw %', 'free throw percentage', 'free_throw_pct', 'throwing'],
      'three_point': ['three_point', 'three point', '3pt', '3-point', 'three pointer', 'three_pointer', '3pt shooting', '3pt spot shooting', 'spot shooting'],
      'dribbling': ['dribbling', 'dribble', 'ball handling', 'handles', 'dribbling skill'],
      'exit_velocity': ['exit_velocity', 'exit velocity', 'bat speed', 'swing speed', 'exit velo'],
      'throwing_velocity': ['throwing_velocity', 'throwing velocity', 'arm strength', 'arm speed', 'throw velo'],
      'fielding_accuracy': ['fielding_accuracy', 'fielding accuracy', 'fielding', 'defense', 'fielding skill'],
      'pop_time': ['pop_time', 'pop time', 'catcher pop', 'c pop time'],
      'sprint_100': ['sprint_100', '100m sprint', '100 meter sprint', '100m', '100 sprint'],
      'sprint_400': ['sprint_400', '400m sprint', '400 meter sprint', '400m', '400 sprint'],
      'long_jump': ['long_jump', 'long jump', 'broad jump', 'lj'],
      'shot_put': ['shot_put', 'shot put', 'shotput', 'sp'],
      'mile_time': ['mile_time', 'mile time', 'mile run', 'mile'],
      'approach_jump': ['approach_jump', 'approach jump', 'block jump'],
      'serving_accuracy': ['serving_accuracy', 'serving accuracy', 'serve accuracy', 'serving'],
      'standing_reach': ['standing_reach', 'standing reach', 'reach', 'standing'],
      'pro_lane_shuttle': ['pro_lane_shuttle', 'pro lane shuttle', 'lane shuttle', 'pro lane', 'shuttle'],
      'three_quarter_court_sprint': ['three_quarter_court_sprint', '3/4 court sprint', 'three quarter court sprint', 'court sprint', '3/4 sprint', '3/4 court'],
      'ball_control': ['ball_control', 'ball control', 'touch', 'first touch'],
      'passing_accuracy': ['passing_accuracy', 'passing accuracy', 'passing', 'pass accuracy'],
      'shooting_power': ['shooting_power', 'shooting power', 'shot power', 'shooting']
    };
  }
  return headerSynonymsCache;
}

function normalizeHeader(header) {
  return String(header || '')
    .toLowerCase()
    // Remove units in parentheses (e.g., "(sec)", "(%)", "(in)")
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if headers indicate header-based format
function hasValidHeaders(headers) {
  const normalizedHeaders = headers.map((h) => normalizeHeader(h));
  const synonyms = getHeaderSynonyms();
  return REQUIRED_HEADERS.every((required) => {
    const candidates = synonyms[required] || [required];
    return candidates.some((syn) => normalizedHeaders.some((header) => header === normalizeHeader(syn) || header.includes(normalizeHeader(syn))));
  });
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

// Analyze columns to detect if they are numeric
export function detectColumnTypes(headers, rows) {
  const columnTypes = {};
  const SAMPLE_SIZE = 50; // Check first 50 rows
  
  headers.forEach(header => {
    let numericCount = 0;
    let totalCount = 0;
    
    for (let i = 0; i < Math.min(rows.length, SAMPLE_SIZE); i++) {
      const val = rows[i][header];
      if (val && val.trim() !== '') {
        totalCount++;
        if (!isNaN(Number(val.trim()))) {
          numericCount++;
        }
      }
    }
    
    // If >80% of non-empty values are numeric, consider it numeric
    if (totalCount > 0 && (numericCount / totalCount) > 0.8) {
      columnTypes[header] = 'numeric';
    } else {
      columnTypes[header] = 'text';
    }
  });
  
  return columnTypes;
}

// Validate a single CSV row
export function validateRow(row, drillDefinitions = []) {
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

  // Validate drill scores if provided
  drillDefinitions.forEach(drill => {
    const drillValue = row[drill.key];
    if (drillValue && drillValue.trim() !== '') {
      const numValue = Number(drillValue);
      if (isNaN(numValue)) {
        warnings.push(`Invalid ${drill.label} score (must be numeric)`);
      } else {
        // Check range if defined
        if (drill.min_value !== undefined && numValue < drill.min_value) {
          warnings.push(`${drill.label} score ${numValue} below minimum (${drill.min_value})`);
        }
        if (drill.max_value !== undefined && numValue > drill.max_value) {
          warnings.push(`${drill.label} score ${numValue} above maximum (${drill.max_value})`);
        }
      }
    }
  });

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
    const normalizedHeaders = headers.map((header) => normalizeHeader(header));
    const synonyms = getHeaderSynonyms();
    const missingHeaders = REQUIRED_HEADERS.filter((required) => {
      const candidates = synonyms[required] || [required];
      return !candidates.some((candidate) =>
        normalizedHeaders.includes(normalizeHeader(candidate))
      );
    });

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

function calculateMatchScore(header, key, synonyms) {
  const normHeader = normalizeHeader(header);
  
  // 1. Exact Key Match (Highest confidence)
  if (normHeader === normalizeHeader(key)) return 100;
  
  // 2. Synonym Matches
  for (const syn of synonyms) {
    const normSyn = normalizeHeader(syn);
    
    // Exact synonym match
    if (normHeader === normSyn) return 90;
    
    // Header contains synonym (Partial match)
    // We prioritize longer synonyms to avoid "Throw" matching "Free Throw"
    if (normHeader.includes(normSyn)) {
      // Score based on specificity (length of synonym relative to header)
      const specificity = normSyn.length / normHeader.length;
      return 50 + (specificity * 30); // 50-80 range
    }
  }
  
  return 0;
}

// Create a suggested mapping from arbitrary CSV headers to our canonical fields
// Returns { mapping: {}, confidence: {} } where confidence is 'high', 'medium', 'low'
export function generateDefaultMapping(headers = [], drillDefinitions = []) {
  const mapping = {};
  const confidence = {};
  
  const allKeys = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
  const drillKeys = drillDefinitions.map(drill => drill.key);
  allKeys.push(...drillKeys);
  
  const synonyms = getHeaderSynonyms();
  
  // CRITICAL FIX: Add drill labels as synonyms for each drill key
  // This enables mapping CSV headers like "Bench Press" to custom drill keys like "x7hG4kL9mN2pQ8vW"
  drillDefinitions.forEach(drill => {
    if (!synonyms[drill.key]) {
      synonyms[drill.key] = [];
    }
    // Add the label as a synonym (if it's different from the key)
    const normalizedKey = normalizeHeader(drill.key);
    const normalizedLabel = normalizeHeader(drill.label);
    
    if (normalizedKey !== normalizedLabel && !synonyms[drill.key].includes(drill.label)) {
      synonyms[drill.key].push(drill.label);
    }
    // Also ensure the key itself is in the synonyms
    if (!synonyms[drill.key].includes(drill.key)) {
      synonyms[drill.key].push(drill.key);
    }
  });
  
  const usedHeaders = new Set();
  
  // Calculate all possible matches with scores
  const allMatches = [];
  
  allKeys.forEach(key => {
    const keySynonyms = synonyms[key] || [key];
    headers.forEach(header => {
      const score = calculateMatchScore(header, key, keySynonyms);
      if (score > 0) {
        allMatches.push({ key, header, score });
      }
    });
  });
  
  // Sort matches by score (descending) to prioritize best matches
  allMatches.sort((a, b) => b.score - a.score);
  
  // Assign mappings greedily
  allMatches.forEach(({ key, header, score }) => {
    // If key is already mapped or header is already used, skip
    if (!mapping[key] && !usedHeaders.has(header)) {
      mapping[key] = header;
      usedHeaders.add(header);
      
      // Determine confidence level
      if (score >= 90) confidence[key] = 'high';
      else if (score >= 60) confidence[key] = 'medium';
      else confidence[key] = 'low';
    }
  });
  
  return { mapping, confidence };
}

// Apply a mapping from arbitrary headers to canonical fields
export function applyMapping(rows = [], mapping = {}, drillDefinitions = []) {
  const output = [];
  const canonicalKeys = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];
  const drillKeys = drillDefinitions.map(drill => drill.key);
  canonicalKeys.push(...drillKeys);

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