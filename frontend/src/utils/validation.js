/**
 * Standardized validation utilities for consistent input validation
 * across the WooCombine application
 */

// Validation rule types
export const VALIDATION_RULES = {
  REQUIRED: 'required',
  EMAIL: 'email',
  NUMBER: 'number',
  MIN_LENGTH: 'minLength',
  MAX_LENGTH: 'maxLength',
  PATTERN: 'pattern'
};

/**
 * Basic validation functions
 */
export const validators = {
  required: (value) => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required';
    }
    if (typeof value === 'string' && value.trim() === '') {
      return 'This field is required';
    }
    return null;
  },

  email: (value) => {
    if (!value) return null; // Allow empty if not required
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  number: (value) => {
    if (!value) return null; // Allow empty if not required
    if (isNaN(Number(value))) {
      return 'Please enter a valid number';
    }
    return null;
  },

  minLength: (min) => (value) => {
    if (!value) return null; // Allow empty if not required
    if (value.length < min) {
      return `Must be at least ${min} characters long`;
    }
    return null;
  },

  maxLength: (max) => (value) => {
    if (!value) return null; // Allow empty if not required
    if (value.length > max) {
      return `Must be no more than ${max} characters long`;
    }
    return null;
  },

  pattern: (regex, message) => (value) => {
    if (!value) return null; // Allow empty if not required
    if (!regex.test(value)) {
      return message || 'Invalid format';
    }
    return null;
  }
};

/**
 * Validate a single field against multiple rules
 * @param {any} value - Value to validate
 * @param {Array} rules - Array of validation rules
 * @returns {string|null} - Error message or null if valid
 */
export const validateField = (value, rules = []) => {
  for (const rule of rules) {
    if (typeof rule === 'function') {
      const error = rule(value);
      if (error) return error;
    } else if (typeof rule === 'object') {
      const { type, ...params } = rule;
      let validator;
      
      switch (type) {
        case VALIDATION_RULES.REQUIRED:
          validator = validators.required;
          break;
        case VALIDATION_RULES.EMAIL:
          validator = validators.email;
          break;
        case VALIDATION_RULES.NUMBER:
          validator = validators.number;
          break;
        case VALIDATION_RULES.MIN_LENGTH:
          validator = validators.minLength(params.min);
          break;
        case VALIDATION_RULES.MAX_LENGTH:
          validator = validators.maxLength(params.max);
          break;
        case VALIDATION_RULES.PATTERN:
          validator = validators.pattern(params.regex, params.message);
          break;
        default:
          continue;
      }
      
      const error = validator(value);
      if (error) return error;
    }
  }
  return null;
};

/**
 * Validate an entire form object
 * @param {Object} formData - Form data object
 * @param {Object} validationSchema - Validation schema with field rules
 * @returns {Object} - Object with field errors and isValid flag
 */
export const validateForm = (formData, validationSchema) => {
  const errors = {};
  let isValid = true;

  for (const [field, rules] of Object.entries(validationSchema)) {
    const value = formData[field];
    const error = validateField(value, rules);
    if (error) {
      errors[field] = error;
      isValid = false;
    }
  }

  return { errors, isValid };
};

/**
 * Common validation schemas for reuse
 */
export const commonSchemas = {
  player: {
    name: [validators.required, validators.maxLength(100)],
    number: [validators.number],
    age_group: [validators.maxLength(20)]
  },
  
  drill: {
    type: [validators.required],
    value: [validators.required, validators.number]
  },
  
  event: {
    name: [validators.required, validators.maxLength(100)],
    date: [validators.required],
    location: [validators.maxLength(200)]
  },
  
  league: {
    name: [validators.required, validators.maxLength(100)],
    description: [validators.maxLength(500)]
  }
};

/**
 * Custom validation helpers
 */
export const customValidators = {
  playerNumber: (value, existingNumbers = []) => {
    if (!value) return null;
    const num = Number(value);
    if (isNaN(num) || num < 1 || num > 999) {
      return 'Player number must be between 1 and 999';
    }
    if (existingNumbers.includes(num)) {
      return 'This player number is already taken';
    }
    return null;
  },

  drillValue: (value, drillType) => {
    if (!value) return null;
    const num = Number(value);
    if (isNaN(num)) {
      return 'Please enter a valid number';
    }
    
    // Drill-specific validation
    switch (drillType) {
      case '40m_dash':
        if (num <= 0 || num > 60) {
          return '40-yard dash time should be between 0 and 60 seconds';
        }
        break;
      case 'vertical_jump':
        if (num < 0 || num > 100) {
          return 'Vertical jump should be between 0 and 100 inches';
        }
        break;
      case 'catching':
      case 'throwing':
      case 'agility':
        if (num < 0 || num > 100) {
          return 'Score should be between 0 and 100 points';
        }
        break;
    }
    return null;
  }
};