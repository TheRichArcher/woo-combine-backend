import React, { useEffect, useMemo, useState } from 'react';
import { useEvent } from '../context/EventContext';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { getDrillsForEvent } from '../constants/players';

export default function Analytics() {
  const { selectedEvent } = useEvent();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const drills = useMemo(() => getDrillsForEvent(selectedEvent || {}), [selectedEvent]);
  const [selectedDrillKey, setSelectedDrillKey] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('ALL');
  // Reasonable value ranges per drill to avoid skew/outliers
  const DRILL_BOUNDS = {
    '40m_dash': { min: 3, max: 20 },
    'vertical_jump': { min: 0, max: 60 },
    'catching': { min: 0, max: 100 },
    'throwing': { min: 0, max: 100 },
    'agility': { min: 0, max: 100 }
  };

  useEffect(() => {
    const run = async () => {
      if (!selectedEvent) return;
      try {
        setLoading(true);
        const res = await api.get(`/players?event_id=${selectedEvent.id}`);
        setPlayers(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [selectedEvent]);

  const totals = useMemo(() => {
    const sum = (arr, key) => arr.reduce((acc, p) => acc + (Number(p[key]) || 0), 0);
    const countWith = (key) => players.filter(p => p[key] != null && p[key] !== '').length;
    return {
      count: players.length,
      withAnyScore: players.filter(p => ['40m_dash','vertical_jump','catching','throwing','agility'].some(k => p[k] != null)).length,
      avg40: players.length ? (sum(players, '40m_dash') / Math.max(1, countWith('40m_dash'))) : 0,
      avgVertical: players.length ? (sum(players, 'vertical_jump') / Math.max(1, countWith('vertical_jump'))) : 0,
    };
  }, [players]);

  // Age groups for filter
  const ageGroups = useMemo(() => {
    const groups = new Set();
    players.forEach(p => { if (p.age_group) groups.add(p.age_group); });
    return ['ALL', ...Array.from(groups).sort()];
  }, [players]);

  // Initialize drill selection when drills load
  useEffect(() => {
    if (!selectedDrillKey && drills && drills.length > 0) {
      setSelectedDrillKey(drills[0].key);
    }
  }, [drills, selectedDrillKey]);

  const selectedDrill = useMemo(() => drills.find(d => d.key === selectedDrillKey), [drills, selectedDrillKey]);

  const filteredPlayers = useMemo(() => {
    return selectedAgeGroup === 'ALL' ? players : players.filter(p => p.age_group === selectedAgeGroup);
  }, [players, selectedAgeGroup]);

  // Drill stats
  const drillStats = useMemo(() => {
    if (!selectedDrill) return null;
    // Build stable [player,value] pairs to avoid mismatches and duplicates
    const entries = filteredPlayers
      .map(p => {
        const raw = p[selectedDrill.key];
        const value = raw === '' || raw == null ? NaN : Number(raw);
        return Number.isFinite(value) ? { player: p, value } : null;
      })
      .filter(Boolean);
    if (entries.length === 0) return { count: 0 };
    // Filter out-of-range values using sensible bounds to prevent skewed charts
    const bounds = DRILL_BOUNDS[selectedDrill.key] || { min: -Infinity, max: Infinity };
    const inRange = entries.filter(e => e.value >= bounds.min && e.value <= bounds.max);
    const outlierCount = entries.length - inRange.length;
    if (inRange.length === 0) return { count: 0, outliers: outlierCount };
    const values = inRange.map(e => e.value);
    const sorted = [...values].sort((a, b) => a - b);
    const quantile = (arr, q) => {
      if (arr.length === 0) return 0;
      const pos = (arr.length - 1) * q;
      const base = Math.floor(pos);
      const rest = pos - base;
      return arr[base] + (arr[base + 1] - arr[base]) * rest || arr[base];
    };
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = quantile(sorted, 0.5);
    const p75 = quantile(sorted, 0.75);
    const p90 = quantile(sorted, 0.9);
    // Histogram bins: dynamic based on n (sqrt rule), min 3, max 8
    const binCount = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(values.length))));
    const range = max - min || 1;
    const bins = new Array(binCount).fill(0);
    values.forEach(v => {
      const idx = Math.min(binCount - 1, Math.floor(((v - min) / range) * binCount));
      bins[idx] += 1;
    });
    const step = range / binCount;
    const edges = Array.from({ length: binCount }, (_, i) => ({ start: min + i * step, end: i === binCount - 1 ? max : min + (i + 1) * step, count: bins[i] }));
    const topSorted = [...inRange].sort((a, b) => (selectedDrill.lowerIsBetter ? a.value - b.value : b.value - a.value));
    const top5 = topSorted.slice(0, 5).map(e => ({ name: e.player?.name || '—', number: e.player?.number, value: e.value }));
    return { count: values.length, avg, min, max, p50, p75, p90, bins, minValue: min, maxValue: max, step, edges, top5, outliers: outlierCount };
  }, [filteredPlayers, selectedDrill]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/live-standings" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
              <p className="text-sm text-gray-600">{selectedEvent?.name || ''}</p>
            </div>
          </div>
          <div className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            Overview
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="text-center text-gray-600">Loading analytics…</div>
        ) : error ? (
          <div className="text-center text-red-600">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="text-xs text-gray-500">Players</div>
                <div className="text-2xl font-bold text-gray-900">{totals.count}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="text-xs text-gray-500">With Scores</div>
                <div className="text-2xl font-bold text-gray-900">{totals.withAnyScore}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="text-xs text-gray-500">Avg 40-Yard (sec)</div>
                <div className="text-2xl font-bold text-blue-600">{totals.avg40 ? totals.avg40.toFixed(2) : '—'}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <div className="text-xs text-gray-500">Avg Vertical (in)</div>
                <div className="text-2xl font-bold text-blue-600">{totals.avgVertical ? totals.avgVertical.toFixed(1) : '—'}</div>
              </div>
            </div>

            {/* Drill Explorer */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="font-semibold text-gray-900">Drill Explorer</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedAgeGroup}
                    onChange={(e) => setSelectedAgeGroup(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {ageGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <select
                    value={selectedDrillKey}
                    onChange={(e) => setSelectedDrillKey(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {drills.map(d => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedDrill && drillStats?.count > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Histogram */}
                  <div>
                    <div className="text-sm text-gray-700 font-medium mb-2">{selectedDrill.label} distribution ({selectedDrill.unit}) · {selectedDrill.lowerIsBetter ? 'lower is better' : 'higher is better'}</div>
                    <div className="h-40 flex items-end gap-1 border border-gray-200 rounded p-2 bg-gray-50">
                      {drillStats.bins.map((b, i) => {
                        const maxBin = Math.max(...drillStats.bins);
                        const ratio = maxBin ? (b / maxBin) : 0;
                        const height = ratio > 0 ? Math.max(6, Math.round(ratio * 100)) : 0; // ensure visible min height
                        const startVal = drillStats.minValue + (i * (drillStats.maxValue - drillStats.minValue)) / drillStats.bins.length;
                        const start = startVal.toFixed(1);
                        return (
                          <div key={i} className="flex-1 h-full flex flex-col justify-end items-center">
                            <div className="w-full bg-blue-500 rounded-t flex items-end justify-center" style={{ height: `${height}%` }}>
                              {b > 0 && <span className="text-[10px] text-white pb-1">{b}</span>}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">{start}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                      <span>{drillStats.count} values{drillStats.outliers ? ` • ${drillStats.outliers} outliers ignored` : ''}</span>
                      {drillStats.edges?.filter(e => e.count > 0).map((e, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded">
                          {e.start.toFixed(1)}–{e.end.toFixed(1)} {selectedDrill.unit}: {e.count}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats + Top performers */}
                  <div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-gray-50 rounded border p-2 text-center">
                        <div className="text-xs text-gray-500">P50</div>
                        <div className="font-semibold text-gray-900">{drillStats.p50?.toFixed(2)} {selectedDrill.unit}</div>
                      </div>
                      <div className="bg-gray-50 rounded border p-2 text-center">
                        <div className="text-xs text-gray-500">P75</div>
                        <div className="font-semibold text-gray-900">{drillStats.p75?.toFixed(2)} {selectedDrill.unit}</div>
                      </div>
                      <div className="bg-gray-50 rounded border p-2 text-center">
                        <div className="text-xs text-gray-500">P90</div>
                        <div className="font-semibold text-gray-900">{drillStats.p90?.toFixed(2)} {selectedDrill.unit}</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Top Performers · {selectedDrill.lowerIsBetter ? 'best (lowest)' : 'best (highest)'} values</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {drillStats.top5.map((t, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-white rounded border p-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center ${idx===0?'bg-green-600':idx<3?'bg-yellow-500':'bg-gray-500'}`}>{idx+1}</div>
                            <div className="text-gray-900">#{t.number} {t.name}</div>
                          </div>
                          <div className="font-mono text-blue-600">{t.value} {selectedDrill.unit}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No scores yet for this drill and filter.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


