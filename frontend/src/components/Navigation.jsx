import React from 'react';

export default function Navigation() {
  return (
    <nav className="bg-white shadow-md p-4">
      <div className="flex flex-row justify-between items-center max-w-screen-xl mx-auto">
        {/* Left: Logo */}
        <div className="font-extrabold text-2xl text-cyan-700 bg-green-100 px-4 py-2 rounded">Woo-Combine</div>
        {/* Right: Nav Items */}
        <div className="flex flex-row gap-6 bg-yellow-100 px-4 py-2 rounded">
          <a href="#" className="text-lg font-semibold text-gray-800 hover:text-cyan-700">Dashboard</a>
          <a href="#" className="text-lg font-semibold text-gray-800 hover:text-cyan-700">Players</a>
          <a href="#" className="text-lg font-semibold text-gray-800 hover:text-cyan-700">Admin</a>
        </div>
      </div>
    </nav>
  );
} 