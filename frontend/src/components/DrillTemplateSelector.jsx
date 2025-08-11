import React, { useState, useEffect } from 'react';
import { getAllTemplates, getTemplateById } from '../constants/drillTemplates';
import { CheckCircle, Info, Zap, Target, Users, Trophy, ChevronDown } from 'lucide-react';

const getSportIcon = (sport) => {
  switch(sport) {
    case 'Football': return '🏈';
    case 'Soccer': return '⚽';
    case 'Basketball': return '🏀';
    case 'Baseball': return '⚾';
    case 'Track & Field': return '🏃';
    case 'Volleyball': return '🏐';
    default: return '🏆';
  }
};

const DrillTemplateSelector = ({ selectedTemplateId, onTemplateSelect, disabled = false }) => {
  const [templates] = useState(getAllTemplates());
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (selectedTemplateId) {
      setSelectedTemplate(getTemplateById(selectedTemplateId));
    }
  }, [selectedTemplateId]);

  const handleTemplateSelect = (templateId) => {
    const template = getTemplateById(templateId);
    setSelectedTemplate(template);
    onTemplateSelect(templateId, template);
  };

  if (showDetails && selectedTemplate) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getSportIcon(selectedTemplate.sport)}</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h3>
              <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(false)}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Change Template
          </button>
        </div>

        {/* Drill Overview */}
        <div className="mb-4">
          <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Evaluation Drills ({selectedTemplate.drills.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedTemplate.drills.map((drill, index) => (
              <div key={drill.key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                <span className="font-medium text-gray-900">{drill.label}</span>
                <span className="text-xs text-gray-500">({drill.unit})</span>
                {drill.lowerIsBetter && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">lower better</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Coaching Presets */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Available Coaching Presets ({Object.keys(selectedTemplate.presets).length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(selectedTemplate.presets).map(([key, preset]) => (
              <div key={key} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="font-medium text-blue-900">{preset.name}</h5>
                <p className="text-xs text-blue-700 mt-1">{preset.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-600" />
        <h3 className="text-lg font-bold text-gray-900">Select Sport Template</h3>
        <div className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
          <CheckCircle className="w-3 h-3" />
          Multi-Sport Support
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Choose the sport template that matches your evaluation needs. Each template includes sport-specific drills and coaching presets.
      </p>

      {/* Dropdown Selector */}
      <div className="relative">
        <select
          value={selectedTemplateId || ''}
          onChange={(e) => handleTemplateSelect(e.target.value)}
          disabled={disabled}
          className={`w-full p-3 pr-10 border-2 rounded-lg appearance-none bg-white text-left cursor-pointer transition-all duration-200 ${
            disabled ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
          }`}
        >
          <option value="" disabled>Select a sport template...</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {getSportIcon(template.sport)} {template.name} - {template.sport}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
      </div>

      {/* Enhanced Preview Card */}
      {selectedTemplate && (
        <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getSportIcon(selectedTemplate.sport)}</span>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-blue-900">{selectedTemplate.name}</h4>
                <p className="text-sm text-blue-700">{selectedTemplate.sport}</p>
              </div>
              <CheckCircle className="w-6 h-6 text-blue-600 ml-2" />
            </div>
            <button
              onClick={() => setShowDetails(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors duration-200 self-start sm:self-auto"
            >
              View Details
            </button>
          </div>

          {/* Description */}
          <p className="text-blue-800 mb-4 leading-relaxed">{selectedTemplate.description}</p>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="bg-white bg-opacity-70 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Drills</span>
              </div>
              <div className="text-lg font-bold text-blue-800">{selectedTemplate.drills.length}</div>
              <div className="text-xs text-blue-600">evaluation metrics</div>
            </div>
            <div className="bg-white bg-opacity-70 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Presets</span>
              </div>
              <div className="text-lg font-bold text-blue-800">{Object.keys(selectedTemplate.presets).length}</div>
              <div className="text-xs text-blue-600">coaching focuses</div>
            </div>
          </div>

          {/* Quick Preview of Drills */}
          <div className="bg-white/50 rounded-lg p-3 border border-blue-200">
            <h5 className="text-sm font-medium text-blue-900 mb-2">Key Drills Include:</h5>
            <div className="flex flex-wrap gap-2">
              {selectedTemplate.drills.map((drill, index) => (
                <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {drill.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!selectedTemplate && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              Please select a sport template to continue
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrillTemplateSelector;