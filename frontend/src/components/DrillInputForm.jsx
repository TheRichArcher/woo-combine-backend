import React, { useState } from "react";

const DRILL_TYPES = [
  { value: "40m_dash", label: "40M Dash" },
  { value: "vertical_jump", label: "Vertical Jump" },
  { value: "catching", label: "Catching" },
  { value: "throwing", label: "Throwing" },
  { value: "agility", label: "Agility" },
];

export default function DrillInputForm({ playerId, onSuccess }) {
  const [type, setType] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!type || !value) {
      setError("Please select a drill type and enter a value.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/drill-results/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, type, value: parseFloat(value) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to submit result");
      }
      setSuccess("Drill result submitted!");
      setType("");
      setValue("");
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md mx-auto mb-6">
      <h2 className="text-xl font-bold mb-4 text-cmf-primary">Submit Drill Result</h2>
      <div className="mb-4">
        <label className="block mb-1 font-semibold">Drill Type</label>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="w-full border-cmf-secondary rounded px-3 py-2 focus:ring-cmf-primary focus:border-cmf-primary"
          required
        >
          <option value="">Select a drill</option>
          {DRILL_TYPES.map(dt => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label className="block mb-1 font-semibold">Value</label>
        <input
          type="number"
          step="any"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-full border-cmf-secondary rounded px-3 py-2 focus:ring-cmf-primary focus:border-cmf-primary"
          required
        />
      </div>
      {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}
      {success && <div className="text-green-600 mb-2 text-sm">{success}</div>}
      <button
        type="submit"
        className="w-full bg-cmf-primary hover:bg-cmf-secondary text-white font-bold py-2 rounded-lg shadow transition"
        disabled={loading}
      >
        {loading ? "Submitting..." : "Submit Result"}
      </button>
    </form>
  );
} 