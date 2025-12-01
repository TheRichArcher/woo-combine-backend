import React, { useState, useEffect, useCallback } from 'react';
// Removed unused import: useAuth
import { useEvent } from '../context/EventContext';
import { useToast } from '../context/ToastContext';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Eye,
  Target,
  Award,
  Info
} from 'lucide-react';
import api from '../lib/api';
import { useAsyncOperation } from '../hooks/useAsyncOperation';

const MultiEvaluatorResults = ({ playerId, playerName }) => {
  const { selectedEvent } = useEvent();
  const { showError } = useToast();
  
  const [evaluations, setEvaluations] = useState({});
  const [aggregatedResults, setAggregatedResults] = useState({});
  const [selectedDrill, setSelectedDrill] = useState(null);

  // Stabilize callbacks to prevent infinite loops
  const onEvaluationsSuccess = useCallback((data) => setEvaluations(data), []);
  const onEvaluationsError = useCallback((err, userMessage) => showError(userMessage), [showError]);

  const onAggregatedSuccess = useCallback((data) => {
    setAggregatedResults(data[playerId] || {});
  }, [playerId]);
  const onAggregatedError = useCallback((err, userMessage) => showError(userMessage), [showError]);

  const { loading: loadingEvaluations, execute: fetchEvaluations } = useAsyncOperation({
    context: 'FETCH_MULTI_EVALUATIONS',
    onSuccess: onEvaluationsSuccess,
    onError: onEvaluationsError
  });

  const { loading: loadingAggregated, execute: fetchAggregated } = useAsyncOperation({
    context: 'FETCH_AGGREGATED_RESULTS',
    onSuccess: onAggregatedSuccess,
    onError: onAggregatedError
  });

  useEffect(() => {
    if (selectedEvent?.id && playerId) {
      // Fetch individual evaluations
      fetchEvaluations(async () => {
        const response = await api.get(`/events/${selectedEvent.id}/players/${playerId}/evaluations`);
        return response.data;
      });

      // Fetch aggregated results
      fetchAggregated(async () => {
        const response = await api.get(`/events/${selectedEvent.id}/aggregated-results`);
        return response.data;
      });
    }
  }, [selectedEvent, playerId, fetchAggregated, fetchEvaluations]);

  const getScoreVariance = (scores) => {
    if (scores.length < 2) return null;
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
  };

  const getVarianceLevel = (variance, average) => {
    if (!variance) return { level: 'none', color: 'text-gray-500', label: 'Single evaluation' };
    
    const variancePercent = (variance / average) * 100;
    
    if (variancePercent < 10) {
      return { level: 'low', color: 'text-semantic-success', label: 'High agreement' };
    } else if (variancePercent < 20) {
      return { level: 'medium', color: 'text-semantic-warning', label: 'Moderate agreement' };
    } else {
      return { level: 'high', color: 'text-semantic-error', label: 'Low agreement' };
    }
  };

  const renderDrillCard = (drillType, drillEvaluations) => {
    const aggregated = aggregatedResults[drillType];
    const scores = drillEvaluations.map(evalItem => evalItem.value);
    const variance = getScoreVariance(scores);
    const varianceInfo = getVarianceLevel(variance, aggregated?.average_score);

    return (
      <div 
        key={drillType}
        className={`p-4 border rounded-lg cursor-pointer transition-all ${
          selectedDrill === drillType 
            ? 'border-brand-primary bg-brand-light/20' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => setSelectedDrill(selectedDrill === drillType ? null : drillType)}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-gray-900 capitalize">
            {drillType.replace('_', ' ')}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{scores.length} evaluators</span>
            <Eye className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {aggregated ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Final Score:</span>
              <span className="font-bold text-lg text-brand-primary">
                {aggregated.final_score.toFixed(2)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Average:</span>
                <span className="ml-1 font-medium">{aggregated.average_score.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Median:</span>
                <span className="ml-1 font-medium">{aggregated.median_score.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                varianceInfo.level === 'low' ? 'bg-semantic-success' :
                varianceInfo.level === 'medium' ? 'bg-semantic-warning' : 'bg-semantic-error'
              }`}></div>
              <span className={`text-xs ${varianceInfo.color}`}>
                {varianceInfo.label}
              </span>
              {variance && (
                <span className="text-xs text-gray-500">
                  (σ: {variance.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Individual Scores:</span>
              <span className="text-sm text-gray-500">No aggregation yet</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {scores.map((score, index) => (
                <span key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {score}
                </span>
              ))}
            </div>
          </div>
        )}

        {selectedDrill === drillType && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Individual Evaluations
            </h5>
            <div className="space-y-3">
                          {drillEvaluations.map((evalData) => (
              <div key={evalData.id} className="flex items-center justify-between p-3 bg-white rounded border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-light/20 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-brand-primary">
                      {evalData.evaluator_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {evalData.evaluator_name}
                    </div>
                    {evalData.notes && (
                      <div className="text-xs text-gray-600 mt-1">
                        "{evalData.notes}"
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-gray-900">
                    {evalData.value}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(evalData.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
            </div>

            {aggregated && scores.length > 1 && (
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <h6 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Statistical Analysis
                </h6>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Range:</span>
                    <span className="ml-2 font-medium">
                      {Math.min(...scores)} - {Math.max(...scores)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Std Dev:</span>
                    <span className="ml-2 font-medium">
                      {variance ? variance.toFixed(2) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loadingEvaluations || loadingAggregated) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-gray-600">Loading evaluation results...</p>
        </div>
      </div>
    );
  }

  if (Object.keys(evaluations).length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No evaluations yet</h3>
          <p className="text-gray-600">
            This player hasn't been evaluated by any coaches yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Award className="w-6 h-6 text-semantic-warning" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Multi-Evaluator Results</h2>
          <p className="text-sm text-gray-600">
            {playerName} - Evaluated by {Object.values(evaluations).flat().length} total evaluations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {Object.entries(evaluations).map(([drillType, drillEvaluations]) => 
          renderDrillCard(drillType, drillEvaluations)
        )}
      </div>

      {/* Summary Stats */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Evaluation Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-primary">
              {Object.keys(evaluations).length}
            </div>
            <div className="text-xs text-gray-600">Drills Evaluated</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-semantic-success">
              {Object.values(evaluations).flat().length}
            </div>
            <div className="text-xs text-gray-600">Total Evaluations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-accent">
              {new Set(Object.values(evaluations).flat().map(e => e.evaluator_id)).size}
            </div>
            <div className="text-xs text-gray-600">Unique Evaluators</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-semantic-warning">
              {Object.values(aggregatedResults).filter(r => r.score_count > 1).length}
            </div>
            <div className="text-xs text-gray-600">Multi-Eval Drills</div>
          </div>
        </div>
      </div>

      {/* Benefits Info */}
      <div className="mt-4 p-4 bg-brand-light/20 border border-brand-primary/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-brand-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-brand-primary mb-1">Multi-Evaluator Advantages</h4>
            <p className="text-sm text-brand-primary/80">
              Multiple evaluations reduce bias and provide more reliable assessments. 
              Look for <span className="font-medium text-semantic-success">high agreement</span> scores 
              as the most trustworthy results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiEvaluatorResults;