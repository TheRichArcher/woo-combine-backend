import React, { useState } from 'react';
import { flushSync } from 'react-dom';

// Simulate the exact same logic as in Players.jsx
const DRILLS = [
  { key: '40m_dash', label: '40M Dash' },
  { key: 'vertical_jump', label: 'Vertical Jump' },
  { key: 'catching', label: 'Catching' },
  { key: 'throwing', label: 'Throwing' },
  { key: 'agility', label: 'Agility' }
];

const getPercentagesFromWeights = (weights) => {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return {};
  const percentages = {};
  DRILLS.forEach(drill => {
    percentages[drill.key] = (weights[drill.key] / total) * 100;
  });
  return percentages;
};

const getWeightsFromPercentages = (percentages) => {
  const total = Object.values(percentages).reduce((sum, pct) => sum + pct, 0);
  if (total === 0) return { 
    '40m_dash': 0.2, 
    'vertical_jump': 0.2, 
    'catching': 0.2, 
    'throwing': 0.2, 
    'agility': 0.2 
  };
  
  const weights = {};
  DRILLS.forEach(drill => {
    weights[drill.key] = percentages[drill.key] / total;
  });
  return weights;
};

export default function SliderTest() {
  const [value, setValue] = useState(50);
  const [dragValue, setDragValue] = useState(50);
  
  // Test the actual weight system from Players.jsx
  const [weights, setWeights] = useState({
    '40m_dash': 0.2,
    'vertical_jump': 0.2,
    'catching': 0.2,
    'throwing': 0.2,
    'agility': 0.2
  });
  
  // Test weight system with flushSync for React 19 batching
  const [weightsFlush, setWeightsFlush] = useState({
    '40m_dash': 0.2,
    'vertical_jump': 0.2,
    'catching': 0.2,
    'throwing': 0.2,
    'agility': 0.2
  });
  
  const updateWeightsFromPercentage = (drillKey, percentage) => {
    console.log('updateWeightsFromPercentage called:', drillKey, percentage);
    const currentPercentages = getPercentagesFromWeights(weights);
    console.log('currentPercentages:', currentPercentages);
    const newPercentages = { ...currentPercentages, [drillKey]: percentage };
    console.log('newPercentages:', newPercentages);
    const newWeights = getWeightsFromPercentages(newPercentages);
    console.log('newWeights:', newWeights);
    setWeights(newWeights);
  };
  
  const updateWeightsFromPercentageFlush = (drillKey, percentage) => {
    console.log('updateWeightsFromPercentageFlush called:', drillKey, percentage);
    const currentPercentages = getPercentagesFromWeights(weightsFlush);
    const newPercentages = { ...currentPercentages, [drillKey]: percentage };
    const newWeights = getWeightsFromPercentages(newPercentages);
    
    // Force immediate update with flushSync
    flushSync(() => {
      setWeightsFlush(newWeights);
    });
  };
  
  const percentages = getPercentagesFromWeights(weights);
  const percentagesFlush = getPercentagesFromWeights(weightsFlush);
  
  console.log('SliderTest render - React', React.version);
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg p-6 space-y-6">
        <h1 className="text-xl font-bold">Slider Drag Test (React {React.version})</h1>
        
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
              console.log('Basic onChange:', e.target.value);
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
        
        {/* Test 4: Weight redistribution logic (React batched) */}
        <div>
          <h2 className="font-semibold mb-2">Test 4: Weight Logic (React Batched)</h2>
          <div className="space-y-3">
            {DRILLS.map(drill => (
              <div key={drill.key}>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium">{drill.label}</label>
                  <span className="text-sm text-gray-600">{Math.round(percentages[drill.key] || 0)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(percentages[drill.key] || 0)}
                  onInput={e => updateWeightsFromPercentage(drill.key, parseInt(e.target.value))}
                  onChange={e => updateWeightsFromPercentage(drill.key, parseInt(e.target.value))}
                  className="w-full h-6 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Test 5: Weight redistribution with flushSync (immediate updates) */}
        <div>
          <h2 className="font-semibold mb-2">Test 5: Weight Logic (flushSync - Immediate)</h2>
          <div className="space-y-3">
            {DRILLS.map(drill => (
              <div key={drill.key}>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium">{drill.label}</label>
                  <span className="text-sm text-gray-600">{Math.round(percentagesFlush[drill.key] || 0)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(percentagesFlush[drill.key] || 0)}
                  onInput={e => updateWeightsFromPercentageFlush(drill.key, parseInt(e.target.value))}
                  onChange={e => updateWeightsFromPercentageFlush(drill.key, parseInt(e.target.value))}
                  className="w-full h-6 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Check browser console for event logs</p>
          <p>• Try dragging each slider type</p>
          <p>• Compare Test 4 (batched) vs Test 5 (flushSync)</p>
          <p>• Test 5 uses flushSync to force immediate React updates</p>
        </div>
      </div>
    </div>
  );
} 