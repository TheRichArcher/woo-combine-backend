import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  const [showDetails, setShowDetails] = useState(false);
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        
        {/* Navigation */}
        <div className="mb-3 flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <Link 
              to="/dashboard" 
              className="text-blue-600 hover:text-blue-800 font-medium transition"
            >
              ← Back to Dashboard
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">Sport Templates</span>
          </nav>
          
          <Link
            to="/live-entry"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2"
          >
            <span>Start Live Entry</span>
            <span>→</span>
          </Link>
        </div>

        {/* Sticky compact action bar */}
        <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur border border-gray-200 rounded-xl p-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm text-gray-700">
              <span className="font-medium">Current:</span> {currentTemplate?.name || 'Football'}
              <span className="mx-2 text-gray-400">|</span>
              <span className="font-medium">Selected:</span> {selectedTemplate?.name || currentTemplate?.name}
              {hasChanges && (
                <span className="ml-2 inline-flex items-center text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full text-xs font-semibold">Changes not applied</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDetails(v => !v)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
              <button
                onClick={handleApplyTemplate}
                disabled={applying || !selectedEvent || !hasChanges}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${hasChanges ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'}`}
                aria-label="Apply selected sport template"
              >
                {applying ? 'Applying...' : 'Apply Template'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Compact header */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Settings className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-brand-secondary">Multi-Sport Templates</h1>
              <p className="text-xs text-gray-600">{templates.length} sports available</p>
            </div>
          </div>
        </div>

        {/* Main grid: selector + optional details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Template selector (condensed, scrollable) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Select Sport Template</h3>
              {hasChanges && (
                <span className="text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full font-medium">Not applied</span>
              )}
            </div>
            <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
              <DrillTemplateSelector
                selectedTemplateId={selectedTemplateId}
                onTemplateSelect={handleTemplateSelect}
              />
            </div>
            {/* Inline apply in left panel for quick action */}
            {hasChanges && (
              <div className="mt-3">
                {applyError && (
                  <div className="mb-2"><ErrorDisplay error={applyError} /></div>
                )}
                <button
                  onClick={handleApplyTemplate}
                  disabled={applying || !selectedEvent}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  {applying ? 'Applying...' : `Apply ${selectedTemplate?.name} Template`}
                </button>
              </div>
            )}
          </div>

          {/* Right: Collapsible details to reduce noise */}
          <div className="space-y-4">
            {showDetails && (
              <>
                <div className="bg-white rounded-xl shadow-sm border border-purple-200 p-4">
                  <h2 className="text-sm font-semibold text-purple-900 mb-3">Why sport-specific templates?</h2>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-start gap-3">
                      <Trophy className="w-4 h-4 text-yellow-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-purple-900">Sport Expertise</div>
                        <div className="text-purple-700">Professionally designed by sport-specific experts</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Star className="w-4 h-4 text-orange-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-purple-900">Relevant Metrics</div>
                        <div className="text-purple-700">Evaluate skills that matter for each sport</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Zap className="w-4 h-4 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-purple-900">Coaching Presets</div>
                        <div className="text-purple-700">Ready-made weight configurations</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comparison table collapsed area */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Template Comparison</h2>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto border border-gray-100 rounded">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-medium text-gray-900">Sport</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900">Drills</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900">Presets</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900">Focus Areas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templates.map((template) => (
                          <tr key={template.id} className={`border-b border-gray-100 ${selectedTemplateId === template.id ? 'bg-purple-50' : ''}`}>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{template.sport === 'Football' ? '🏈' : template.sport === 'Soccer' ? '⚽' : template.sport === 'Basketball' ? '🏀' : template.sport === 'Baseball' ? '⚾' : template.sport === 'Track & Field' ? '🏃' : '🏐'}</span>
                                <span className="font-medium">{template.name}</span>
                                {selectedTemplateId === template.id && <CheckCircle className="w-3 h-3 text-purple-600" />}
                              </div>
                            </td>
                            <td className="py-2 px-3">{template.drills.length}</td>
                            <td className="py-2 px-3">{Object.keys(template.presets).length}</td>
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap gap-1">
                                {[...new Set(template.drills.map(d => d.category))].slice(0, 3).map(category => (
                                  <span key={category} className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
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

                {/* Quick Actions (condensed) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Link 
                      to="/players" 
                      className="flex items-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition group"
                    >
                      <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">+</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900 group-hover:text-blue-800 text-sm">Manage Players</h4>
                      </div>
                      <span className="text-blue-600">→</span>
                    </Link>
                    <Link 
                      to="/evaluators" 
                      className="flex items-center gap-2 p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition group"
                    >
                      <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">+</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-green-900 group-hover:text-green-800 text-sm">Manage Evaluators</h4>
                      </div>
                      <span className="text-green-600">→</span>
                    </Link>
                    <Link 
                      to="/team-formation" 
                      className="flex items-center gap-2 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition group"
                    >
                      <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">⚡</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-purple-900 group-hover:text-purple-800 text-sm">Form Teams</h4>
                      </div>
                      <span className="text-purple-600">→</span>
                    </Link>
                  </div>
                </div>

                {/* Coming Soon (kept concise) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Coming Soon</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="font-medium text-gray-900 mb-1">🏒 Hockey</div>
                      <div className="text-gray-600">Skating, shooting, puck handling</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="font-medium text-gray-900 mb-1">🏊 Swimming</div>
                      <div className="text-gray-600">Stroke technique, endurance</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="font-medium text-gray-900 mb-1">🎾 Tennis</div>
                      <div className="text-gray-600">Serve power, court movement</div>
                    </div>
                  </div>
                </div>
              </>
            )}
            {!showDetails && (
              <div className="text-xs text-gray-500">More info is hidden. Click "Show Details" in the sticky bar to expand.</div>
            )}
          </div>
        </div>
        {/* Footer note */}
        <div className="mt-2 text-center text-[11px] text-gray-400">Need more detail? Toggle "Show Details" at the top.</div>
      </div>
    </div>
  );
});

export default SportTemplatesPage;