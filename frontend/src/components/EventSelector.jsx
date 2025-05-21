import React, { useState } from "react";
import { useEvent } from "../context/EventContext";

export default function EventSelector() {
  const { events, selectedEvent, setSelectedEvent, setEvents } = useEvent();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSelect = (e) => {
    const ev = events.find(ev => ev.id === e.target.value);
    if (ev) setSelectedEvent(ev);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date }),
      });
      if (!res.ok) throw new Error("Failed to create event");
      const newEvent = await res.json();
      setEvents(prev => [newEvent, ...prev]);
      setSelectedEvent(newEvent);
      setShowModal(false);
      setName("");
      setDate("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <select
        value={selectedEvent?.id || ""}
        onChange={handleSelect}
        className="border-cmf-secondary rounded px-3 py-2 focus:ring-cmf-primary focus:border-cmf-primary"
      >
        {events.map(ev => (
          <option key={ev.id} value={ev.id}>
            {ev.name} – {new Date(ev.date).toLocaleDateString()}
          </option>
        ))}
      </select>
      <button
        onClick={() => setShowModal(true)}
        className="bg-cmf-primary text-white font-bold px-4 py-2 rounded-lg shadow hover:bg-cmf-secondary transition"
      >
        Create New Event
      </button>
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm relative">
            <button
              onClick={() => setShowModal(false)}
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
      )}
    </div>
  );
} 