/**
 * This layout defines Woo-Combine's onboarding experience.
 * 
 * ⚠️ Do not modify layout logic, background, or footer content
 * without PM approval. This layout is benchmarked to Mojo UX.
 *
 * @param contentClassName - Optional. Extra classes for the <main> content area (e.g. to brighten or blur background for forms).
 * @param hideHeader - Optional. If true, hides the top-left Woo-Combine logo header (for distraction-free onboarding screens).
 */
import React from "react";
import Logo from "../Logo";

// This is the canonical onboarding layout for Woo-Combine. Changes to visual hierarchy or branding must be reviewed.
// TODO: Can swap gradient for background video after MVP

export default function WelcomeLayout({ children, footerLinks, backgroundColor, contentClassName, hideHeader }) {
  return (
    <div className={`min-h-screen flex flex-col ${backgroundColor || "bg-gradient-to-br from-cyan-900 via-blue-900 to-cyan-700"} relative`}>
      {!hideHeader && (
        <header className="absolute top-0 left-0 p-6">
          <Logo className="text-white drop-shadow-lg" />
        </header>
      )}
      <main className={`flex flex-1 flex-col justify-center items-center px-4 ${contentClassName || ""}`}>
        {children}
      </main>
      <footer className="w-full flex flex-col items-center gap-2 pb-8 mt-auto">
        {footerLinks}
      </footer>
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
    </div>
  );
} 