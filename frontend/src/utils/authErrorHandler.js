/**
 * Checks if a Firebase auth error code is an expected user error
 * that should not be reported to Sentry as an application exception.
 * 
 * @param {string} errorCode - The Firebase error code (e.g. 'auth/wrong-password')
 * @returns {boolean} - True if the error is expected behavior
 */
export const isExpectedAuthError = (errorCode) => {
  const expectedCodes = [
    'auth/invalid-credential',       // Wrong email/password combination
    'auth/wrong-password',           // Wrong password
    'auth/user-not-found',           // Email not registered
    'auth/invalid-email',            // Malformed email
    'auth/user-disabled',            // Account disabled
    'auth/email-already-in-use',     // Signup: email taken
    'auth/weak-password',            // Signup: password too weak
    'auth/operation-not-allowed',    // Signup: method disabled
    'auth/invalid-login-credentials' // New Firebase variant
  ];
  return expectedCodes.includes(errorCode);
};

/**
 * Returns a user-friendly error message for common Firebase auth errors.
 * Returns null if the error code is not recognized as a standard auth error,
 * allowing the caller to provide a generic fallback.
 * 
 * @param {string} errorCode - The Firebase error code
 * @returns {string|null} - User friendly message or null
 */
export const getAuthErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return "No account found with that email address.";
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return "Incorrect email or password.";
    case 'auth/invalid-email':
      return "Please enter a valid email address.";
    case 'auth/user-disabled':
      return "This account has been disabled.";
    case 'auth/too-many-requests':
      return "Too many failed attempts. Please try again later.";
    default:
      return null;
  }
};

