import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import SimpleSlider from '../components/SimpleSlider';

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

  // NEW: Test with proportional redistribution (FIXED VERSION)
  const [weightsProportional, setWeightsProportional] = useState({
    '40m_dash': 0.2,
    'vertical_jump': 0.2,
    'catching': 0.2,
    'throwing': 0.2,
    'agility': 0.2
  });

  // NEW: Test with SimpleSlider component (FIXED VERSION)
  const [weightsSimpleSlider, setWeightsSimpleSlider] = useState({
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

  // NEW: SIMPLE redistribution (matches our fix)
  const updateWeightsProportional = (drillKey, percentage) => {
    console.log('🎯 SIMPLE CHANGE:', drillKey, 'to', percentage + '%');
    
    // SIMPLE APPROACH: dragged slider goes exactly where user wants it
    const newWeight = percentage / 100;
    const remainingWeight = Math.max(0, 1 - newWeight);
    
    // Distribute remaining weight equally among other 4 sliders
    const otherSliderWeight = remainingWeight / 4;
    
    const newWeights = {};
    DRILLS.forEach(drill => {
      if (drill.key === drillKey) {
        newWeights[drill.key] = newWeight;
      } else {
        newWeights[drill.key] = otherSliderWeight;
      }
    });

    console.log('🎯 NEW SIMPLE WEIGHTS:', newWeights);
    setWeightsProportional(newWeights);
  };

  // NEW: SimpleSlider test (matches our fix)
  const handleSimpleSliderChange = (drillKey, percentage) => {
    console.log('🎯 SIMPLE SLIDER CHANGE:', drillKey, 'to', percentage + '%');
    
    // SIMPLE APPROACH: dragged slider goes exactly where user wants it
    const newWeight = percentage / 100;
    const remainingWeight = Math.max(0, 1 - newWeight);
    
    // Distribute remaining weight equally among other 4 sliders
    const otherSliderWeight = remainingWeight / 4;
    
    const newWeights = {};
    DRILLS.forEach(drill => {
      if (drill.key === drillKey) {
        newWeights[drill.key] = newWeight;
      } else {
        newWeights[drill.key] = otherSliderWeight;
      }
    });

    console.log('🎯 NEW SIMPLE SLIDER WEIGHTS:', newWeights);
    setWeightsSimpleSlider(newWeights);
  };
  
  const percentages = getPercentagesFromWeights(weights);
  const percentagesFlush = getPercentagesFromWeights(weightsFlush);
  const percentagesProportional = getPercentagesFromWeights(weightsProportional);
  const percentagesSimpleSlider = getPercentagesFromWeights(weightsSimpleSlider);
  
  console.log('SliderTest render - React', React.version);
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg p-6 space-y-8">
        <h1 className="text-2xl font-bold">Slider Drag Test (React {React.version})</h1>
        
        {/* Test 1: Basic HTML slider */}
        <div>
          <h2 className="font-semibold mb-2 text-green-700">✅ Test 1: Basic HTML Slider</h2>
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
          <h2 className="font-semibold mb-2 text-green-700">✅ Test 2: With onInput Handler</h2>
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
          <h2 className="font-semibold mb-2 text-green-700">✅ Test 3: With Custom Styling</h2>
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
          <h2 className="font-semibold mb-2 text-red-600">❌ Test 4: Weight Logic (React Batched) - OLD METHOD</h2>
          <p className="text-sm text-gray-600 mb-2">Uses old getWeightsFromPercentages logic - may be jumpy</p>
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
          <h2 className="font-semibold mb-2 text-red-600">❌ Test 5: Weight Logic (flushSync) - OLD METHOD</h2>
          <p className="text-sm text-gray-600 mb-2">Uses old getWeightsFromPercentages + flushSync - may be jumpy</p>
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

                 {/* Test 6: NEW - Simple redistribution with step=0.1 */}
         <div>
           <h2 className="font-semibold mb-2 text-blue-600">🔧 Test 6: Simple Redistribution (step=0.1) - NEW FIX</h2>
           <p className="text-sm text-gray-600 mb-2">Uses simple equal weight redistribution + parseFloat + step=0.1</p>
          <div className="space-y-3">
            {DRILLS.map(drill => (
              <div key={drill.key}>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium">{drill.label}</label>
                  <span className="text-sm text-gray-600">{Math.round(percentagesProportional[drill.key] || 0)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={percentagesProportional[drill.key] || 0}
                  onInput={e => updateWeightsProportional(drill.key, parseFloat(e.target.value))}
                  onChange={e => updateWeightsProportional(drill.key, parseFloat(e.target.value))}
                  className="w-full h-6 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>

                 {/* Test 7: NEW - SimpleSlider Component Test */}
         <div>
           <h2 className="font-semibold mb-2 text-green-600">✅ Test 7: Fixed SimpleSlider Component - NEW FIX</h2>
           <p className="text-sm text-gray-600 mb-2">Uses updated SimpleSlider component with parseFloat + displayValue + step=0.1</p>
           <div className="space-y-3">
             {DRILLS.map(drill => (
               <SimpleSlider
                 key={drill.key}
                 label={drill.label}
                 value={percentagesSimpleSlider[drill.key] || 0}
                 displayValue={Math.round(percentagesSimpleSlider[drill.key] || 0)}
                 onChange={(newValue) => handleSimpleSliderChange(drill.key, newValue)}
                 step={0.1}
                 className="border-green-200"
               />
             ))}
           </div>
         </div>

         {/* Test 8: Debug Information */}
         <div className="bg-gray-100 rounded-lg p-4">
           <h2 className="font-semibold mb-2 text-gray-800">🔍 Debug Information</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
             <div>
               <h3 className="font-medium text-gray-700 mb-1">React Environment:</h3>
               <p>React Version: {React.version}</p>
               <p>Window Location: {window.location.href}</p>
               <p>User Agent: {navigator.userAgent.slice(0, 50)}...</p>
             </div>
             <div>
               <h3 className="font-medium text-gray-700 mb-1">Weight States (Test 7):</h3>
               <div className="font-mono text-xs bg-white p-2 rounded border max-h-20 overflow-y-auto">
                 {JSON.stringify(weightsSimpleSlider, null, 2)}
               </div>
               <p className="mt-1">Sum: {Object.values(weightsSimpleSlider).reduce((sum, w) => sum + w, 0).toFixed(6)}</p>
             </div>
           </div>
         </div>
        
        <div className="text-xs text-gray-500 space-y-1 border-t pt-4">
          <p><strong>Testing Instructions:</strong></p>
          <p>• Check browser console for event logs</p>
          <p>• Try dragging each slider type and compare smoothness</p>
          <p>• <span className="text-red-600">Tests 4 & 5 (OLD)</span> should show 1% increments and jumpy behavior</p>
                     <p>• <span className="text-blue-600">Test 6 (FIXED)</span> should show smooth sub-1% dragging with simple redistribution</p>
          <p>• <span className="text-green-600">Test 7 (SIMPLESLIDER)</span> should show the smoothest behavior with the SimpleSlider component</p>
          <p>• Green tests should feel like professional app sliders, red tests should feel choppy</p>
        </div>
      </div>
    </div>
  );
} 