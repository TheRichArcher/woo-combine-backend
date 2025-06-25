import React from 'react';

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
  // 🚀 ZERO OVERHEAD - instant response with onInput for smooth dragging
  const handleInput = (e) => {
    const value = parseFloat(e.target.value);
    onChange(value);
  };
  
  // Fallback for onChange (some browsers)
  const handleChange = (e) => {
    const value = parseFloat(e.target.value);
    onChange(value);
  };

  return (
    <div className={`bg-white rounded-lg p-4 border border-gray-200 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <div className="text-xs text-gray-500">Higher = more important</div>
        </div>
        <span className="text-lg font-mono text-blue-600 bg-blue-100 px-3 py-1 rounded-full min-w-[50px] text-center">
          {displayValue !== undefined ? displayValue : Math.round(value)}
        </span>
      </div>
      
      <div className="touch-none">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={handleInput}
          onChange={handleChange}
          className="w-full h-6 rounded-lg cursor-pointer accent-blue-600"
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-400 mt-2">
        <span>Less important</span>
        <span>More important</span>
      </div>
    </div>
  );
} 