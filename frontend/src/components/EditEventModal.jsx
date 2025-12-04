import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import api from '../lib/api';

export default function EditEventModal({ open, onClose, event, onUpdated }) {
  const { selectedLeagueId } = useAuth();
  const { setSelectedEvent, setEvents } = useEvent();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-populate form when event prop changes
  useEffect(() => {
    if (event) {
      setName(event.name || "");
      setDate(event.date || "");
      setLocation(event.location || "");
    }
  }, [event]);

  if (!open || !event) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const isoDate = date ? new Date(date).toISOString().slice(0, 10) : "";
      
      await api.put(`/leagues/${selectedLeagueId}/events/${event.id}`, {
        name,
        date: isoDate,
        location
      });
      
      const updatedEvent = {
        ...event,
        name: name,
        date: isoDate,
        location: location,
        updated_at: new Date().toISOString()
      };
      
      // Update the events list
      setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
      
      // Update selected event if it's the one being edited
      setSelectedEvent(prev => prev && prev.id === event.id ? updatedEvent : prev);
      
      if (onUpdated) onUpdated(updatedEvent);
      if (onClose) onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to update event');
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
        <h2 className="text-xl font-bold mb-4 text-gray-900">Edit Event</h2>
        <form onSubmit={handleUpdate}>
          <label className="block mb-2 font-semibold">Event Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            required
          />
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
            placeholder="e.g., Event Location"
            className="w-full border border-brand-primary/20 rounded px-3 py-2 mb-4 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
          <small className="text-gray-500 text-xs mb-4 block">
            Leave location blank if not determined yet
          </small>
          {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-brand-primary text-white font-medium px-4 py-2 rounded-lg shadow hover:opacity-90 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Event"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 