console.log('Loading WeightControls.jsx - START');

import React, { useRef } from 'react';
import { Settings } from 'lucide-react';

const WeightControls = ({
  sliderWeights,
  activePreset,
  handleWeightChange,
  applyPreset,
  showCustomControls,
  setShowCustomControls,
  drills = [],
  presets = {}
}) => {
  const sliderRefs = useRef({});

  return (
    <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-5 h-5 text-cmf-primary" />
        <h2 className="text-lg font-semibold text-cmf-secondary">Ranking Weight Controls</h2>
      </div>
      <p className="text-cmf-primary text-sm mb-3">
        Set drill priorities for ranking calculations. Higher values = more important to you.
        <span className="block text-xs mt-1 opacity-75">
          Currently: <strong>{presets[activePreset]?.name || 'Custom'}</strong>
          {!activePreset && (
            <span className="ml-1 text-green-600">⚡ Live updates!</span>
          )}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {Object.entries(presets).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className={`p-4 text-left rounded-lg border-2 transition-all touch-manipulation min-h-[70px] ${
              activePreset === key
                ? 'border-cmf-primary bg-cmf-primary text-white shadow-lg'
                : 'border-gray-200 hover:border-cmf-primary bg-white text-gray-700 hover:shadow-md'
            }`}
          >
            <div className="font-medium text-sm">{preset.name}</div>
            <div className="text-xs opacity-75 mt-1">{preset.description}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3 bg-white rounded-lg p-3 border border-gray-200">
        <div>
          <span className="text-sm font-medium text-gray-700">Custom Weight Sliders</span>
          <div className="text-xs text-gray-500">Fine-tune individual drill priorities</div>
        </div>
        <button
          onClick={() => setShowCustomControls(!showCustomControls)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-w-[80px] touch-manipulation ${
            showCustomControls
              ? 'bg-cmf-primary text-white'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }`}
        >
          {showCustomControls ? 'Hide' : 'Show'}
        </button>
      </div>

      {showCustomControls && (
        <div className="space-y-3">
          {drills.map((drill) => (
            <div key={drill.key} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">{drill.label}</label>
                  <div className="text-xs text-gray-500">Higher = more important</div>
                </div>
                <span className="text-lg font-mono text-blue-600 bg-blue-100 px-3 py-1 rounded-full min-w-[50px] text-center">
                  {(sliderWeights[drill.key] ?? 0).toFixed(0)}%
                </span>
              </div>

              <div className="touch-none">
                <input
                  type="range"
                  ref={(el) => (sliderRefs.current[drill.key] = el)}
                  value={sliderWeights[drill.key] ?? 50}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(e) => {
                    const newWeight = parseFloat(e.target.value);
                    handleWeightChange(drill.key, newWeight);
                  }}
                  name={drill.key}
                  className="w-full h-6 rounded-lg cursor-pointer accent-blue-600"
                />
              </div>

              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>Less important</span>
                <span>More important</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WeightControls;
