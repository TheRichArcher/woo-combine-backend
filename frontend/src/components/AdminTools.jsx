import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import EventSelector from "./EventSelector";
import api from '../lib/api';
import QRCode from 'react-qr-code';
import { Upload, UserPlus, RefreshCcw, Users, Copy, Link2, QrCode } from 'lucide-react';
import CreateEventModal from "./CreateEventModal";

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
  const rowWarnings = [];
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = row[i] ?? "";
  });
  if (!obj.name) rowWarnings.push("Missing name");
  if (obj.number && isNaN(Number(obj.number))) rowWarnings.push("Invalid number");
  if (obj.age_group && !["7-8", "9-10", "11-12"].includes(obj.age_group)) rowWarnings.push("Invalid age group");
  ["40m_dash", "vertical_jump", "catching", "throwing", "agility"].forEach(drill => {
    if (obj[drill] && isNaN(Number(obj[drill]))) rowWarnings.push(`Invalid ${drill}`);
  });
  return { ...obj, warnings: rowWarnings };
}

export default function AdminTools() {
  const { user, role, userRole, selectedLeagueId, leagues } = useAuth();
  const { selectedEvent, setEvents, setSelectedEvent } = useEvent();

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

  // Player count state
  const [playerCount, setPlayerCount] = useState(0);
  const [playerCountLoading, setPlayerCountLoading] = useState(false);
  const fileInputRef = useRef();

  // Invite to League section state
  const [showQr, setShowQr] = useState(false);
  const league = leagues?.find(l => l.id === selectedLeagueId);
  const joinCode = league?.id || '';
  const inviteLink = joinCode ? `https://woo-combine.com/join?code=${joinCode}` : '';

  const [showCreateEvent, setShowCreateEvent] = useState(false);

  // Scroll to player upload section if hash is present or changes
  useEffect(() => {
    const scrollToSection = () => {
      if (window.location.hash === '#player-upload-section') {
        const section = document.getElementById('player-upload-section');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      }
    };
    scrollToSection();
    window.addEventListener('hashchange', scrollToSection);
    return () => window.removeEventListener('hashchange', scrollToSection);
  }, []);

  // QA logging
  useEffect(() => {
    console.log('[AdminTools] mount');
    console.log('[AdminTools] userRole:', userRole);
    console.log('[AdminTools] selectedEvent:', selectedEvent);
  }, [userRole, selectedEvent]);

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

  const allRowsValid = csvErrors.length === 0 && csvRows.length > 0 && csvRows.every(r => r.warnings.length === 0);

  // Fetch player count for summary badge
  const fetchPlayerCount = async () => {
    if (!selectedEvent || !user || !selectedLeagueId) return;
    setPlayerCountLoading(true);
    try {
      const { data } = await api.get(`/players?event_id=${selectedEvent.id}&user_id=${user.uid}&league_id=${selectedLeagueId}`);
      setPlayerCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setPlayerCount(0);
    } finally {
      setPlayerCountLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayerCount();
    // eslint-disable-next-line
  }, [selectedEvent]);

  // Call this after upload or manual add
  const handlePostUploadSuccess = () => {
    fetchPlayerCount();
  };

  const handleUpload = async () => {
    if (!selectedEvent || !user || !selectedLeagueId) return;
    setUploadStatus("loading");
    setUploadMsg("");
    const payload = {
      event_id: selectedEvent.id,
      players: csvRows.map(row => { const { warnings: _warnings, ...rest } = row; return rest; })
    };
    console.log("Uploading players:", payload);
    try {
      const token = await user.getIdToken();
      const res = await api.post(`/players/bulk`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Upload response:", res);
      const { data } = res;
      if (data.errors && data.errors.length > 0) {
        setUploadStatus("error");
        setUploadMsg("Some rows failed to upload. See errors below.");
      } else {
        setUploadStatus("success");
        setUploadMsg(`✅ Upload successful! ${data.added} players added.`);
        setCsvRows([]);
        setCsvHeaders([]);
        setCsvFileName("");
        handlePostUploadSuccess();
      }
    } catch (err) {
      setUploadStatus("error");
      setUploadMsg(`❌ ${err.message || "Upload failed."}`);
    }
  };

  // Manual add player logic
  const handleManualChange = (e) => {
    setManualPlayer({ ...manualPlayer, [e.target.name]: e.target.value });
  };
  const validateManual = () => {
    const errors = [];
    if (!manualPlayer.name) errors.push("Missing name");
    if (manualPlayer.number && isNaN(Number(manualPlayer.number))) errors.push("Invalid number");
    if (manualPlayer.age_group && !AGE_GROUPS.includes(manualPlayer.age_group)) errors.push("Invalid age group");
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
      const playerPayload = {
        name: manualPlayer.name,
        number: Number(manualPlayer.number),
        age_group: manualPlayer.age_group,
      };
      if (manualPlayer.photo_url) playerPayload.photo_url = manualPlayer.photo_url;
      await api.post(`/players`, playerPayload);
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
      handlePostUploadSuccess();
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

  // Drill score tooltip
  const drillTip = "Score range: 1–10. Use decimals for precision (e.g., 7.5)";

  // Reupload button handler
  const handleReupload = () => {
    setCsvRows([]);
    setCsvHeaders([]);
    setCsvErrors([]);
    setCsvFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (userRole !== 'organizer') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto text-center border-2 border-red-200">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Admin Access Required</h2>
          <p className="text-cmf-secondary">You do not have permission to view this page.<br/>Organizer access required.</p>
        </div>
      </div>
    );
  }

  if (!selectedEvent || !selectedEvent.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto text-center border-2 border-yellow-200">
          <h2 className="text-2xl font-bold text-yellow-600 mb-4">No Event Selected</h2>
          <p className="text-cmf-secondary mb-4">Before importing players, you'll need to create an event.</p>
          <button
            className="bg-cmf-primary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-secondary transition"
            onClick={() => setShowCreateEvent(true)}
          >
            + Create New Event
          </button>
        </div>
        <CreateEventModal
          open={showCreateEvent}
          onClose={() => setShowCreateEvent(false)}
          onCreated={async event => {
            setShowCreateEvent(false);
            if (!user || !selectedLeagueId) return;
            try {
              const token = await user.getIdToken();
              const url = `/leagues/${selectedLeagueId}/events`;
              const { data } = await api.get(url, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (Array.isArray(data)) setEvents(data);
              else setEvents([]);
              const found = Array.isArray(data) ? data.find(e => e.event_id === event.event_id) : null;
              if (found) setSelectedEvent(found);
              else if (Array.isArray(data) && data.length > 0) setSelectedEvent(data[0]);
              setTimeout(() => {
                const section = document.getElementById('player-upload-section');
                if (section) section.scrollIntoView({ behavior: 'smooth' });
              }, 300);
            } catch {
              setEvents(prev => Array.isArray(prev) ? [event, ...prev] : [event]);
              setSelectedEvent(event);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 mt-8">
      <div className="rounded-2xl shadow-sm bg-white border border-gray-200 py-4 px-5 mb-6">
        <EventSelector />
        {/* Player Upload Summary Badge */}
        {selectedEvent && (
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center bg-cmf-primary/10 border border-cmf-primary text-cmf-primary font-bold px-4 py-2 rounded-full text-base">
              <span role="img" aria-label="player">🧍</span>
              {playerCountLoading ? (
                <span className="ml-2 animate-pulse">Loading...</span>
              ) : (
                <span className="ml-2">{playerCount} Players Uploaded to: {selectedEvent.name} – {selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) ? new Date(selectedEvent.date).toLocaleDateString() : "Invalid Date"}</span>
              )}
            </span>
          </div>
        )}
        <AdminOnboardingCallout />
        <div className="mb-4 text-lg font-semibold flex items-center gap-2 text-gray-900">
          <span role="img" aria-label="event">🏷️</span>
          Managing: {selectedEvent ? `${selectedEvent.name} – ${selectedEvent.date && !isNaN(Date.parse(selectedEvent.date)) ? new Date(selectedEvent.date).toLocaleDateString() : "Invalid Date"}` : "No event selected"}
        </div>
        {/* Step 2: Add Players Section */}
        <div id="player-upload-section" className="mb-8">
          <div className="mb-2">
            <div className="text-xs font-bold text-gray-500 tracking-wide uppercase mb-1">Step 2</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Add Players to Your Event</h2>
            <div className="flex gap-2 mb-2">
              <button
                className="bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition"
                onClick={handleSampleDownload}
              >
                <Upload className="inline-block mr-2 w-4 h-4" />Sample CSV
              </button>
              <button
                className="bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition"
                onClick={() => setShowManualForm(v => !v)}
              >
                + Add Player Manually
              </button>
            </div>
            <div className="text-sm text-gray-600 mb-2">
              Uploading to: <span className="font-bold">{selectedEvent.name} – {new Date(selectedEvent.date).toLocaleDateString()}</span>
            </div>
            {/* CSV Upload Dropzone */}
            <div className="border-dashed border-2 border-blue-300 bg-blue-50 p-5 rounded-xl text-center text-sm text-gray-600 flex flex-col items-center">
              <Upload className="w-8 h-8 text-blue-400 mb-2" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsv}
                className="mb-2 cursor-pointer"
                style={{ maxWidth: 300 }}
              />
              {csvFileName && <div className="text-xs text-gray-500 mb-2">{csvFileName}</div>}
              {csvErrors.length > 0 && <div className="text-red-500 text-sm mb-2">{csvErrors.join('; ')}</div>}
              {Array.isArray(csvRows) && csvRows.length > 0 && csvErrors.length === 0 && (
                <div className="overflow-x-auto max-h-64 border rounded mb-2 w-full">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr>
                        <th className="px-2 py-1">{/* Validation Icon */}</th>
                        <th className="px-2 py-1">#</th>
                        {Array.isArray(csvHeaders) && csvHeaders.length > 0 && (
                          csvHeaders.map(h => (
                            <th key={h} className="px-2 py-1">
                              {h.replace(/_/g, ' ').replace('m dash', 'm Dash').replace(/\b\w/g, l => l.toUpperCase())}
                              {["40m_dash", "vertical_jump", "catching", "throwing", "agility"].includes(h) && (
                                <span className="ml-1 cursor-pointer" title={drillTip}>ℹ️</span>
                              )}
                            </th>
                          ))
                        )}
                        <th className="px-2 py-1">Warnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(csvRows) && csvRows.length > 0 && csvRows.map((row, i) => {
                        const hasWarnings = row.warnings.length > 0;
                        return (
                          <tr key={i} className={hasWarnings ? "bg-yellow-50" : ""}>
                            <td className="px-2 py-1 text-center">
                              {hasWarnings ? (
                                <span
                                  className="text-yellow-500 cursor-pointer"
                                  title={row.warnings.join(", ")}
                                >❌</span>
                              ) : (
                                <span className="text-green-600">✅</span>
                              )}
                            </td>
                            <td className="px-2 py-1 font-mono">{i + 1}</td>
                            {Array.isArray(csvHeaders) && csvHeaders.length > 0 && csvHeaders.map(h => <td key={h} className="px-2 py-1">{row[h]}</td>)}
                            <td className="px-2 py-1 text-yellow-600">
                              {row.warnings && row.warnings.length > 0 ? row.warnings.join(", ") : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Reupload Button */}
              {Array.isArray(csvRows) && csvRows.length > 0 && (
                <button
                  className="mt-2 bg-cmf-secondary text-white font-bold px-4 py-2 rounded shadow hover:bg-cmf-primary transition"
                  onClick={handleReupload}
                  type="button"
                >🔁 Upload Another CSV</button>
              )}
              <button
                className="bg-cmf-primary text-white font-bold px-4 py-2 rounded-lg shadow disabled:opacity-50 hover:bg-cmf-secondary transition mt-2"
                disabled={!allRowsValid || uploadStatus === "loading" || !selectedEvent}
                onClick={handleUpload}
              >
                {uploadStatus === "loading" ? "Uploading..." : "Confirm Upload"}
              </button>
              {uploadStatus === "success" && <div className="text-green-600 mt-2">{uploadMsg}</div>}
              {uploadStatus === "error" && <div className="text-red-500 mt-2">{uploadMsg}</div>}
            </div>
          </div>
        </div>
        {/* Manual Add Player Form */}
        {showManualForm && (
          <div className="rounded-2xl shadow-sm bg-white border border-gray-200 py-4 px-5 mb-6" id="manual-add-form-section">
            <div className="text-xs font-bold text-gray-500 tracking-wide uppercase mb-1 flex items-center gap-2"><UserPlus className="w-4 h-4" />Manual Add</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Player Manually</h3>
            <form onSubmit={async (e) => {
              await handleManualSubmit(e);
              // After submit, scroll to the form and show success
              if (manualStatus === 'success') {
                const el = document.getElementById('manual-add-form-section');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input name="name" value={manualPlayer.name} onChange={handleManualChange} placeholder="Name" className="border rounded px-2 py-1" required />
                <input name="number" value={manualPlayer.number} onChange={handleManualChange} placeholder="Number" className="border rounded px-2 py-1" />
                <select name="age_group" value={manualPlayer.age_group} onChange={handleManualChange} className="border rounded px-2 py-1">
                  <option value="">Age Group</option>
                  {AGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <label className="flex items-center gap-1">
                  <input name="40m_dash" value={manualPlayer["40m_dash"]} onChange={handleManualChange} placeholder="40m Dash" className="border rounded px-2 py-1 flex-1" />
                  <span className="cursor-pointer" title={drillTip}>ℹ️</span>
                </label>
                <label className="flex items-center gap-1">
                  <input name="vertical_jump" value={manualPlayer["vertical_jump"]} onChange={handleManualChange} placeholder="Vertical Jump" className="border rounded px-2 py-1 flex-1" />
                  <span className="cursor-pointer" title={drillTip}>ℹ️</span>
                </label>
                <label className="flex items-center gap-1">
                  <input name="catching" value={manualPlayer["catching"]} onChange={handleManualChange} placeholder="Catching" className="border rounded px-2 py-1 flex-1" />
                  <span className="cursor-pointer" title={drillTip}>ℹ️</span>
                </label>
                <label className="flex items-center gap-1">
                  <input name="throwing" value={manualPlayer["throwing"]} onChange={handleManualChange} placeholder="Throwing" className="border rounded px-2 py-1 flex-1" />
                  <span className="cursor-pointer" title={drillTip}>ℹ️</span>
                </label>
                <label className="flex items-center gap-1">
                  <input name="agility" value={manualPlayer["agility"]} onChange={handleManualChange} placeholder="Agility" className="border rounded px-2 py-1 flex-1" />
                  <span className="cursor-pointer" title={drillTip}>ℹ️</span>
                </label>
              </div>
              {manualErrors.length > 0 && <div className="text-red-500 text-sm mt-2">{manualErrors.join(", ")}</div>}
              <div className="flex gap-2 mt-4 flex-wrap justify-center">
                <button type="submit" className="bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition flex items-center gap-2" disabled={manualStatus === 'loading'}>
                  <UserPlus className="w-4 h-4" />{manualStatus === 'loading' ? 'Adding...' : 'Add Player'}
                </button>
                <button type="button" className="bg-gray-200 text-cyan-700 rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-gray-300 transition flex items-center gap-2" onClick={() => setShowManualForm(false)}>
                  Cancel
                </button>
              </div>
              {manualStatus === 'success' && <div className="text-green-600 mt-2">✅ {manualMsg}</div>}
              {manualStatus === 'error' && <div className="text-red-500 mt-2">❌ {manualMsg}</div>}
            </form>
          </div>
        )}
        {/* Reset Tool */}
        <div className="rounded-2xl shadow-sm bg-white border border-gray-200 py-4 px-5 mb-6">
          <div className="text-xs font-bold text-gray-500 tracking-wide uppercase mb-1 flex items-center gap-2"><RefreshCcw className="w-4 h-4" />Reset Players</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove All Players from Event</h3>
          <label className="block mb-1 font-medium">Type <span className="font-mono">REMOVE</span> to enable reset:</label>
          <input
            type="text"
            value={confirmInput}
            onChange={e => setConfirmInput(e.target.value)}
            className="w-full border-cyan-200 rounded px-3 py-2 focus:ring-cyan-600 focus:border-cyan-600 mb-2"
            disabled={status === "success"}
          />
          <button
            disabled={confirmInput !== "REMOVE" || status === "loading" || status === "success" || !selectedEvent}
            onClick={handleReset}
            className="bg-red-500 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm mt-2 disabled:opacity-50 hover:bg-red-600 transition flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />{status === "loading" ? "Resetting..." : "Reset All Players"}
          </button>
          {status === "success" && <div className="text-green-600 mt-4">Reset successful!</div>}
          {status === "error" && <div className="text-red-500 mt-4">{errorMsg}</div>}
        </div>
        {/* Invite to League Section */}
        {role === 'organizer' && selectedLeagueId && (
          <div className="rounded-2xl shadow-sm bg-white border border-gray-200 py-4 px-5 mb-6 flex flex-col items-center text-center">
            <div className="text-xs font-bold text-gray-500 tracking-wide uppercase mb-1 flex items-center gap-2"><Users className="w-4 h-4" />Invite Coaches</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Share League Access</h3>
            <div className="text-sm text-gray-600 mb-2">Share this code, link, or QR with coaches to let them join as a coach.</div>
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-2 w-full justify-center">
              <div className="font-mono text-lg bg-gray-100 text-gray-800 px-4 py-2 rounded-lg border flex-1 select-all">{joinCode}</div>
              <button className="bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition flex items-center gap-2" onClick={() => {navigator.clipboard.writeText(joinCode)}}><Copy className="w-4 h-4" />Copy Code</button>
              <button className="bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition flex items-center gap-2" onClick={() => {navigator.clipboard.writeText(inviteLink)}}><Link2 className="w-4 h-4" />Copy Invite Link</button>
              <button className="bg-cyan-700 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-800 transition flex items-center gap-2" onClick={() => setShowQr(true)}><QrCode className="w-4 h-4" />Show QR</button>
            </div>
            {showQr && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                <div className="bg-white rounded-2xl p-6 shadow-lg flex flex-col items-center">
                  <QRCode value={inviteLink} size={200} />
                  <div className="mt-2 text-xs">Scan to join: <br />{inviteLink}</div>
                  <button className="mt-4 bg-cyan-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-sm hover:bg-cyan-700 transition flex items-center gap-2" onClick={() => setShowQr(false)}><QrCode className="w-4 h-4" />Close</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 