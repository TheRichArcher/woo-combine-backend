import React, { useState } from 'react';
import { flushSync } from 'react-dom';

// Simple slider component that works exactly like SliderTest
export default function SimpleSlider({ 
  label, 
  value, 
  onChange,
  min = 0, 
  max = 100, 
  step = 1,
  className = "",
  displayValue // Support displayValue prop for precise display control
}) {
  // ZERO OVERHEAD - use parseFloat for precision when step=0.1
  const handleEvent = (e) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <div className={`bg-white rounded-lg p-4 border border-gray-200 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <div className="text-xs text-gray-500">Drag to adjust</div>
        </div>
        <span className="text-lg font-mono text-blue-600 bg-blue-100 px-3 py-1 rounded-full min-w-[60px] text-center">
          {displayValue !== undefined ? displayValue : Math.round(value)}%
        </span>
      </div>
      
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={handleEvent}
          onChange={handleEvent}
          className="w-full h-8 bg-gray-200 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 custom-slider"
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-400 mt-2">
        <span>Less</span>
        <span>More</span>
      </div>
    </div>
  );
} 