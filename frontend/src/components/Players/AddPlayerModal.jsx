import React, { useState, useMemo, useCallback } from "react";
import { X, UserPlus } from 'lucide-react';
import api from '../../lib/api';
import { AGE_GROUP_OPTIONS } from '../../constants/players';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import { useToast } from '../../context/ToastContext';
import { useEvent } from '../../context/EventContext';
import ErrorDisplay from '../ErrorDisplay';

const AddPlayerModal = React.memo(function AddPlayerModal({ allPlayers, onClose, onSave }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    number: '',
    age_group: ''
  });
  
  const { selectedEvent } = useEvent();
  const { showSuccess, showError } = useToast();
  const { loading: saving, error, execute: executeAdd } = useAsyncOperation({
    context: 'PLAYER_ADD',
    onSuccess: (data) => {
      const playerName = `${formData.first_name} ${formData.last_name}`;
      const autoNumbered = !formData.number || formData.number.trim() === "";
      showSuccess(`Player added${autoNumbered ? ` with auto-number #${data.number}` : ''}!`);
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

  // Auto-assign player number logic (simplified version from AdminTools)
  const autoAssignPlayerNumber = useCallback((ageGroup) => {
    const playersInGroup = allPlayers.filter(p => p.age_group === ageGroup);
    const usedNumbers = playersInGroup.map(p => p.number).filter(n => n != null);
    
    // Find next available number starting from 1
    let nextNumber = 1;
    while (usedNumbers.includes(nextNumber)) {
      nextNumber++;
    }
    return nextNumber;
  }, [allPlayers]);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const validateForm = useCallback(() => {
    const errors = [];
    
    if (!formData.first_name.trim()) {
      errors.push("First name is required");
    }
    
    if (!formData.last_name.trim()) {
      errors.push("Last name is required");
    }
    
    if (formData.number && formData.number.trim() !== "" && isNaN(Number(formData.number))) {
      errors.push("Player number must be a valid number");
    }
    
    // Check for duplicate number
    if (formData.number && formData.number.trim() !== "") {
      const numberExists = allPlayers.some(p => p.number === parseInt(formData.number));
      if (numberExists) {
        errors.push(`Player number ${formData.number} is already taken`);
      }
    }
    
    return errors;
  }, [formData, allPlayers]);

  const handleSave = useCallback(async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      showError(`Please fix: ${errors.join(", ")}`);
      return;
    }

    if (!selectedEvent) {
      showError('No event selected');
      return;
    }

    // Auto-assign player number if not provided
    let playerNumber = null;
    if (formData.number && formData.number.trim() !== "") {
      playerNumber = parseInt(formData.number);
    } else {
      // Auto-assign number based on age group
      playerNumber = autoAssignPlayerNumber(formData.age_group.trim() || null);
    }

    const playerData = {
      name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
      number: playerNumber,
      age_group: formData.age_group.trim() || null,
    };

    await executeAdd(async () => {
      const response = await api.post(`/players?event_id=${selectedEvent.id}`, playerData);
      return { ...response.data, number: playerNumber };
    });
  }, [formData, selectedEvent, validateForm, showError, executeAdd, autoAssignPlayerNumber]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Add New Player</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
          {error && (
            <div className="mb-4">
              <ErrorDisplay error={error} />
            </div>
          )}

          <div className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Enter first name"
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Enter last name"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Number and Age Group */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player Number
                  <span className="text-xs text-gray-500 ml-1">(Auto-generated if empty)</span>
                </label>
                <input
                  type="number"
                  value={formData.number}
                  onChange={(e) => handleInputChange('number', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Auto-generated"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age Group
                </label>
                <div className="relative">
                  <input
                    list="age-groups"
                    type="text"
                    value={formData.age_group}
                    onChange={(e) => handleInputChange('age_group', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="e.g., 6U, 7-8, U10"
                    disabled={saving}
                  />
                  <datalist id="age-groups">
                    {existingAgeGroups.map(group => (
                      <option key={group} value={group} />
                    ))}
                    {AGE_GROUP_OPTIONS.map(option => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            disabled={saving || (!formData.first_name.trim() || !formData.last_name.trim())}
          >
            {saving ? 'Adding...' : 'Add Player'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default AddPlayerModal;