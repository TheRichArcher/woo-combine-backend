import React from "react";
import { Link, useNavigate } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";

// Simplified welcome content - no more confusing A/B testing
const getWelcomeContent = () => {
  return {
    title: "Digital Combine Management",
    subtitle: "Turn your phone into a professional sports combine timer. Track performance, generate rankings, and share instant digital reports.",
    buttonText: "Get Started Free",
    hook: "📱 Replace clipboards with instant digital scoring"
  };
};

export default function Welcome() {
  const navigate = useNavigate();
  
  const content = getWelcomeContent();

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
            
            {/* Unified Demo Button */}
            <div className="flex justify-center">
              <button
                className="bg-white hover:bg-gray-50 text-cyan-600 font-semibold py-4 px-8 rounded-xl border-2 border-cyan-600 transition-all duration-200 transform hover:scale-105 shadow-lg"
                onClick={() => navigate("/workflow-demo")}
              >
                🚀 Watch Complete Demo
                <div className="text-xs text-gray-600 mt-1">Workflow + Features in Action</div>
              </button>
            </div>
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