import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shield, ShieldOff, CheckCircle, AlertCircle, Loader2, Edit3, Eye } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

export default function StaffManagement({ leagueId, currentUser }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useToast();
  const [togglingId, setTogglingId] = useState(null);
  const [togglingWriteId, setTogglingWriteId] = useState(null);

  const fetchMembers = useCallback(async () => {
    if (!leagueId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/leagues/${leagueId}/members`);
      // Sort: Organizers first, then alphabetical
      const sortedMembers = (response.data.members || []).sort((a, b) => {
        if (a.role === 'organizer' && b.role !== 'organizer') return -1;
        if (a.role !== 'organizer' && b.role === 'organizer') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setMembers(sortedMembers);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setError('Failed to load staff list');
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleToggleStatus = async (member) => {
    // Prevent disabling yourself
    if (member.id === currentUser?.uid) {
      showError("You cannot revoke your own access.");
      return;
    }

    try {
      setTogglingId(member.id);
      const newStatus = !member.disabled; // Toggle
      
      await api.patch(`/leagues/${leagueId}/members/${member.id}/status`, {
        disabled: newStatus
      });
      
      // Optimistic update
      setMembers(prev => prev.map(m => 
        m.id === member.id ? { ...m, disabled: newStatus } : m
      ));
      
      showSuccess(`User access ${newStatus ? 'revoked' : 'restored'}`);
    } catch (err) {
      console.error('Failed to update member status:', err);
      showError('Failed to update access status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleWritePermission = async (member) => {
    // Prevent changing your own write permission
    if (member.id === currentUser?.uid) {
      showError("You cannot change your own write permissions.");
      return;
    }

    // Organizers always have write access
    if (member.role === 'organizer') {
      showError("Organizers always have full write access.");
      return;
    }

    try {
      setTogglingWriteId(member.id);
      const newCanWrite = !member.canWrite; // Toggle (default to true if undefined)
      
      await api.patch(`/leagues/${leagueId}/members/${member.id}/write-permission`, {
        canWrite: newCanWrite
      });
      
      // Optimistic update
      setMembers(prev => prev.map(m => 
        m.id === member.id ? { ...m, canWrite: newCanWrite } : m
      ));
      
      showSuccess(`${member.name} can now ${newCanWrite ? 'edit scores and players' : 'only view data (read-only)'}`);
    } catch (err) {
      console.error('Failed to update write permission:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to update write permission';
      showError(errorMsg);
    } finally {
      setTogglingWriteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading staff list...
      </div>
    );
  }

    if (error) {
    return (
      <div className="bg-semantic-error/10 border border-semantic-error/20 text-semantic-error p-4 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        {error}
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* Info Banner */}
      <div className="mb-4 bg-brand-light/20 p-4 rounded-lg border border-brand-primary/20 text-sm text-brand-primary flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Two-Tier Access Control:</strong>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li><strong>Access Toggle (right):</strong> Completely revokes access to league data</li>
            <li><strong>Write Permission (left, coaches only):</strong> Set coach to Read-Only while keeping their access active</li>
          </ul>
          <p className="mt-2 text-xs">
            Note: If you globally lock the combine, all non-organizers become read-only regardless of individual settings.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {members.map(member => {
          const canWrite = member.canWrite !== undefined ? member.canWrite : true; // Default to true
          const isCoach = member.role === 'coach';
          const isOrganizer = member.role === 'organizer';
          
          return (
            <div 
              key={member.id} 
              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                member.disabled 
                  ? 'bg-gray-50 border-gray-200 opacity-75' 
                  : 'bg-white border-gray-200 hover:border-cmf-primary/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  isOrganizer
                    ? 'bg-brand-accent/10 text-brand-accent' 
                    : isCoach
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'bg-semantic-success/10 text-semantic-success'
                }`}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    {member.name || 'Unknown User'}
                    {member.id === currentUser?.uid && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">You</span>
                    )}
                    {member.disabled && (
                      <span className="text-xs bg-semantic-error/10 text-semantic-error px-2 py-0.5 rounded-full font-bold">
                        SUSPENDED
                      </span>
                    )}
                    {!member.disabled && isCoach && !canWrite && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Read-Only
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{member.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-gray-600 capitalize">
                  {member.role}
                </div>
                
                {/* Write Permission Toggle (coaches only) */}
                {isCoach && member.id !== currentUser?.uid && !member.disabled && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => handleToggleWritePermission(member)}
                      disabled={togglingWriteId === member.id}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        canWrite ? 'bg-green-500' : 'bg-orange-400'
                      }`}
                      title={canWrite ? "Can edit scores & players" : "Read-only access"}
                    >
                      <span className="sr-only">Toggle Write Permission</span>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          canWrite ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      >
                        {canWrite ? (
                          <Edit3 className="w-3 h-3 text-green-600 m-auto mt-1" />
                        ) : (
                          <Eye className="w-3 h-3 text-orange-600 m-auto mt-1" />
                        )}
                      </span>
                    </button>
                    <span className="text-xs text-gray-500">
                      {canWrite ? 'Can Edit' : 'View Only'}
                    </span>
                  </div>
                )}
                
                {/* Access Toggle (all members except current user) */}
                {member.id !== currentUser?.uid && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => handleToggleStatus(member)}
                      disabled={togglingId === member.id}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        member.disabled ? 'bg-gray-200' : 'bg-cmf-primary'
                      }`}
                      title={member.disabled ? "Click to restore access" : "Click to revoke access"}
                    >
                      <span className="sr-only">Toggle Access</span>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          member.disabled ? 'translate-x-0' : 'translate-x-5'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-gray-500">
                      {member.disabled ? 'Suspended' : 'Active'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No members found in this league.
          </div>
        )}
      </div>
    </div>
  );
}

