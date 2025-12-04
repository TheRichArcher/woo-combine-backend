/**
 * Frontend validation utilities for form inputs and user data
 */

/**
 * Validates email address format
 * @param {string} email - Email address to validate
 * @returns {string} - Cleaned email address
 * @throws {Error} - If email is invalid
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }
  
  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error('Invalid email format');
  }
  
  return trimmedEmail;
}

/**
 * Validates player name format and length
 * @param {string} name - Player name to validate
 * @returns {string} - Cleaned player name
 * @throws {Error} - If name is invalid
 */
export function validatePlayerName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Player name is required');
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    throw new Error('Player name must be at least 2 characters long');
  }
  
  if (trimmedName.length > 50) {
    throw new Error('Player name must be no more than 50 characters long');
  }
  
  // Allow letters, spaces, hyphens, apostrophes, and periods
  const nameRegex = /^[a-zA-ZÀ-ÿ\s\-'\.]+$/;
  if (!nameRegex.test(trimmedName)) {
    throw new Error('Player name contains invalid characters');
  }
  
  return trimmedName;
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {string} - The password if valid
 * @throws {Error} - If password is invalid
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }
  
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }
  
  return password;
}

/**
 * Validates age group format
 * @param {string} ageGroup - Age group to validate
 * @returns {string} - Cleaned age group
 * @throws {Error} - If age group is invalid
 */
export function validateAgeGroup(ageGroup) {
  if (ageGroup == null) return '';
  if (typeof ageGroup !== 'string') return String(ageGroup);
  // Accept any string (including blank) to support arbitrary league labels
  return ageGroup.trim();
}

/**
 * Custom validators for specific form types
 */
export const customValidators = {
  /**
   * Validates drill values based on drill type
   * @param {string|number} value - The drill value to validate
   * @param {string} type - The type of drill (40m_dash, vertical_jump, etc.)
   * @param {object} drillDef - Optional drill definition with min/max/unit
   * @returns {string|null} - Error message if invalid, null if valid
   */
  drillValue(value, type, drillDef = null) {
    if (!value && value !== 0) {
      return "Drill value is required";
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return "Drill value must be a valid number";
    }

    if (numValue < 0) {
      return "Drill value cannot be negative";
    }

    // Use drill definition constraints if available
    if (drillDef) {
      if (drillDef.min_value !== undefined && drillDef.min_value !== null && numValue < drillDef.min_value) {
        return `Value seems unrealistic (min ${drillDef.min_value})`;
      }
      if (drillDef.max_value !== undefined && drillDef.max_value !== null && numValue > drillDef.max_value) {
        return `Value seems unrealistic (max ${drillDef.max_value})`;
      }
      return null;
    }

    // Legacy fallback (deprecate football-specific hardcoding where possible)
    // Only keep extremely generic bounds if absolutely necessary
    if (numValue > 100000) {
       return "Value seems unrealistically high";
    }

    return null; // Valid
  }
};