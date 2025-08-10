import React from 'react';

export default function OnboardingCard({
  title,
  subtitle,
  children,
  showLogo = true,
  centered = true,
  footer = null,
  className = '',
}) {
  return (
    <div className={`w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 ${centered ? 'text-center' : ''} ${className}`}>
      {showLogo && (
        <div className="text-center mb-6">
          <img
            src="/favicon/woocombine-logo.png"
            alt="Woo-Combine Logo"
            className="w-16 h-16 mx-auto mb-4 object-contain"
          />
        </div>
      )}

      {title && (
        <h1 className="text-2xl font-bold mb-2 text-gray-900">{title}</h1>
      )}
      {subtitle && (
        <p className="mb-6 text-gray-600 text-sm">{subtitle}</p>
      )}

      {children}

      {footer}
    </div>
  );
}


