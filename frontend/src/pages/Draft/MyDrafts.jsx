/**
 * MyDrafts - List of user's drafts (created + coaching)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import LoadingScreen from '../../components/LoadingScreen';
import { 
  Plus, 
  Trophy, 
  Users, 
  Clock, 
  CheckCircle, 
  Play,
  Settings,
  ArrowRight
} from 'lucide-react';

const statusColors = {
  setup: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-orange-100 text-orange-800',
  completed: 'bg-blue-100 text-blue-800'
};

const statusIcons = {
  setup: Settings,
  active: Play,
  paused: Clock,
  completed: CheckCircle
};

const MyDrafts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const res = await api.get('/drafts?mine=true');
        setDrafts(res.data || []);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load drafts');
      } finally {
        setLoading(false);
      }
    };
    fetchDrafts();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Drafts</h1>
            <p className="text-sm text-gray-500">Drafts you've created or are coaching</p>
          </div>
          <Link
            to="/draft/create"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            New Draft
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Drafts List */}
        {drafts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No drafts yet</h3>
            <p className="text-gray-500 mb-4">Create your first draft to get started</p>
            <Link
              to="/draft/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus size={18} />
              Create Draft
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => {
              const StatusIcon = statusIcons[draft.status] || Settings;
              const isOwner = draft.created_by === user?.uid;
              
              return (
                <div
                  key={draft.id}
                  onClick={() => navigate(
                    draft.status === 'setup' 
                      ? `/draft/${draft.id}/setup` 
                      : `/draft/${draft.id}/room`
                  )}
                  className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl">
                      <Trophy className="text-indigo-600" size={24} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {draft.name}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[draft.status]}`}>
                          <StatusIcon size={12} className="inline mr-1" />
                          {draft.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {draft.draft_type || 'snake'}
                        </span>
                        {!isOwner && (
                          <span className="text-indigo-600 font-medium">
                            Coaching
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <ArrowRight className="text-gray-400" size={20} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyDrafts;
