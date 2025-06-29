import React, { useState, useRef } from 'react';
import { Settings } from 'lucide-react';
import { DRILLS, WEIGHT_PRESETS } from '../../constants/players';

/**
 * Mobile-optimized weight control component with preset buttons and custom sliders
 * @param {Object} props - Component props
 * @param {Object} props.weights - Current weight values
 * @param {Function} props.onWeightChange - Weight change handler
 * @param {Function} props.onPresetApply - Preset apply handler
 * @param {string} props.activePreset - Currently active preset key
 * @param {boolean} props.showSliders - Whether to show custom sliders
 */
function WeightControls({ 
  weights, 
  onWeightChange, 
  onPresetApply, 
  activePreset, 
  showSliders = false 
}) {
  const [showCustomControls, setShowCustomControls] = useState(showSliders);
  const [localWeights, setLocalWeights] = useState(weights);
  const sliderRefs = useRef({});

  // Persist weights function for slider interactions
  const persistWeights = () => {
    if (onWeightChange) {
      Object.entries(localWeights).forEach(([key, value]) => {
        onWeightChange(key, value);
      });
    }
  };

  return (
    <div className="bg-gradient-to-r from-cmf-primary/10 to-cmf-secondary/10 rounded-xl p-4 border border-cmf-primary/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-cmf-primary" />
          <h3 className="font-semibold text-gray-900">Weight Adjustment Controls</h3>
        </div>
        <span className="bg-cmf-primary/10 text-cmf-primary px-2 py-1 rounded-full text-xs font-medium">
          {WEIGHT_PRESETS[activePreset]?.name || 'Custom'}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Set drill priorities for ranking calculations. Higher values = more important to you.
      </p>

      {/* Preset Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {Object.entries(WEIGHT_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => onPresetApply && onPresetApply(key)}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              activePreset === key
                ? 'border-cmf-primary bg-cmf-primary text-white ring-2 ring-cmf-primary ring-opacity-20'
                : 'border-gray-200 bg-white hover:border-cmf-primary/50 text-gray-700 hover:text-cmf-primary'
            }`}
          >
            <div className="font-semibold text-sm">{preset.name}</div>
            <div className="text-xs opacity-75 mt-1">{preset.description}</div>
          </button>
        ))}
      </div>

      {/* Custom Controls Toggle */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">Custom Weight Sliders</span>
        <button
          onClick={() => setShowCustomControls(!showCustomControls)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
            showCustomControls
              ? 'bg-cmf-primary text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {showCustomControls ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Custom Sliders */}
      {showCustomControls && (
        <div className="space-y-3">
          {DRILLS.map((drill) => (
            <div key={drill.key} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">{drill.label}</label>
                  <div className="text-xs text-gray-500">Higher = more important</div>
                </div>
                <span className="text-lg font-mono text-blue-600 bg-blue-100 px-3 py-1 rounded-full min-w-[50px] text-center">
                  {localWeights[drill.key] || weights[drill.key] || 0}
                </span>
              </div>
              
              <div className="touch-none">
                <input
                  type="range"
                  ref={(el) => (sliderRefs.current[drill.key] = el)}
                  defaultValue={localWeights[drill.key] ?? weights[drill.key] ?? 50}
                  min={0}
                  max={100}
                  step={1}
                  onInput={(e) => {
                    const newWeight = parseInt(e.target.value, 10);
                    setLocalWeights((prev) => ({ ...prev, [drill.key]: newWeight }));
                  }}
                  onPointerUp={persistWeights}
                  name={drill.key}
                  className="w-full h-6 rounded-lg cursor-pointer accent-blue-600"
                  style={{
                    background: 'linear-gradient(to right, #ddd 0%, #ddd 50%, #3b82f6 50%, #3b82f6 100%)',
                    WebkitAppearance: 'none',
                    height: '8px',
                    borderRadius: '5px',
                    outline: 'none',
                  }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>Less important</span>
                <span>More important</span>
              </div>
            </div>
          ))}
          
          <div className="text-center pt-2">
            <p className="text-xs text-gray-500">
              💡 Drag sliders to adjust drill importance for your ranking analysis
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeightControls; 