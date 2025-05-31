import React from "react";
import { Link } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import SignupForm from "../components/Welcome/SignupForm";

export default function SignUp() {
  return (
    <WelcomeLayout
      contentClassName="min-h-[70vh]"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center">
        <SignupForm />
      </div>
    </WelcomeLayout>
  );
} 