import React from "react";
import { Link } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import WelcomeContent from "../components/Welcome/WelcomeContent";

// TODO: Use useFeatureFlags to swap different onboarding variants (e.g. Mojo-style vs. sports-specific copy).

export default function Welcome() {
  const footerLinks = (
    <div className="flex flex-col sm:flex-row gap-2 text-white/80 text-base">
      <Link to="/login" className="hover:underline">Already have an account? <span className="font-semibold text-white">Sign In</span></Link>
      <span className="hidden sm:inline">&middot;</span>
      <Link to="/claim" className="hover:underline">Need to claim an account? <span className="font-semibold text-white">Claim</span></Link>
    </div>
  );
  return (
    <WelcomeLayout footerLinks={footerLinks}>
      <WelcomeContent />
    </WelcomeLayout>
  );
} 