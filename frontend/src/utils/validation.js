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
  if (!ageGroup || typeof ageGroup !== 'string') {
    throw new Error('Age group is required');
  }
  
  const trimmedAgeGroup = ageGroup.trim();
  
  // Allow formats like: 7-8, 9-10, U12, 12U, etc.
  const ageGroupRegex = /^((\d{1,2}-\d{1,2})|(U\d{1,2})|(\d{1,2}U))$/;
  if (!ageGroupRegex.test(trimmedAgeGroup)) {
    throw new Error('Invalid age group format. Examples: 7-8, U12, 12U');
  }
  
  return trimmedAgeGroup;
}