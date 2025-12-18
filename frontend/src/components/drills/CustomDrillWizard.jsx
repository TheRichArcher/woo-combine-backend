import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { CheckCircle, AlertTriangle, ArrowRight, ArrowLeft, Ruler, Info } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { getDrillsFromTemplate } from '../../constants/drillTemplates';

const DRILL_CATEGORIES = ["Speed", "Agility", "Power", "Strength", "Skill", "Conditioning", "Physical"];
const SCORING_UNITS = ["Seconds", "Inches", "Reps", "MPH", "Percent", "Other"];

export default function CustomDrillWizard({ isOpen, onClose, eventId, leagueId, onDrillCreated, initialData = null, drillTemplate, disabledDrills = [] }) {
  const { showSuccess, showError } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    category: initialData?.category || 'Speed',
    description: initialData?.description || '',
    unit: initialData?.unit === 'Other' ? 'Other' : (SCORING_UNITS.includes(initialData?.unit) ? initialData?.unit : 'Other'),
    customUnit: (!SCORING_UNITS.includes(initialData?.unit) ? initialData?.unit : '') || '',
    direction: initialData?.lower_is_better ? 'lower' : 'higher',
    minVal: initialData?.min_val !== undefined ? initialData.min_val : '',
    maxVal: initialData?.max_val !== undefined ? initialData.max_val : '',
  });

  // Validation Warnings
  const [showRangeWarning, setShowRangeWarning] = useState(false);
  const [warningConfirmed, setWarningConfirmed] = useState(false);

  // Derived State for validation
  // Only check against active (enabled) template drills to allow reusing names of disabled drills
  const templateDrills = getDrillsFromTemplate(drillTemplate);
  const activeTemplateDrills = templateDrills.filter(d => !disabledDrills.includes(d.key));
  const collision = activeTemplateDrills.find(d => d.label.toLowerCase() === formData.name.trim().toLowerCase());
  const nameError = collision ? `"${collision.label}" is already a standard drill in this event.` : null;

  // Handlers
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (formData.name.trim().length < 3) return false;
      if (nameError) return false;
      return !!formData.category;
    }
    if (step === 2) {
      if (formData.unit === 'Other' && !formData.customUnit.trim()) return false;
      return true;
    }
    if (step === 3) {
      const min = parseFloat(formData.minVal);
      const max = parseFloat(formData.maxVal);
      if (isNaN(min) || isNaN(max)) return false;
      if (min >= max) return false;
      
      // Side effect logic moved to handleNext to prevent render loop
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
        // Step 3 warning logic
        if (step === 3) {
            const max = parseFloat(formData.maxVal);
            // Trigger warnings if needed (only once per navigation attempt)
            if (!warningConfirmed && !showRangeWarning) {
                const isTime = formData.unit === 'Seconds';
                if (isTime && max > 300) { // > 5 mins seems wrong for typical drills
                    setShowRangeWarning(true);
                    return;
                }
            }
        }

        if (showRangeWarning && !warningConfirmed) return; // Block if warning shown and not confirmed
        setStep(prev => prev + 1);
        setShowRangeWarning(false);
        setWarningConfirmed(false);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
    setShowRangeWarning(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        unit: formData.unit === 'Other' ? formData.customUnit : formData.unit,
        lower_is_better: formData.direction === 'lower',
        min_val: parseFloat(formData.minVal),
        max_val: parseFloat(formData.maxVal),
      };

      if (initialData?.id) {
          await api.put(`/leagues/${leagueId}/events/${eventId}/custom-drills/${initialData.id}`, payload);
          showSuccess('Custom drill updated successfully');
      } else {
          await api.post(`/leagues/${leagueId}/events/${eventId}/custom-drills`, payload);
          showSuccess('Custom drill created successfully');
      }
      
      onDrillCreated?.();
      onClose();
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to save drill');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived values for Preview
  const exampleScores = useMemo(() => {
    const min = parseFloat(formData.minVal) || 0;
    const max = parseFloat(formData.maxVal) || 100;
    // Generate 3 examples: Good (close to 500), Avg (close to 250), Bad (close to 0)
    // Normalization: 
    // If lower is better: Score = 500 * (max - val) / (max - min)
    // If higher is better: Score = 500 * (val - min) / (max - min)
    
    const isLowerBetter = formData.direction === 'lower';
    
    const calculateScore = (val) => {
        let score = 0;
        if (isLowerBetter) {
            score = 500 * ((max - val) / (max - min));
        } else {
            score = 500 * ((val - min) / (max - min));
        }
        return Math.max(0, Math.min(500, Math.round(score)));
    };

    // Generate sample values roughly at 10%, 50%, 90% of range
    // For lower is better: 10% score is near max val, 90% score is near min val
    // We want to show "Good Result", "Avg Result", "Poor Result"
    
    const range = max - min;
    let goodVal, avgVal, poorVal;

    if (isLowerBetter) {
        goodVal = min + (range * 0.1); // Close to min (fast)
        avgVal = min + (range * 0.5);
        poorVal = min + (range * 0.9); // Close to max (slow)
    } else {
        goodVal = min + (range * 0.9); // Close to max (high jump)
        avgVal = min + (range * 0.5);
        poorVal = min + (range * 0.1); // Close to min (low jump)
    }
    
    return [
        { label: 'Good Result', val: goodVal.toFixed(2), score: calculateScore(goodVal), color: 'text-green-600', barColor: 'bg-green-500', width: '90%' },
        { label: 'Average Result', val: avgVal.toFixed(2), score: calculateScore(avgVal), color: 'text-gray-700', barColor: 'bg-yellow-500', width: '50%' },
        { label: 'Poor Result', val: poorVal.toFixed(2), score: calculateScore(poorVal), color: 'text-red-500', barColor: 'bg-red-500', width: '10%' },
    ];
  }, [formData.minVal, formData.maxVal, formData.direction]);


  if (!isOpen) return null;

  return (
    <Modal 
        title={initialData ? "Edit Custom Drill" : "Create Custom Drill"} 
        size="lg" 
        onClose={onClose}
        footer={
            <div className="flex justify-between w-full">
                {step > 1 ? (
                    <Button variant="subtle" onClick={handleBack}>Back</Button>
                ) : <div></div>}
                
                {step < 4 ? (
                    <Button onClick={handleNext} disabled={!validateStep() && !showRangeWarning}>
                        Continue
                    </Button>
                ) : (
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Drill'}
                    </Button>
                )}
            </div>
        }
    >
        {/* Stepper */}
        <div className="mb-8">
            <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-0.5 bg-gray-200 -z-10"></div>
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className={`flex flex-col items-center bg-white px-2`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                            step >= s ? 'bg-cmf-primary border-cmf-primary text-white' : 'bg-white border-gray-300 text-gray-400'
                        }`}>
                            {s}
                        </div>
                        <span className="text-xs mt-1 font-medium text-gray-500">
                            {s === 1 ? 'Basics' : s === 2 ? 'Unit' : s === 3 ? 'Range' : 'Preview'}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        {/* Step 1: Basics */}
        {step === 1 && (
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Drill Name *</label>
                    <Input 
                        value={formData.name} 
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="e.g. 3-Cone Shuttle"
                        error={nameError}
                    />
                    {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <Select 
                        value={formData.category} 
                        onChange={(e) => updateField('category', e.target.value)}
                    >
                        {DRILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                    <textarea 
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-cmf-primary focus:border-cmf-primary"
                        rows="3"
                        value={formData.description}
                        onChange={(e) => updateField('description', e.target.value)}
                        placeholder="Instructions for the evaluator..."
                    />
                </div>
            </div>
        )}

        {/* Step 2: Unit & Direction */}
        {step === 2 && (
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Scoring Unit</label>
                    <div className="grid grid-cols-3 gap-3">
                        {SCORING_UNITS.map(unit => (
                            <button
                                key={unit}
                                onClick={() => updateField('unit', unit)}
                                className={`p-3 border rounded-lg text-sm font-medium transition-all ${
                                    formData.unit === unit 
                                    ? 'bg-teal-50 border-cmf-primary text-cmf-primary ring-1 ring-cmf-primary' 
                                    : 'hover:bg-gray-50 border-gray-200 text-gray-700'
                                }`}
                            >
                                {unit}
                            </button>
                        ))}
                    </div>
                    {formData.unit === 'Other' && (
                        <div className="mt-3">
                            <Input 
                                placeholder="Specify unit (e.g. Watts)" 
                                value={formData.customUnit}
                                onChange={(e) => updateField('customUnit', e.target.value)}
                            />
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Scoring Direction</label>
                    <div className="flex gap-4">
                        <label className={`flex-1 relative flex cursor-pointer rounded-lg border p-4 shadow-sm focus:outline-none ${
                            formData.direction === 'lower' ? 'ring-2 ring-cmf-primary border-transparent bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}>
                            <input 
                                type="radio" 
                                name="direction" 
                                value="lower" 
                                checked={formData.direction === 'lower'}
                                onChange={() => updateField('direction', 'lower')}
                                className="sr-only" 
                            />
                            <div className="flex flex-col">
                                <span className="block text-sm font-medium text-gray-900">Lower is Better</span>
                                <span className="mt-1 text-sm text-gray-500">Faster times = Higher score</span>
                                <span className="mt-2 text-xs bg-white border border-gray-200 text-gray-600 py-1 px-2 rounded w-fit">e.g. Sprints</span>
                            </div>
                        </label>

                        <label className={`flex-1 relative flex cursor-pointer rounded-lg border p-4 shadow-sm focus:outline-none ${
                            formData.direction === 'higher' ? 'ring-2 ring-cmf-primary border-transparent bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}>
                            <input 
                                type="radio" 
                                name="direction" 
                                value="higher" 
                                checked={formData.direction === 'higher'}
                                onChange={() => updateField('direction', 'higher')}
                                className="sr-only" 
                            />
                            <div className="flex flex-col">
                                <span className="block text-sm font-medium text-gray-900">Higher is Better</span>
                                <span className="mt-1 text-sm text-gray-500">More reps/dist = Higher score</span>
                                <span className="mt-2 text-xs bg-white border border-gray-200 text-gray-600 py-1 px-2 rounded w-fit">e.g. Jumps</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        )}

        {/* Step 3: Range */}
        {step === 3 && (
            <div className="space-y-6">
                 <div className="bg-blue-50 p-4 rounded-lg flex gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-700">
                        Define the expected range to ensure accurate normalization (0-500 scale). 
                        Scores outside this range will be clamped.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {formData.direction === 'lower' ? 'Best Possible Result (Min)' : 'Worst Expected Result (Min)'}
                        </label>
                        <div className="relative">
                            <Input 
                                type="number" 
                                step="0.01"
                                value={formData.minVal} 
                                onChange={(e) => updateField('minVal', e.target.value)}
                                placeholder="0.00"
                            />
                             <span className="absolute right-3 top-2.5 text-gray-500 text-sm">
                                {formData.unit === 'Other' ? formData.customUnit : formData.unit}
                            </span>
                        </div>
                        <p className={`mt-1 text-xs ${formData.direction === 'lower' ? 'text-green-600' : 'text-red-500'}`}>
                            Score: {formData.direction === 'lower' ? '500 pts' : '0 pts'}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                             {formData.direction === 'lower' ? 'Worst Expected Result (Max)' : 'Best Possible Result (Max)'}
                        </label>
                        <div className="relative">
                            <Input 
                                type="number" 
                                step="0.01"
                                value={formData.maxVal} 
                                onChange={(e) => updateField('maxVal', e.target.value)}
                                placeholder="0.00"
                            />
                            <span className="absolute right-3 top-2.5 text-gray-500 text-sm">
                                {formData.unit === 'Other' ? formData.customUnit : formData.unit}
                            </span>
                        </div>
                        <p className={`mt-1 text-xs ${formData.direction === 'lower' ? 'text-red-500' : 'text-green-600'}`}>
                            Score: {formData.direction === 'lower' ? '0 pts' : '500 pts'}
                        </p>
                    </div>
                </div>

                {/* Warning Modal Inline */}
                {showRangeWarning && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-yellow-800">Unusual Range Detected</h3>
                                <div className="mt-2 text-sm text-yellow-700">
                                    <p>The maximum value seems unusually high for this unit. Are you sure this is correct?</p>
                                </div>
                                <div className="mt-2">
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300 text-yellow-600 shadow-sm focus:border-yellow-300 focus:ring focus:ring-yellow-200 focus:ring-opacity-50"
                                            checked={warningConfirmed}
                                            onChange={(e) => setWarningConfirmed(e.target.checked)}
                                        />
                                        <span className="ml-2 text-sm text-yellow-800 font-medium">I confirm this range is correct</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Step 4: Preview */}
        {step === 4 && (
            <div className="space-y-6">
                <div className="text-center">
                    <h4 className="text-lg font-medium text-gray-900">Preview: {formData.name}</h4>
                    <p className="text-sm text-gray-500">Category: {formData.category} • Unit: {formData.unit === 'Other' ? formData.customUnit : formData.unit}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Example Normalization</h5>
                    <div className="space-y-4">
                        {exampleScores.map((ex, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                                <div className="w-24 font-mono text-sm text-gray-700">
                                    {ex.val} <span className="text-xs text-gray-400">{formData.unit === 'Other' ? formData.customUnit : formData.unit}</span>
                                    <div className="text-[10px] text-gray-400">{ex.label}</div>
                                </div>
                                <div className="flex-1 mx-4 bg-gray-200 rounded-full h-2">
                                    <div className={`h-2 rounded-full ${ex.barColor}`} style={{ width: ex.width }}></div>
                                </div>
                                <span className={`w-16 font-bold text-right ${ex.color}`}>{ex.score} pts</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-blue-50 rounded-md p-4 flex items-start">
                    <Info className="h-5 w-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-sm text-blue-700">
                        Once <strong>Live Entry</strong> begins, this drill configuration will be locked to ensure scoring integrity for all players.
                    </p>
                </div>
            </div>
        )}
    </Modal>
  );
}
