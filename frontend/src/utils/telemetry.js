/**
 * Telemetry utilities with fail-safe guards
 * 
 * Purpose: Prevent telemetry/analytics crashes from breaking UI
 * Pattern: All telemetry functions are optional and fail silently
 */

/**
 * Safe telemetry logger with Sentry integration
 * 
 * @param {string} event - Event name
 * @param {object} data - Event data
 * 
 * Usage:
 *   logEvent('user-action', { action: 'click', target: 'button' })
 * 
 * Behavior:
 * - Logs to console in development
 * - Sends to Sentry breadcrumb if available
 * - Never throws errors (fail-safe)
 */
export const logEvent = (event, data = {}) => {
  try {
    // Development logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Telemetry] ${event}`, data);
    }
    
    // Sentry breadcrumb (if available)
    if (typeof window !== 'undefined' && window.Sentry?.addBreadcrumb) {
      window.Sentry.addBreadcrumb({
        category: 'telemetry',
        message: event,
        data: data,
        level: 'info'
      });
    }
  } catch (error) {
    // Fail silently - telemetry should never break the app
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Telemetry] Failed to log event:', error);
    }
  }
};

/**
 * Safe drag event logger
 * 
 * @param {string} eventType - 'dragenter' | 'dragleave' | 'drop' | 'drop-success' | 'drop-rejected'
 * @param {object} data - Event details
 * 
 * Usage:
 *   logDragEvent('drop-success', { fileName: 'data.csv' })
 */
export const logDragEvent = (eventType, data = {}) => {
  logEvent(`drag-${eventType}`, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Safe user action logger
 * 
 * @param {string} action - Action name
 * @param {object} data - Action context
 */
export const logUserAction = (action, data = {}) => {
  logEvent(`user-${action}`, data);
};

/**
 * Safe error logger (non-throwing)
 * 
 * @param {string} errorContext - Where the error occurred
 * @param {Error|string} error - The error
 * @param {object} data - Additional context
 */
export const logError = (errorContext, error, data = {}) => {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Console error in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Error] ${errorContext}:`, errorMessage, data);
    }
    
    // Sentry error (if available)
    if (typeof window !== 'undefined' && window.Sentry?.captureException) {
      window.Sentry.captureException(error, {
        tags: { context: errorContext },
        extra: data
      });
    }
  } catch (loggingError) {
    // Ultimate fail-safe: even error logging can't break the app
    console.warn('[Telemetry] Failed to log error:', loggingError);
  }
};

/**
 * Safe performance metric logger
 * 
 * @param {string} metric - Metric name
 * @param {number} value - Metric value
 * @param {object} data - Additional context
 */
export const logMetric = (metric, value, data = {}) => {
  logEvent(`metric-${metric}`, {
    value,
    ...data
  });
};

/**
 * Create a safe event logger with context
 * 
 * @param {string} context - Component or feature name
 * @returns {function} Logger function bound to context
 * 
 * Usage:
 *   const log = createLogger('EventSetup');
 *   log('file-uploaded', { fileName: 'data.csv' });
 */
export const createLogger = (context) => {
  return (event, data = {}) => {
    logEvent(event, {
      context,
      ...data
    });
  };
};

// Default export for convenience
export default {
  logEvent,
  logDragEvent,
  logUserAction,
  logError,
  logMetric,
  createLogger
};

