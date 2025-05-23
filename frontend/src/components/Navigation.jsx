import React from 'react';
import { Link } from 'react-router-dom';

export default function Navigation() {
  return (
    <nav className="bg-white shadow-md p-4">
      <div className="flex flex-row justify-between items-center max-w-screen-xl mx-auto">
        {/* Left: Logo */}
        <div className="font-extrabold text-2xl text-cyan-700 bg-green-100 px-4 py-2 rounded">Woo-Combine</div>
        {/* Right: Nav Items */}
        <div className="flex flex-row gap-6 bg-yellow-100 px-4 py-2 rounded">
          <Link to="/dashboard" className="text-lg font-semibold text-gray-800 hover:text-cyan-700">Dashboard</Link>
          <Link to="/players" className="text-lg font-semibold text-gray-800 hover:text-cyan-700">Players</Link>
          <Link to="/admin" className="text-lg font-semibold text-gray-800 hover:text-cyan-700">Admin</Link>
        </div>
      </div>
    </nav>
  );
} 