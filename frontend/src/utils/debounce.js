/**
 * Performance optimization utilities for WooCombine
 * Implements debouncing for heavy operations like ranking calculations
 */

/**
 * Debounce function to limit the rate of function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

/**
 * Throttle function to limit function calls to once per interval
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  
  return function executedFunction(...args) {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if ((Date.now() - lastRan) >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Batch multiple function calls into a single execution
 * @param {Function} func - Function to batch
 * @param {number} delay - Batch delay in milliseconds
 * @returns {Function} Batched function
 */
export function batchCalls(func, delay = 50) {
  let pending = false;
  let args = [];
  
  return function batchedFunction(...newArgs) {
    args.push(newArgs);
    
    if (!pending) {
      pending = true;
      setTimeout(() => {
        const allArgs = args;
        args = [];
        pending = false;
        func(allArgs);
      }, delay);
    }
  };
}