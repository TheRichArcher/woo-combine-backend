/**
 * Player Auto-Numbering System
 * 
 * Generates smart player numbers based on age groups for easy identification
 * in Live Drill Entry mode.
 * 
 * Examples:
 * - 12U players: 1201, 1202, 1203...
 * - 8U players: 801, 802, 803...
 * - Lil' Ballers: 501, 502, 503...
 * - Rookies: 2001, 2002, 2003...
 */

// Player numbering system configuration
const NUMBERING_CONFIG = {
  FALLBACK_PREFIX: 99,        // Fallback prefix for unknown age groups
  MAX_COUNTER: 999,           // Maximum counter before fallback
  FALLBACK_MIN: 100,          // Minimum number for fallback range
  FALLBACK_MAX: 999           // Maximum number for fallback range
};

// Age group to number prefix mapping
const AGE_GROUP_PREFIXES = {
  // Standard age group formats
  '6U': 6, 'U6': 6, '5-6': 6,
  '8U': 8, 'U8': 8, '7-8': 8,
  '10U': 10, 'U10': 10, '9-10': 10,
  '12U': 12, 'U12': 12, '11-12': 12,
  '14U': 14, 'U14': 14, '13-14': 14,
  '16U': 16, 'U16': 16, '15-16': 16,
  '18U': 18, 'U18': 18, '17-18': 18,
  
  // Common variations
  'Little League': 5,
  'Lil Ballers': 5,
  'Rookie': 5,
  'Pee Wee': 7,
  'Minor': 9,
  'Major': 11,
  'Junior': 13,
  'Senior': 15,
  'Varsity': 17,
  'Adult': 20
};

/**
 * Get the numeric prefix for an age group
 */
export const getAgeGroupPrefix = (ageGroup) => {
  if (!ageGroup) return NUMBERING_CONFIG.FALLBACK_PREFIX;
  
  // Direct lookup first
  const normalized = ageGroup.toString().trim();
  if (AGE_GROUP_PREFIXES[normalized]) {
    return AGE_GROUP_PREFIXES[normalized];
  }
  
  // Try case-insensitive lookup
  const lowerCase = normalized.toLowerCase();
  for (const [key, value] of Object.entries(AGE_GROUP_PREFIXES)) {
    if (key.toLowerCase() === lowerCase) {
      return value;
    }
  }
  
  // Extract numbers from age group (e.g., "12" from "12 years old")
  const numbers = normalized.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    return parseInt(numbers[0]);
  }
  
  return NUMBERING_CONFIG.FALLBACK_PREFIX;
};

/**
 * Generates a unique player number for the given age group
 */
export const generatePlayerNumber = (ageGroup, existingNumbers = [], sequenceStart = 1) => {
  const prefix = getAgeGroupPrefix(ageGroup);
  let counter = sequenceStart;
  let candidateNumber;
  
  // Keep trying until we find a unique number
  do {
    candidateNumber = prefix * 100 + counter;
    counter++;
    
    // Safety check to prevent infinite loops
    if (counter > NUMBERING_CONFIG.MAX_COUNTER) {
      // If we can't find a number in the primary range, try the 99xx range
      candidateNumber = NUMBERING_CONFIG.FALLBACK_PREFIX * 100 + 
                       Math.floor(Math.random() * (NUMBERING_CONFIG.FALLBACK_MAX - NUMBERING_CONFIG.FALLBACK_MIN + 1)) + 
                       NUMBERING_CONFIG.FALLBACK_MIN;
      break;
    }
  } while (existingNumbers.includes(candidateNumber));
  
  return candidateNumber;
};

/**
 * Auto-assigns numbers to a list of players, ensuring uniqueness
 */
export const autoAssignPlayerNumbers = (players) => {
  const existingNumbers = players
    .filter(p => p.number != null)
    .map(p => parseInt(p.number));
  
  return players.map(player => {
    // Skip players who already have numbers
    if (player.number != null && player.number !== '') {
      return player;
    }
    
    // Generate new number for this player
    const newNumber = generatePlayerNumber(player.age_group, existingNumbers);
    existingNumbers.push(newNumber); // Add to existing list to prevent duplicates
    
    return {
      ...player,
      number: newNumber
    };
  });
};

/**
 * Get all available age group options for display in forms
 */
export const getAgeGroupOptions = () => {
  return Object.keys(AGE_GROUP_PREFIXES).sort((a, b) => {
    const prefixA = AGE_GROUP_PREFIXES[a];
    const prefixB = AGE_GROUP_PREFIXES[b];
    return prefixA - prefixB;
  });
};

/**
 * Gets a preview of what number range an age group will use
 */
export const getAgeGroupNumberRange = (ageGroup) => {
  const prefix = getAgeGroupPrefix(ageGroup);
  const start = prefix * 100 + 1;
  const end = prefix * 100 + 99;
  return `${start}-${end}`;
};

/**
 * Validates if a player number fits the expected pattern for their age group
 */
export const validatePlayerNumberForAgeGroup = (number, ageGroup) => {
  if (!number || !ageGroup) return true; // Skip validation if missing data
  
  const expectedPrefix = getAgeGroupPrefix(ageGroup);
  const actualPrefix = Math.floor(parseInt(number) / 100);
  
  return actualPrefix === expectedPrefix;
};

export default {
  generatePlayerNumber,
  autoAssignPlayerNumbers,
  getAgeGroupNumberRange,
  validatePlayerNumberForAgeGroup,
  getAgeGroupOptions
}; 