import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Keyboard } from 'lucide-react';
import WelcomeLayout from '../components/layouts/WelcomeLayout';

export default function CoachEventRequired() {
  const navigate = useNavigate();

  return (
    <WelcomeLayout
      contentClassName="min-h-screen"
      hideHeader={true}
      showOverlay={false}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
          <QrCode className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold mb-3">You must join an event to continue</h1>
        <p className="text-gray-600 mb-6">
          Your coach account is active, but no event assignment was found. Join using an event invite to unlock coach access.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/join')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Scan Event QR
          </button>
          <button
            onClick={() => navigate('/join')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            <Keyboard className="w-4 h-4" />
            Enter Event Code
          </button>
        </div>
      </div>
    </WelcomeLayout>
  );
}
