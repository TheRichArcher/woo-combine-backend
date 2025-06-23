import React, { useState } from 'react';

export default function IsolatedSliderTest() {
  const [value, setValue] = useState(50);

  return (
    <div className="bg-purple-100 border border-purple-300 rounded-lg p-4 mb-4">
      <h3 className="text-purple-800 font-bold mb-2">🧪 ISOLATED SLIDER TEST</h3>
      <p className="text-purple-700 text-sm mb-3">
        This slider has ZERO interference - just direct state updates
      </p>
      
      <div className="flex items-center gap-4">
        <span className="text-lg font-mono text-purple-600 min-w-[60px]">
          {value}%
        </span>
        
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onInput={(e) => setValue(parseInt(e.target.value))}
          onChange={(e) => setValue(parseInt(e.target.value))}
          className="flex-1 h-8 bg-purple-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      
      <div className="text-xs text-purple-600 mt-2">
        If this doesn't drag smoothly, the problem is browser/system level
      </div>
    </div>
  );
} 