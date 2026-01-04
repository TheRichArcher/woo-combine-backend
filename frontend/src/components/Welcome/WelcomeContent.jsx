import React from "react";
import { useNavigate } from "react-router-dom";

export default function WelcomeContent({ variant = 'default' }) {
  const navigate = useNavigate();
  
  const getContent = () => {
    switch (variant) {
      case 'mojo-style':
        return {
          title: "Track Every Drill, Score Every Performance",
          subtitle: "Real-time combine tracking that turns raw athletic performance into championship insights. See results instantly.",
          buttonText: "Start Tracking"
        };
      case 'sports-focused':
        return {
          title: "Digital Sports Combines Made Simple",
          subtitle: "Run professional combines with instant digital scorecards. No more clipboards or calculators.",
          buttonText: "Try It Free"
        };
      default:
        return {
          title: "Digital Combine Tracking",
          subtitle: "Turn your phone into a professional combine timer. Track drills and performance metrics with instant digital scorecards.",
          buttonText: "Start Free Trial"
        };
    }
  };

  const content = getContent();

  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center">
      <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">
        {content.title}
      </h1>
      <p className="text-lg sm:text-2xl text-brand-light/80 mb-8 max-w-xl">
        {content.subtitle}
      </p>
      <button
        className="bg-brand-primary hover:bg-brand-secondary text-white text-xl font-semibold px-10 py-4 rounded-lg shadow-lg mb-8 transition-colors duration-150"
        onClick={() => navigate("/signup")}
      >
        {content.buttonText}
      </button>
    </div>
  );
} 