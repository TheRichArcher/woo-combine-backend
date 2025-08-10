import React from "react";
import { Link } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import ForgotPasswordForm from "../components/Welcome/ForgotPasswordForm";

export default function ForgotPassword() {
  const footerLinks = (
    <div className="flex flex-col sm:flex-row gap-2 text-white/80 text-base">
      <Link to="/login" className="hover:underline">Back to <span className="font-semibold text-white">Login</span></Link>
      <span className="hidden sm:inline">&middot;</span>
      <Link to="/signup" className="hover:underline">Don't have an account? <span className="font-semibold text-white">Let's Get Started</span></Link>
    </div>
  );
  return (
    <WelcomeLayout
      footerLinks={footerLinks}
      contentClassName="min-h-[70vh]"
      hideHeader={true}
      showOverlay={false}
      backgroundColor="bg-surface-subtle"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center">
        <ForgotPasswordForm />
      </div>
    </WelcomeLayout>
  );
} 