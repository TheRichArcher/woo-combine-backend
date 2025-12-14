import React, { useState, useMemo, useCallback } from "react";
import { X, Edit } from 'lucide-react';
import api from '../../lib/api';
import { AGE_GROUP_OPTIONS } from '../../constants/app';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import { useToast } from '../../context/ToastContext';
import { usePlayerDetails } from '../../context/PlayerDetailsContext'; // Import context
import ErrorDisplay from '../ErrorDisplay';

const EditPlayerModal = React.memo(function EditPlayerModal({ player, allPlayers, onClose, onSave }) {
  const { updateSelectedPlayer } = usePlayerDetails(); // Get update function
  const [formData, setFormData] = useState({
    name: player?.name || '',
    number: player?.number || '',
    age_group: player?.age_group || ''
  });
  
  const { showError } = useToast();
  const { loading: saving, error, execute: executeUpdate } = useAsyncOperation({
    context: 'PLAYER_UPDATE',
    onSuccess: () => {
      onSave();
      onClose();
    },
    onError: (err, userMessage) => {
      showError(userMessage);
    }
  });

  const existingAgeGroups = useMemo(() => {
    return [...new Set(
      allPlayers
        .map(p => p.age_group)
        .filter(ag => ag && ag.trim() !== '')
    )].sort();
  }, [allPlayers]);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) {
      showError('Player name is required');
      return;
    }

    const updateData = {
      name: formData.name.trim(),
      number: formData.number ? parseInt(formData.number) : null,
      age_group: formData.age_group.trim() || null
    };

    const apiUrl = `/players/${player.id}?event_id=${player.event_id}`;
    
    await executeUpdate(async () => {
      const response = await api.put(apiUrl, updateData);
      // API-First Update: Only update local state if API call succeeds
      if (updateSelectedPlayer) {
        updateSelectedPlayer(response.data);
      }
      return response;
    });
  }, [formData, player, executeUpdate, showError, updateSelectedPlayer]);

  if (!player) return null;

  return (
  <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4">
      <div className="wc-card max-w-md w-full">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            <h2 className="text-xl font-bold">Edit Player</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <ErrorDisplay error={error} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
              placeholder="e.g., A, B, C, 6U, U8, 7-8, 9-10 years old"
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
              Type any format your league uses (A, B, C, 6U, U8, 7-8 years old, etc.)
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
              className="flex-1 bg-brand-primary hover:opacity-90 text-white font-medium py-2 rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default EditPlayerModal;