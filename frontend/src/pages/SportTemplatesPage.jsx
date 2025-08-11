import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DrillTemplateSelector from '../components/DrillTemplateSelector';
import { Settings, Trophy, Star, CheckCircle, Zap } from 'lucide-react';
import { getAllTemplates, getTemplateById } from '../constants/drillTemplates';
import { useEvent } from '../context/EventContext';
import { useToast } from '../context/ToastContext';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import ErrorDisplay from '../components/ErrorDisplay';

export default function SportTemplatesPage() {
  const { selectedEvent, updateEvent } = useEvent();
  const { showSuccess } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState(selectedEvent?.drillTemplate || 'football');
  const [showDetails, setShowDetails] = useState(false);
  const templates = getAllTemplates();

  const currentTemplate = getTemplateById(selectedEvent?.drillTemplate || 'football');
  const selectedTemplate = getTemplateById(selectedTemplateId);
  const hasChanges = selectedTemplateId !== (selectedEvent?.drillTemplate || 'football');

  const { loading: applying, error: applyError, execute: executeApply } = useAsyncOperation({
    context: 'TEMPLATE_APPLY',
    onSuccess: () => {
      showSuccess('Template applied');
    }
  });

  const handleTemplateSelect = useCallback((templateId) => {
    setSelectedTemplateId(templateId);
  }, []);

  const handleApplyTemplate = useCallback(async () => {
    if (!selectedEvent || !hasChanges) return;
    await executeApply(async () => {
      const updatedEventData = {
        name: selectedEvent.name,
        date: selectedEvent.date,
        location: selectedEvent.location,
        drillTemplate: selectedTemplateId
      };
      return await updateEvent(selectedEvent.id, updatedEventData);
    });
  }, [selectedEvent, hasChanges, executeApply, selectedTemplateId, updateEvent]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 mt-20">
        <div className="mb-4 flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium transition">← Back to Dashboard</Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">Sport Templates</span>
          </nav>
          <Link to="/live-entry" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg transition flex items-center gap-2">
            <span>Start Live Entry</span>
            <span>→</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-brand-primary/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-brand-secondary">Sport Templates</h1>
          </div>
          <div className="text-sm text-gray-700">
            <div className="flex items-center gap-2 flex-wrap">
              <div><span className="font-semibold">Current:</span> {currentTemplate?.name || 'Football'}</div>
              <span className="text-gray-300">|</span>
              <div><span className="font-semibold">Selected:</span> {selectedTemplate?.name || currentTemplate?.name}</div>
              {hasChanges && (
                <span className="inline-flex items-center text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full text-xs font-semibold">Changes not applied</span>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => setShowDetails(v => !v)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
            <button onClick={handleApplyTemplate} disabled={applying || !selectedEvent || !hasChanges} className={hasChanges ? 'px-4 py-2 text-sm rounded-lg font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white' : 'px-4 py-2 text-sm rounded-lg font-semibold transition-colors bg-gray-200 text-gray-500'}>
              {applying ? 'Applying...' : 'Apply Template'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-brand-primary/30">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Select Sport Template</h2>
          <div className="max-h-80 overflow-auto rounded-lg border border-gray-100">
            <DrillTemplateSelector selectedTemplateId={selectedTemplateId} onTemplateSelect={handleTemplateSelect} />
          </div>
          {hasChanges && (
            <div className="mt-3">
              {applyError && (<div className="mb-2"><ErrorDisplay error={applyError} /></div>)}
              <button onClick={handleApplyTemplate} disabled={applying || !selectedEvent} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg text-sm">
                {applying ? 'Applying...' : 'Apply Selected Template'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {showDetails && (
            <>
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-brand-primary/30">
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

              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
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
                        <tr key={template.id} className={(selectedTemplateId === template.id ? 'bg-purple-50 ' : '') + 'border-b border-gray-100'}>
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
                                <span key={category} className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{category}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Link to="/players" className="flex items-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition group">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">+</div>
                    <div className="flex-1">
                      <h4 className="font-medium text-blue-900 group-hover:text-blue-800 text-sm">Manage Players</h4>
                    </div>
                    <span className="text-blue-600">→</span>
                  </Link>
                  <Link to="/evaluators" className="flex items-center gap-2 p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition group">
                    <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">+</div>
                    <div className="flex-1">
                      <h4 className="font-medium text-green-900 group-hover:text-green-800 text-sm">Manage Evaluators</h4>
                    </div>
                    <span className="text-green-600">→</span>
                  </Link>
                  <Link to="/team-formation" className="flex items-center gap-2 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition group">
                    <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">⚡</div>
                    <div className="flex-1">
                      <h4 className="font-medium text-purple-900 group-hover:text-purple-800 text-sm">Form Teams</h4>
                    </div>
                    <span className="text-purple-600">→</span>
                  </Link>
                </div>
              </div>
            </>
          )}
          {!showDetails && (
            <div className="text-xs text-gray-500 text-center">More info is hidden. Tap Show Details above to expand.</div>
          )}
        </div>
      </div>
    </div>
  );
}
