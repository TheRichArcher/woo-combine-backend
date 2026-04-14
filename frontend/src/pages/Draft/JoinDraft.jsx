/**
 * JoinDraft - Landing page for coach invite links
 * URL: /draft/join/{invite_token}
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import LoadingScreen from '../../components/LoadingScreen';
import api from '../../lib/api';
import { 
  Users, 
  CheckCircle, 
  AlertCircle,
  LogIn,
  ArrowRight
} from 'lucide-react';

const JoinDraft = () => {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showSuccess, showError } = useToast();
  
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  // Fetch invite info (no auth required)
  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await api.get(`/drafts/join/${inviteToken}`);
        setInviteInfo(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Invalid invite link');
      } finally {
        setLoading(false);
      }
    };
    
    if (inviteToken) fetchInvite();
  }, [inviteToken]);

  const handleJoin = async () => {
    if (!user) {
      // Save invite token and redirect to login
      sessionStorage.setItem('pendingInvite', inviteToken);
      navigate('/login?redirect=' + encodeURIComponent(`/draft/join/${inviteToken}`));
      return;
    }

    setJoining(true);
    try {
      const res = await api.post(`/drafts/join/${inviteToken}`);
      showSuccess(`Joined ${res.data.team_name}!`);
      navigate(`/draft/${res.data.draft_id}/room`);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  if (loading || authLoading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h1 className="text-xl font-bold mb-2">Invalid Invite Link</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link 
            to="/"
            className="text-blue-600 hover:underline"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white text-center">
          <Users className="mx-auto mb-3" size={40} />
          <h1 className="text-2xl font-bold">You're Invited!</h1>
          <p className="text-blue-100 mt-1">Join as a coach in this draft</p>
        </div>

        {/* Info */}
        <div className="p-6">
          <div className="space-y-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Draft</div>
              <div className="font-semibold text-lg">{inviteInfo.draft_name}</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Your Team</div>
              <div className="font-semibold text-lg">{inviteInfo.team_name}</div>
              {inviteInfo.coach_name && (
                <div className="text-sm text-gray-500">Coach: {inviteInfo.coach_name}</div>
              )}
            </div>

            {inviteInfo.draft_status === 'active' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
                <span className="text-sm text-yellow-800">Draft is in progress!</span>
              </div>
            )}

            {inviteInfo.already_claimed && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                <span className="text-sm text-green-800">Team already has a coach assigned</span>
              </div>
            )}
          </div>

          {/* Action */}
          {!inviteInfo.already_claimed ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              {!user ? (
                <>
                  <LogIn size={20} />
                  Sign In to Join
                </>
              ) : joining ? (
                'Joining...'
              ) : (
                <>
                  Join as Coach
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => navigate(`/draft/${inviteInfo.draft_id}/room`)}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
            >
              Go to Draft Room
              <ArrowRight size={20} />
            </button>
          )}

          {!user && (
            <p className="text-center text-sm text-gray-500 mt-4">
              You'll need to sign in or create an account to join
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinDraft;
