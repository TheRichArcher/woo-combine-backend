import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Edit2, Save, ShieldAlert, Trash2, X } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import api from "../../lib/api";
import { customValidators } from "../../utils/validation";
import { useToast } from "../../context/ToastContext";

function formatTimestamp(value) {
  if (!value) return "Not recorded";
  const parsed = parseISO(value);
  if (!isValid(parsed)) return "Not recorded";
  return format(parsed, "MMM d, yyyy h:mm a");
}

function toTimestampValue(value) {
  if (!value) return 0;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return 0;
  return parsed.getTime();
}

function RecordedResultsSection({
  player,
  drills = [],
  eventId,
  canManageResults = false,
  manageResultsDisabledReason = "",
  onResultsChanged
}) {
  const { showSuccess, showError } = useToast();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingResultId, setEditingResultId] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingResultId, setSavingResultId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [deletingResultId, setDeletingResultId] = useState("");

  const drillByKey = useMemo(
    () => Object.fromEntries(drills.map((drill) => [drill.key, drill])),
    [drills]
  );

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const aTs = toTimestampValue(a.created_at || a.recorded_at);
      const bTs = toTimestampValue(b.created_at || b.recorded_at);
      return bTs - aTs;
    });
  }, [results]);

  const activeResultIds = useMemo(() => {
    const latestByDrill = new Map();
    sortedResults.forEach((result) => {
      if (!result?.type) return;
      if (!latestByDrill.has(result.type)) {
        latestByDrill.set(result.type, result.id);
      }
    });
    return new Set(Array.from(latestByDrill.values()));
  }, [sortedResults]);

  const loadResults = useCallback(async () => {
    if (!eventId || !player?.id) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await api.get(
        `/drill-results/?event_id=${eventId}&player_id=${player.id}`
      );
      setResults(Array.isArray(response.data?.results) ? response.data.results : []);
    } catch (err) {
      const message = err?.response?.data?.detail || "Failed to load recorded results";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [eventId, player?.id]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const startEditing = (result) => {
    setEditingResultId(result.id);
    setEditValue(result.value != null ? String(result.value) : "");
    setEditNotes(result.notes || "");
  };

  const cancelEditing = () => {
    setEditingResultId("");
    setEditValue("");
    setEditNotes("");
  };

  const handleSaveEdit = async (result) => {
    const drillDef = drillByKey[result.type] || null;
    const validationError = customValidators.drillValue(editValue, result.type, drillDef);
    if (validationError) {
      showError(validationError);
      return;
    }

    setSavingResultId(result.id);
    try {
      await api.put(
        `/drill-results/${result.id}?event_id=${eventId}&player_id=${player.id}`,
        {
          value: parseFloat(editValue),
          notes: editNotes
        }
      );

      showSuccess("Recorded result updated");
      cancelEditing();
      await loadResults();
      if (onResultsChanged) onResultsChanged();
    } catch (err) {
      showError(err?.response?.data?.detail || "Failed to update recorded result");
    } finally {
      setSavingResultId("");
    }
  };

  const handleDelete = async (result) => {
    setDeletingResultId(result.id);
    try {
      await api.delete(
        `/drill-results/${result.id}?event_id=${eventId}&player_id=${player.id}`
      );
      showSuccess("Recorded result deleted");
      setConfirmDeleteId("");
      await loadResults();
      if (onResultsChanged) onResultsChanged();
    } catch (err) {
      showError(err?.response?.data?.detail || "Failed to delete recorded result");
    } finally {
      setDeletingResultId("");
    }
  };

  return (
    <section className="border-t border-gray-100 p-4 bg-gray-50">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Recorded Results</h3>
        <span className="text-xs text-gray-500">
          {sortedResults.length} {sortedResults.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {!canManageResults && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            {manageResultsDisabledReason || "Read-only mode: only organizers/coaches with write access can edit or delete recorded results."}
          </p>
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500 py-4 text-center">Loading recorded results...</div>
      )}

      {!loading && error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
          {error}
        </div>
      )}

      {!loading && !error && sortedResults.length === 0 && (
        <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-4 text-center">
          No recorded results yet for this player.
        </div>
      )}

      {!loading && !error && sortedResults.length > 0 && (
        <div className="space-y-2">
          {sortedResults.map((result) => {
            const drillDef = drillByKey[result.type];
            const drillLabel = drillDef?.label || result.type;
            const unit = result.unit || drillDef?.unit || "";
            const isEditing = editingResultId === result.id;
            const isSaving = savingResultId === result.id;
            const isDeleting = deletingResultId === result.id;
            const showDeleteConfirm = confirmDeleteId === result.id;
            const isActiveScore = activeResultIds.has(result.id);
            const entryClassName = isActiveScore
              ? "bg-blue-50 rounded-lg border-2 border-blue-200 p-3"
              : "bg-white rounded-lg border border-gray-200 p-3";

            return (
              <div key={result.id} className={entryClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900">{drillLabel}</div>
                      {isActiveScore ? (
                        <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          Active Score
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          History
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-brand-primary font-semibold mt-0.5">
                      {result.value} {unit}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(result.recorded_at || result.created_at)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Entered by: {result.source || result.created_by || "Unknown"}
                    </div>
                    {result.notes ? (
                      <div className="text-xs text-gray-600 mt-2 italic">Note: {result.notes}</div>
                    ) : (
                      <div className="text-xs text-gray-400 mt-2">No note</div>
                    )}
                  </div>

                  {canManageResults && !isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditing(result)}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                        aria-label="Edit recorded result"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(result.id)}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition"
                        aria-label="Delete recorded result"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Corrected value
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Note
                      </label>
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        placeholder="Optional correction note"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(result)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-brand-primary text-white hover:opacity-90 disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                )}

                {showDeleteConfirm && (
                  <div className="mt-3 pt-3 border-t border-red-100 bg-red-50 rounded-md p-2.5">
                    <div className="text-xs text-red-800 mb-2">
                      Delete this recorded result? If this is the latest attempt, the player's current score will revert to the previous attempt or be removed.
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId("")}
                        className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(result)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {isDeleting ? "Deleting..." : "Confirm Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default React.memo(RecordedResultsSection);
