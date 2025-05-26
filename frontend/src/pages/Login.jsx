import React, { useEffect } from "react";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import LoginForm from "../components/Welcome/LoginForm";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { user, selectedLeagueId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/select-league");
    }
  }, [user, navigate]);

  return (
    <WelcomeLayout
      contentClassName="min-h-[70vh]"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 flex flex-col items-center">
        <LoginForm />
      </div>
    </WelcomeLayout>
  );
} 