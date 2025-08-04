import React from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "../components/LoadingScreen";

export default function OnboardingEvent() {
  const navigate = useNavigate();
  
  // UNIFIED EXPERIENCE: Redirect to the new guided create-event flow
  // This maintains onboarding URL compatibility while providing consistent UX
  React.useEffect(() => {
    navigate('/create-event', { replace: true });
  }, [navigate]);

  return <LoadingScreen title="Setting up guided event creation..." subtitle="Redirecting to unified experience" size="medium" />;
}