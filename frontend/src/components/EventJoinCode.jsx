import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { Copy, QrCode } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function EventJoinCode({ event, league }) {
  const [selectedRole, setSelectedRole] = useState('coach');
  const { showSuccess } = useToast();

  if (!event || !league) return null;

  const joinCode = event.id;
  const baseJoinUrl = `https://woo-combine.com/join-event/${league.id}/${event.id}`;
  const legacyJoinUrl = `https://woo-combine.com/join?code=${encodeURIComponent(joinCode)}`;
  const roleJoinUrl = `${baseJoinUrl}/${selectedRole}`;
  const legacyButtonLabel = legacyJoinUrl ? 'Copy Legacy Link (woo-combine.com/join)' : 'Copy General Link (Legacy)';

  const copyToClipboard = (text, description) => {
    navigator.clipboard.writeText(text);
    showSuccess(`📋 ${description} copied to clipboard!`);
  };

  return (
    <div className="w-full max-w-md text-center mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 text-green-600">Event Created Successfully!</h1>
        <p className="text-gray-600 mb-4">Your combine event "{event.name}" is ready.</p>
      </div>

      <div className="bg-white border-2 border-green-200 rounded-xl p-6 mb-4">
        <div className="mb-4">
          <div className="font-semibold text-gray-700 mb-2">Event Join Code:</div>
          <div className="text-2xl font-mono bg-gray-100 rounded p-3 inline-block border">
            {joinCode}
          </div>
        </div>

        {/* Role-specific QR Code Section */}
        <div className="mb-4">
          <div className="font-semibold text-gray-700 mb-3">Secure Role-Based Invitations:</div>
          
          {/* Role Selection */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-3">
            <button
              onClick={() => setSelectedRole('coach')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                selectedRole === 'coach'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              👨‍🏫 Coach
            </button>
            <button
              onClick={() => setSelectedRole('viewer')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                selectedRole === 'viewer'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              👥 Viewer
            </button>
          </div>

          {/* QR Code Display */}
          <div className="flex justify-center mb-2">
            <div className="bg-white p-4 rounded-lg border">
              <QRCode value={roleJoinUrl} size={160} />
            </div>
          </div>
          
          <div className="text-xs mb-2">
            <span className={`font-medium ${selectedRole === 'coach' ? 'text-blue-600' : 'text-green-600'}`}>
              {selectedRole === 'coach' ? '🔵 COACH ACCESS' : '🟢 VIEWER ACCESS'} QR CODE
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {roleJoinUrl}
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <button
            onClick={() => copyToClipboard(roleJoinUrl, `${selectedRole === 'coach' ? 'Coach' : 'Viewer'} Link`)}
            className={`text-white px-4 py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
              selectedRole === 'coach' 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            <Copy className="w-4 h-4" />
            Copy {selectedRole === 'coach' ? 'Coach' : 'Viewer'} Link
          </button>
          <button
            onClick={() => copyToClipboard(legacyJoinUrl, 'Legacy Join Link')}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-600 transition flex items-center justify-center gap-2 text-sm"
            title={legacyJoinUrl}
            aria-label={`Copy legacy join link ${legacyJoinUrl}`}
          >
            <QrCode className="w-4 h-4" />
            {legacyButtonLabel}
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
          <div className="text-amber-800 text-xs">
            <p className="font-medium mb-1">🔒 Security Feature:</p>
            <p>Role-specific QR codes prevent unauthorized access escalation. Share Coach codes only with trusted staff.</p>
          </div>
        </div>

        <div className="text-xs text-gray-600 mt-2 break-all">
          Legacy Link (woo-combine.com/join): {legacyJoinUrl}
        </div>

        <div className="text-green-700 font-semibold text-sm mt-4">
          🏆 Share the appropriate QR code based on the access level needed!
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        <strong>Next steps:</strong>
        <ul className="list-disc list-inside mt-2 text-left">
          <li>Share Coach QR codes with refs and staff</li>
          <li>Share Viewer QR codes with parents and spectators</li>
          <li>Upload player roster in the Admin section</li>
          <li>Start recording drill results</li>
        </ul>
      </div>
    </div>
  );
} 