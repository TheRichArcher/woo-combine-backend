/**
 * CreateDraft - Create a new draft for an event
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEvent } from '../../context/EventContext';
import { useToast } from '../../context/ToastContext';
import api from '../../lib/api';
import { ArrowLeft, Zap } from 'lucide-react';

const CreateDraft = () => {
  const navigate = useNavigate();
  const { selectedEvent } = useEvent();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age_group: '',
    draft_type: 'snake',
    pick_timer_seconds: 60,
    trades_enabled: false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedEvent) {
      showError('Please select an event first');
      return;
    }

    if (!formData.name.trim()) {
      showError('Draft name is required');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/drafts', {
        ...formData,
        event_id: selectedEvent.id,
        name: formData.name.trim(),
        age_group: formData.age_group || null
      });
      
      showSuccess('Draft created!');
      navigate(`/draft/${res.data.id}/setup`);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to create draft');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm p-8 text-center">
          <h2 className="text-xl font-bold mb-4">No Event Selected</h2>
          <p className="text-gray-600 mb-6">
            Please select an event first to create a draft.
          </p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/events" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Create Draft</h1>
              <p className="text-sm text-gray-500">for {selectedEvent.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          {/* Draft Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Draft Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., U10 Spring Draft"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Age Group */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Age Group (Optional)
            </label>
            <select
              value={formData.age_group}
              onChange={(e) => setFormData(f => ({ ...f, age_group: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Players</option>
              <option value="U6">U6 (Under 6)</option>
              <option value="U8">U8 (Under 8)</option>
              <option value="U10">U10 (Under 10)</option>
              <option value="U12">U12 (Under 12)</option>
              <option value="U14">U14 (Under 14)</option>
              <option value="U16">U16 (Under 16)</option>
              <option value="U18">U18 (Under 18)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Filter players by age group. Leave empty to include all players.
            </p>
          </div>

          {/* Draft Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Draft Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                formData.draft_type === 'snake' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="draft_type"
                  value="snake"
                  checked={formData.draft_type === 'snake'}
                  onChange={(e) => setFormData(f => ({ ...f, draft_type: e.target.value }))}
                  className="sr-only"
                />
                <div>
                  <p className="font-medium">Snake</p>
                  <p className="text-xs text-gray-500">1-2-3... 3-2-1 (fairer)</p>
                </div>
              </label>
              <label className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                formData.draft_type === 'linear' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="draft_type"
                  value="linear"
                  checked={formData.draft_type === 'linear'}
                  onChange={(e) => setFormData(f => ({ ...f, draft_type: e.target.value }))}
                  className="sr-only"
                />
                <div>
                  <p className="font-medium">Linear</p>
                  <p className="text-xs text-gray-500">1-2-3... 1-2-3</p>
                </div>
              </label>
            </div>
          </div>

          {/* Pick Timer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pick Timer
            </label>
            <select
              value={formData.pick_timer_seconds}
              onChange={(e) => setFormData(f => ({ ...f, pick_timer_seconds: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0}>No Timer</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>

          {/* Trades */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Allow Trades</p>
              <p className="text-xs text-gray-500">Let coaches trade picks during the draft</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.trades_enabled}
                onChange={(e) => setFormData(f => ({ ...f, trades_enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
          >
            <Zap size={18} />
            {loading ? 'Creating...' : 'Create Draft'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateDraft;
