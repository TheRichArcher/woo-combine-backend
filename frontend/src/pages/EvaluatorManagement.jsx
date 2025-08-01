import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import EvaluatorManagement from '../components/EvaluatorManagement';
import MultiEvaluatorResults from '../components/MultiEvaluatorResults';
import EventSelector from '../components/EventSelector';
import { Users, Star, BarChart3, Trophy } from 'lucide-react';

const EvaluatorManagementPage = () => {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Multi-Evaluator System</h1>
              <p className="text-lg text-gray-600">Reduce bias with multiple coach evaluations & statistical analysis</p>
            </div>
            <div className="ml-auto">
              <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium">
                🆕 New Feature
              </span>
            </div>
          </div>

          {/* Benefits Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">Why Use Multi-Evaluator?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-yellow-500 mt-1" />
                <div>
                  <h3 className="font-medium text-blue-900">Reduce Bias</h3>
                  <p className="text-sm text-blue-700">Multiple perspectives provide more objective evaluations</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-medium text-blue-900">Statistical Analysis</h3>
                  <p className="text-sm text-blue-700">Automatic variance detection and agreement levels</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Trophy className="w-5 h-5 text-purple-500 mt-1" />
                <div>
                  <h3 className="font-medium text-blue-900">Professional Results</h3>
                  <p className="text-sm text-blue-700">Credible evaluations parents and players trust</p>
                </div>
              </div>
            </div>
          </div>

          <EventSelector />
        </div>

        {!selectedEvent ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Select an Event</h3>
            <p className="text-gray-600">Choose an event above to manage evaluators and view multi-coach results.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Evaluator Management Section */}
            {(userRole === 'organizer' || userRole === 'coach') && (
              <EvaluatorManagement />
            )}

            {/* Results Demonstration - Show for selected player if available */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Multi-Evaluator Results Demo</h2>
              <p className="text-gray-600 mb-4">
                Once you have evaluators and player data, this section will show advanced statistical analysis 
                of evaluations including variance detection and agreement levels.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
                <p className="text-center text-gray-500">
                  📊 Advanced evaluation results will appear here after adding evaluators and collecting data
                </p>
              </div>
            </div>

            {/* Getting Started Guide */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-amber-900 mb-3">Getting Started with Multi-Evaluator</h3>
              <div className="space-y-2 text-sm text-amber-800">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <span>Add evaluators (coaches, scouts, assistants) to your event above</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <span>Each evaluator scores players independently during your event</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <span>View aggregated results with statistical analysis and confidence levels</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                  <span>Generate professional reports showing evaluation consensus</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluatorManagementPage;