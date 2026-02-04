import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import Button from "../components/ui/Button";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
  const { user, userRole, status, initializing } = useAuth();
  
  // Redirect authenticated users to appropriate destination
  useEffect(() => {
    // Wait for auth to finish initializing
    if (initializing) return;
    
    // If user is logged in
    if (user) {
      // If email not verified, go to verify-email
      if (!user.emailVerified) {
        navigate('/verify-email', { replace: true });
        return;
      }
      
      // If no role selected, go to role selection
      if (!userRole) {
        navigate('/select-role', { replace: true });
        return;
      }
      
      // Authenticated with role - go to dashboard
      navigate('/coach', { replace: true });
    }
  }, [user, userRole, initializing, navigate]);
  
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
          
          {/* Primary CTA Buttons - Dual intent: Action vs Proof */}
          <div className="space-y-3 mb-6">
            {/* Primary: Direct Action for ready users */}
            <Button 
              size="lg" 
              className="w-full" 
              onClick={() => {
                console.log('[Analytics] welcome_cta_start_setup');
                navigate("/signup");
              }}
            >
              🚀 Start Setup Now
            </Button>
            
            {/* Secondary: Proof for skeptical users */}
            <Button 
              variant="outline" 
              size="lg"
              className="w-full" 
              onClick={() => {
                console.log('[Analytics] welcome_demo_click');
                navigate("/workflow-demo");
              }}
            >
              <div className="text-center">
                <div className="font-semibold">See how to run a combine in 3 minutes</div>
                <div className="text-xs text-gray-500 mt-0.5">Setup → Live Entry → Rankings → Export (no signup)</div>
              </div>
            </Button>
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