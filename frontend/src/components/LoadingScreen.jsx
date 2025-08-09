import React, { useState, useEffect } from 'react';

// Enhanced LoadingScreen supports title, subtitle, message and optional progress
const LoadingScreen = ({ 
  size = 'large', 
  title = 'Loading...', 
  subtitle = '', 
  message = '', 
  showProgress = false 
}) => {
  const [extendedLoading, setExtendedLoading] = useState(false);
  const [coldStartMessage, setColdStartMessage] = useState(false);

  useEffect(() => {
    // Show extended loading message after 5 seconds
    const extendedTimer = setTimeout(() => {
      setExtendedLoading(true);
    }, 5000);

    // Show cold start message after 10 seconds
    const coldStartTimer = setTimeout(() => {
      setColdStartMessage(true);
    }, 10000);

    return () => {
      clearTimeout(extendedTimer);
      clearTimeout(coldStartTimer);
    };
  }, []);

  const sizeClasses = {
    small: 'h-32 w-32',
    medium: 'h-48 w-48',
    large: 'h-64 w-64'
  };

  const spinnerSizes = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/5 to-brand-primary/10 flex items-center justify-center">
      <div className="text-center">
        {/* Logo */}
        <div className={`mx-auto mb-8 ${sizeClasses[size]} flex items-center justify-center`}>
          <img 
            src="/favicon/woocombine-logo.png" 
            alt="WooCombine" 
            className="max-w-full max-h-full object-contain"
          />
        </div>

        {/* Spinner */}
        <div className="flex justify-center mb-6">
          <div className={`${spinnerSizes[size]} border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin`}></div>
        </div>

        {/* Titles/messages */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-1">
          {title || 'Loading...'}
        </h2>
        {subtitle && (
          <p className="text-gray-600 mb-3">{subtitle}</p>
        )}
        {message && (
          <p className="text-gray-500 text-sm mb-2">{message}</p>
        )}

        {showProgress && (
          <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden mx-auto mb-4" aria-hidden="true">
            <div className="h-full w-1/2 bg-brand-primary animate-pulse" />
          </div>
        )}

        {/* Extended loading messages */}
        {extendedLoading && !coldStartMessage && (
          <div className="text-gray-500 text-sm max-w-md mx-auto">
            <p className="mb-2">This is taking longer than usual...</p>
            <p>The server may be starting up.</p>
          </div>
        )}

        {coldStartMessage && (
          <div className="text-gray-500 text-sm max-w-md mx-auto bg-brand-primary/10 p-4 rounded-lg border border-brand-primary/20">
            <p className="mb-2">☕ <strong>Server is waking up</strong></p>
            <p className="mb-2">This can take up to 30 seconds on the first visit after inactivity.</p>
            <p className="text-xs">Your data is safe - just waiting for the server to start.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen; 