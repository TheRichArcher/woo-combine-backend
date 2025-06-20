import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [activeColdStartId, setActiveColdStartId] = useState(null);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    
    // Clear active cold start ID if this was a cold start notification
    if (id === activeColdStartId) {
      setActiveColdStartId(null);
    }
  }, [activeColdStartId]);

  // Convenience methods for different types of notifications
  const showSuccess = useCallback((message, duration = 4000) => {
    return addToast(message, 'success', duration);
  }, [addToast]);

  const showError = useCallback((message, duration = 6000) => {
    return addToast(message, 'error', duration);
  }, [addToast]);

  const showInfo = useCallback((message, duration = 5000) => {
    return addToast(message, 'info', duration);
  }, [addToast]);

  const showWarning = useCallback((message, duration = 5000) => {
    return addToast(message, 'warning', duration);
  }, [addToast]);

  const showColdStartNotification = useCallback(() => {
    // CRITICAL FIX: Prevent duplicate cold start notifications
    if (activeColdStartId) {
      return activeColdStartId; // Return existing notification ID
    }
    
    const id = addToast(
      "Server is starting up after inactivity. This may take up to a minute...", 
      'warning', 
      10000 // 10 second duration
    );
    
    setActiveColdStartId(id);
    return id;
  }, [addToast, activeColdStartId]);

  // Notification helpers for common scenarios
  const notifyPlayerAdded = useCallback((playerName) => {
    return showSuccess(`✅ ${playerName} added successfully!`);
  }, [showSuccess]);

  const notifyPlayersUploaded = useCallback((count) => {
    return showSuccess(`✅ ${count} players uploaded successfully!`);
  }, [showSuccess]);

  const notifyEventCreated = useCallback((eventName) => {
    return showSuccess(`🎉 Event "${eventName}" created successfully!`);
  }, [showSuccess]);

  const notifyEventUpdated = useCallback((eventName) => {
    return showSuccess(`✅ Event "${eventName}" updated successfully!`);
  }, [showSuccess]);

  const notifyScoreAdded = useCallback((playerName, drill) => {
    return showSuccess(`📊 Score recorded for ${playerName} - ${drill}`);
  }, [showSuccess]);

  const notifyError = useCallback((error) => {
    const message = error?.response?.data?.detail || error?.message || 'An error occurred';
    return showError(`❌ ${message}`);
  }, [showError]);

  const contextValue = {
    // Core methods
    addToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showColdStartNotification,
    
    // Convenience notifications
    notifyPlayerAdded,
    notifyPlayersUploaded,
    notifyEventCreated,
    notifyEventUpdated,
    notifyScoreAdded,
    notifyError,
    
    // Toast state for debugging
    toasts
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Render all toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
} 