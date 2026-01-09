import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { useToast } from "../context/ToastContext";
import { logger } from '../utils/logger';

/**
 * DeleteConfirmModal - CANONICAL DELETE CONFIRMATION COMPONENT
 * 
 * Single source of truth for all delete/remove confirmations across the app.
 * 
 * @param {boolean} open - Whether modal is visible
 * @param {function} onClose - Callback to close modal
 * @param {function} onConfirm - Async callback to execute deletion
 * @param {string} title - Modal title (e.g., "Delete Event")
 * @param {string} itemName - Name of item being deleted (for display)
 * @param {string} itemType - Type of item (e.g., "event", "player", "drill")
 * @param {string} description - What is being deleted (optional, defaults from itemName)
 * @param {string} consequences - What will happen after deletion (optional)
 * @param {string} severity - 'low' | 'medium' | 'high' (determines confirmation type)
 * @param {boolean} requireTypedConfirmation - Force typed confirmation (overrides severity default)
 * @param {string} confirmationText - Text user must type (default: "DELETE")
 * @param {string} variant - 'danger' (red) | 'warning' (yellow)
 * @param {string} confirmButtonText - Text for confirm button (default: "Delete")
 * @param {string} cancelButtonText - Text for cancel button (default: "Cancel")
 * @param {object} analyticsData - Additional data to log with deletion event
 */
export default function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  
  // Content
  title = "Confirm Deletion",
  itemName = "",
  itemType = "item",
  description = null,
  consequences = null,
  
  // Behavior
  severity = 'medium', // 'low' | 'medium' | 'high'
  requireTypedConfirmation = null, // Auto-determined by severity if null
  confirmationText = "DELETE",
  
  // Styling
  variant = 'danger', // 'danger' | 'warning'
  confirmButtonText = "Delete",
  cancelButtonText = "Cancel",
  
  // Analytics
  analyticsData = {}
}) {
  const { showSuccess, showError } = useToast();
  const inputRef = useRef(null);
  
  // Async states
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  
  // Typed confirmation state
  const [typedText, setTypedText] = useState("");
  const [pasteBlocked, setPasteBlocked] = useState(false);
  
  // Determine if typed confirmation is required
  const needsTypedConfirmation = requireTypedConfirmation !== null 
    ? requireTypedConfirmation 
    : severity === 'high';
  
  const canConfirm = needsTypedConfirmation 
    ? typedText.trim().toUpperCase() === confirmationText.toUpperCase()
    : true;
  
  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setTypedText("");
      setError("");
      setPasteBlocked(false);
      setIsDeleting(false);
      
      // Focus input if typed confirmation required
      if (needsTypedConfirmation) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    }
  }, [open, needsTypedConfirmation]);
  
  // Log modal display
  useEffect(() => {
    if (open) {
      logger.info('DELETE_CONFIRM_MODAL_SHOWN', {
        itemType,
        itemName,
        severity,
        needsTypedConfirmation,
        ...analyticsData
      });
    }
  }, [open, itemType, itemName, severity, needsTypedConfirmation, analyticsData]);
  
  if (!open) return null;
  
  const handleConfirm = async () => {
    if (!canConfirm || isDeleting) return;
    
    setIsDeleting(true);
    setError("");
    
    try {
      logger.info('DELETE_CONFIRM_INITIATED', {
        itemType,
        itemName,
        severity,
        ...analyticsData
      });
      
      await onConfirm();
      
      logger.info('DELETE_CONFIRM_SUCCESS', {
        itemType,
        itemName,
        ...analyticsData
      });
      
      showSuccess(`✅ ${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted successfully`);
      
      // Close modal after brief delay
      setTimeout(() => {
        if (onClose) onClose();
      }, 500);
      
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to delete';
      setError(errorMsg);
      showError(`❌ ${errorMsg}`);
      
      logger.error('DELETE_CONFIRM_FAILED', {
        itemType,
        itemName,
        error: errorMsg,
        ...analyticsData
      });
      
      setIsDeleting(false);
    }
  };
  
  const handleCancel = () => {
    if (isDeleting) return;
    
    logger.info('DELETE_CONFIRM_CANCELLED', {
      itemType,
      itemName,
      typedText: typedText ? 'partial' : 'none',
      ...analyticsData
    });
    
    if (onClose) onClose();
  };
  
  const handlePaste = (e) => {
    if (needsTypedConfirmation) {
      e.preventDefault();
      setPasteBlocked(true);
      setTimeout(() => setPasteBlocked(false), 2000);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canConfirm && !isDeleting) {
      handleConfirm();
    } else if (e.key === 'Escape' && !isDeleting) {
      handleCancel();
    }
  };
  
  // Color schemes
  const colors = variant === 'danger' ? {
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    button: 'bg-red-600 hover:bg-red-700',
    inputFocus: 'focus:ring-red-500 focus:border-red-500',
    inputBorder: 'border-red-300'
  } : {
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-600',
    button: 'bg-yellow-600 hover:bg-yellow-700',
    inputFocus: 'focus:ring-yellow-500 focus:border-yellow-500',
    inputBorder: 'border-yellow-300'
  };
  
  const displayDescription = description || `Are you sure you want to delete ${itemName ? `"${itemName}"` : `this ${itemType}`}?`;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`flex-shrink-0 ${colors.iconBg} rounded-full p-3`}>
            {severity === 'low' ? (
              <AlertTriangle className={`w-6 h-6 ${colors.iconText}`} />
            ) : (
              <Trash2 className={`w-6 h-6 ${colors.iconText}`} />
            )}
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          </div>
          
          <button
            onClick={handleCancel}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Description */}
        <div className="mb-4">
          <p className="text-gray-700 text-sm leading-relaxed">
            {displayDescription}
          </p>
          
          {consequences && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">Consequences:</span>{' '}
                {consequences}
              </p>
            </div>
          )}
        </div>
        
        {/* Typed Confirmation Input */}
        {needsTypedConfirmation && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-bold text-gray-900">{confirmationText}</span> to confirm:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              disabled={isDeleting}
              className={`w-full px-3 py-2 border ${colors.inputBorder} rounded-lg ${colors.inputFocus} disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm`}
              placeholder={confirmationText}
              autoComplete="off"
              spellCheck="false"
            />
            {pasteBlocked && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ Pasting is disabled. Please type manually to confirm.
              </p>
            )}
            {typedText && !canConfirm && (
              <p className="text-xs text-gray-500 mt-1">
                Text doesn't match. Please type exactly: <span className="font-bold">{confirmationText}</span>
              </p>
            )}
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {cancelButtonText}
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || isDeleting}
            className={`flex-1 px-4 py-2 ${colors.button} text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              confirmButtonText
            )}
          </button>
        </div>
        
        {/* Keyboard Shortcuts Hint */}
        {!isDeleting && (
          <p className="text-xs text-gray-400 text-center mt-3">
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">Enter</kbd> to confirm or{' '}
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-600 font-mono">Esc</kbd> to cancel
          </p>
        )}
      </div>
    </div>
  );
}

