import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Standardized error display component for consistent error UI
 * @param {Object} props - Component props
 * @param {string} props.error - Error message to display
 * @param {string} props.title - Optional title to display above the error
 * @param {Function} props.onRetry - Optional retry handler to render a Retry button
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showIcon - Whether to show error icon
 */
const ErrorDisplay = React.memo(function ErrorDisplay({ 
  error,
  title = '',
  onRetry,
  className = '', 
  showIcon = true 
}) {
  if (!error) return null;

  return (
    <div className={`bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm ${className}`}>
      {title && <h3 className="text-red-800 font-semibold mb-1">{title}</h3>}
      <div className="flex items-start gap-2">
        {showIcon && <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
        <span className="flex-1">{error}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 text-red-800 hover:text-red-900 font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        )}
      </div>
    </div>
  );
});

export default ErrorDisplay;