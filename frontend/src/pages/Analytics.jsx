import React, { useEffect, useMemo, useState } from 'react';
import { useEvent } from '../context/EventContext';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowLeft } from 'lucide-react';
import api from '../lib/api';

export default function Analytics() {
  const { selectedEvent } = useEvent();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-2">Next Up</h2>
              <p className="text-sm text-gray-600">We can add drill distribution charts, percentile ranks, and trendlines here. Let me know which metrics you want first.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


