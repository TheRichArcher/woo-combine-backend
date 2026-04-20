import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function Item({ to, onClick, icon, label, desc, disabled }) {
  const base = "w-full px-4 py-4 flex items-start gap-3 text-left transition";
  const content = (
    <>
      <div className="text-xl leading-none mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 truncate">{label}</div>
        <div className="text-sm text-gray-500 mt-0.5">{desc}</div>
      </div>
      <div className="text-gray-300">›</div>
    </>
  );

  if (disabled) {
    return (
      <div className={base + " opacity-50 cursor-not-allowed bg-white"}>
        {content}
      </div>
    );
  }

  if (to) {
    return (
      <Link to={to} className={base + " hover:bg-gray-50"}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={base + " hover:bg-gray-50"}>
      {content}
    </button>
  );
}

export default function More() {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const scannerPath = useMemo(() => {
    if (!selectedEvent?.id) return null;
    return `/events/${selectedEvent.id}/scanner`;
  }, [selectedEvent?.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div>
          <div className="text-xs uppercase font-bold text-gray-500 tracking-wide">More</div>
          <h1 className="text-2xl font-bold text-gray-900">Tools & Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Everything else lives here so Combine Day stays simple.</p>
        </div>

        <Section title="Tools">
          <Item
            icon="🏆"
            label="Draft Room"
            desc="Run a live draft with your roster"
            to="/draft/create"
          />
          <Item
            icon="📥"
            label="Bulk Import"
            desc="Import players and results from CSV"
            to="/players?action=import"
          />
          <Item
            icon="📷"
            label="Camera Scanner"
            desc="Scan score sheets with your phone camera"
            to={scannerPath || '/coach'}
            disabled={!scannerPath}
          />
          <Item
            icon="⚖️"
            label="Scoring Weights"
            desc="Customize what matters most in rankings"
            to="/players?tab=analyze"
          />
          <Item
            icon="🧒"
            label="Age Groups"
            desc="Assign and filter players by age group"
            to="/players?tab=manage"
          />
        </Section>

        <Section title="Management">
          {(userRole === 'organizer' || userRole === 'coach') && (
            <Item
              icon="🧑‍⚖️"
              label="Evaluators"
              desc="Multi-evaluator workflow and grading"
              to="/evaluators"
            />
          )}
          <Item
            icon="🧩"
            label="Team Formation"
            desc="Auto-balance teams from live results"
            to="/team-formation"
          />
          {(userRole === 'organizer' || userRole === 'coach') && (
            <Item
              icon="🏟️"
              label="Sport Templates"
              desc="Choose drills and presets per sport"
              to="/sport-templates"
            />
          )}
          <Item
            icon="🔗"
            label="Event Sharing"
            desc="Share QR codes for staff and viewers"
            to="/event-sharing"
          />
          <Item
            icon="📈"
            label="Analytics"
            desc="Explore performance trends and insights"
            to="/analytics"
          />
        </Section>

        <Section title="Account">
          <Item
            icon="🛠️"
            label="Admin Tools"
            desc="Event setup, permissions, and admin utilities"
            to="/admin"
          />
          <Item
            icon="❓"
            label="Help"
            desc="Get support and common troubleshooting"
            to="/help"
          />
          <Item
            icon="🏷️"
            label="League Settings"
            desc="Switch leagues and events"
            to="/select-league"
          />
        </Section>

        {/* Small escape hatch */}
        <button
          onClick={() => navigate('/coach')}
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          ← Back to Events
        </button>
      </div>
    </div>
  );
}
