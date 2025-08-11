import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from '../lib/api';
import { getAllTemplates } from '../constants/drillTemplates';

const getSportIcon = (sport) => {
  switch(sport) {
    case 'Football': return '🏈';
    case 'Soccer': return '⚽';
    case 'Basketball': return '🏀';
    case 'Baseball': return '⚾';
    case 'Track & Field': return '🏃';
    case 'Volleyball': return '🏐';
    default: return '🏆';
  }
};

export default function CreateEventModal({ open, onClose, onCreated }) {
  const { selectedLeagueId, user: _user } = useAuth();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("football");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const templates = getAllTemplates();

  if (!open) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const isoDate = date ? new Date(date).toISOString().slice(0, 10) : "";
      
      const response = await api.post(`/leagues/${selectedLeagueId}/events`, {
        name,
        date: isoDate,
        location,
        drillTemplate: selectedTemplate
      });
      
      const newEvent = {
        id: response.data.event_id,
        name: name,
        date: isoDate,
        created_at: new Date().toISOString()
      };
      
      setName("");
      setDate("");
      setLocation("");
      setSelectedTemplate("football");
      if (onCreated) onCreated(newEvent);
      if (onClose) onClose();
    } catch (err) {
      // Event creation failed
      setError(err.response?.data?.detail || err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="fixed inset-0 flex items-center justify-center wc-overlay z-50">
      <div className="wc-card p-6 w-full max-w-sm relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-brand-primary text-2xl font-bold"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4 text-gray-900">Create New Event</h2>
        <form onSubmit={handleCreate}>
          <label className="block mb-2 font-semibold">Event Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            required
          />
          
          <label className="block mb-2 font-semibold">Sport Template</label>
          <select
            value={selectedTemplate}
            onChange={e => setSelectedTemplate(e.target.value)}
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            required
          >
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {getSportIcon(template.sport)} {template.name}
              </option>
            ))}
          </select>
          
          <label className="block mb-2 font-semibold">Event Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            required
          />
          <label className="block mb-2 font-semibold">Location</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g., Central Park Football Field"
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
          {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}
          <button
            type="submit"
            className="bg-brand-primary text-white font-medium px-4 py-2 rounded-lg shadow w-full hover:opacity-90 transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Event"}
          </button>
        </form>
      </div>
    </div>
  );
} 