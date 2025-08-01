import React, { useState, useCallback } from 'react';
import DrillTemplateSelector from '../components/DrillTemplateSelector';
import { Settings, Trophy, Star, CheckCircle, Zap, Save, AlertCircle } from 'lucide-react';
import { getAllTemplates, getTemplateById } from '../constants/drillTemplates';
import { useEvent } from '../context/EventContext';
import { useToast } from '../context/ToastContext';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import ErrorDisplay from '../components/ErrorDisplay';

const SportTemplatesPage = React.memo(() => {
  const { selectedEvent, updateEvent } = useEvent();
  const { showSuccess } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState(selectedEvent?.drillTemplate || 'football');
  const templates = getAllTemplates();

  const currentTemplate = getTemplateById(selectedEvent?.drillTemplate || 'football');
  const selectedTemplate = getTemplateById(selectedTemplateId);
  const hasChanges = selectedTemplateId !== (selectedEvent?.drillTemplate || 'football');

  // Use standardized async operation for consistent error handling
  const { loading: applying, error: applyError, execute: executeApply } = useAsyncOperation({
    context: 'TEMPLATE_APPLY',
    onSuccess: (result) => {
      showSuccess(
        `✅ Applied ${selectedTemplate.name} template! All drill evaluations will now use ${selectedTemplate.sport} drills.`
      );
    }
  });

  const handleTemplateSelect = useCallback((templateId, template) => {
    setSelectedTemplateId(templateId);
  }, []);

  const handleApplyTemplate = useCallback(async () => {
    if (!selectedEvent || !hasChanges) return;
    
    await executeApply(async () => {
      // Validate template selection
      if (!selectedTemplate) {
        throw new Error('Invalid template selected');
      }
      
      // Update the event with the new drill template
      const updatedEventData = {
        name: selectedEvent.name,
        date: selectedEvent.date,
        location: selectedEvent.location,
        drillTemplate: selectedTemplateId
      };
      
      return await updateEvent(selectedEvent.id, updatedEventData);
    });
  }, [selectedEvent, hasChanges, executeApply, selectedTemplate, selectedTemplateId, updateEvent]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 mt-20">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-purple-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Settings className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-cmf-secondary">Multi-Sport Templates</h1>
              <p className="text-sm text-gray-600">Professional templates for {templates.length} sports</p>
            </div>
          </div>
          
          {/* Current Template Status */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-gray-900">Currently Active:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{currentTemplate?.sport === 'Football' ? '🏈' : currentTemplate?.sport === 'Soccer' ? '⚽' : currentTemplate?.sport === 'Basketball' ? '🏀' : currentTemplate?.sport === 'Baseball' ? '⚾' : currentTemplate?.sport === 'Track & Field' ? '🏃' : '🏐'}</span>
              <span className="text-sm font-medium text-gray-900">{currentTemplate?.name}</span>
            </div>
          </div>
          
          <div className="text-center">
            <span className="bg-purple-100 text-purple-800 text-xs px-3 py-1 rounded-full font-medium">
              🆕 New Feature
            </span>
          </div>
        </div>

        {/* Benefits Banner */}
        <div className="bg-white rounded-2xl shadow-lg border border-purple-200 p-4 mb-6">
          <h2 className="text-lg font-semibold text-purple-900 mb-3">Why Use Sport-Specific Templates?</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-yellow-500 mt-1" />
              <div>
                <h3 className="font-medium text-purple-900 text-sm">Sport Expertise</h3>
                <p className="text-xs text-purple-700">Professionally designed by sport-specific experts</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-orange-500 mt-1" />
              <div>
                <h3 className="font-medium text-purple-900 text-sm">Relevant Metrics</h3>
                <p className="text-xs text-purple-700">Evaluate skills that actually matter for each sport</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-green-500 mt-1" />
              <div>
                <h3 className="font-medium text-purple-900 text-sm">Coaching Presets</h3>
                <p className="text-xs text-purple-700">Ready-made weight configurations for different focuses</p>
              </div>
            </div>
          </div>
        </div>

        {/* Template Selector */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Select Sport Template</h3>
            {hasChanges && (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Changes not applied</span>
              </div>
            )}
          </div>
          <DrillTemplateSelector
            selectedTemplateId={selectedTemplateId}
            onTemplateSelect={handleTemplateSelect}
          />
          
          {/* Apply Template Button */}
          {hasChanges && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Ready to Apply Template?</h4>
                  <p className="text-xs text-blue-700 mb-3">
                    This will change your event to use <strong>{selectedTemplate?.name}</strong> drills and weights. 
                    All future evaluations will use the new drill set.
                  </p>
                </div>
              </div>
              
              {/* Error Display */}
              {applyError && (
                <div className="mb-3">
                  <ErrorDisplay error={applyError} />
                </div>
              )}
              
              <button
                onClick={handleApplyTemplate}
                disabled={applying || !selectedEvent}
                aria-label={`Apply ${selectedTemplate?.name} template to current event`}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {applying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" aria-hidden="true" />
                    <span>Apply {selectedTemplate?.name} Template</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Template Comparison Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 mb-6">
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
        <div className="bg-white rounded-2xl shadow-lg border border-blue-200 p-4 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">🚀 How to Implement</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-blue-900 mb-2 text-sm">For Event Organizers:</h4>
              <div className="space-y-2 text-xs text-blue-800">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Select your sport template when creating an event</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Import players and set up evaluation stations</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Train evaluators on sport-specific drill criteria</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-blue-900 mb-2 text-sm">For Coaches:</h4>
              <div className="space-y-2 text-xs text-blue-800">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Choose coaching preset that matches your philosophy</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Customize drill weights based on your priorities</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Review rankings and form teams using advanced tools</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">🔮 Coming Soon</h3>
          <div className="space-y-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <h4 className="font-medium text-gray-900 mb-1">🏒 Hockey Template</h4>
              <p className="text-gray-600 text-xs">Skating, shooting, puck handling, defensive positioning</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <h4 className="font-medium text-gray-900 mb-1">🏊 Swimming Template</h4>
              <p className="text-gray-600 text-xs">Stroke technique, endurance, starts, turns</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <h4 className="font-medium text-gray-900 mb-1">🎾 Tennis Template</h4>
              <p className="text-gray-600 text-xs">Serve power, groundstrokes, court movement, volleys</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              📧 <strong>Request a Sport:</strong> Need a template for your sport? Contact us and we'll prioritize based on demand.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

});

export default SportTemplatesPage;