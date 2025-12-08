import React, { useEffect, useMemo, useState } from 'react';
import { useEvent } from '../context/EventContext';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowLeft, HelpCircle } from 'lucide-react';
import api from '../lib/api';
import { useDrills } from '../hooks/useDrills';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ScatterChart, Scatter, CartesianGrid, ResponsiveContainer, LabelList, Cell } from 'recharts';

export default function Analytics() {
  const { selectedEvent } = useEvent();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Unified Drills Hook
  const { drills } = useDrills(selectedEvent);

  const [selectedDrillKey, setSelectedDrillKey] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('ALL');
  const [viewMode, setViewMode] = useState('bar'); // 'bar' | 'simple' | 'histogram'
  const [labelMode, setLabelMode] = useState('number'); // 'number' | 'name'
  
  // High-contrast palette (no bright yellows)
  const CHART_COLORS = ['#2563eb', '#16a34a', '#ef4444', '#9333ea', '#0ea5e9', '#f59e0b', '#22c55e', '#3b82f6', '#ea580c', '#1d4ed8'];

  // Helper to color-code histogram bins from green (best) → orange → red (worst)
  const getBinColor = (index, total, lowerIsBetter, count) => {
    if (!count) return '#d1d5db'; // grey for empty bins
    const tBase = total > 0 ? (index + 0.5) / total : 1; // use bin midpoint for smoother thresholds
    const t = lowerIsBetter ? tBase : (1 - tBase);       // map so t=0 is best
    if (t < 0.33) return '#16a34a'; // green
    if (t < 0.66) return '#f59e0b'; // orange
    return '#ef4444';               // red
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
    // Use player.scores for all calculations (replaces legacy flattened access)
    const sum = (arr, key) => arr.reduce((acc, p) => acc + (Number(p.scores?.[key]) || 0), 0);
    const countWith = (key) => players.filter(p => p.scores?.[key] != null && p.scores?.[key] !== '').length;
    
    // Dynamically find top 2 drills to display in summary cards
    const topDrills = drills.slice(0, 2);
    
    const drillStats = topDrills.map(d => ({
      label: d.label,
      unit: d.unit,
      avg: players.length ? (sum(players, d.key) / Math.max(1, countWith(d.key))) : 0
    }));

    return {
      count: players.length,
      withAnyScore: players.filter(p => drills.some(d => p.scores?.[d.key] != null && p.scores?.[d.key] !== '')).length,
      drillStats
    };
  }, [players, drills]);

  // Age groups for filter
  const ageGroups = useMemo(() => {
    const groups = new Set();
    players.forEach(p => { if (p.age_group) groups.add(p.age_group); });
    return ['ALL', ...Array.from(groups).sort()];
  }, [players]);

  // Initialize drill selection when drills available
  useEffect(() => {
    // Check if current selected key is valid in new drills list
    const isValidKey = selectedDrillKey && drills.some(d => d.key === selectedDrillKey);
    
    if ((!selectedDrillKey || !isValidKey) && drills && drills.length > 0) {
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
          // Use player.scores to access drill data
          const raw = p.scores?.[drill.key];
          const value = raw === '' || raw == null ? NaN : Number(raw);
          return Number.isFinite(value) ? { player: p, value } : null;
        })
        .filter(Boolean);

      if (entries.length === 0) {
        return { count: 0, orderedForBars: [], top5: [], bins: [], edges: [] };
      }

      const bounds = {
        min: (drill.min_value !== undefined && drill.min_value !== null) ? Number(drill.min_value) : -Infinity, 
        max: (drill.max_value !== undefined && drill.max_value !== null) ? Number(drill.max_value) : Infinity
      };
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

      // Helper to resolve display label (Number > Initials > ?)
      const getAxisLabel = (p) => {
        const num = p.jersey_number || p.number;
        const hasNum = num !== undefined && num !== null && num !== '';
        
        // Mode: Numbers (Default)
        if (labelMode === 'number') {
            if (hasNum) return `#${num}`;
            // Fallback to External ID if available (last 4 chars)
            if (p.external_id) {
                const ext = String(p.external_id);
                return `…${ext.slice(-4)}`;
            }
            return 'N/A';
        }
        
        // Mode: Names
        if (labelMode === 'name') {
            if (p.name) {
                const parts = p.name.trim().split(/\s+/);
                // Return Last Name for readability on axis, unless full name is short
                if (p.name.length < 10) return p.name;
                return parts.length > 1 ? parts[parts.length-1] : p.name;
            }
            if (hasNum) return `#${num}`;
        }

        return '?';
      };

      const orderedForBars = (drill.lowerIsBetter
        ? [...inRange].sort((a, b) => a.value - b.value)
        : [...inRange].sort((a, b) => b.value - a.value)
      ).map(e => ({ ...e, displayLabel: getAxisLabel(e.player) }));

      // DEBUG: Log sample data for verification
      if (orderedForBars.length > 0) {
        console.log("Analytics: Sample Player", orderedForBars[0].player);
        console.log("Analytics: Sample Chart Data", orderedForBars[0]);
      }

      // Compute simple top5 list used by the sidebar
      const top5 = orderedForBars.slice(0, 5).map(e => ({
        name: e.player?.name,
        number: e.player?.jersey_number || e.player?.number,
        displayLabel: e.displayLabel,
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

      const p10 = quantile(values, 0.10);
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
        p10,
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
  }, [filteredPlayers, labelMode]);

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
          <div className="text-xs bg-brand-accent/10 text-brand-accent px-3 py-1 rounded-full font-medium flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            Overview
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="text-center text-gray-600">Loading analytics…</div>
        ) : error ? (
          <div className="text-center text-semantic-error">{error}</div>
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
              {totals.drillStats.map((stat, idx) => (
                <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                  <div className="text-xs text-gray-500">Avg {stat.label} ({stat.unit})</div>
                  <div className="text-2xl font-bold text-brand-primary">{stat.avg ? stat.avg.toFixed(2) : '—'}</div>
                </div>
              ))}
            </div>

            {/* Drill Explorer */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <h2 className="font-semibold text-gray-900">Drill Explorer</h2>
                <div className="flex flex-wrap items-center gap-2">
                  
                  {/* View Toggles */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium hidden sm:inline">View:</span>
                    <div className="text-xs bg-gray-100 border border-gray-200 rounded overflow-hidden flex">
                        <button className={`px-2 py-1 ${viewMode==='bar'?'bg-white font-medium shadow-sm':''}`} onClick={() => setViewMode('bar')}>Bar</button>
                        <button className={`px-2 py-1 ${viewMode==='lollipop'?'bg-white font-medium shadow-sm':''}`} onClick={() => setViewMode('lollipop')}>Lollipop</button>
                        <button className={`px-2 py-1 ${viewMode==='simple'?'bg-white font-medium shadow-sm':''}`} onClick={() => setViewMode('simple')}>Simple</button>
                        <button className={`px-2 py-1 ${viewMode==='histogram'?'bg-white font-medium shadow-sm':''}`} onClick={() => setViewMode('histogram')}>Histogram</button>
                    </div>
                  </div>

                  {/* Label Toggles (only for charts) */}
                  {(viewMode === 'bar' || viewMode === 'lollipop') && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium hidden sm:inline">Labels:</span>
                        <div className="text-xs bg-gray-100 border border-gray-200 rounded overflow-hidden flex">
                            <button className={`px-2 py-1 ${labelMode==='number'?'bg-white font-medium shadow-sm':''}`} onClick={() => setLabelMode('number')}>#</button>
                            <button className={`px-2 py-1 ${labelMode==='name'?'bg-white font-medium shadow-sm':''}`} onClick={() => setLabelMode('name')}>Names</button>
                        </div>
                    </div>
                  )}

                  <div className="h-4 w-px bg-gray-300 hidden sm:block mx-1"></div>

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
                      <BarChart data={drillStats.orderedForBars.slice(0, 10).map((e) => ({ 
                        name: e.player.name, 
                        number: e.player.jersey_number || e.player.number || '?',
                        external_id: e.player.external_id,
                        axisLabel: e.displayLabel,
                        score: Number(e.value.toFixed(2)) 
                      }))}>
                        <XAxis dataKey="axisLabel" label={{ value: labelMode === 'number' ? 'Player Number' : 'Player Name', position: 'bottom' }} />
                        <YAxis label={{ value: `Score (${selectedDrill.unit})`, angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          cursor={{ fill: 'transparent' }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-2 border border-gray-200 shadow-sm rounded text-sm">
                                  <div className="font-bold text-gray-900">{data.name}</div>
                                  <div className="text-gray-600 mb-1 flex items-center gap-1">
                                    <span className="bg-gray-100 text-gray-700 px-1.5 rounded text-xs font-mono">#{data.number}</span>
                                  </div>
                                  <div className="font-mono font-semibold text-brand-primary mt-1">
                                    {data.score} {selectedDrill.unit}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
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
                        <XAxis dataKey="axisLabel" name="Player" label={{ value: 'Player', position: 'bottom' }} />
                        <YAxis dataKey="score" name="Score" domain={[0, 'dataMax + 5']} label={{ value: `Score (${selectedDrill.unit})`, angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-2 border border-gray-200 shadow-sm rounded text-sm">
                                  <div className="font-bold text-gray-900">{data.name}</div>
                                  <div className="text-gray-600 mb-1">{data.axisLabel}</div>
                                  <div className="font-mono font-semibold text-brand-primary">
                                    {data.score} {selectedDrill.unit}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter 
                          name="Scores" 
                          data={drillStats.orderedForBars.slice(0, 10).map((e) => ({ 
                            name: e.player.name, 
                            axisLabel: e.displayLabel,
                            score: e.value 
                          }))} 
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
                        const color = getBinColor(i, drillStats.edges.length, selectedDrill.lowerIsBetter, e.count);
                        return (
                          <div key={i} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                            <div className="w-full rounded-t flex items-end justify-center" style={{ height: `${height}%`, backgroundColor: color }}>
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
                        <div>Best: <span className="font-semibold">{drillStats.bestEntry?.value?.toFixed(2)} {selectedDrill.unit}</span> ({drillStats.bestEntry?.player?.jersey_number || drillStats.bestEntry?.player?.number ? `#${drillStats.bestEntry?.player?.jersey_number || drillStats.bestEntry?.player?.number}` : ''} {drillStats.bestEntry?.player?.name})</div>
                        <div>Typical range: <span className="font-semibold">{drillStats.p25?.toFixed(2)}–{drillStats.p75?.toFixed(2)} {selectedDrill.unit}</span></div>
                        <div>Needs work: <span className="font-semibold">{drillStats.worstEntry?.value?.toFixed(2)} {selectedDrill.unit}</span> ({drillStats.worstEntry?.player?.jersey_number || drillStats.worstEntry?.player?.number ? `#${drillStats.worstEntry?.player?.jersey_number || drillStats.worstEntry?.player?.number}` : ''} {drillStats.worstEntry?.player?.name})</div>
                      </div>
                      {/* Bucket bars */}
                      <div className="space-y-2">
                        {[
                          { label: 'Best', count: drillStats.bestCount, color: 'bg-semantic-success' },
                          { label: 'Typical', count: drillStats.typicalCount, color: 'bg-semantic-warning' },
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
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {selectedDrill.lowerIsBetter ? (
                        <>
                          <div className="bg-gray-50 rounded border p-2 text-center">
                            <div className="text-xs text-gray-500" title="P50: the middle score (half of scores are below, half above)" aria-label="P50, the middle score">P50</div>
                            <div className="font-semibold text-gray-900">{drillStats.p50?.toFixed(2)} {selectedDrill.unit}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Middle score</div>
                          </div>
                          <div className="bg-gray-50 rounded border p-2 text-center">
                            <div className="text-xs text-gray-500" title="P25: top 25% cutoff (lower is better)" aria-label="P25, top 25% cutoff">P25</div>
                            <div className="font-semibold text-gray-900">{drillStats.p25?.toFixed(2)} {selectedDrill.unit}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Top 25% cutoff</div>
                          </div>
                          <div className="bg-gray-50 rounded border p-2 text-center">
                            <div className="text-xs text-gray-500" title="P10: top 10% cutoff (lower is better)" aria-label="P10, top 10% cutoff">P10</div>
                            <div className="font-semibold text-gray-900">{drillStats.p10?.toFixed(2)} {selectedDrill.unit}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Top 10% cutoff</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-50 rounded border p-2 text-center">
                            <div className="text-xs text-gray-500" title="P50: the middle score (half of scores are below, half above)" aria-label="P50, the middle score">P50</div>
                            <div className="font-semibold text-gray-900">{drillStats.p50?.toFixed(2)} {selectedDrill.unit}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Middle score</div>
                          </div>
                          <div className="bg-gray-50 rounded border p-2 text-center">
                            <div className="text-xs text-gray-500" title="P75: top 25% cutoff (higher is better)" aria-label="P75, top 25% cutoff">P75</div>
                            <div className="font-semibold text-gray-900">{drillStats.p75?.toFixed(2)} {selectedDrill.unit}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Top 25% cutoff</div>
                          </div>
                          <div className="bg-gray-50 rounded border p-2 text-center">
                            <div className="text-xs text-gray-500" title="P90: top 10% cutoff (higher is better)" aria-label="P90, top 10% cutoff">P90</div>
                            <div className="font-semibold text-gray-900">{drillStats.p90?.toFixed(2)} {selectedDrill.unit}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">Top 10% cutoff</div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      <span>{selectedDrill.lowerIsBetter ? 'We show P50 (middle), plus P25 and P10 to mark the top 25% and top 10% performers (lower is better).' : 'We show P50 (middle), plus P75 and P90 to mark the top 25% and top 10% performers (higher is better).'}</span>
                    </div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Top Performers · {selectedDrill.lowerIsBetter ? 'best (lowest)' : 'best (highest)'} values</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {drillStats.top5.map((t, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-white rounded border p-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center ${idx===0?'bg-semantic-success':idx<3?'bg-semantic-warning':'bg-gray-500'}`}>{idx+1}</div>
                            <div className="text-gray-900">{t.number ? `#${t.number}` : ''} {t.name}</div>
                          </div>
                          <div className="font-mono text-brand-primary">{t.value} {selectedDrill.unit}</div>
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
