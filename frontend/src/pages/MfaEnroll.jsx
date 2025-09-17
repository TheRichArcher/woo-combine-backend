import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";

export default function MfaEnroll() {
  const navigate = useNavigate();
  return (
    <div className="w-full max-w-md mx-auto py-12 text-center">
      <h1 className="text-2xl font-bold mb-4">Multi‑Factor Authentication Required</h1>
      <p className="text-gray-700 mb-6">
        For admin accounts, multi‑factor authentication (MFA) is required. Please enroll a second factor (TOTP or SMS) in your account settings.
      </p>
      <div className="mb-8 text-sm text-gray-600">
        After enrolling, sign out and sign back in to continue.
      </div>
      <Button onClick={() => navigate("/dashboard")} className="w-full">Back to Dashboard</Button>
    </div>
  );
}


