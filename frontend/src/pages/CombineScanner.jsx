import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Camera, RefreshCcw, CheckCircle2, ScanText, Save, AlertTriangle } from 'lucide-react';

import api from '../lib/api';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDrills } from '../hooks/useDrills';
import { useCombineLockState } from '../hooks/useCombineLockState';

import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import CombineLockedBanner from '../components/CombineLockedBanner';

export default function CombineScanner() {
  const { eventId } = useParams();
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const { showError, showSuccess, showInfo } = useToast();

  const { drills, loading: drillsLoading } = useDrills(selectedEvent);
  const { isLocked, lockMessage, handleSubmitError } = useCombineLockState();

  const [status, setStatus] = useState('Ready'); // Ready | Scanning | Saved

  // Roster
  const [rosterLoading, setRosterLoading] = useState(false);
  const [players, setPlayers] = useState([]);
  const [rosterMeta, setRosterMeta] = useState(null);

  // Athlete picker
  const [athleteQuery, setAthleteQuery] = useState('');
  const [athleteOpen, setAthleteOpen] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState(null);

  // Drill
  const [selectedDrill, setSelectedDrill] = useState('');

  // Capture / OCR
  const fileInputRef = useRef(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [ocr, setOcr] = useState(null);
  const [valueInput, setValueInput] = useState('');
  const [scanning, setScanning] = useState(false);

  // UX
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [recentSaves, setRecentSaves] = useState([]);

  const drillDef = useMemo(
    () => drills.find(d => d.key === selectedDrill),
    [drills, selectedDrill]
  );

  const filteredPlayers = useMemo(() => {
    const q = athleteQuery.trim().toLowerCase();
    if (!q) return players;
    return players.filter(p => {
      const name = (p.name || '').toLowerCase();
      const num = (p.number ?? '').toString().toLowerCase();
      const ag = (p.age_group || '').toLowerCase();
      return name.includes(q) || num.includes(q) || ag.includes(q);
    });
  }, [players, athleteQuery]);

  const canScan = !!selectedAthlete && !!selectedDrill && !scanning;
  const canSave = !!selectedAthlete && !!selectedDrill && valueInput !== '' && !scanning && !isLocked;

  const fetchRoster = async () => {
    if (!eventId) return;
    setRosterLoading(true);
    try {
      const { data } = await api.get(`/mobile/events/${eventId}/roster`);
      setPlayers(data.players || []);
      setRosterMeta(data);
    } catch {
      showError('Failed to load roster. Please try again.');
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    if (userRole && !['organizer', 'coach'].includes(userRole)) {
      showInfo('Scanner is available to coaches and organizers only.');
    }
  }, [userRole, showInfo]);

  const resetCapture = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl('');
    setOcr(null);
    setValueInput('');
    setStatus('Ready');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePickImage = async (file) => {
    if (!file) return;
    if (!selectedDrill) {
      showInfo('Select a drill first.');
      return;
    }

    resetCapture();

    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);

    setScanning(true);
    setStatus('Scanning');

    try {
      const form = new FormData();
      form.append('image', file);
      form.append('event_id', eventId);
      form.append('drill_type', selectedDrill);

      const { data } = await api.post('/scanner/ocr', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setOcr(data);
      if (data?.value !== null && data?.value !== undefined) {
        setValueInput(String(data.value));
      } else {
        setValueInput('');
      }
      setStatus('Ready');

      if (data?.value == null) {
        showInfo('Could not confidently read a value. Try another photo or enter manually.');
      }
    } catch {
      showError('OCR failed. Please try again.');
      setOcr(null);
      setValueInput('');
      setStatus('Ready');
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!selectedAthlete || !selectedDrill) return;

    const numeric = Number(valueInput);
    if (!Number.isFinite(numeric)) {
      showError('Enter a valid number.');
      return;
    }

    try {
      await api.post('/drill-results/', {
        player_id: selectedAthlete.id,
        event_id: eventId,
        type: selectedDrill,
        value: numeric
      });

      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        athleteName: selectedAthlete.name,
        drillLabel: drillDef?.label || selectedDrill,
        value: numeric,
        unit: drillDef?.unit || '',
        ts: new Date()
      };

      setRecentSaves(prev => [entry, ...prev].slice(0, 20));
      setStatus('Saved');
      showSuccess('Saved');

      if (autoAdvance) {
        const idx = players.findIndex(p => p.id === selectedAthlete.id);
        const next = idx >= 0 ? players[idx + 1] : null;
        if (next) {
          setSelectedAthlete(next);
          setAthleteQuery(next.name || '');
        }
      }

      resetCapture();
    } catch (err) {
      const analyzed = await handleSubmitError(err);
      showError(analyzed?.userMessage || 'Error saving result.');
    }
  };

  const pillClasses = {
    Ready: 'bg-surface-subtle text-text',
    Scanning: 'bg-brand-primary/15 text-brand-primary',
    Saved: 'bg-semantic-success/15 text-semantic-success'
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-white/70 truncate">
              {selectedEvent?.name || rosterMeta?.event_name || 'Event'}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Combine Scanner</h1>
          </div>
          <div className={["px-3 py-1 rounded-full text-xs font-semibold", pillClasses[status] || pillClasses.Ready].join(' ')}>
            {status}
          </div>
        </div>

        {isLocked && (
          <div className="mt-3">
            <CombineLockedBanner message={lockMessage} />
          </div>
        )}

        {selectedEvent?.id && eventId && selectedEvent.id !== eventId && (
          <div className="mt-3 wc-card p-3 bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-300 mt-0.5" />
              <div className="text-sm text-yellow-100">
                You’re viewing scanner for a different event than the one selected in the header.
                <div className="mt-2">
                  <Link className="underline" to={`/events/${selectedEvent.id}/scanner`}>Go to selected event</Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Athlete</h2>
            <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" onClick={fetchRoster} disabled={rosterLoading}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          <div className="mt-2 relative">
            <Input
              value={athleteQuery}
              onChange={(e) => { setAthleteQuery(e.target.value); setAthleteOpen(true); }}
              onFocus={() => setAthleteOpen(true)}
              placeholder={rosterLoading ? 'Loading roster…' : 'Search name / # / age group'}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              disabled={rosterLoading}
            />

            {selectedAthlete && (
              <div className="mt-2 text-sm text-white/80">
                Selected: <span className="font-semibold">{selectedAthlete.name}</span>
                {selectedAthlete.number ? ` • #${selectedAthlete.number}` : ''}
                {selectedAthlete.age_group ? ` • ${selectedAthlete.age_group}` : ''}
              </div>
            )}

            {athleteOpen && !rosterLoading && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-gray-900 shadow-xl max-h-72 overflow-auto">
                {filteredPlayers.length === 0 ? (
                  <div className="p-3 text-sm text-white/60">No matches</div>
                ) : (
                  filteredPlayers.slice(0, 50).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedAthlete(p); setAthleteQuery(p.name || ''); setAthleteOpen(false); }}
                      className="w-full text-left px-3 py-3 hover:bg-white/5 border-b border-white/5 last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-white/60 truncate">
                            {p.age_group || ''}{p.position ? ` • ${p.position}` : ''}{p.team_name ? ` • ${p.team_name}` : ''}
                          </div>
                        </div>
                        <div className="text-sm text-white/70 whitespace-nowrap">{p.number ? `#${p.number}` : ''}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-white/80">Drill</h2>
          <div className="mt-2">
            {drillsLoading ? (
              <div className="text-sm text-white/60">Loading drills…</div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {drills.map(d => {
                  const active = d.key === selectedDrill;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => { setSelectedDrill(d.key); resetCapture(); }}
                      className={[
                        'px-4 py-3 rounded-xl border text-left min-w-[160px] flex-shrink-0',
                        active ? 'bg-brand-primary/15 border-brand-primary/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
                      ].join(' ')}
                    >
                      <div className="text-sm font-semibold truncate">{d.label || d.key}</div>
                      <div className="text-xs text-white/60">{d.unit || ''}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-white/80">Photo</h2>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handlePickImage(e.target.files?.[0])}
          />

          <div className="mt-2 flex gap-2">
            <Button variant="primary" size="lg" className="flex-1" onClick={() => fileInputRef.current?.click()} disabled={!canScan}>
              {scanning ? (
                <>
                  <ScanText className="w-5 h-5 mr-2" />
                  Scanning…
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5 mr-2" />
                  Take Photo
                </>
              )}
            </Button>

            <Button variant="subtle" size="lg" className="border border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={resetCapture} disabled={scanning}>
              Clear
            </Button>
          </div>

          {imagePreviewUrl && (
            <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black">
              <img src={imagePreviewUrl} alt="Preview" className="w-full object-contain max-h-[360px]" />
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80">Result</h2>
            {ocr && (
              <div className="text-xs text-white/60">
                Confidence: <span className="font-semibold">{Math.round((ocr.confidence || 0) * 100)}%</span>
              </div>
            )}
          </div>

          <div className="mt-2">
            <div className="flex gap-2 items-center">
              <Input
                inputMode="decimal"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                placeholder="Enter value"
                className="text-2xl font-bold bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <div className="text-sm text-white/60 min-w-[56px] text-right">{drillDef?.unit || ''}</div>
            </div>

            {ocr?.all_numbers?.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-white/60 mb-2">Alternatives</div>
                <div className="flex flex-wrap gap-2">
                  {ocr.all_numbers.slice(0, 12).map((n, idx) => (
                    <button
                      key={`${n}-${idx}`}
                      type="button"
                      onClick={() => setValueInput(String(n))}
                      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} />
              Auto-advance athlete
            </label>
            {isLocked && <div className="text-xs text-white/60">Locked</div>}
          </div>

          <Button
            variant={isLocked ? 'subtle' : 'success'}
            size="lg"
            className={isLocked ? 'w-full mt-2 border border-white/10 bg-white/5 text-white' : 'w-full mt-2'}
            onClick={handleSave}
            disabled={!canSave}
          >
            <Save className="w-5 h-5 mr-2" />
            Save Result
          </Button>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-white/80">Recent Saves</h2>
          <div className="mt-2 space-y-2">
            {recentSaves.length === 0 ? (
              <div className="text-sm text-white/60">No saves yet</div>
            ) : (
              recentSaves.map(e => (
                <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{e.athleteName}</div>
                    <div className="text-xs text-white/60 truncate">{e.drillLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold whitespace-nowrap">
                      {e.value}{e.unit ? ` ${e.unit}` : ''}
                    </div>
                    <div className="text-xs text-white/50 whitespace-nowrap">
                      {e.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-10 text-xs text-white/40 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Photos are processed server-side (no on-device OCR).
        </div>
      </div>
    </div>
  );
}
