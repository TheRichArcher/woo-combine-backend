import React from "react";
import { Link } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import WelcomeContent from "../components/Welcome/WelcomeContent";

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
  
  // Different footer content based on variant
  const getFooterContent = () => {
    switch (welcomeVariant) {
      case 'mojo-style':
        return (
          <div className="flex flex-col sm:flex-row gap-2 text-white/80 text-base">
            <Link to="/login" className="hover:underline">Ready to dominate? <span className="font-semibold text-white">Sign in</span></Link>
            <span className="hidden sm:inline">&middot;</span>
            <Link to="/claim" className="hover:underline">First time? <span className="font-semibold text-white">Get started</span></Link>
          </div>
        );
      case 'sports-focused':
        return (
          <div className="flex flex-col sm:flex-row gap-2 text-white/80 text-base">
            <Link to="/login" className="hover:underline">Returning athlete? <span className="font-semibold text-white">Sign in</span></Link>
            <span className="hidden sm:inline">&middot;</span>
            <Link to="/claim" className="hover:underline">New to combines? <span className="font-semibold text-white">Claim account</span></Link>
          </div>
        );
      default:
        return (
          <div className="flex flex-col sm:flex-row gap-2 text-white/80 text-base">
            <Link to="/login" className="hover:underline">Already have an account? <span className="font-semibold text-white">Sign in</span></Link>
            <span className="hidden sm:inline">&middot;</span>
            <Link to="/claim" className="hover:underline">Need to claim an account? <span className="font-semibold text-white">Claim</span></Link>
          </div>
        );
    }
  };

  return (
    <WelcomeLayout footerLinks={getFooterContent()} showOverlay={false}>
      <WelcomeContent variant={welcomeVariant} />
    </WelcomeLayout>
  );
} 