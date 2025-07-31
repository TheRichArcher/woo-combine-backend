/**
 * Standardized async operation hook for consistent error handling
 * across the WooCombine application
 */

import { useState, useCallback } from 'react';
import { logger } from '../utils/logger';
import { APP_CONFIG, ERROR_MESSAGES } from '../constants/app';

// MOVED HELPER FUNCTIONS TO TOP TO FIX TEMPORAL DEAD ZONE

/**
 * Convert technical errors to user-friendly messages
 */
function getUserFriendlyError(error) {
  // Network errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return ERROR_MESSAGES.NETWORK.TIMEOUT;
  }
  
  if (error.message?.includes('Network Error')) {
    return ERROR_MESSAGES.NETWORK.OFFLINE;
  }
  
  // HTTP status errors
  if (error.response?.status) {
    switch (error.response.status) {
      case 401:
        return ERROR_MESSAGES.AUTH.SESSION_EXPIRED;
      case 403:
        return ERROR_MESSAGES.NETWORK.FORBIDDEN;
      case 404:
        return ERROR_MESSAGES.NETWORK.NOT_FOUND;
      case 429:
        return ERROR_MESSAGES.AUTH.TOO_MANY_REQUESTS;
      case 500:
      case 502:
      case 503:
      case 504:
        return ERROR_MESSAGES.NETWORK.SERVER_ERROR;
      default:
        return error.response.data?.detail || error.response.data?.message || 'An error occurred';
    }
  }
  
  // Firebase/Auth errors
  if (error.code?.startsWith('auth/')) {
    return ERROR_MESSAGES.AUTH.LOGIN_FAILED;
  }
  
  // Default to error message or generic message
  return error.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Determine if an error should not be retried
 */
function shouldNotRetry(error) {
  // Don't retry client errors (4xx) except for specific cases
  const status = error.response?.status;
  if (status >= 400 && status < 500) {
    // Retry on 408 (timeout), 429 (rate limit), but not others
    return ![408, 429].includes(status);
  }
  
  // Don't retry validation errors or auth errors
  if (error.code?.startsWith('auth/') || error.name === 'ValidationError') {
    return true;
  }
  
  return false;
}

/**
 * Hook for standardized async operation handling
 * @param {Object} options - Configuration options
 * @param {string} options.context - Context name for logging (e.g., 'PLAYER_FETCH')
 * @param {Function} options.onSuccess - Optional success callback
 * @param {Function} options.onError - Optional error callback
 * @param {boolean} options.showToast - Whether to show toast notifications
 * @returns {Object} { data, loading, error, execute, reset }
 */
export const useAsyncOperation = (options = {}) => {
  const { 
    context = 'ASYNC_OP',
    onSuccess,
    onError,
    showToast = false
  } = options;

  const [state, setState] = useState({
    data: null,
    loading: false,
    error: null
  });

  // NOW SAFE: getUserFriendlyError is defined above
  const execute = useCallback(async (asyncFunction, ...args) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const startTime = performance.now();
    logger.time(context, 'Operation');

    try {
      const result = await asyncFunction(...args);
      
      const endTime = performance.now();
      logger.timeEnd(context, 'Operation');
      
      setState({ data: result, loading: false, error: null });
      
      // Log successful operation
      logger.info(context, `Operation completed successfully in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      logger.timeEnd(context, 'Operation');
      
      // Determine user-friendly error message
      const userMessage = getUserFriendlyError(error);
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: userMessage 
      }));
      
      // Log error with context
      logger.error(context, `Operation failed: ${userMessage}`, error);
      
      // Call error callback if provided
      if (onError) {
        onError(error, userMessage);
      }
      
      throw error;
    }
  }, [context, onSuccess, onError]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    execute,
    reset
  };
};

/**
 * Hook for API operations with built-in retry logic
 * @param {Object} options - Configuration options
 * @returns {Object} Enhanced async operation with retry capabilities
 */
export const useApiOperation = (options = {}) => {
  const { 
    maxRetries = APP_CONFIG.RETRY.MAX_RETRIES,
    baseDelay = APP_CONFIG.RETRY.BASE_DELAY,
    ...restOptions 
  } = options;

  const asyncOp = useAsyncOperation(restOptions);

  // NOW SAFE: shouldNotRetry is defined above
  const executeWithRetry = useCallback(async (apiFunction, ...args) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await asyncOp.execute(apiFunction, ...args);
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain error types
        if (shouldNotRetry(error) || attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(APP_CONFIG.RETRY.EXPONENTIAL_BASE, attempt);
        const finalDelay = Math.min(delay, APP_CONFIG.RETRY.MAX_DELAY);
        
        logger.warn(
          restOptions.context || 'API_RETRY', 
          `Attempt ${attempt + 1} failed, retrying in ${finalDelay}ms`,
          { error: error.message, attempt: attempt + 1, maxRetries }
        );
        
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
    }
    
    throw lastError;
  }, [asyncOp, maxRetries, baseDelay, restOptions.context]);

  return {
    ...asyncOp,
    execute: executeWithRetry
  };
};

/**
 * Hook for batch operations with progress tracking
 * @param {Object} options - Configuration options
 * @returns {Object} Batch operation handler with progress
 */
export const useBatchOperation = (options = {}) => {
  const asyncOp = useAsyncOperation(options);
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });

  const executeBatch = useCallback(async (items, batchFunction, batchSize = 10) => {
    setProgress({ current: 0, total: items.length, percentage: 0 });
    
    const results = [];
    const errors = [];
    
    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const batchResults = await Promise.allSettled(
          batch.map((item, index) => batchFunction(item, i + index))
        );
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            errors.push({
              index: i + index,
              item: batch[index],
              error: result.reason
            });
          }
        });
        
      } catch (batchError) {
        logger.error(options.context || 'BATCH_OP', 'Batch processing failed', batchError);
        errors.push({ batch: i / batchSize, error: batchError });
      }
      
      // Update progress
      const current = Math.min(i + batchSize, items.length);
      const percentage = Math.round((current / items.length) * 100);
      setProgress({ current, total: items.length, percentage });
    }
    
    return { results, errors };
  }, [options.context]);

  return {
    ...asyncOp,
    executeBatch,
    progress
  };
};

export default useAsyncOperation; 