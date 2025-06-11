import React from 'react';

export default function LoadingScreen({ 
  title = "Loading WooCombine...", 
  subtitle = null,
  showLogo = true,
  size = "large" // "small", "medium", "large"
}) {
  const sizeClasses = {
    small: {
      container: "min-h-[40vh]",
      logo: "w-12 h-12",
      spinner: "w-6 h-6 border-2",
      title: "text-lg",
      subtitle: "text-sm"
    },
    medium: {
      container: "min-h-[60vh]",
      logo: "w-16 h-16",
      spinner: "w-8 h-8 border-4",
      title: "text-xl",
      subtitle: "text-base"
    },
    large: {
      container: "min-h-screen",
      logo: "w-20 h-20",
      spinner: "w-10 h-10 border-4",
      title: "text-2xl",
      subtitle: "text-lg"
    }
  };

  const classes = sizeClasses[size];

  return (
    <div className={`${classes.container} flex items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50`}>
      <div className="text-center p-8">
        {/* Logo */}
        {showLogo && (
          <div className="mb-6">
            <img
              src="/favicon/woocombine-logo.png"
              alt="WooCombine Logo"
              className={`${classes.logo} mx-auto object-contain animate-pulse`}
            />
          </div>
        )}

        {/* Spinner */}
        <div className="mb-4">
          <div className={`animate-spin inline-block ${classes.spinner} border-gray-200 border-t-cyan-600 rounded-full`}></div>
        </div>

        {/* Title */}
        <div className={`${classes.title} font-semibold text-gray-800 mb-2`}>
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div className={`${classes.subtitle} text-gray-600`}>
            {subtitle}
          </div>
        )}

        {/* Animated dots */}
        <div className="flex justify-center space-x-1 mt-4">
          <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
} 