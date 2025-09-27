import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

const Toast = ({ message, type = 'info', duration = 5000, onClose, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300); // Animation duration
  }, [onClose]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, handleClose]);

  const typeStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800'
  };

  const iconMap = {
    info: <AlertCircle className="w-5 h-5" />,
    warning: <Clock className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />
  };

  return (
    <div className={`max-w-sm p-4 border rounded-lg shadow-lg transition-all duration-300 ${
      isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
    } ${typeStyles[type]}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        {iconMap[type]}
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
          {(actionLabel || secondaryActionLabel) && (
            <div className="mt-2 flex gap-3 text-sm">
              {actionLabel && (
                <button
                  onClick={() => { if (onAction) onAction(); handleClose(); }}
                  className="underline font-medium hover:opacity-80"
                >
                  {actionLabel}
                </button>
              )}
              {secondaryActionLabel && (
                <button
                  onClick={() => { if (onSecondaryAction) onSecondaryAction(); handleClose(); }}
                  className="underline text-gray-700 hover:opacity-80"
                >
                  {secondaryActionLabel}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 hover:bg-black/10 rounded-full transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast; 