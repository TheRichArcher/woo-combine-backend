import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import EventSelector from "./EventSelector";
import api from '../lib/api';

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
const SAMPLE_ROWS = [
  ["Jane Smith", "23", "9-10", "6.1", "19", "8", "7", "6.8"],
  ["Alex Lee", "45", "11-12", "5.8", "21", "9", "8", "7.2"],
];

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

  // Manual add player state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualPlayer, setManualPlayer] = useState({
    name: '',
    number: '',
    age_group: '',
    "40m_dash": '',
    "vertical_jump": '',
    catching: '',
    throwing: '',
    agility: '',
  });
  const [manualErrors, setManualErrors] = useState([]);
  const [manualStatus, setManualStatus] = useState('idle');
  const [manualMsg, setManualMsg] = useState('');

  const handleReset = async () => {
    if (!selectedEvent || !user || !selectedLeagueId) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      await api.delete(`/players/reset?event_id=${selectedEvent.id}&user_id=${user.uid}&league_id=${selectedLeagueId}`);
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
    if (!selectedEvent || !user || !selectedLeagueId) return;
    setUploadStatus("loading");
    setUploadMsg("");
    setBackendErrors([]);
    try {
      const { data } = await api.post(`/players/upload`, {
        event_id: selectedEvent.id,
        players: csvRows.map(({ errors, ...row }) => row),
        user_id: user.uid,
        league_id: selectedLeagueId
      });
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

  // Manual add player logic
  const handleManualChange = (e) => {
    setManualPlayer({ ...manualPlayer, [e.target.name]: e.target.value });
  };
  const validateManual = () => {
    const errors = [];
    if (!manualPlayer.name) errors.push("Missing name");
    if (!manualPlayer.number || isNaN(Number(manualPlayer.number))) errors.push("Invalid number");
    if (!AGE_GROUPS.includes(manualPlayer.age_group)) errors.push("Invalid age group");
    ["40m_dash", "vertical_jump", "catching", "throwing", "agility"].forEach(drill => {
      if (manualPlayer[drill] && isNaN(Number(manualPlayer[drill]))) errors.push(`Invalid ${drill}`);
    });
    return errors;
  };
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualErrors([]);
    setManualStatus('idle');
    setManualMsg('');
    const errors = validateManual();
    if (errors.length > 0) {
      setManualErrors(errors);
      return;
    }
    setManualStatus('loading');
    try {
      const { data } = await api.post(`/players`, {
        ...manualPlayer,
        number: Number(manualPlayer.number),
        event_id: selectedEvent.id,
        user_id: user.uid,
        league_id: selectedLeagueId
      });
      setManualStatus('success');
      setManualMsg('Player added!');
      setManualPlayer({
        name: '',
        number: '',
        age_group: '',
        "40m_dash": '',
        "vertical_jump": '',
        catching: '',
        throwing: '',
        agility: '',
      });
      setShowManualForm(false);
    } catch (err) {
      setManualStatus('error');
      setManualMsg(err.message || 'Failed to add player.');
    }
  };

  // Download sample CSV
  const handleSampleDownload = () => {
    let csv = REQUIRED_HEADERS.join(",") + "\n";
    SAMPLE_ROWS.forEach(row => {
      csv += row.join(",") + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_players.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    <div className="bg-white rounded-xl shadow-lg p-6 mt-6 max-w-xl mx-auto">
      <EventSelector />
      <AdminOnboardingCallout />
      <div className="mb-4 text-lg font-semibold flex items-center gap-2 text-cmf-primary">
        <span role="img" aria-label="event">🏷️</span>
        Managing: {selectedEvent ? `${selectedEvent.name} – ${new Date(selectedEvent.date).toLocaleDateString()}` : "No event selected"}
      </div>
      {/* Step 2: Add Players Section */}
      <div id="player-upload-section" className="mb-8 p-4 border-2 border-cmf-primary rounded-xl bg-cmf-primary/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-2">
          <h2 className="text-xl font-bold text-cmf-primary">Step 2: Add Players to Your Event</h2>
          <div className="flex gap-2">
            <button
              className="bg-cmf-secondary text-white font-bold px-3 py-1 rounded shadow hover:bg-cmf-primary transition"
              onClick={handleSampleDownload}
            >📄 Download Sample CSV</button>
            <button
              className="bg-cmf-primary text-white font-bold px-3 py-1 rounded shadow hover:bg-cmf-secondary transition"
              onClick={() => setShowManualForm(v => !v)}
            >+ Add Player Manually</button>
          </div>
        </div>
        <div className="text-cmf-secondary mb-2">
          Uploading to: <span className="font-bold">{selectedEvent.name} – {new Date(selectedEvent.date).toLocaleDateString()}</span>
        </div>
        {/* CSV Upload Area */}
        <div className="mb-2">
          <label className="block mb-1 font-bold">Upload CSV File</label>
          <div className="border-2 border-dashed border-cmf-primary rounded-lg p-4 bg-white flex flex-col items-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsv}
              className="mb-2 cursor-pointer"
              style={{ maxWidth: 300 }}
            />
            {csvFileName && <div className="text-xs text-cmf-secondary mb-2">{csvFileName}</div>}
            {csvErrors.length > 0 && <div className="text-red-500 text-sm mb-2">{csvErrors.join("; ")}</div>}
            {csvRows.length > 0 && csvErrors.length === 0 && (
              <div className="overflow-x-auto max-h-64 border rounded mb-2 w-full">
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
              {uploadStatus === "loading" ? "Uploading..." : "Confirm Upload"}
            </button>
            {uploadStatus === "success" && <div className="text-green-600 mt-2">{uploadMsg}</div>}
            {uploadStatus === "error" && <div className="text-red-500 mt-2">{uploadMsg}</div>}
          </div>
        </div>
        {/* Manual Add Player Form */}
        {showManualForm && (
          <form className="mt-4 p-4 border rounded bg-white" onSubmit={handleManualSubmit}>
            <h3 className="font-bold mb-2 text-cmf-primary">Add Player Manually</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input name="name" value={manualPlayer.name} onChange={handleManualChange} placeholder="Name" className="border rounded px-2 py-1" />
              <input name="number" value={manualPlayer.number} onChange={handleManualChange} placeholder="Number" className="border rounded px-2 py-1" />
              <select name="age_group" value={manualPlayer.age_group} onChange={handleManualChange} className="border rounded px-2 py-1">
                <option value="">Age Group</option>
                {AGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input name="40m_dash" value={manualPlayer["40m_dash"]} onChange={handleManualChange} placeholder="40m Dash" className="border rounded px-2 py-1" />
              <input name="vertical_jump" value={manualPlayer["vertical_jump"]} onChange={handleManualChange} placeholder="Vertical Jump" className="border rounded px-2 py-1" />
              <input name="catching" value={manualPlayer["catching"]} onChange={handleManualChange} placeholder="Catching" className="border rounded px-2 py-1" />
              <input name="throwing" value={manualPlayer["throwing"]} onChange={handleManualChange} placeholder="Throwing" className="border rounded px-2 py-1" />
              <input name="agility" value={manualPlayer["agility"]} onChange={handleManualChange} placeholder="Agility" className="border rounded px-2 py-1" />
            </div>
            {manualErrors.length > 0 && <div className="text-red-500 text-sm mt-2">{manualErrors.join(", ")}</div>}
            <div className="flex gap-2 mt-2">
              <button type="submit" className="bg-cmf-primary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-secondary transition" disabled={manualStatus === 'loading'}>
                {manualStatus === 'loading' ? 'Adding...' : 'Add Player'}
              </button>
              <button type="button" className="bg-gray-200 text-cmf-secondary font-bold px-4 py-2 rounded shadow hover:bg-gray-300 transition" onClick={() => setShowManualForm(false)}>
                Cancel
              </button>
            </div>
            {manualStatus === 'success' && <div className="text-green-600 mt-2">{manualMsg}</div>}
            {manualStatus === 'error' && <div className="text-red-500 mt-2">{manualMsg}</div>}
          </form>
        )}
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
    </div>
  );
} 