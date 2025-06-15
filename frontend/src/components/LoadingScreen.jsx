import React, { useState, useEffect } from 'react';

const LoadingScreen = ({ size = 'large', message = 'Loading...' }) => {
  const [extendedLoading, setExtendedLoading] = useState(false);
  const [coldStartMessage, setColdStartMessage] = useState(false);

  useEffect(() => {
    // Show extended loading message after 10 seconds
    const extendedTimer = setTimeout(() => {
      setExtendedLoading(true);
    }, 10000);

    // Show cold start message after 20 seconds
    const coldStartTimer = setTimeout(() => {
      setColdStartMessage(true);
    }, 20000);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
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
          <div className={`${spinnerSizes[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
        </div>

        {/* Main message */}
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          {message}
        </h2>

        {/* Extended loading messages */}
        {extendedLoading && !coldStartMessage && (
          <div className="text-gray-500 text-sm max-w-md mx-auto">
            <p className="mb-2">This is taking longer than usual...</p>
            <p>The server may be starting up.</p>
          </div>
        )}

        {coldStartMessage && (
          <div className="text-gray-500 text-sm max-w-md mx-auto bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="mb-2">🚀 <strong>Server is starting up</strong></p>
            <p className="mb-2">This can take up to a minute on the first visit.</p>
            <p className="text-xs">Free hosting services need time to initialize.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen; 