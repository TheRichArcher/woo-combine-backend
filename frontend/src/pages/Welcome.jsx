import React from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const { welcomeVariant } = useFeatureFlags();
  
  const getContent = () => {
    switch (welcomeVariant) {
      case 'mojo-style':
        return {
          title: "Track Every 40-Yard Dash, Score Every Drill",
          subtitle: "Real-time combine tracking that turns raw athletic performance into championship insights. See results instantly.",
          buttonText: "Start Tracking",
          hook: "⚡ Live combine scoring in seconds"
        };
      case 'sports-focused':
        return {
          title: "Digital Sports Combines Made Simple",
          subtitle: "Run professional NFL-style combines with instant digital scorecards. No more clipboards or calculators.",
          buttonText: "Try It Free",
          hook: "🏃‍♂️ From 40-yard dash to digital scorecard in 30 seconds"
        };
      default:
        return {
          title: "Digital Combine Tracking",
          subtitle: "Turn your phone into a professional combine timer. Track 40-yard dashes, vertical jumps, and drills with instant digital scorecards.",
          buttonText: "Start Free Trial",
          hook: "📱 Replace clipboards with instant digital scoring"
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
            src="/favicon/woocombine-logo.png"
            alt="Woo-Combine Logo"
            className="w-16 h-16 mx-auto mb-4"
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Main Content */}
        <div className="text-center mb-8">
          {/* Hook - Immediate Value Proposition */}
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg px-4 py-2 mb-4">
            <span className="text-cyan-700 font-medium text-sm">{content.hook}</span>
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            {content.title}
          </h1>
          <p className="text-gray-600 text-base leading-relaxed mb-6">
            {content.subtitle}
          </p>
          
          {/* Primary CTA Buttons */}
          <div className="space-y-3 mb-6">
            <button
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
              onClick={() => navigate("/signup")}
            >
              {content.buttonText}
            </button>
            
            {/* Demo Button - Immediate Access */}
            <button
              className="w-full bg-white hover:bg-gray-50 text-cyan-600 font-semibold py-3 rounded-xl border-2 border-cyan-600 transition-all duration-200 transform hover:scale-[1.02]"
              onClick={() => navigate("/demo")}
            >
              👀 Try Demo - See It In Action
            </button>
          </div>
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