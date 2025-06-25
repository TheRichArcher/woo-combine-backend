import React from 'react';

/**
 * SimpleSlider - Production-ready slider component using the "Exact Working Pattern"
 * 
 * ✅ PROVEN PATTERN:
 * - Uses controlled components with value prop (not defaultValue)
 * - onChange for immediate state updates (smooth dragging)
 * - onMouseUp/onTouchEnd for persistence on drag end
 * - No unstable keys or dependencies
 * 
 * @param {Object} props
 * @param {string} props.label - Display label for the slider
 * @param {number} props.value - Current slider value (0-100)
 * @param {function} props.onChange - Called on every slider movement
 * @param {function} props.onPersist - Called when drag ends (for backend persistence)
 * @param {number} props.min - Minimum value (default: 0)
 * @param {number} props.max - Maximum value (default: 100)
 * @param {number} props.step - Step increment (default: 1)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showValue - Whether to display current value (default: true)
 * @param {string} props.accentColor - Tailwind accent color (default: blue-600)
 */
export default function SimpleSlider({
  label,
  value = 50,
  onChange,
  onPersist,
  min = 0,
  max = 100,
  step = 1,
  className = '',
  showValue = true,
  accentColor = 'blue-600'
}) {
  const handleChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    if (onChange) {
      onChange(newValue);
    }
  };

  const handleDragEnd = () => {
    if (onPersist) {
      onPersist(value);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label and Value Display */}
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-sm font-medium text-gray-700">
              {label}
            </label>
          )}
          {showValue && (
            <span className={`text-lg font-mono text-${accentColor} bg-${accentColor.split('-')[0]}-100 px-3 py-1 rounded-full min-w-[50px] text-center`}>
              {value}
            </span>
          )}
        </div>
      )}

      {/* Slider Input */}
      <div className="touch-none">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onMouseUp={handleDragEnd}
          onTouchEnd={handleDragEnd}
          className={`w-full h-6 rounded-lg cursor-pointer accent-${accentColor}`}
        />
      </div>

      {/* Helper Text */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>Less important</span>
        <span>More important</span>
      </div>
    </div>
  );
} 