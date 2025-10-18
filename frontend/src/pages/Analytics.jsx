import React, { useEffect, useMemo, useState } from 'react';
import { useEvent } from '../context/EventContext';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { getDrillsForEvent } from '../constants/players';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ScatterChart, Scatter, CartesianGrid, ResponsiveContainer, LabelList, Cell } from 'recharts';

export default function Analytics() {
  const { selectedEvent } = useEvent();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const drills = useMemo(() => getDrillsForEvent(selectedEvent || {}), [selectedEvent]);
  const [selectedDrillKey, setSelectedDrillKey] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('ALL');
  const [viewMode, setViewMode] = useState('bar'); // 'bar' | 'simple' | 'histogram'
  // High-contrast palette (no bright yellows)
  const CHART_COLORS = ['#2563eb', '#16a34a', '#ef4444', '#9333ea', '#0ea5e9', '#f59e0b', '#22c55e', '#3b82f6', '#ea580c', '#1d4ed8'];
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

  // Reusable stats computer for any drill
  const computeStatsFor = useMemo(() => {
    return (drill) => {
      if (!drill) return { count: 0, orderedForBars: [], top5: [], bins: [], edges: [] };

      const entries = filteredPlayers
        .map(p => {
          const raw = p[drill.key];
          const value = raw === '' || raw == null ? NaN : Number(raw);
          return Number.isFinite(value) ? { player: p, value } : null;
        })
        .filter(Boolean);

      if (entries.length === 0) {
        return { count: 0, orderedForBars: [], top5: [], bins: [], edges: [] };
      }

      const bounds = DRILL_BOUNDS[drill.key] || { min: -Infinity, max: Infinity };
      const inRange = entries.filter(e => e.value >= bounds.min && e.value <= bounds.max);

      if (inRange.length === 0) {
        return { count: 0, orderedForBars: [], top5: [], bins: [], edges: [], outliers: entries.length };
      }

      const values = inRange.map(e => e.value).sort((a, b) => a - b);

      const quantile = (arr, q) => {
        if (arr.length === 0) return 0;
        const pos = (arr.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        return (arr[base] + ((arr[base + 1] ?? arr[base]) - arr[base]) * rest) || arr[base] || 0;
      };

      const min = values[0];
      const max = values[values.length - 1];

      const orderedForBars = drill.lowerIsBetter
        ? [...inRange].sort((a, b) => a.value - b.value)
        : [...inRange].sort((a, b) => b.value - a.value);

      // Compute simple top5 list used by the sidebar
      const top5 = orderedForBars.slice(0, 5).map(e => ({
        name: e.player?.name,
        number: e.player?.number,
        value: drill.lowerIsBetter ? Number(e.value.toFixed(2)) : Number(e.value.toFixed(2))
      }));

      // Histogram bins for 'histogram' view with adaptive bucket count (4–10 bins)
      const spanValue = Math.max(0.0001, max - min);
      const targetBins = Math.min(10, Math.max(4, Math.round(Math.sqrt(inRange.length) * 2)));
      const numBins = targetBins;
      const bins = new Array(numBins).fill(0);
      const edges = [];
      inRange.forEach(e => {
        const idx = Math.min(numBins - 1, Math.floor(((e.value - min) / spanValue) * numBins));
        bins[idx] += 1;
      });
      for (let i = 0; i < numBins; i += 1) {
        const start = min + (i * spanValue) / numBins;
        const end = min + ((i + 1) * spanValue) / numBins;
        edges.push({ start, end, count: bins[i] });
      }
      const minValue = min;
      const maxValue = max;

      const p25 = quantile(values, 0.25);
      const p50 = quantile(values, 0.5);
      const p75 = quantile(values, 0.75);
      const p90 = quantile(values, 0.9);

      const bestEntry = orderedForBars[0] || null;
      const worstEntry = orderedForBars[orderedForBars.length - 1] || null;

      // Simple bucketization for 'simple' view
      const bestCount = orderedForBars.slice(0, Math.max(1, Math.floor(inRange.length * 0.2))).length;
      const typicalCount = Math.max(0, inRange.length - bestCount - Math.max(1, Math.floor(inRange.length * 0.2)));
      const needsWorkCount = inRange.length - bestCount - typicalCount;

      return {
        count: values.length,
        min,
        max,
        p25,
        p50,
        p75,
        p90,
        orderedForBars,
        top5,
        bestEntry,
        worstEntry,
        bestCount,
        typicalCount,
        needsWorkCount,
        bins,
        edges,
        minValue,
        maxValue,
      };
    };
  }, [filteredPlayers]);

  // Drill stats for currently selected drill (computed via reusable function)
  const drillStats = useMemo(() => computeStatsFor(selectedDrill), [computeStatsFor, selectedDrill]);

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
                  <div className="text-xs bg-gray-100 border border-gray-200 rounded overflow-hidden">
                    <button className={`px-2 py-1 ${viewMode==='bar'?'bg-white':''}`} onClick={() => setViewMode('bar')}>Vertical Bar</button>
                    <button className={`px-2 py-1 ${viewMode==='lollipop'?'bg-white':''}`} onClick={() => setViewMode('lollipop')}>Lollipop</button>
                    <button className={`px-2 py-1 ${viewMode==='simple'?'bg-white':''}`} onClick={() => setViewMode('simple')}>Simple</button>
                    <button className={`px-2 py-1 ${viewMode==='histogram'?'bg-white':''}`} onClick={() => setViewMode('histogram')}>Histogram</button>
                  </div>
                  <select
                    value={selectedAgeGroup}
                    onChange={(e) => setSelectedAgeGroup(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {(ageGroups || []).map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <select
                    value={selectedDrillKey}
                    onChange={(e) => setSelectedDrillKey(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {(drills || []).map(d => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedDrill && drillStats?.count > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Visualization */}
                  {viewMode === 'bar' ? (
                  <div>
                    <div className="text-sm text-gray-700 font-medium">{selectedDrill.label} Scores</div>
                    <div className="text-xs text-gray-500 mb-2">{selectedDrill.lowerIsBetter ? 'lower is better' : 'higher is better'}</div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={drillStats.orderedForBars.slice(0, 10).map((e) => ({ name: e.player.name, score: Number(e.value.toFixed(2)) }))}>
                        <XAxis dataKey="name" label={{ value: 'Player', position: 'bottom' }} />
                        <YAxis label={{ value: `Score (${selectedDrill.unit})`, angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Bar dataKey="score">
                          {drillStats.orderedForBars.slice(0, 10).map((_, idx) => (
                            <Cell key={`bar-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                          <LabelList dataKey="score" position="top" formatter={(v) => `${v} ${selectedDrill.unit}`} fill="#111827" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  ) : viewMode === 'lollipop' ? (
                  <div>
                    <div className="text-sm text-gray-700 font-medium">{selectedDrill.label} Scores (Lollipop Chart)</div>
                    <div className="text-xs text-gray-500 mb-2">{selectedDrill.lowerIsBetter ? 'lower is better' : 'higher is better'}</div>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" name="Player" label={{ value: 'Player', position: 'bottom' }} />
                        <YAxis dataKey="score" name="Score" domain={[0, 'dataMax + 5']} label={{ value: `Score (${selectedDrill.unit})`, angle: -90, position: 'insideLeft' }} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter 
                          name="Scores" 
                          data={drillStats.orderedForBars.slice(0, 10).map((e) => ({ name: e.player.name, score: e.value }))} 
                          line={{ stroke: '#64748b', strokeWidth: 1.5 }} 
                          lineType="joint" 
                          shape="circle" 
                          shapeProps={{ r: 6 }} 
                        >
                          {drillStats.orderedForBars.slice(0, 10).map((_, idx) => (
                            <Cell key={`pt-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} stroke="#111827" />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  ) : viewMode === 'histogram' ? (
                  <div>
                    <div className="text-sm text-gray-700 font-medium mb-2">{selectedDrill.label} distribution ({selectedDrill.unit}) · {selectedDrill.lowerIsBetter ? 'lower is better' : 'higher is better'}</div>
                    <div className="h-40 flex items-end gap-1 border border-gray-200 rounded p-2 bg-gray-50">
                      {drillStats.edges.map((e, i) => {
                        const maxBin = Math.max(...drillStats.bins);
                        const ratio = maxBin ? (e.count / maxBin) : 0;
                        const height = ratio > 0 ? Math.max(6, Math.round(ratio * 100)) : 0;
                        const label = `${e.start.toFixed( e.start % 1 === 0 ? 0 : 1)} - ${e.end.toFixed( e.end % 1 === 0 ? 0 : 1)}`;
                        return (
                          <div key={i} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                            <div className="w-full bg-blue-500 rounded-t flex items-end justify-center" style={{ height: `${height}%` }}>
                              {e.count > 0 && <span className="text-[10px] text-white pb-1">{e.count}</span>}
                            </div>
                            <div className="text-[11px] text-gray-700 mt-1 truncate" title={`${label} ${selectedDrill.unit}`}>{label}</div>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {label}: {e.count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-center text-xs text-gray-500 mt-1">Score ({selectedDrill.unit})</div>
                  </div>
                  ) : (
                  <div>
                    <div className="text-sm text-gray-700 font-medium mb-2">{selectedDrill.label} at a glance</div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="bg-gray-50 rounded border p-3 text-sm">
                        <div>Best: <span className="font-semibold">{drillStats.bestEntry?.value?.toFixed(2)} {selectedDrill.unit}</span> (#{drillStats.bestEntry?.player?.number} {drillStats.bestEntry?.player?.name})</div>
                        <div>Typical range: <span className="font-semibold">{drillStats.p25?.toFixed(2)}–{drillStats.p75?.toFixed(2)} {selectedDrill.unit}</span></div>
                        <div>Needs work: <span className="font-semibold">{drillStats.worstEntry?.value?.toFixed(2)} {selectedDrill.unit}</span> (#{drillStats.worstEntry?.player?.number} {drillStats.worstEntry?.player?.name})</div>
                      </div>
                      {/* Bucket bars */}
                      <div className="space-y-2">
                        {[
                          { label: 'Best', count: drillStats.bestCount, color: 'bg-green-500' },
                          { label: 'Typical', count: drillStats.typicalCount, color: 'bg-yellow-500' },
                          { label: 'Needs work', count: drillStats.needsWorkCount, color: 'bg-gray-400' },
                        ].map((bkt, i) => {
                          const pct = Math.round((bkt.count / drillStats.count) * 100);
                          return (
                            <div key={i} className="text-xs">
                              <div className="flex justify-between mb-1"><span>{bkt.label}</span><span>{bkt.count} of {drillStats.count} ({pct}%)</span></div>
                              <div className="w-full h-3 bg-gray-200 rounded">
                                <div className={`${bkt.color} h-3 rounded`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  )}

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


