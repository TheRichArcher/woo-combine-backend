import React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';

/**
 * CombineLockedBanner Component
 * 
 * Displays a prominent banner when the combine is locked.
 * Used by coaches/viewers to indicate read-only mode.
 * 
 * @param {boolean} isLocked - Whether combine is currently locked
 * @param {string} message - Lock message to display
 * @param {string} className - Additional CSS classes
 */
export default function CombineLockedBanner({ isLocked, message, className = '' }) {
  if (!isLocked) return null;

  return (
    <div className={`bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Lock className="w-6 h-6 text-red-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-red-900">
              🔒 Combine Locked
            </h3>
            <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-semibold rounded">
              READ-ONLY
            </span>
          </div>
          <p className="text-sm text-red-800">
            {message || 'This combine has been locked by the organizer. Results are final and cannot be edited.'}
          </p>
          <div className="mt-2 flex items-start gap-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Contact the organizer if corrections or updates are needed.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

