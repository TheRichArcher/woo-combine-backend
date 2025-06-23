import React, { useState } from 'react';

export default function SliderTest() {
  const [value, setValue] = useState(50);
  const [dragValue, setDragValue] = useState(50);
  
  console.log('SliderTest render - value:', value, 'dragValue:', dragValue);
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg p-6 space-y-6">
        <h1 className="text-xl font-bold">Slider Drag Test</h1>
        
        {/* Test 1: Basic HTML slider */}
        <div>
          <h2 className="font-semibold mb-2">Test 1: Basic HTML Slider</h2>
          <p className="text-sm text-gray-600 mb-2">Value: {value}</p>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={e => {
              console.log('onChange:', e.target.value);
              setValue(parseInt(e.target.value));
            }}
            className="w-full"
          />
        </div>
        
        {/* Test 2: With onInput */}
        <div>
          <h2 className="font-semibold mb-2">Test 2: With onInput Handler</h2>
          <p className="text-sm text-gray-600 mb-2">Value: {dragValue}</p>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={dragValue}
            onInput={e => {
              console.log('onInput:', e.target.value);
              setDragValue(parseInt(e.target.value));
            }}
            onChange={e => {
              console.log('onChange (final):', e.target.value);
              setDragValue(parseInt(e.target.value));
            }}
            className="w-full"
          />
        </div>
        
        {/* Test 3: With custom styling */}
        <div>
          <h2 className="font-semibold mb-2">Test 3: With Custom Styling</h2>
          <p className="text-sm text-gray-600 mb-2">Value: {dragValue}</p>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={dragValue}
            onInput={e => setDragValue(parseInt(e.target.value))}
            onChange={e => setDragValue(parseInt(e.target.value))}
            className="w-full h-8 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation slider-thumb"
          />
        </div>
        
        <div className="text-xs text-gray-500">
          Check browser console for event logs
        </div>
      </div>
    </div>
  );
} 