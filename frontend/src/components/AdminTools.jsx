import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";

const REQUIRED_HEADERS = [
  "name",
  "number",
  "age_group",
  "40m_dash",
  "vertical_jump",
  "catching",
  "throwing",
  "agility",
];
const AGE_GROUPS = ["7-8", "9-10", "11-12"];

const API = import.meta.env.VITE_API_URL;

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split(",").map(cell => cell.trim()));
  return { headers, rows };
}

function validateRow(row, headers) {
  const errors = [];
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = row[i] ?? "";
  });
  // Validate required fields
  if (!obj.name) errors.push("Missing name");
  if (!obj.number || isNaN(Number(obj.number))) errors.push("Invalid number");
  if (!AGE_GROUPS.includes(obj.age_group)) errors.push("Invalid age group");
  // Drill fields
  ["40m_dash", "vertical_jump", "catching", "throwing", "agility"].forEach(drill => {
    if (obj[drill] && isNaN(Number(obj[drill]))) errors.push(`Invalid ${drill}`);
  });
  return { ...obj, errors };
}

export default function AdminTools() {
  const { user, role, selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();

  // Reset tool state
  const [confirmInput, setConfirmInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  // CSV upload state
  const [csvRows, setCsvRows] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvFileName, setCsvFileName] = useState("");

  const [uploadStatus, setUploadStatus] = useState("idle"); // idle | loading | success | error
  const [uploadMsg, setUploadMsg] = useState("");
  const [backendErrors, setBackendErrors] = useState([]);

  const handleReset = async () => {
    if (!selectedEvent) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${API}/players/reset?event_id=${selectedEvent.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Reset failed");
      setStatus("success");
      setConfirmInput("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Error during reset.");
    }
  };

  const handleCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const { headers, rows } = parseCsv(text);
      // Validate headers
      const headerErrors = [];
      if (headers.length !== REQUIRED_HEADERS.length || !REQUIRED_HEADERS.every((h, i) => h === headers[i])) {
        headerErrors.push("Headers must match: " + REQUIRED_HEADERS.join(", "));
      }
      // Validate rows
      const validatedRows = rows.map(row => validateRow(row, headers));
      setCsvHeaders(headers);
      setCsvRows(validatedRows);
      setCsvErrors(headerErrors);
    };
    reader.readAsText(file);
  };

  const allRowsValid = csvErrors.length === 0 && csvRows.length > 0 && csvRows.every(r => r.errors.length === 0);

  const handleUpload = async () => {
    if (!selectedEvent) return;
    setUploadStatus("loading");
    setUploadMsg("");
    setBackendErrors([]);
    try {
      const res = await fetch(`${API}/players/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: selectedEvent.id, players: csvRows.map(({ errors, ...row }) => row) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      if (data.errors && data.errors.length > 0) {
        setBackendErrors(data.errors);
        setUploadStatus("error");
        setUploadMsg("Some rows failed to upload. See errors below.");
      } else {
        setUploadStatus("success");
        setUploadMsg(`Upload successful! ${data.added} players added.`);
        setCsvRows([]);
        setCsvHeaders([]);
        setCsvFileName("");
      }
    } catch (err) {
      setUploadStatus("error");
      setUploadMsg(err.message || "Upload failed.");
    }
  };

  // Onboarding callout for admin
  const AdminOnboardingCallout = () => (
    <div className="bg-cmf-primary/10 border-l-4 border-cmf-primary text-cmf-primary px-4 py-3 mb-6 rounded">
      <strong>Welcome, Admin.</strong> Manage your combine tools below.
    </div>
  );

  // Role-based access logic
  if (!selectedLeagueId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto text-center border-2 border-yellow-200">
          <h2 className="text-2xl font-bold text-yellow-600 mb-4">No League Selected</h2>
          <p className="text-cmf-secondary">Please select a league to use admin tools.</p>
        </div>
      </div>
    );
  }

  if (role !== 'organizer') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto text-center border-2 border-red-200">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Admin Access Required</h2>
          <p className="text-cmf-secondary">You do not have permission to view this page.<br/>Organizer access required.</p>
        </div>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto text-center border-2 border-yellow-200">
          <h2 className="text-2xl font-bold text-yellow-600 mb-4">No Event Selected</h2>
          <p className="text-cmf-secondary">Please select or create an event to use admin tools.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mt-12 max-w-md mx-auto">
      <AdminOnboardingCallout />
      <div className="mb-4 text-lg font-semibold flex items-center gap-2 text-cmf-primary">
        <span role="img" aria-label="event">🏷️</span>
        Managing: {selectedEvent ? `${selectedEvent.name} – ${new Date(selectedEvent.date).toLocaleDateString()}` : "No event selected"}
      </div>
      {/* Reset Tool */}
      <div className="mb-8">
        <label className="block mb-1 font-bold">Type <span className="font-mono">REMOVE</span> to enable reset:</label>
        <input
          type="text"
          value={confirmInput}
          onChange={e => setConfirmInput(e.target.value)}
          className="w-full border-cmf-secondary rounded px-3 py-2 focus:ring-cmf-primary focus:border-cmf-primary"
          disabled={status === "success"}
        />
        <button
          disabled={confirmInput !== "REMOVE" || status === "loading" || status === "success" || !selectedEvent}
          onClick={handleReset}
          className="bg-red-500 text-white font-bold px-4 py-2 rounded-lg shadow mt-2 disabled:opacity-50 hover:bg-red-600 transition"
        >
          {status === "loading" ? "Resetting..." : "Reset All Players"}
        </button>
        {status === "success" && <div className="text-green-600 mt-4">Reset successful!</div>}
        {status === "error" && <div className="text-red-500 mt-4">{errorMsg}</div>}
      </div>
      {/* CSV Upload Tool */}
      <div className="mb-4">
        <label className="block mb-1 font-bold">Bulk CSV Upload</label>
        <input
          type="file"
          accept=".csv"
          onChange={handleCsv}
          className="mb-2"
        />
        {csvFileName && <div className="text-xs text-cmf-secondary mb-2">{csvFileName}</div>}
        {csvErrors.length > 0 && <div className="text-red-500 text-sm mb-2">{csvErrors.join("; ")}</div>}
        {csvRows.length > 0 && csvErrors.length === 0 && (
          <div className="overflow-x-auto max-h-64 border rounded mb-2">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1">#</th>
                  {csvHeaders.map(h => <th key={h} className="px-2 py-1">{h}</th>)}
                  <th className="px-2 py-1">Errors</th>
                </tr>
              </thead>
              <tbody>
                {csvRows.map((row, i) => {
                  const backendError = backendErrors.find(e => e.row === i + 1);
                  return (
                    <tr key={i} className={row.errors.length || backendError ? "bg-red-50" : ""}>
                      <td className="px-2 py-1 font-mono">{i + 1}</td>
                      {csvHeaders.map(h => <td key={h} className="px-2 py-1">{row[h]}</td>)}
                      <td className="px-2 py-1 text-red-500">
                        {[...row.errors, backendError?.message].filter(Boolean).join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <button
          className="bg-cmf-primary text-white font-bold px-4 py-2 rounded-lg shadow disabled:opacity-50 hover:bg-cmf-secondary transition"
          disabled={!allRowsValid || uploadStatus === "loading" || !selectedEvent}
          onClick={handleUpload}
        >
          {uploadStatus === "loading" ? "Uploading..." : "Upload Players"}
        </button>
        {uploadStatus === "success" && <div className="text-green-600 mt-2">{uploadMsg}</div>}
        {uploadStatus === "error" && <div className="text-red-500 mt-2">{uploadMsg}</div>}
      </div>
    </div>
  );
} 