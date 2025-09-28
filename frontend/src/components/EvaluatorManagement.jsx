import React, { useState, useEffect, useCallback } from 'react';
import { useEvent } from '../context/EventContext';
import { useToast } from '../context/ToastContext';
import { Plus, Users, UserCheck, Shield, Eye, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { useAsyncOperation } from '../hooks/useAsyncOperation';

const EVALUATOR_ROLES = [
  { value: 'head_coach', label: 'Head Coach', icon: Shield, color: 'text-purple-600 bg-purple-100' },
  { value: 'assistant_coach', label: 'Assistant Coach', icon: UserCheck, color: 'text-blue-600 bg-blue-100' },
  { value: 'evaluator', label: 'Evaluator', icon: Eye, color: 'text-green-600 bg-green-100' },
  { value: 'scout', label: 'Scout', icon: Users, color: 'text-orange-600 bg-orange-100' },
];

const EvaluatorManagement = () => {
  const { selectedEvent } = useEvent();
  const { showSuccess, showError } = useToast();
  
  const [evaluators, setEvaluators] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvaluator, setNewEvaluator] = useState({
    name: '',
    email: '',
    role: 'evaluator'
  });

    // Stabilize callbacks to prevent infinite loops
  const onFetchSuccess = useCallback((data) => setEvaluators(data), []);
  const onFetchError = useCallback((err, userMessage) => {
    // Don't show error toast for 401 (session expired) to prevent cascade
    if (err.response?.status !== 401) {
      showError(userMessage);
    }
  }, [showError]);

  const { loading: loadingEvaluators, execute: fetchEvaluators } = useAsyncOperation({
    context: 'FETCH_EVALUATORS',
    onSuccess: onFetchSuccess,
    onError: onFetchError
  });

  const loadEvaluators = useCallback(async () => {
    if (selectedEvent?.id) {
      try {
        await fetchEvaluators(async () => {
          const response = await api.get(`/events/${selectedEvent.id}/evaluators`);
          return response.data;
        });
      } catch (error) {
        // Stop attempting to load evaluators if session expired
        if (error.response?.status === 401) {
          // eslint-disable-next-line no-console
          console.warn('Session expired while loading evaluators - stopping attempts');
          return;
        }
        // Re-throw other errors
        throw error;
      }
    }
  }, [selectedEvent?.id, fetchEvaluators]);

  // Stabilize callbacks for add evaluator
  const onAddSuccess = useCallback(() => {
    showSuccess('Evaluator added successfully!');
    setShowAddForm(false);
    setNewEvaluator({ name: '', email: '', role: 'evaluator' });
    loadEvaluators();
  }, [showSuccess, loadEvaluators]);

  const onAddError = useCallback((err, userMessage) => {
    // Don't show error toast for 401 (session expired) to prevent cascade
    if (err.response?.status !== 401) {
      showError(userMessage);
    }
  }, [showError]);

  const { loading: addingEvaluator, execute: addEvaluator } = useAsyncOperation({
    context: 'ADD_EVALUATOR',
    onSuccess: onAddSuccess,
    onError: onAddError
  });

  useEffect(() => {
    loadEvaluators();
  }, [loadEvaluators]);

  const handleAddEvaluator = async () => {
    if (!newEvaluator.name.trim() || !newEvaluator.email.trim()) {
      showError('Please fill in all required fields');
      return;
    }

    await addEvaluator(async () => {
      const response = await api.post(`/events/${selectedEvent.id}/evaluators`, newEvaluator);
      return response.data;
    });
  };

  const getRoleInfo = (roleValue) => {
    return EVALUATOR_ROLES.find(role => role.value === roleValue) || EVALUATOR_ROLES[2];
  };

  if (!selectedEvent) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className="w-5 h-5" />
          <span>Please select an event to manage evaluators</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Evaluator Management</h2>
            <p className="text-sm text-gray-600">
              Manage coaches and evaluators for {selectedEvent.name}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Evaluator
        </button>
      </div>

      {/* Add Evaluator Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-3">Add New Evaluator</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={newEvaluator.name}
                onChange={(e) => setNewEvaluator({ ...newEvaluator, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Evaluator name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={newEvaluator.email}
                onChange={(e) => setNewEvaluator({ ...newEvaluator, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={newEvaluator.role}
                onChange={(e) => setNewEvaluator({ ...newEvaluator, role: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {EVALUATOR_ROLES.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleAddEvaluator}
              disabled={addingEvaluator}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {addingEvaluator ? 'Adding...' : 'Add Evaluator'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Evaluators List */}
      <div className="space-y-4">
        {loadingEvaluators ? (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-600">Loading evaluators...</p>
          </div>
        ) : evaluators.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No evaluators yet</h3>
            <p className="text-gray-600 mb-4">Add evaluators to enable multi-coach scoring</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Add First Evaluator
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluators.map((evaluator) => {
              const roleInfo = getRoleInfo(evaluator.role);
              const RoleIcon = roleInfo.icon;
              
              return (
                <div key={evaluator.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-full ${roleInfo.color}`}>
                        <RoleIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{evaluator.name}</h4>
                        <p className="text-sm text-gray-600">{evaluator.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      <span className="text-xs text-gray-500">Active</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 text-xs text-gray-500">
                    Added {new Date(evaluator.added_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Evaluator Stats */}
      {evaluators.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Evaluation Team Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{evaluators.length}</div>
              <div className="text-xs text-gray-600">Total Evaluators</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {evaluators.filter(e => e.role === 'head_coach').length}
              </div>
              <div className="text-xs text-gray-600">Head Coaches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {evaluators.filter(e => e.role === 'evaluator').length}
              </div>
              <div className="text-xs text-gray-600">Evaluators</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {evaluators.filter(e => e.role === 'scout').length}
              </div>
              <div className="text-xs text-gray-600">Scouts</div>
            </div>
          </div>
        </div>
      )}

      {/* Benefits Callout */}
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
          <UserCheck className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-900 mb-1">Multi-Evaluator Benefits</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>- Reduce individual bias with multiple perspectives</li>
              <li>- Automatic score aggregation and variance analysis</li>
              <li>- Real-time collaborative evaluation</li>
              <li>- Enhanced credibility with multiple evaluators</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvaluatorManagement;