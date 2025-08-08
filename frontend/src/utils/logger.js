/**
 * Centralized logging utility for WooCombine App
 * Provides environment-aware logging with consistent formatting
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1, 
  INFO: 2,
  DEBUG: 3
};

const getCurrentLogLevel = () => {
  // Node/Jest env
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NODE_ENV === 'production') return LOG_LEVELS.ERROR;
    if (process.env.VITE_LOG_LEVEL) return LOG_LEVELS[process.env.VITE_LOG_LEVEL] || LOG_LEVELS.INFO;
  }
  // Vite runtime (guarded)
  try {
    // eslint-disable-next-line no-new-func
    const env = new Function('try { return import.meta && import.meta.env } catch (e) { return {} }')();
    if (env && env.PROD) return LOG_LEVELS.ERROR;
    if (env && env.VITE_LOG_LEVEL) return LOG_LEVELS[env.VITE_LOG_LEVEL] || LOG_LEVELS.INFO;
  } catch {}
  return LOG_LEVELS.DEBUG;
};

const formatMessage = (level, context, message, data) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${level}] ${timestamp} [${context}]`;
  return { prefix, message, data };
};

class Logger {
  constructor() {
    this.logLevel = getCurrentLogLevel();
  }

  error(context, message, error = null) {
    if (this.logLevel >= LOG_LEVELS.ERROR) {
      const { prefix } = formatMessage('ERROR', context, message);
      console.error(`${prefix} ${message}`, error || '');
    }
    
    // In production, send to error tracking service
    // Only attempt external reporting in production
    const isProd = (() => {
      if (typeof process !== 'undefined' && process.env) return process.env.NODE_ENV === 'production';
      try {
        // eslint-disable-next-line no-new-func
        const env = new Function('try { return import.meta && import.meta.env && import.meta.env.PROD } catch (e) { return false }')();
        return !!env;
      } catch { return false; }
    })();

    if (isProd && error) {
      // NOTE: Ready for error tracking service integration (Sentry, LogRocket, etc.)
      this.sendToErrorService(context, message, error);
    }
  }

  warn(context, message, data = null) {
    if (this.logLevel >= LOG_LEVELS.WARN) {
      const { prefix } = formatMessage('WARN', context, message);
      console.warn(`${prefix} ${message}`, data || '');
    }
  }

  info(context, message, data = null) {
    if (this.logLevel >= LOG_LEVELS.INFO) {
      const { prefix } = formatMessage('INFO', context, message);
      console.log(`${prefix} ${message}`, data || '');
    }
  }

  debug(context, message, data = null) {
    if (this.logLevel >= LOG_LEVELS.DEBUG) {
      const { prefix } = formatMessage('DEBUG', context, message);
      console.log(`${prefix} ${message}`, data || '');
    }
  }

  // Performance timing utility
  time(context, label) {
    if (this.logLevel >= LOG_LEVELS.DEBUG) {
      console.time(`[${context}] ${label}`);
    }
  }

  timeEnd(context, label) {
    if (this.logLevel >= LOG_LEVELS.DEBUG) {
      console.timeEnd(`[${context}] ${label}`);
    }
  }

  // Placeholder for production error service integration
  sendToErrorService(context, message, error) {
    // Implementation would depend on chosen service (Sentry, LogRocket, etc.)
    // For now, just ensure errors are logged
    console.error(`[PRODUCTION-ERROR] [${context}] ${message}`, {
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export context-specific loggers for common modules
export const authLogger = {
  error: (message, error) => logger.error('AUTH', message, error),
  warn: (message, data) => logger.warn('AUTH', message, data),
  info: (message, data) => logger.info('AUTH', message, data),
  debug: (message, data) => logger.debug('AUTH', message, data)
};

export const apiLogger = {
  error: (message, error) => logger.error('API', message, error),
  warn: (message, data) => logger.warn('API', message, data),
  info: (message, data) => logger.info('API', message, data),
  debug: (message, data) => logger.debug('API', message, data)
};

export const playerLogger = {
  error: (message, error) => logger.error('PLAYER', message, error),
  warn: (message, data) => logger.warn('PLAYER', message, data),
  info: (message, data) => logger.info('PLAYER', message, data),
  debug: (message, data) => logger.debug('PLAYER', message, data)
};

export const rankingLogger = {
  error: (message, error) => logger.error('RANKING', message, error),
  warn: (message, data) => logger.warn('RANKING', message, data),
  info: (message, data) => logger.info('RANKING', message, data),
  debug: (message, data) => logger.debug('RANKING', message, data)
};

export default logger; 