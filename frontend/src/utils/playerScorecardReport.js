import { calculateOptimizedCompositeScore, calculateOptimizedRankings } from './optimizedScoring';
import { buildPlayerScorecardPdfFilename } from './pdfFilename';
import { getStarRatingFromPercentile } from './starRating';

function normalizeWeights(weights = {}, drills = []) {
  const normalized = {};
  drills.forEach((drill) => {
    const rawWeight = Number(weights?.[drill.key] ?? 0);
    normalized[drill.key] = rawWeight <= 1 ? rawWeight * 100 : rawWeight;
  });
  return normalized;
}

function buildDrillAnalysis(player, allPlayers, drills, includeRecommendations = true) {
  if (!player || !Array.isArray(drills)) return [];

  return drills.map((drill) => {
    const playerScore = player.scores?.[drill.key] ?? player[drill.key];
    if (playerScore === null || playerScore === undefined) {
      return {
        ...drill,
        playerScore: null,
        rank: null,
        percentile: null,
        recommendation: 'No score recorded for this drill.'
      };
    }

    const ageGroupPlayers = allPlayers.filter(
      (p) =>
        p.age_group === player.age_group &&
        (p.scores?.[drill.key] ?? p[drill.key]) !== null &&
        (p.scores?.[drill.key] ?? p[drill.key]) !== undefined
    );

    const sortedByDrill = [...ageGroupPlayers].sort((a, b) => {
      const valA = a.scores?.[drill.key] ?? a[drill.key];
      const valB = b.scores?.[drill.key] ?? b[drill.key];
      return drill.lowerIsBetter ? valA - valB : valB - valA;
    });

    const drillRank = sortedByDrill.findIndex((p) => p.id === player.id) + 1;
    const ageCount = sortedByDrill.length;
    const drillPercentile = Math.round(
      ((sortedByDrill.length - drillRank + 1) / sortedByDrill.length) * 100
    );

    let recommendation = '';
    if (includeRecommendations) {
      if (drillPercentile >= 80) {
        recommendation = `Excellent ${drill.label.toLowerCase()} performance! Continue to maintain this strength.`;
      } else if (drillPercentile >= 60) {
        recommendation = `Good ${drill.label.toLowerCase()} performance. Consider focused training to reach elite level.`;
      } else if (drillPercentile >= 40) {
        recommendation = `Average ${drill.label.toLowerCase()} performance. Regular practice in this area recommended.`;
      } else {
        recommendation = `Focus area for improvement. Dedicated ${drill.label.toLowerCase()} training strongly recommended.`;
      }
    }

    return {
      ...drill,
      playerScore,
      rank: drillRank,
        ageCount,
      percentile: drillPercentile,
      recommendation
    };
  });
}

function resolveCanonicalPercentile(player, allPlayers, fallbackPercentile) {
  const direct = Number(player?.canonical_percentile);
  if (Number.isFinite(direct)) return Math.round(direct);

  const fromCohort = (allPlayers || []).find((p) => p?.id === player?.id);
  const cohortPercentile = Number(fromCohort?.canonical_percentile);
  if (Number.isFinite(cohortPercentile)) return Math.round(cohortPercentile);

  return fallbackPercentile;
}

export function buildPlayerScorecardPayload({
  player,
  allPlayers = [],
  weights = {},
  drills = [],
  includeRecommendations = true
}) {
  if (!player) return null;

  const normalizedWeights = normalizeWeights(weights, drills);
  const compositeScore = calculateOptimizedCompositeScore(player, allPlayers, normalizedWeights, drills);

  const ageGroupPlayers = allPlayers.filter((p) => p.age_group === player.age_group);
  const rankedPlayers = calculateOptimizedRankings(ageGroupPlayers, normalizedWeights, drills);
  const rankData = rankedPlayers.find((p) => p.id === player.id);
  const rank = rankData ? rankData.rank : rankedPlayers.length + 1;
  const totalInAgeGroup = rankedPlayers.length;
  const percentile =
    totalInAgeGroup > 0
      ? Math.round(((totalInAgeGroup - rank + 1) / totalInAgeGroup) * 100)
      : 0;
  const canonicalPercentile = resolveCanonicalPercentile(player, allPlayers, percentile);
  const starRating = getStarRatingFromPercentile(canonicalPercentile);

  return {
    playerStats: {
      compositeScore,
      rank,
      totalInAgeGroup,
      percentile: canonicalPercentile,
      starCount: starRating.starCount,
      starLabel: starRating.starLabel,
      starDisplay: starRating.starDisplay
    },
    drillAnalysis: buildDrillAnalysis(player, allPlayers, drills, includeRecommendations)
  };
}

export function generatePlayerScorecardHTML({
  player,
  displayName,
  documentTitle,
  selectedEvent,
  templateName,
  drills = [],
  playerStats,
  drillAnalysis = []
}) {
  if (!player || !playerStats) return '';

  const positiveHighlight =
    playerStats.starCount >= 5
      ? 'Outstanding performance! Ranked among the top performers in your age group.'
      : playerStats.starCount >= 4
        ? 'Great job! Strong performance compared to peers in your age group.'
        : '';

  const playerInfoLine = player.number
    ? `Player #${player.number}`
    : `Age Group: ${player.age_group || 'N/A'}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${documentTitle || `${displayName} - Player Scorecard`}</title>
        <style>
          @page { size: letter; margin: 0.5in; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 11px; line-height: 1.4; }
          .header { text-align: center; border-bottom: 2px solid #19c3e6; padding-bottom: 12px; margin-bottom: 16px; }
          .logo { font-size: 20px; font-weight: bold; color: #19c3e6; }
          .header-sub { margin-top: 4px; font-size: 11px; color: #6b7280; }
          .top-summary { border: 1px solid #d1f4fb; background: #f7feff; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
          .top-player-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 10px; }
          .player-name { font-size: 26px; font-weight: bold; color: #111827; line-height: 1.2; }
          .player-meta { color: #6b7280; font-size: 11px; margin-top: 4px; }
          .top-stat-row { display: flex; gap: 10px; }
          .stat-box { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; text-align: center; background: #ffffff; }
          .stat-number { font-size: 22px; font-weight: bold; color: #19c3e6; }
          .stat-label { font-size: 9px; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
          .summary-explainer { margin-top: 10px; color: #374151; font-size: 10px; line-height: 1.35; }
          .positive-highlight { margin-top: 8px; font-size: 11px; color: #065f46; font-weight: 600; }
          .section { margin-bottom: 14px; }
          .section-title { font-size: 13px; font-weight: bold; color: #19c3e6; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
          .drill-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .drill-table th { text-align: left; padding: 4px 8px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
          .drill-table td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
          .drill-table tr:last-child td { border-bottom: none; }
          .drill-score { font-weight: bold; color: #19c3e6; }
          .summary-box { background: #f0fdff; border: 1px solid #19c3e6; border-radius: 6px; padding: 12px; font-size: 11px; }
          .summary-box p { margin-bottom: 6px; }
          .summary-box p:last-child { margin-bottom: 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 9px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 8px; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .section { page-break-inside: avoid; }
            .drill-table { page-break-inside: auto; }
            .drill-table tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🏆 WooCombine Player Scorecard</div>
          <div class="header-sub">${selectedEvent?.name || 'Evaluation Event'} — ${new Date().toLocaleDateString()}</div>
        </div>

        <div class="top-summary">
          <div class="top-player-row">
            <div>
              <div class="player-name">${displayName}</div>
              <div class="player-meta">${playerInfoLine}</div>
            </div>
          </div>
          <div class="top-stat-row">
            <div class="stat-box">
              <div class="stat-number">${player.age_group || 'N/A'}</div>
              <div class="stat-label">Age Group</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${playerStats.compositeScore.toFixed(1)}</div>
              <div class="stat-label">Overall Score</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${playerStats.starDisplay || '—'}</div>
              <div class="stat-label">${playerStats.starLabel || 'Star Tier'}</div>
            </div>
          </div>
          <div class="summary-explainer">
            These results reflect your child's performance during the Woo Combine. Star tiers are based on age-group percentile bands and shared across WooCombine reports and draft views.
          </div>
          ${positiveHighlight ? `<div class="positive-highlight">${positiveHighlight}</div>` : ''}
        </div>

        <div class="section">
          <div class="section-title">📊 Drill Performance Breakdown</div>
          <table class="drill-table">
            <thead>
              <tr>
                <th>Drill</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${drillAnalysis
                .map((drill) => {
                  return `
                <tr>
                  <td><strong>${drill.label}</strong></td>
                  <td class="drill-score">${drill.playerScore !== null && drill.playerScore !== undefined ? `${drill.playerScore} ${drill.unit}` : '—'}</td>
                </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">🎯 ${templateName || 'Evaluation'} Summary</div>
          <div class="summary-box">
            <p><strong>Overall Assessment:</strong> ${displayName} scored ${playerStats.compositeScore.toFixed(1)}
            overall in the ${player.age_group} age group (${playerStats.starDisplay || '—'} ${playerStats.starLabel || ''}).</p>

            <p><strong>Evaluation Methodology:</strong> This scorecard is based on the ${templateName || 'evaluation'}
            template with ${drills.length} drill assessments. Scores are weighted according to coaching preferences
            and normalized within the age group for fair comparison.</p>
          </div>
        </div>

        <div class="footer">
          Generated by WooCombine — ${new Date().toLocaleString()} —
          Event: ${selectedEvent?.name || 'N/A'}
        </div>
      </body>
    </html>
  `;
}

export function downloadPlayerScorecardPdf({
  player,
  displayName,
  selectedEvent,
  templateName,
  drills = [],
  allPlayers = [],
  weights = {},
  includeRecommendations = true,
  coachNotes = ''
}) {
  const pdfFilename = buildPlayerScorecardPdfFilename({
    eventName: selectedEvent?.name,
    playerName: displayName
  });

  const payload = buildPlayerScorecardPayload({
    player,
    allPlayers,
    weights,
    drills,
    includeRecommendations
  });
  if (!payload) return false;

  const reportHtml = generatePlayerScorecardHTML({
    player,
    displayName,
    documentTitle: pdfFilename,
    selectedEvent,
    templateName,
    drills,
    playerStats: payload.playerStats,
    drillAnalysis: payload.drillAnalysis
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(reportHtml);
  printWindow.document.close();

  const handleLoad = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // ignore print errors
    }
  };

  if (printWindow.document.readyState === 'complete') {
    handleLoad();
  } else {
    printWindow.onload = handleLoad;
  }

  return true;
}

export function createScorecardEmailDraft({
  player,
  displayName,
  selectedEvent,
  allPlayers = [],
  weights = {},
  drills = []
}) {
  const payload = buildPlayerScorecardPayload({
    player,
    allPlayers,
    weights,
    drills
  });

  if (!payload) return null;

  const { playerStats } = payload;
  const subject = `${displayName} - Player Scorecard from ${selectedEvent?.name || 'Evaluation'}`;
  const body = `Hi,

Here are ${displayName}'s evaluation highlights:

- Overall Score: ${playerStats.compositeScore.toFixed(1)}
- Tier: ${playerStats.starDisplay || '—'} ${playerStats.starLabel || ''}

Full scorecard PDF can be downloaded from WooCombine.

Best regards,
${selectedEvent?.name || 'Coaching Staff'}`;

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
