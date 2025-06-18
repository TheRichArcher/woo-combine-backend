import React from 'react';
import QRCode from 'react-qr-code';
import { Copy, QrCode } from 'lucide-react';

export default function EventJoinCode({ event, league }) {
  if (!event || !league) return null;

  const joinCode = event.id;
  const joinUrl = `https://woo-combine.com/join-event/${league.id}/${event.id}`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
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

        <div className="mb-4">
          <div className="flex justify-center mb-2">
            <div className="bg-white p-4 rounded-lg border">
              <QRCode value={joinUrl} size={160} />
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Scan to join: {joinUrl}
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <button
            onClick={() => copyToClipboard(joinCode)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Event Code
          </button>
          <button
            onClick={() => copyToClipboard(joinUrl)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Copy Join Link
          </button>
        </div>

        <div className="text-green-700 font-semibold text-sm">
          🏆 Share this code or QR with coaches to join this combine event!
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        <strong>Next steps:</strong>
        <ul className="list-disc list-inside mt-2 text-left">
          <li>Share the code/QR with your coaches</li>
          <li>Upload player roster in the Admin section</li>
          <li>Start recording drill results</li>
        </ul>
      </div>
    </div>
  );
} 