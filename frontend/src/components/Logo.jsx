import React from "react";

export default function Logo({ className = "" }) {
  return (
    <div className={`font-extrabold text-2xl text-cyan-700 min-w-0 ${className}`}>
      Woo-Combine
    </div>
  );
} 