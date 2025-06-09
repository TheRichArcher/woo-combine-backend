import React from "react";

export default function WelcomeContent({ variant = 'default' }) {
  const getContent = () => {
    switch (variant) {
      case 'mojo-style':
        return {
          title: "Dominate. Track. Win.",
          subtitle: "Elevate your game with precision tracking and real-time insights that champions demand.",
          buttonText: "Start Dominating"
        };
      case 'sports-focused':
        return {
          title: "Train. Compete. Excel.",
          subtitle: "Professional-grade combine tracking and analytics for serious athletes and coaches.",
          buttonText: "Join the Elite"
        };
      default:
        return {
          title: "Coach. Manage. Never miss a moment.",
          subtitle: "Your all-in-one platform for team management, communication, and never missing a play.",
          buttonText: "Get Started"
        };
    }
  };

  const content = getContent();

  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center">
      <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">
        {content.title}
      </h1>
      <p className="text-lg sm:text-2xl text-cyan-100 mb-8 max-w-xl">
        {content.subtitle}
      </p>
      <button
        className="bg-cyan-700 hover:bg-cyan-800 text-white text-xl font-semibold px-10 py-4 rounded-lg shadow-lg mb-8 transition-colors duration-150"
        onClick={() => window.location.assign("/signup")}
      >
        {content.buttonText}
      </button>
    </div>
  );
} 