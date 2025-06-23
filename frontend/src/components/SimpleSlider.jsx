import React, { useState } from 'react';
import { flushSync } from 'react-dom';

// Simple slider component that works exactly like SliderTest
export default function SimpleSlider({ 
  label, 
  value, 
  onInput,  // For smooth dragging (temp values)
  onChange, // For final value (mouse up)
  min = 0, 
  max = 100, 
  step = 1,
  className = ""
}) {
  const handleInput = (e) => {
    const newValue = parseInt(e.target.value);
    console.log('SimpleSlider onInput:', label, 'from', value, 'to', newValue);
    e.stopPropagation();
    if (onInput) onInput(newValue);
  };

  const handleMouseUp = (e) => {
    const newValue = parseInt(e.target.value);
    console.log('SimpleSlider onMouseUp:', label, 'from', value, 'to', newValue);
    e.stopPropagation();
    if (onChange) onChange(newValue);
  };

  const handleTouchEnd = (e) => {
    const newValue = parseInt(e.target.value);
    console.log('SimpleSlider onTouchEnd:', label, 'from', value, 'to', newValue);
    e.stopPropagation();
    if (onChange) onChange(newValue);
  };

  return (
    <div className={`bg-white rounded-lg p-4 border border-gray-200 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <div className="text-xs text-gray-500">Drag to adjust</div>
        </div>
        <span className="text-lg font-mono text-blue-600 bg-blue-100 px-3 py-1 rounded-full min-w-[60px] text-center">
          {value}%
        </span>
      </div>
      
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={handleInput}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleTouchEnd}
          className="w-full h-8 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-400 mt-2">
        <span>Less</span>
        <span>More</span>
      </div>
    </div>
  );
} 