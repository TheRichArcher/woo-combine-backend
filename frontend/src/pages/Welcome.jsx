import React from "react";
import { Link, useNavigate } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import Button from "../components/ui/Button";
import { Link as RouterLink } from "react-router-dom";

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
      backgroundColor="bg-surface-subtle"
      footerLinks={(
        <div className="flex flex-col sm:flex-row gap-2 text-white/80 text-sm">
          <RouterLink to="/terms" className="hover:underline">Terms</RouterLink>
          <span className="hidden sm:inline">·</span>
          <RouterLink to="/privacy" className="hover:underline">Privacy</RouterLink>
          <span className="hidden sm:inline">·</span>
          <RouterLink to="/help" className="hover:underline">Contact</RouterLink>
        </div>
      )}
    >
      <div className="w-full max-w-md wc-card p-6 sm:p-10 flex flex-col items-center">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/favicon/woocombine-logo.png"
            alt="Woo-Combine Logo"
            className="w-16 h-16 mx-auto mb-4 object-contain"
          />
        </div>

        {/* Main Content */}
        <div className="text-center mb-8">
          {/* Hook - Immediate Value Proposition */}
          <div className="bg-gradient-to-r from-brand-primary/10 to-brand-primary/10 border border-brand-primary/20 rounded-lg px-4 py-2 mb-4">
            <span className="text-brand-primary font-medium text-sm">{content.hook}</span>
          </div>
          
          <h1 className="wc-h1 mb-4">
            {content.title}
          </h1>
          <p className="wc-subtle text-base leading-relaxed mb-6">
            {content.subtitle}
          </p>
          
          {/* Primary CTA Buttons */}
          <div className="space-y-3 mb-6">
            <Button size="lg" className="w-full" onClick={() => navigate("/signup")}>
              {content.buttonText}
            </Button>
            {/* Unified Demo Button */}
            <div className="flex justify-center">
              <Button variant="outline" className="py-4 px-8" onClick={() => navigate("/workflow-demo")}>
                🚀 Watch Complete Demo
                <div className="text-xs text-gray-600 mt-1">Workflow + Features in Action</div>
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center space-y-3 text-sm">
          <div className="flex flex-col gap-2">
            <Link 
              to="/login" 
              className="text-brand-primary hover:opacity-90 font-medium transition-colors duration-200"
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