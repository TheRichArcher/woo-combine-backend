import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Standardized error display component for consistent error UI
 * @param {Object} props - Component props
 * @param {string} props.error - Error message to display
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showIcon - Whether to show error icon
 */
const ErrorDisplay = React.memo(function ErrorDisplay({ 
  error, 
  className = '', 
  showIcon = true 
}) {
  if (!error) return null;

  return (
    <div className={`bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex items-start gap-2 ${className}`}>
      {showIcon && <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
      <span className="flex-1">{error}</span>
    </div>
  );
});

export default ErrorDisplay;