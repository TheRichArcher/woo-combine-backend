import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-600">
        <div className="flex items-center gap-2 text-gray-500">
          <img src="/favicon/woocombine-logo.png" alt="WooCombine" className="w-5 h-5" />
          <span>© {new Date().getFullYear()} WooCombine</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link to="/terms" className="hover:text-gray-900 hover:underline">Terms</Link>
          <span className="text-gray-300">|</span>
          <Link to="/privacy" className="hover:text-gray-900 hover:underline">Privacy</Link>
          <span className="text-gray-300">|</span>
          <Link to="/help" className="hover:text-gray-900 hover:underline">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}


