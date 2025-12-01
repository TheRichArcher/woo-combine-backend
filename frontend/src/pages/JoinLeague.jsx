import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import QRCode from 'react-qr-code';
import { BrowserQRCodeReader } from '@zxing/browser';
import WelcomeLayout from '../components/layouts/WelcomeLayout';
import Button from '../components/ui/Button';

export default function JoinLeague() {
  const { user, addLeague } = useAuth();
  const navigate = useNavigate();
  const { code: urlCode } = useParams();
  const [joinCode, setJoinCode] = useState(urlCode || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrError, setQrError] = useState('');
  const videoRef = useRef(null);
  const qrReaderRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) setJoinCode(codeParam.toUpperCase());
    else if (urlCode) setJoinCode(urlCode);
  }, [urlCode]);

  const handleStartScanner = async () => {
    try {
      // iOS requires getUserMedia to be called directly from a user gesture
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        // We don't need to keep the stream, just triggering the permission prompt
      }
      setShowQrScanner(true);
    } catch (err) {
      console.error("Camera permission error:", err);
      // We still show the scanner so the user sees the error state in the modal
      setShowQrScanner(true);
      setQrError('Camera permission is required. Please enable camera access in your browser settings.');
    }
  };

  // Start QR scanner when modal opens
  useEffect(() => {
    if (showQrScanner && videoRef.current) {
      setQrError('');
      qrReaderRef.current = new BrowserQRCodeReader();
      qrReaderRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
            let code = '';
            try {
              const url = new URL(result.getText());
              // Support both /join/CODE and /join-event/CODE formats
              if (url.pathname.includes('/join-event/')) {
                // Full event URL format
                navigate(`/join-event${url.pathname.replace('/join-event', '')}${url.search}`);
                setShowQrScanner(false);
                qrReaderRef.current.reset();
                return;
              }
              code = url.searchParams.get('code') || url.pathname.split('/').pop();
            } catch {
              // If URL parsing fails, treat the raw text as the code
              code = result.getText();
            }
            setShowQrScanner(false);
            qrReaderRef.current.reset();
            navigate(`/join?code=${encodeURIComponent(code)}`);
          } else if (err && err.name !== 'NotFoundException') {
            // Ignore NotFoundException as it just means no QR code found in current frame
            console.error("QR Scanner error:", err);
            // Only show persistent errors, not temporary scanning errors
            if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
              setQrError('Camera error: ' + (err.message || err));
            }
          }
        }
      );
    }
    return () => {
      if (qrReaderRef.current) {
        qrReaderRef.current.reset();
      }
    };
  }, [showQrScanner, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const { data } = await api.post(`/leagues/join/${joinCode}`, {
        user_id: user?.uid,
        email: user?.email,
      });
      setLeagueName(data.league_name);
      setSuccess(true);
      if (addLeague) addLeague({ id: joinCode, name: data.league_name, role: 'coach' });
    } catch (err) {
      if (err?.response?.status === 404) {
        setError('We could not find a league with that code. If this was an event invite, we will try loading it now.');
        // Legacy invites sometimes provide the event ID instead of league ID
        setTimeout(() => {
          navigate(`/join-event/${joinCode}`);
        }, 400);
      } else {
        setError(err.message || 'Error joining league');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <WelcomeLayout
      contentClassName="min-h-[70vh]"
      hideHeader={true}
      showOverlay={false}
      backgroundColor="bg-surface-subtle"
    >
      {/* Floating QR Scan Button */}
      <Button
        className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg p-4 flex items-center gap-2 text-lg font-bold"
        onClick={handleStartScanner}
        aria-label="Scan Event QR Code"
      >
        <span role="img" aria-label="scan">📷</span> Scan Event QR Code
      </Button>
      
      {/* QR Scanner Modal */}
      {showQrScanner && (
        <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center max-w-xs w-full">
            <h2 className="text-lg font-bold mb-2">Scan Event QR Code</h2>
            <div className="w-full h-64 mb-2 flex items-center justify-center relative overflow-hidden bg-black rounded">
              <video 
                ref={videoRef} 
                className="w-full h-full rounded object-cover" 
                playsInline 
                autoPlay 
                muted 
              />
            </div>
            {qrError && <div className="text-red-500 text-sm mb-2 text-center">{qrError}</div>}
            <Button onClick={() => setShowQrScanner(false)} className="w-full">Cancel</Button>
          </div>
        </div>
      )}
      
      <div className="w-full max-w-md wc-card p-6 sm:p-10 flex flex-col items-center">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/favicon/woocombine-logo.png"
            alt="Woo-Combine Logo"
            className="w-16 h-16 mx-auto mb-4"
            style={{ objectFit: 'contain' }}
          />
        </div>

        <h1 className="text-2xl font-bold mb-4 text-gray-900">Join a League</h1>
        <div className="mb-2 text-gray-600">Enter the league code provided by your organizer to join their league.</div>
        <div className="mb-4 text-xs text-gray-500">Need help? Ask your organizer for a league code or QR invite.</div>
        
        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-4 w-full">
            <input
              type="text"
              className="w-full px-4 py-3 border border-brand-primary/30 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition text-center font-mono text-lg tracking-widest"
              placeholder="Enter League Code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              required
              autoFocus
            />
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Joining...' : 'Join League'}
            </Button>
            {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          </form>
        ) : (
          <div className="text-center w-full">
            <div className="mb-4 text-green-600 font-semibold">Successfully joined league!</div>
            <div className="mb-2">Welcome to <span className="font-bold">{leagueName}</span></div>
            <Button size="lg" className="w-full mt-4" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </WelcomeLayout>
  );
} 