import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import WelcomeLayout from "../components/layouts/WelcomeLayout";
import api from "../lib/api";
import { useEvent } from "../context/EventContext";
import { getStarRatingFromPercentile } from "../utils/starRating";

const GENERIC_LOOKUP_ERROR =
  "We couldn't find a matching participant with that Combine Number and Last Name.";
const STAR_SYSTEM_EXPLANATION =
  "This report reflects your child’s performance at the Woo Combine on this specific day. Star ratings show how each result compares to other participants in the same age group. Every athlete develops at a different pace, and this is simply a snapshot to help understand strengths and areas to build on. Star ratings range from 1 to 5, with more stars indicating stronger performance in that drill or overall on the day of the combine.";

function getReportStarTier(report) {
  if (!report) return { starDisplay: "—" };
  if (report.star_display) {
    return {
      starDisplay: report.star_display || "—",
    };
  }
  const fallback = getStarRatingFromPercentile(report?.percentile);
  return {
    starDisplay: fallback.starDisplay || "—",
  };
}

function getDrillStarDisplay(drill) {
  if (drill?.drill_star_display) return drill.drill_star_display;
  const fallback = getStarRatingFromPercentile(drill?.percentile);
  return fallback.starDisplay || "—";
}

function normalizeNamePart(value) {
  return typeof value === "string" ? value.trim() : "";
}

function splitFullName(fullName) {
  const normalized = normalizeNamePart(fullName);
  if (!normalized) return { firstName: "", lastName: "" };
  const parts = normalized.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function getReportDisplayName(report) {
  const firstName = normalizeNamePart(report?.first_name);
  const lastName = normalizeNamePart(report?.last_name);
  const combinedFromParts = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (combinedFromParts) return combinedFromParts;

  const parsed = splitFullName(report?.player_name);
  const parsedCombined = [parsed.firstName, parsed.lastName].filter(Boolean).join(" ").trim();
  return parsedCombined || "Participant";
}

function buildPrintableHtml(report) {
  const overallStar = getReportStarTier(report);
  const displayName = getReportDisplayName(report);
  const drillRows = (report?.drill_breakdown || [])
    .map((drill) => {
      const score =
        drill.score === null || drill.score === undefined
          ? "—"
          : `${drill.score} ${drill.unit || ""}`.trim();
      const drillStars = getDrillStarDisplay(drill);
      return `
        <tr>
          <td>${drill.drill_label}</td>
          <td>${score}</td>
          <td>${drillStars}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>WooCombine Player Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
          h1 { margin: 0 0 4px 0; font-size: 24px; }
          .meta { color: #4b5563; margin-bottom: 20px; }
          .summary { display: flex; gap: 12px; margin-bottom: 18px; }
          .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; min-width: 130px; }
          .label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
          .value { font-size: 22px; font-weight: 700; color: #19c3e6; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 8px; font-size: 13px; }
          th { background: #f9fafb; }
          .report-explainer { margin: 0 0 16px 0; color: #374151; font-size: 13px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <h1>${displayName}</h1>
        <div class="meta">Age Group: ${report.age_group || "N/A"}</div>
        <div class="summary">
          <div class="box"><div class="label">Overall Score</div><div class="value">${report.overall_score}</div></div>
          <div class="box"><div class="label">Stars</div><div class="value">${overallStar.starDisplay || "—"}</div></div>
        </div>
        <div class="report-explainer">${STAR_SYSTEM_EXPLANATION}</div>
        <h2>Drill Breakdown</h2>
        <table>
          <thead><tr><th>Drill</th><th>Score</th><th>Stars</th></tr></thead>
          <tbody>${drillRows}</tbody>
        </table>
      </body>
    </html>
  `;
}

export default function ResultsLookup() {
  const location = useLocation();
  const { selectedEvent } = useEvent();
  const [combineNumber, setCombineNumber] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [report, setReport] = useState(null);
  const eventIdFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return (params.get("event_id") || "").trim();
  }, [location.search]);
  const effectiveEventId = (eventIdFromQuery || selectedEvent?.id || "").toString().trim();
  const overallStar = useMemo(
    () => getReportStarTier(report),
    [report]
  );
  const normalizedCombineNumber = combineNumber.trim();
  const normalizedLastName = lastName.trim();
  const combineHasLetters = /[a-z]/i.test(normalizedCombineNumber);
  const lastNameHasNumbers = /\d/.test(normalizedLastName);
  const looksReversed =
    normalizedCombineNumber.length > 0 &&
    normalizedLastName.length > 0 &&
    combineHasLetters &&
    /^\d+$/.test(normalizedLastName);

  const canSubmit = useMemo(
    () =>
      effectiveEventId.length > 0 &&
      normalizedCombineNumber.length > 0 &&
      normalizedLastName.length > 0 &&
      !combineHasLetters &&
      !lastNameHasNumbers &&
      !loading,
    [
      effectiveEventId,
      normalizedCombineNumber,
      normalizedLastName,
      combineHasLetters,
      lastNameHasNumbers,
      loading,
    ]
  );

  const handleLookup = async (event) => {
    event.preventDefault();
    setError("");
    setFormError("");
    setReport(null);

    if (looksReversed) {
      setFormError(
        "It looks like the fields may be reversed. Please enter the number in Combine Number and the last name separately."
      );
      return;
    }
    if (combineHasLetters || lastNameHasNumbers || !canSubmit) return;

    setLoading(true);

    try {
      const response = await api.post("/public/results-lookup", {
        event_id: effectiveEventId,
        combine_number: normalizedCombineNumber,
        last_name: normalizedLastName,
      });
      setReport(response.data || null);
    } catch {
      setError(GENERIC_LOOKUP_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!report) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(buildPrintableHtml(report));
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  return (
    <WelcomeLayout contentClassName="min-h-screen" hideHeader={true} showOverlay={false}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Find Your Child&apos;s Report</h1>
        <p className="text-sm text-gray-600 mb-6">
          Enter the participant&apos;s Combine Number and Last Name to view one report.
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Use the number from your child&apos;s bib and their last name.
        </p>
        {!effectiveEventId && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
            This lookup link is missing event context. Please use the event-specific report link or QR code from your organizer.
          </div>
        )}

        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Combine Number</label>
            <input
              type="text"
              value={combineNumber}
              onChange={(e) => {
                setCombineNumber(e.target.value);
                if (formError) setFormError("");
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Enter number (e.g. 145)"
              autoComplete="off"
              inputMode="numeric"
              required
            />
            {combineHasLetters && (
              <p className="mt-1 text-xs text-red-600">Combine Number must be a number</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (formError) setFormError("");
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Enter last name (e.g. Banfill)"
              autoComplete="family-name"
              required
            />
            {lastNameHasNumbers && (
              <p className="mt-1 text-xs text-red-600">Last Name should not contain numbers</p>
            )}
          </div>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {formError}
            </div>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-brand-primary hover:bg-brand-secondary disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? "Looking up report..." : "View Report"}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {report && (
          <div className="mt-6 border border-gray-200 rounded-xl p-5 bg-gray-50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{getReportDisplayName(report)}</h2>
                <p className="text-sm text-gray-600">Age Group: {report.age_group || "N/A"}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Overall Score</div>
                <div className="text-2xl font-bold text-brand-primary">{report.overall_score}</div>
                <div className="text-sm text-gray-600">{overallStar.starDisplay || "—"}</div>
              </div>
            </div>

            <p className="mt-3 text-sm text-gray-700 leading-6">{STAR_SYSTEM_EXPLANATION}</p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-2">Drill</th>
                    <th className="text-left py-2 pr-2">Score</th>
                    <th className="text-left py-2">Stars</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.drill_breakdown || []).map((drill) => (
                    <tr key={drill.drill_key} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium">{drill.drill_label}</td>
                      <td className="py-2 pr-2">
                        {drill.score === null || drill.score === undefined
                          ? "—"
                          : `${drill.score} ${drill.unit || ""}`.trim()}
                      </td>
                      <td className="py-2">{getDrillStarDisplay(drill)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 bg-gray-900 hover:bg-black text-white font-medium py-2.5 rounded-lg transition"
              >
                Print Report
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-medium py-2.5 rounded-lg transition"
              >
                Download (Print to PDF)
              </button>
            </div>
          </div>
        )}
      </div>
    </WelcomeLayout>
  );
}
