import React, { useState } from 'react';
import api from '../lib/api';
import { parseRegistrationCsv, prepareRegistrationImport } from '../utils/registrationImport';

export default function RegistrationImport({ draftId, ageGroup, existingPlayers, onImported }) {
  const [rows, setRows] = useState([]);
  const [division, setDivision] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const divisions = [...new Set(rows.map(r => r.registration_division))];
  const preview = rows.filter(r => r.registration_division === division);
  async function readFile(event) {
    setRows([]); setDivision(''); setError('');
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) throw new Error('Please use a CSV smaller than 5 MB.');
      setRows(parseRegistrationCsv(await file.text()));
    } catch (e) { setError(e.message); }
    event.target.value = '';
  }
  async function importPlayers() {
    setBusy(true); setError('');
    try {
      // Refresh before duplicate detection so a prior import cannot be silently repeated.
      const response = await api.get(`/drafts/${draftId}/players`);
      const latest = response.data.players || response.data;
      const players = prepareRegistrationImport(rows, division, Array.isArray(latest) ? latest : existingPlayers, ageGroup);
      await api.post(`/drafts/${draftId}/players/bulk`, { players });
      setRows([]); setDivision('');
      await onImported();
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setBusy(false); }
  }
  return <div className="border rounded-lg p-3 mb-4 space-y-2">
    <label className="block font-medium">Import SportsConnect CSV
      <input type="file" accept=".csv,text/csv" disabled={busy} onChange={readFile} className="block text-sm mt-2" />
    </label>
    <p className="text-xs text-gray-600">Choose a participant export for parent ability, seasons played and previous team. Enrollment exports may omit these answers. No contact or payment details are imported.</p>
    {rows.length > 0 && <>
      <label className="block text-sm">Source division
        <select value={division} onChange={e => setDivision(e.target.value)} disabled={busy} className="block border p-2 w-full">
          <option value="">Select the division to import</option>
          {divisions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      {preview.length > 0 && <>
        <p className="text-sm">{preview.length} players will be added to this draft{ageGroup ? ` (${ageGroup})` : ''}. Confirm that this is the correct division.</p>
        <p className="text-xs">Parent ability: {preview.filter(p => p.parent_reported_ability).length}; previous team: {preview.filter(p => p.registration_previous_team).length}; seasons played: {preview.filter(p => p.parent_reported_experience).length}. Blank answers remain unreported. Parent ability does not set measured scores or ranking.</p>
        <ul className="text-sm max-h-32 overflow-auto">{preview.map((p, i) => <li key={i}>{p.name}</li>)}</ul>
        <button type="button" disabled={busy} onClick={importPlayers} className="rounded bg-blue-600 text-white px-3 py-2">{busy ? 'Importing…' : 'Confirm and import this division'}</button>
      </>}
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
