import React, { useState, useEffect } from 'react';
import { getAllTemplates, getTemplateById } from '../constants/drillTemplates';
import { CheckCircle, Info, Zap, Target, Users, Trophy } from 'lucide-react';

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          return (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template.id)}
              disabled={disabled}
              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-md ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{getSportIcon(template.sport)}</span>
                <div className="flex-1">
                  <h4 className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                    {template.name}
                  </h4>
                  <p className={`text-xs ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                    {template.sport}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                )}
              </div>

              <p className={`text-sm mb-3 ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>
                {template.description}
              </p>

              <div className="flex items-center justify-between text-xs">
                <span className={`flex items-center gap-1 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                  <Target className="w-3 h-3" />
                  {template.drills.length} drills
                </span>
                <span className={`flex items-center gap-1 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                  <Users className="w-3 h-3" />
                  {Object.keys(template.presets).length} presets
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedTemplate && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                Selected: {selectedTemplate.name}
              </span>
            </div>
            <button
              onClick={() => setShowDetails(true)}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              View Details →
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {selectedTemplate.drills.length} drills • {Object.keys(selectedTemplate.presets).length} coaching presets
          </p>
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