/**
 * DraftPayment - Payment flow before starting a draft
 * Shows pricing info and handles Stripe checkout (when enabled)
 * 
 * For testing: Payments are disabled, all drafts are free
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDraft } from '../../hooks/useDraft';
import LoadingScreen from '../../components/LoadingScreen';
import api from '../../lib/api';
import { 
  CreditCard, 
  CheckCircle, 
  Users, 
  DollarSign,
  ArrowRight,
  Shield
} from 'lucide-react';

const DraftPayment = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { draft, loading: draftLoading } = useDraft(draftId);
  
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await api.get(`/draft-payments/pricing/${draftId}`);
        setPricing(res.data);
      } catch (err) {
        showError(err.response?.data?.detail || 'Failed to load pricing');
      } finally {
        setLoading(false);
      }
    };
    
    if (draftId) fetchPricing();
  }, [draftId]);

  const handleStartDraft = async () => {
    setProcessing(true);
    try {
      await api.post(`/drafts/${draftId}/start`);
      showSuccess('Draft started!');
      navigate(`/draft/${draftId}/room`);
    } catch (err) {
      if (err.response?.status === 402) {
        showError('Payment required before starting');
      } else {
        showError(err.response?.data?.detail || 'Failed to start draft');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handlePayment = async () => {
    setProcessing(true);
    try {
      const res = await api.post('/draft-payments/create-checkout', {
        draft_id: draftId,
        success_url: `${window.location.origin}/draft/${draftId}/payment?success=true`,
        cancel_url: `${window.location.origin}/draft/${draftId}/payment?canceled=true`
      });
      window.location.href = res.data.checkout_url;
    } catch (err) {
      if (err.response?.status === 501) {
        // Payments not implemented - bypass for testing
        showError('Payments not yet enabled. Drafts are free for testing!');
        await handleStartDraft();
      } else {
        showError(err.response?.data?.detail || 'Failed to create checkout');
      }
    } finally {
      setProcessing(false);
    }
  };

  if (draftLoading || loading) return <LoadingScreen />;
  if (!draft || !pricing) return <div className="p-8 text-center">Draft not found</div>;

  const isAdmin = draft.created_by === user?.uid;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white text-center">
            <h1 className="text-2xl font-bold mb-2">{draft.name}</h1>
            <p className="text-blue-100">Ready to start your draft</p>
          </div>

          {/* Pricing Info */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <Users className="mx-auto mb-2 text-blue-600" size={24} />
                <div className="text-2xl font-bold">{pricing.num_teams}</div>
                <div className="text-sm text-gray-500">Teams</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <DollarSign className="mx-auto mb-2 text-green-600" size={24} />
                <div className="text-2xl font-bold">{pricing.price_display}</div>
                <div className="text-sm text-gray-500">{pricing.tier_name}</div>
              </div>
            </div>

            {/* Status */}
            {pricing.is_free && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                <div>
                  <div className="font-semibold text-green-800">Free Draft!</div>
                  <div className="text-sm text-green-600">
                    {pricing.num_players <= 15 
                      ? `Drafts with ≤15 players are free` 
                      : `Solo drafts are free`}
                  </div>
                </div>
              </div>
            )}

            {pricing.payment_status === 'paid' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                <div>
                  <div className="font-semibold text-green-800">Payment Complete</div>
                  <div className="text-sm text-green-600">Ready to start</div>
                </div>
              </div>
            )}

            {pricing.payment_status === 'bypassed' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                <Shield className="text-yellow-600 flex-shrink-0" size={24} />
                <div>
                  <div className="font-semibold text-yellow-800">Testing Mode</div>
                  <div className="text-sm text-yellow-600">Payment bypassed for testing</div>
                </div>
              </div>
            )}

            {/* Action Button */}
            {isAdmin && (
              <div className="space-y-3">
                {!pricing.requires_payment ? (
                  <button
                    onClick={handleStartDraft}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                  >
                    {processing ? 'Starting...' : 'Start Draft'}
                    <ArrowRight size={20} />
                  </button>
                ) : (
                  <button
                    onClick={handlePayment}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:bg-gray-300 transition-colors"
                  >
                    <CreditCard size={20} />
                    {processing ? 'Processing...' : `Pay ${pricing.price_display} to Start`}
                  </button>
                )}
                
                <button
                  onClick={() => navigate(`/draft/${draftId}/setup`)}
                  className="w-full px-6 py-3 text-gray-600 hover:text-gray-800 text-sm"
                >
                  ← Back to Setup
                </button>
              </div>
            )}

            {!isAdmin && (
              <div className="text-center text-gray-500 py-4">
                Only the draft creator can start the draft
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 text-center text-xs text-gray-500">
            <Shield size={14} className="inline mr-1" />
            Secure payment powered by Stripe
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftPayment;
