/**
 * This layout defines Woo-Combine's onboarding experience.
 * 
 * ⚠️ Do not modify layout logic, background, or footer content
 * without PM approval. This layout is benchmarked to Mojo UX.
 *
 * @param contentClassName - Optional. Extra classes for the <main> content area (e.g. to brighten or blur background for forms).
 * @param hideHeader - Optional. If true, hides the top-left Woo-Combine logo header (for distraction-free onboarding screens).
 * @param showOverlay - Optional. If false, disables the dark overlay (for card-based onboarding screens). Default: true.
 * @param useBackgroundVideo - Optional. If true, uses background video instead of gradient. Default: false.
 * @param backgroundVideoUrl - Optional. URL for background video. Required if useBackgroundVideo is true.
 */
import React from "react";
import Logo from "../Logo";

// This is the canonical onboarding layout for Woo-Combine. Changes to visual hierarchy or branding must be reviewed.

export default function WelcomeLayout({ 
  children, 
  footerLinks, 
  backgroundColor, 
  contentClassName, 
  hideHeader, 
  showOverlay = false, 
  useBackgroundVideo = false,
  backgroundVideoUrl 
}) {
  // Default background styling: use light surface background everywhere for consistency
  const defaultBackground = backgroundColor || "bg-surface-subtle";
  const isLightBackground = defaultBackground.includes('surface') || defaultBackground.includes('white') || defaultBackground.includes('gray') || !showOverlay;
  
  return (
    <div className={`min-h-screen flex flex-col ${useBackgroundVideo ? "bg-black" : defaultBackground} relative overflow-hidden`}>
      {/* Background Video */}
      {useBackgroundVideo && backgroundVideoUrl && (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source src={backgroundVideoUrl} type="video/mp4" />
          {/* Fallback to gradient if video fails to load */}
          <div className={`absolute inset-0 ${defaultBackground}`} />
        </video>
      )}
      
      {!hideHeader && (
        <header className="absolute top-0 left-0 p-6 z-10">
          <Logo className={isLightBackground ? "text-brand-primary" : "text-white drop-shadow-lg"} />
        </header>
      )}
      <main className={`flex flex-1 flex-col justify-center items-center px-4 relative z-10 ${contentClassName || ""}`}>
        {children}
      </main>
      <footer className="w-full flex flex-col items-center gap-2 pb-8 mt-auto relative z-10">
        {footerLinks}
        {!footerLinks && (
          <div className="flex gap-3 text-white/80 text-sm">
            <a href="/terms" className="hover:underline">Terms</a>
            <span>·</span>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <span>·</span>
            <a href="/help" className="hover:underline">Contact</a>
          </div>
        )}
      </footer>
      {showOverlay !== false && (
        <div className="absolute inset-0 bg-black/40 pointer-events-none z-5" />
      )}
    </div>
  );
} 