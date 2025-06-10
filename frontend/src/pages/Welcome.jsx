import React from "react";
import { Link } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";

// Simple feature flags system - in production this could be from a service like LaunchDarkly
const useFeatureFlags = () => {
  // For now, randomly assign variant or use localStorage to persist choice
  const getVariant = () => {
    const stored = localStorage.getItem('welcome_variant');
    if (stored) return stored;
    
    // Randomly assign variant for A/B testing
    const variants = ['default', 'mojo-style', 'sports-focused'];
    const variant = variants[Math.floor(Math.random() * variants.length)];
    localStorage.setItem('welcome_variant', variant);
    return variant;
  };
  
  return {
    welcomeVariant: getVariant()
  };
};

export default function Welcome() {
  const { welcomeVariant } = useFeatureFlags();
  
  const getContent = () => {
    switch (welcomeVariant) {
      case 'mojo-style':
        return {
          title: "Dominate. Track. Win.",
          subtitle: "Elevate your game with precision tracking and real-time insights that champions demand.",
          buttonText: "Start Dominating"
        };
      case 'sports-focused':
        return {
          title: "Train. Compete. Excel.",
          subtitle: "Professional-grade combine tracking and analytics for serious athletes and coaches.",
          buttonText: "Join the Elite"
        };
      default:
        return {
          title: "Coach. Manage. Excel.",
          subtitle: "Your all-in-one platform for team management, combine tracking, and athletic excellence.",
          buttonText: "Get Started"
        };
    }
  };

  const content = getContent();

  return (
    <WelcomeLayout
      contentClassName="min-h-[70vh]"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/favicon/ChatGPT Image May 21, 2025, 05_33_34 PM.png"
            alt="Woo-Combine Logo"
            className="w-16 h-16 mx-auto mb-4"
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Main Content */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            {content.title}
          </h1>
          <p className="text-gray-600 text-base leading-relaxed mb-6">
            {content.subtitle}
          </p>
          
          {/* Primary CTA Button */}
          <button
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02] mb-6"
            onClick={() => window.location.assign("/signup")}
          >
            {content.buttonText}
          </button>
        </div>

        {/* Footer Links */}
        <div className="text-center space-y-3 text-sm">
          <div className="flex flex-col gap-2">
            <Link 
              to="/login" 
              className="text-cyan-600 hover:text-cyan-800 font-medium transition-colors duration-200"
            >
              Already have an account? <span className="font-semibold">Sign In</span>
            </Link>
            <Link 
              to="/claim" 
              className="text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
            >
              Need to claim an account? <span className="font-semibold">Claim Account</span>
            </Link>
          </div>
          
          {/* Help Link */}
          <div className="pt-4 border-t border-gray-100">
            <Link 
              to="/help" 
              className="text-gray-500 hover:text-gray-700 text-xs transition-colors duration-200"
            >
              Need Help?
            </Link>
          </div>
        </div>
      </div>
    </WelcomeLayout>
  );
} 