import React from "react";
import { Link } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import SignupForm from "../components/Welcome/SignupForm";

export default function SignUp() {
  const footerLinks = (
    <div className="flex flex-col sm:flex-row gap-2 text-white/80 text-base">
      <Link to="/login" className="hover:underline">Already have an account? <span className="font-semibold text-white">Sign In</span></Link>
      <span className="hidden sm:inline">&middot;</span>
      <Link to="/claim" className="hover:underline">Need to claim an account? <span className="font-semibold text-white">Claim</span></Link>
    </div>
  );
  return (
    <WelcomeLayout
      footerLinks={footerLinks}
      contentClassName="min-h-[70vh]"
    >
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center">
        <SignupForm />
      </div>
    </WelcomeLayout>
  );
} 