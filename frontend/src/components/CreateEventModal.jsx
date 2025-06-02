import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from '../lib/api';

export default function CreateEventModal({ open, onClose, onCreated }) {
  const { selectedLeagueId, user } = useAuth();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  if (!selectedLeagueId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm relative text-center">
          <h2 className="text-xl font-bold mb-4 text-cmf-primary">Create New Event</h2>
          <div className="text-gray-700 text-base py-8">Please wait while your league loads…</div>
        </div>
      </div>
    );
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const isoDate = date ? new Date(date).toISOString().slice(0, 10) : "";
      const { data: newEvent } = await api.post(`/leagues/${selectedLeagueId}/events`, {
        name,
        date: isoDate
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setName("");
      setDate("");
      if (onCreated) onCreated(newEvent);
      if (onClose) onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-cmf-primary text-2xl font-bold"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4 text-cmf-primary">Create New Event</h2>
        <form onSubmit={handleCreate}>
          <label className="block mb-2 font-semibold">Event Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border-cmf-secondary rounded px-3 py-2 mb-4 focus:ring-cmf-primary focus:border-cmf-primary"
            required
          />
          <label className="block mb-2 font-semibold">Event Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border-cmf-secondary rounded px-3 py-2 mb-4 focus:ring-cmf-primary focus:border-cmf-primary"
            required
          />
          {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}
          <button
            type="submit"
            className="bg-cmf-primary text-white font-bold px-4 py-2 rounded-lg shadow w-full hover:bg-cmf-secondary transition"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Event"}
          </button>
        </form>
      </div>
    </div>
  );
} 