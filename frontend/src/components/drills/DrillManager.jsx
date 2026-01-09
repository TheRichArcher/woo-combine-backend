import React, { useState, useEffect, useCallback } from 'react';
import { getDrillsFromTemplate, getTemplateById } from '../../constants/drillTemplates';
import CustomDrillWizard from './CustomDrillWizard';
import DeleteConfirmModal from '../DeleteConfirmModal';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Plus, Lock, Edit2, Trash2, Info, Eye, EyeOff } from 'lucide-react';

export default function DrillManager({ event, leagueId, isLiveEntryActive = false, onDrillsChanged }) {
  const [activeTab, setActiveTab] = useState('template'); // 'template' | 'custom'
  const [customDrills, setCustomDrills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState(null);
  const [disabledDrills, setDisabledDrills] = useState([]);
  const [updatingEvent, setUpdatingEvent] = useState(false);
  const [drillToDelete, setDrillToDelete] = useState(null);
  const { showError, showSuccess } = useToast();

  const templateId = event?.drillTemplate;
  const templateDrills = getDrillsFromTemplate(templateId);
  const templateInfo = getTemplateById(templateId);

  // Initialize disabled drills from event
  useEffect(() => {
    if (event?.disabled_drills) {
      setDisabledDrills(event.disabled_drills);
    }
  }, [event]);

  const fetchCustomDrills = useCallback(async () => {
    if (!event?.id || !leagueId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/leagues/${leagueId}/events/${event.id}/custom-drills`);
      setCustomDrills(data.custom_drills || []);
    } catch (error) {
      console.error("Failed to fetch custom drills", error);
      // Don't show error toast on mount to avoid spam if just empty
    } finally {
      setLoading(false);
    }
  }, [event?.id, leagueId]);

  useEffect(() => {
    fetchCustomDrills();
  }, [fetchCustomDrills]);

  const toggleDrill = async (drillKey) => {
    if (isLiveEntryActive) return;
    
    setUpdatingEvent(true);
    try {
      const isCurrentlyDisabled = disabledDrills.includes(drillKey);
      const newDisabled = isCurrentlyDisabled
        ? disabledDrills.filter(k => k !== drillKey)
        : [...disabledDrills, drillKey];
      
      setDisabledDrills(newDisabled);
      
      // Persist to backend
      await api.put(`/leagues/${leagueId}/events/${event.id}`, {
        name: event.name, // Required field
        disabledDrills: newDisabled
      });
      
      // showSuccess(isCurrentlyDisabled ? "Drill enabled" : "Drill disabled");
      onDrillsChanged?.();
    } catch (error) {
      console.error("Failed to update event drills", error);
      showError("Failed to update drill status");
      // Revert
      setDisabledDrills(event?.disabled_drills || []);
    } finally {
      setUpdatingEvent(false);
    }
  };

  const handleDeleteClick = (drill) => {
    if (isLiveEntryActive) return;
    setDrillToDelete(drill);
  };

  const handleDeleteConfirm = async () => {
    if (!drillToDelete) return;

    try {
      await api.delete(`/leagues/${leagueId}/events/${event.id}/custom-drills/${drillToDelete.id}`);
      await fetchCustomDrills();
      onDrillsChanged?.();
      // Success toast handled by DeleteConfirmModal
    } catch (error) {
      throw error; // Let DeleteConfirmModal handle the error display
    }
  };

  const handleEdit = (drill) => {
    if (isLiveEntryActive) return;
    setEditingDrill(drill);
    setIsWizardOpen(true);
  };

  const handleCreate = () => {
    setEditingDrill(null);
    setIsWizardOpen(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Manage Drills</h2>
          <p className="text-sm text-gray-500 mt-1">
            Template: {templateInfo?.name || 'Standard'}
          </p>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
                onClick={() => setActiveTab('template')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'template' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                Template Drills ({templateDrills.length})
            </button>
            <button
                onClick={() => setActiveTab('custom')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'custom' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                Custom Drills ({customDrills.length})
            </button>
        </div>
      </div>

      <div className="bg-gray-50 min-h-[300px]">
        {activeTab === 'template' ? (
            <div>
                <div className="bg-blue-50 p-4 border-b border-blue-100 text-sm text-blue-800 flex items-start gap-3">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <strong>Configure Standard Drills:</strong> You can disable drills that you won't be using for this event. 
                        Disabled drills will be hidden from the app and reports.
                    </div>
                </div>
                <ul className="divide-y divide-gray-200 bg-white">
                    {templateDrills.map((drill) => {
                        const isDisabled = disabledDrills.includes(drill.key);
                        return (
                            <li key={drill.key} className={`px-6 py-4 hover:bg-gray-50 flex items-center justify-between ${isDisabled ? 'bg-gray-50 opacity-75' : ''}`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${isDisabled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{drill.label}</span>
                                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">Built-in</span>
                                        {isDisabled && <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-600/10">Disabled</span>}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        Category: {drill.category} • Unit: {drill.unit} • {drill.lowerIsBetter ? 'Lower is better' : 'Higher is better'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Toggle Switch */}
                                    <button
                                        onClick={() => toggleDrill(drill.key)}
                                        disabled={isLiveEntryActive || updatingEvent}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                            isDisabled 
                                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                                                : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200'
                                        } ${isLiveEntryActive || updatingEvent ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isDisabled ? (
                                            <>
                                                <EyeOff className="w-4 h-4" />
                                                <span>Hidden</span>
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4" />
                                                <span>Visible</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        ) : (
            <div className="bg-white h-full">
                {/* Empty State / List */}
                {customDrills.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="mx-auto h-12 w-12 text-teal-600 bg-teal-50 rounded-full flex items-center justify-center mb-3">
                            <Plus className="h-6 w-6" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">No custom drills yet</h3>
                        <p className="mt-1 text-sm text-gray-500 max-w-xs mx-auto">
                            Create drills unique to this event. They will be locked once Live Entry begins.
                        </p>
                        <button 
                            onClick={handleCreate}
                            disabled={isLiveEntryActive}
                            className={`mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                                isLiveEntryActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'
                            }`}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Custom Drill
                        </button>
                    </div>
                ) : (
                    <div>
                         <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">
                                {isLiveEntryActive ? 'Locked (Live Entry Active)' : 'Editable'}
                            </span>
                            {!isLiveEntryActive && (
                                <button 
                                    onClick={handleCreate}
                                    className="text-xs font-medium text-teal-700 hover:text-teal-800 flex items-center"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> New Drill
                                </button>
                            )}
                        </div>
                        <ul className="divide-y divide-gray-200">
                            {customDrills.map((drill) => (
                                <li key={drill.id} className={`px-6 py-4 hover:bg-gray-50 flex items-center justify-between ${isLiveEntryActive ? 'opacity-75' : ''}`}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-900">{drill.name}</span>
                                            <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">Custom</span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500">
                                            Category: {drill.category} • Unit: {drill.unit} • {drill.lower_is_better ? 'Lower is better' : 'Higher is better'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isLiveEntryActive ? (
                                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                                <Lock className="w-3 h-3 mr-1" /> Locked
                                            </span>
                                        ) : (
                                            <>
                                                <button onClick={() => handleEdit(drill)} className="p-1 text-gray-400 hover:text-teal-600">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteClick(drill)} className="p-1 text-gray-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Wizard Modal */}
      {isWizardOpen && (
        <CustomDrillWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          eventId={event?.id}
          leagueId={leagueId}
          drillTemplate={templateId}
          disabledDrills={disabledDrills}
          initialData={editingDrill}
          onDrillCreated={async () => {
            await fetchCustomDrills();
            onDrillsChanged?.();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={!!drillToDelete}
        onClose={() => setDrillToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Custom Drill"
        itemName={drillToDelete?.name || ""}
        itemType="drill"
        description={`Are you sure you want to delete the "${drillToDelete?.name}" drill?`}
        consequences="This drill and all associated data will be permanently removed. This action cannot be undone."
        severity="medium"
        variant="danger"
        confirmButtonText="Delete Drill"
        analyticsData={{
          drillId: drillToDelete?.id,
          drillName: drillToDelete?.name,
          eventId: event?.id
        }}
      />
    </div>
  );
}

