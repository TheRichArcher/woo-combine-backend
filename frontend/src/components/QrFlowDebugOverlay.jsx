import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';

const DEBUG_KEY = 'debug_qr_flow';
const REDIRECT_KEY = 'debug_qr_last_redirect_reason';

const readDebugEnabled = () => {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
};

const readRedirectReason = () => {
  try {
    const raw = localStorage.getItem(REDIRECT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function QrFlowDebugOverlay() {
  const location = useLocation();
  const { userRole, selectedLeagueId, leagues } = useAuth();
  const { selectedEvent, events, noLeague } = useEvent();
  const [debugEnabled, setDebugEnabled] = useState(readDebugEnabled);
  const [lastRedirectReason, setLastRedirectReason] = useState(readRedirectReason);

  useEffect(() => {
    const updateEnabled = () => setDebugEnabled(readDebugEnabled());
    const updateRedirectReason = () => setLastRedirectReason(readRedirectReason());
    const onStorage = (event) => {
      if (event.key === DEBUG_KEY) updateEnabled();
      if (event.key === REDIRECT_KEY) updateRedirectReason();
    };
    const onRedirectReason = (event) => {
      if (event?.detail) setLastRedirectReason(event.detail);
      else updateRedirectReason();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', updateEnabled);
    window.addEventListener('focus', updateRedirectReason);
    window.addEventListener('qr-flow-redirect-reason', onRedirectReason);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', updateEnabled);
      window.removeEventListener('focus', updateRedirectReason);
      window.removeEventListener('qr-flow-redirect-reason', onRedirectReason);
    };
  }, []);

  if (!debugEnabled) return null;

  const route = `${location.pathname}${location.search || ''}`;
  const selectedEventSummary = selectedEvent
    ? `${selectedEvent.id || 'n/a'} | ${selectedEvent.name || 'Unnamed'}`
    : 'null';
  const redirectReasonSummary = lastRedirectReason
    ? `${lastRedirectReason.reason} (${lastRedirectReason.from} -> ${lastRedirectReason.to})`
    : 'none';

  return (
    <div className="fixed bottom-3 right-3 z-[9999] max-w-sm rounded-md border border-black/20 bg-black/85 p-3 text-xs text-white shadow-2xl">
      <div className="font-semibold">QR Flow Debug</div>
      <div>route: {route}</div>
      <div>userRole: {userRole || 'null'}</div>
      <div>selectedLeagueId: {selectedLeagueId || 'null'}</div>
      <div>selectedEvent: {selectedEventSummary}</div>
      <div>leagues.length: {Array.isArray(leagues) ? leagues.length : 0}</div>
      <div>events.length: {Array.isArray(events) ? events.length : 0}</div>
      <div>noLeague: {String(noLeague)}</div>
      <div className="mt-1 break-words">lastRedirectReason: {redirectReasonSummary}</div>
    </div>
  );
}
