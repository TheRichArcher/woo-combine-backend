/**
 * Parse a YYYY-MM-DD date string into a Date object in LOCAL timezone
 * 
 * WHY: new Date("2026-01-28") is parsed as UTC midnight, which can shift
 * to previous day in timezones behind UTC (EST, PST, etc.)
 * 
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Date|null} Date object in local timezone, or null if invalid
 */
export function parseLocalDate(dateString) {
  if (!dateString) return null;
  
  // Parse YYYY-MM-DD manually to avoid UTC interpretation
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);
  
  // Create Date in LOCAL timezone (not UTC)
  const date = new Date(year, month, day);
  
  // Validate the date is valid
  if (isNaN(date.getTime())) return null;
  
  return date;
}

/**
 * Format a YYYY-MM-DD date string with custom format options
 * 
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {Intl.DateTimeFormatOptions} options - toLocaleDateString options
 * @returns {string} Formatted date or "Date not set"
 */
export function formatEventDateCustom(dateString, options) {
  const date = parseLocalDate(dateString);
  if (!date) return "Date not set";
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format a YYYY-MM-DD date string for display without timezone shifts
 * 
 * SOLUTION: Parse the YYYY-MM-DD string and create Date in LOCAL timezone
 * 
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date like "1/28/2026" or "Date not set"
 */
export function formatEventDate(dateString) {
  const date = parseLocalDate(dateString);
  if (!date) return "Date not set";
  return date.toLocaleDateString();
}

/**
 * Format a YYYY-MM-DD date string with long format (e.g., "Monday, January 28, 2026")
 * 
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Long formatted date or "Date not set"
 */
export function formatEventDateLong(dateString) {
  const date = parseLocalDate(dateString);
  if (!date) return "Date not set";
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

