import React, { useState } from 'react';
import DrillTemplateSelector from '../components/DrillTemplateSelector';
import { Settings, Trophy, Star, CheckCircle, Zap } from 'lucide-react';
import { getAllTemplates } from '../constants/drillTemplates';

const SportTemplatesPage = () => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('football');
  const templates = getAllTemplates();

  const handleTemplateSelect = (templateId, template) => {
    setSelectedTemplateId(templateId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Settings className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Multi-Sport Templates</h1>
              <p className="text-lg text-gray-600">Professional evaluation templates for {templates.length} different sports</p>
            </div>
            <div className="ml-auto">
              <span className="bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full font-medium">
                🆕 New Feature
              </span>
            </div>
          </div>

          {/* Benefits Banner */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-purple-900 mb-3">Why Use Sport-Specific Templates?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Trophy className="w-5 h-5 text-yellow-500 mt-1" />
                <div>
                  <h3 className="font-medium text-purple-900">Sport Expertise</h3>
                  <p className="text-sm text-purple-700">Professionally designed by sport-specific experts</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-orange-500 mt-1" />
                <div>
                  <h3 className="font-medium text-purple-900">Relevant Metrics</h3>
                  <p className="text-sm text-purple-700">Evaluate skills that actually matter for each sport</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-medium text-purple-900">Coaching Presets</h3>
                  <p className="text-sm text-purple-700">Ready-made weight configurations for different focuses</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Template Selector */}
        <div className="mb-8">
          <DrillTemplateSelector
            selectedTemplateId={selectedTemplateId}
            onTemplateSelect={handleTemplateSelect}
          />
        </div>

        {/* Template Comparison Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Template Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Sport</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Drills</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Presets</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Focus Areas</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template, index) => (
                  <tr key={template.id} className={`border-b border-gray-100 ${selectedTemplateId === template.id ? 'bg-purple-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{template.sport === 'Football' ? '🏈' : template.sport === 'Soccer' ? '⚽' : template.sport === 'Basketball' ? '🏀' : template.sport === 'Baseball' ? '⚾' : template.sport === 'Track & Field' ? '🏃' : '🏐'}</span>
                        <span className="font-medium">{template.name}</span>
                        {selectedTemplateId === template.id && <CheckCircle className="w-4 h-4 text-purple-600" />}
                      </div>
                    </td>
                    <td className="py-3 px-4">{template.drills.length} drills</td>
                    <td className="py-3 px-4">{Object.keys(template.presets).length} presets</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(template.drills.map(d => d.category))].slice(0, 3).map(category => (
                          <span key={category} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                            {category}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Implementation Guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">🚀 How to Implement Sport Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-blue-900 mb-2">For Event Organizers:</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <span>Select your sport template when creating an event</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <span>Import players and set up evaluation stations</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <span>Train evaluators on sport-specific drill criteria</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-blue-900 mb-2">For Coaches:</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <span>Choose coaching preset that matches your philosophy</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <span>Customize drill weights based on your priorities</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <span>Review rankings and form teams using advanced tools</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">🔮 Coming Soon</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">🏒 Hockey Template</h4>
              <p className="text-gray-600">Skating, shooting, puck handling, defensive positioning</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">🏊 Swimming Template</h4>
              <p className="text-gray-600">Stroke technique, endurance, starts, turns</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">🎾 Tennis Template</h4>
              <p className="text-gray-600">Serve power, groundstrokes, court movement, volleys</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              📧 <strong>Request a Sport:</strong> Need a template for your sport? Contact us and we'll prioritize based on demand.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SportTemplatesPage;