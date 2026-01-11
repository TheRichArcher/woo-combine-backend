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

/**
 * Maps age groups to numeric prefixes
 * CRITICAL: Prefixes must be <= 97 to ensure numbers stay within 0-9999 range
 * (Backend validation requires number <= 9999)
 */
const getAgeGroupPrefix = (ageGroup) => {
  if (!ageGroup || typeof ageGroup !== 'string') return 90; // Default for no age group (90xx range)
  
  const normalized = ageGroup.toLowerCase().trim();
  
  // Extract numeric part for standard age groups (12U, 8U, etc.)
  const numericMatch = normalized.match(/(\d+)/);
  if (numericMatch) {
    const num = parseInt(numericMatch[1]);
    // Handle special cases for very young ages
    if (num <= 5) return 5;  // 3U, 4U, 5U all use 5xx range
    // Cap at 97 to ensure 97xx stays under 9999
    return Math.min(num, 97);
  }
  
  // Map common non-numeric age groups to meaningful prefixes
  const mappings = {
    // Little kids variants
    'lil ballers': 5,
    'lil\' ballers': 5,
    'little ballers': 5,
    'tots': 3,
    'tiny tots': 3,
    'micro': 4,
    
    // Skill-based groupings
    'rookies': 20,
    'beginners': 21,
    'novice': 22,
    'intermediate': 23,
    'advanced': 24,
    'elite': 26,
    
    // Experience-based
    'junior': 15,
    'juniors': 15,
    'senior': 25,
    'seniors': 25,
    'varsity': 27,
    'jv': 16,
    'freshman': 14,
    'sophomore': 15,
    'jr varsity': 16,
    
    // Special groups
    'all stars': 28,
    'champions': 29,
    'select': 30,
    'travel': 31,
    'rec': 32,
    'recreational': 32
  };
  
  return mappings[normalized] || 90; // Default to 90xx range for unknown groups (stays under 9999)
};

/**
 * Generates a unique player number for the given age group
 * CRITICAL: Numbers must stay within 0-9999 range (backend validation)
 */
export const generatePlayerNumber = (ageGroup, existingNumbers = [], sequenceStart = 1) => {
  const prefix = getAgeGroupPrefix(ageGroup);
  let counter = sequenceStart;
  let candidateNumber;
  
  // Keep trying until we find a unique number
  do {
    candidateNumber = prefix * 100 + counter;
    counter++;
    
    // Safety check to prevent infinite loops and out-of-range numbers
    if (counter > 99 || candidateNumber > 9999) {
      // If we can't find a number in the primary range, use fallback range 9000-9999
      // Start from 9000 and find first available
      for (let fallback = 9000; fallback <= 9999; fallback++) {
        if (!existingNumbers.includes(fallback)) {
          candidateNumber = fallback;
          break;
        }
      }
      break;
    }
  } while (existingNumbers.includes(candidateNumber));
  
  // Final safety check - ensure we never exceed backend limit
  if (candidateNumber > 9999) {
    console.error(`[playerNumbering] Generated number ${candidateNumber} exceeds 9999 limit. Using 9999.`);
    candidateNumber = 9999;
  }
  
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
  validatePlayerNumberForAgeGroup
}; 