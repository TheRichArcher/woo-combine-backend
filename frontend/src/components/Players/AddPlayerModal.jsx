console.log('Loading AddPlayerModal.jsx');

import React, { useState, useMemo, useCallback } from "react";
import { UserPlus } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../lib/api';
import { AGE_GROUP_OPTIONS } from '../../constants/app';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import { useToast } from '../../context/ToastContext';
import { useEvent } from '../../context/EventContext';
import { generatePlayerNumber } from '../../utils/playerNumbering';
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
      const _playerName = `${formData.first_name} ${formData.last_name}`;
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

  // Auto-assign player number using the sophisticated numbering system
  const autoAssignPlayerNumber = useCallback((ageGroup) => {
    const existingNumbers = allPlayers
      .filter(p => p.number != null)
      .map(p => parseInt(p.number));
    
    return generatePlayerNumber(ageGroup, existingNumbers);
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
    <Modal
      title="Add New Player"
      icon={<UserPlus className="w-5 h-5" />}
      onClose={onClose}
      footer={(
        <>
          <Button variant="subtle" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="success" onClick={handleSave} disabled={saving || (!formData.first_name.trim() || !formData.last_name.trim())}>
            {saving ? 'Adding...' : 'Add Player'}
          </Button>
        </>
      )}
    >
      {error && (
        <div className="mb-4">
          <ErrorDisplay error={error} />
        </div>
      )}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">First Name *</label>
            <Input
              type="text"
              value={formData.first_name}
              onChange={(e) => handleInputChange('first_name', e.target.value)}
              placeholder="Enter first name"
              disabled={saving}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Last Name *</label>
            <Input
              type="text"
              value={formData.last_name}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              placeholder="Enter last name"
              disabled={saving}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Player Number <span className="text-xs text-text-muted ml-1">(Auto-generated if empty)</span></label>
            <Input
              type="number"
              value={formData.number}
              onChange={(e) => handleInputChange('number', e.target.value)}
              placeholder="Auto-generated"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Age Group</label>
            <div className="relative">
              <Input
                list="age-groups"
                type="text"
                value={formData.age_group}
                onChange={(e) => handleInputChange('age_group', e.target.value)}
                placeholder="e.g., A, B, C, 6U, 7-8, U10"
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
    </Modal>
  );
});

export default AddPlayerModal;