import React from 'react';
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
  const isOrganizer = userRole === 'organizer';
  const isCoach = userRole === 'coach';
  const isStaff = isOrganizer || isCoach;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div>
          <div className="text-xs uppercase font-bold text-gray-500 tracking-wide">More</div>
          <h1 className="text-2xl font-bold text-gray-900">{isCoach ? 'Coach Menu' : 'Tools & Settings'}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {isCoach
              ? 'Core workflow is up front. Secondary tools are grouped below.'
              : 'Keep event-day workflow simple with clear core and secondary sections.'}
          </p>
        </div>

        {isStaff && (
          <Section title="Core Workflow">
            <Item
              icon="👥"
              label="Roster"
              desc={isOrganizer ? "Manage your event's players" : 'View and manage your roster'}
              to="/players?tab=manage"
            />
            <Item
              icon="✅"
              label="Check-In"
              desc="Check athletes in and keep attendance current"
              to="/check-in"
            />
            <Item
              icon="📊"
              label="Rankings"
              desc="View standings and adjust scoring views"
              to="/players?tab=analyze"
            />
            <Item
              icon="📝"
              label="Scorecards"
              desc="Generate and share scorecard reports"
              to="/scorecards"
            />
          </Section>
        )}

        {isStaff && (
          <Section title="Secondary Tools">
            <Item
              icon="🗓️"
              label="Schedule"
              desc="Review and plan event schedule details"
              to="/schedule"
            />
            <Item
              icon="🧩"
              label="Teams"
              desc="Auto-balance teams from live results"
              to="/team-formation"
            />
            <Item
              icon="🏆"
              label="Draft"
              desc="Run or manage live draft sessions"
              to="/drafts"
            />
          </Section>
        )}

        {isOrganizer && (
          <Section title="Organizer Tools">
            <Item
              icon="🧑‍⚖️"
              label="Evaluators"
              desc="Manage evaluator setup and grading workflows"
              to="/evaluators"
            />
            <Item
              icon="🏟️"
              label="Sport Templates"
              desc="Configure drills and presets by sport"
              to="/sport-templates"
            />
            <Item
              icon="📈"
              label="Analytics Explorer"
              desc="Explore advanced event performance insights"
              to="/analytics"
            />
            <Item
              icon="🔗"
              label="Event Sharing"
              desc="Share event QR codes for staff and viewers"
              to="/event-sharing"
            />
          </Section>
        )}

        {isOrganizer && (
          <Section title="Operations">
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
              to={selectedEvent?.id ? `/events/${selectedEvent.id}/scanner` : '/coach'}
              disabled={!selectedEvent?.id}
            />
          </Section>
        )}

        {!isStaff && (
          <Section title="Tools">
            <Item
              icon="📊"
              label="Live Standings"
              desc="View current event standings"
              to="/live-standings"
            />
            <Item
              icon="🗓️"
              label="Schedule"
              desc="View event timeline and sessions"
              to="/schedule"
            />
          </Section>
        )}

        <Section title="Account">
          <Item
            icon="🏷️"
            label="League Settings"
            desc="Switch leagues and events"
            to="/select-league"
          />
          {isOrganizer && (
            <Item
              icon="🛠️"
              label="Admin Tools"
              desc="Event setup, permissions, and admin utilities"
              to="/admin"
            />
          )}
          <Item
            icon="❓"
            label="Help"
            desc="Get support and common troubleshooting"
            to="/help"
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
