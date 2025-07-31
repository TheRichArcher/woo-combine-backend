import React, { useState } from "react";
import { X, Edit } from 'lucide-react';
import api from '../../lib/api';
import { AGE_GROUP_OPTIONS } from '../../constants/players';

export default function EditPlayerModal({ player, allPlayers, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: player?.name || '',
    number: player?.number || '',
    age_group: player?.age_group || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const existingAgeGroups = [...new Set(
    allPlayers
      .map(p => p.age_group)
      .filter(ag => ag && ag.trim() !== '')
  )].sort();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Player name is required');
      return;
    }

    setSaving(true);
    setError('');
    
    try {
      const updateData = {
        name: formData.name.trim(),
        number: formData.number ? parseInt(formData.number) : null,
        age_group: formData.age_group.trim() || null
      };

      const apiUrl = `/players/${player.id}?event_id=${player.event_id}`;
      await api.put(apiUrl, updateData);
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update player');
    } finally {
      setSaving(false);
    }
  };

  if (!player) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="bg-cmf-primary text-white p-6 rounded-t-xl flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            <h2 className="text-xl font-bold">Edit Player</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
              placeholder="Enter player name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player Number
            </label>
            <input
              type="number"
              value={formData.number}
              onChange={(e) => handleInputChange('number', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
              placeholder="Enter player number"
              min="1"
              max="999"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age Group
            </label>
            <input
              type="text"
              list="age-group-suggestions"
              value={formData.age_group}
              onChange={(e) => handleInputChange('age_group', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cmf-primary focus:border-cmf-primary"
              placeholder="e.g., 6U, U8, 7-8, 9-10 years old"
            />
            <datalist id="age-group-suggestions">
              {existingAgeGroups.map(ageGroup => (
                <option key={ageGroup} value={ageGroup} />
              ))}
              {AGE_GROUP_OPTIONS.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <p className="text-xs text-gray-500 mt-1">
              Type any format your league uses (6U, U8, 7-8 years old, etc.)
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-cmf-primary hover:bg-cmf-secondary text-white font-medium py-2 rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}