import { calculateOptimizedCompositeScore, calculateOptimizedRankings } from './optimizedScoring';

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

  return {
    playerStats: {
      compositeScore,
      rank,
      totalInAgeGroup,
      percentile
    },
    drillAnalysis: buildDrillAnalysis(player, allPlayers, drills, includeRecommendations)
  };
}

export function generatePlayerScorecardHTML({
  player,
  displayName,
  selectedEvent,
  templateName,
  drills = [],
  playerStats,
  drillAnalysis = [],
  includeRecommendations = true,
  coachNotes = ''
}) {
  if (!player || !playerStats) return '';

  const playerInfoLine = player.number
    ? `Player #${player.number} — Age Group: ${player.age_group || 'N/A'}`
    : `Age Group: ${player.age_group || 'N/A'}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${displayName} - Player Scorecard</title>
        <style>
          @page { size: letter; margin: 0.5in; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 11px; line-height: 1.4; }
          .header { text-align: center; border-bottom: 2px solid #19c3e6; padding-bottom: 12px; margin-bottom: 16px; }
          .logo { font-size: 20px; font-weight: bold; color: #19c3e6; }
          .header-sub { margin-top: 4px; font-size: 11px; color: #6b7280; }
          .player-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .player-name { font-size: 22px; font-weight: bold; color: #111827; }
          .player-meta { color: #6b7280; font-size: 11px; margin-top: 2px; }
          .composite-score { font-size: 28px; font-weight: bold; color: #19c3e6; text-align: right; }
          .composite-label { font-size: 10px; color: #6b7280; text-align: right; }
          .summary-row { display: flex; gap: 12px; margin-bottom: 16px; }
          .stat-box { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; text-align: center; }
          .stat-number { font-size: 22px; font-weight: bold; color: #19c3e6; }
          .stat-label { font-size: 9px; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
          .section { margin-bottom: 14px; }
          .section-title { font-size: 13px; font-weight: bold; color: #19c3e6; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
          .drill-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .drill-table th { text-align: left; padding: 4px 8px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
          .drill-table td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
          .drill-table tr:last-child td { border-bottom: none; }
          .drill-score { font-weight: bold; color: #19c3e6; }
          .drill-rec { font-style: italic; color: #6b7280; font-size: 9px; }
          .notes-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; font-size: 11px; color: #111827; }
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

        <div class="player-row">
          <div>
            <div class="player-name">${displayName}</div>
            <div class="player-meta">${playerInfoLine}</div>
          </div>
          <div>
            <div class="composite-score">${playerStats.compositeScore.toFixed(1)}</div>
            <div class="composite-label">Composite Score</div>
          </div>
        </div>

        <div class="summary-row">
          <div class="stat-box">
            <div class="stat-number">${playerStats.rank}</div>
            <div class="stat-label">Rank in Age Group</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${playerStats.percentile}%</div>
            <div class="stat-label">Percentile</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${playerStats.totalInAgeGroup}</div>
            <div class="stat-label">Total in Age Group</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📊 Drill Performance Breakdown</div>
          <table class="drill-table">
            <thead>
              <tr>
                <th>Drill</th>
                <th>Score</th>
                <th>Rank</th>
                <th>Percentile</th>
                ${includeRecommendations ? '<th>Recommendation</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${drillAnalysis
                .map((drill) => {
                  return `
                <tr>
                  <td><strong>${drill.label}</strong></td>
                  <td class="drill-score">${drill.playerScore !== null && drill.playerScore !== undefined ? `${drill.playerScore} ${drill.unit}` : '—'}</td>
                  <td>${drill.rank ? `${drill.rank} / ${drill.ageCount || 1}` : '—'}</td>
                  <td>${drill.percentile !== null && drill.percentile !== undefined ? `${drill.percentile}%` : '—'}</td>
                  ${includeRecommendations ? `<td class="drill-rec">${drill.recommendation}</td>` : ''}
                </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        ${coachNotes
          ? `
          <div class="section">
            <div class="section-title">💬 Coach Notes</div>
            <div class="notes-box">${coachNotes.replace(/\n/g, '<br>')}</div>
          </div>
        `
          : ''}

        <div class="section">
          <div class="section-title">🎯 ${templateName || 'Evaluation'} Summary</div>
          <div class="summary-box">
            <p><strong>Overall Assessment:</strong> ${displayName} scored ${playerStats.compositeScore.toFixed(1)}
            overall, ranking ${playerStats.rank} out of ${playerStats.totalInAgeGroup} players in the ${player.age_group} age group
            (${playerStats.percentile}th percentile).</p>

            <p><strong>Evaluation Methodology:</strong> This scorecard is based on the ${templateName || 'evaluation'}
            template with ${drills.length} drill assessments. Scores are weighted according to coaching preferences
            and normalized within the age group for fair comparison.</p>

            ${includeRecommendations
              ? `
              <p><strong>Next Steps:</strong> Review the individual drill recommendations above for targeted
              improvement areas. Focus on drills where percentile ranks are below 60% for maximum development impact.</p>
            `
              : ''}
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
    selectedEvent,
    templateName,
    drills,
    playerStats: payload.playerStats,
    drillAnalysis: payload.drillAnalysis,
    includeRecommendations,
    coachNotes
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

- Composite Score: ${playerStats.compositeScore.toFixed(1)}
- Rank: ${playerStats.rank} of ${playerStats.totalInAgeGroup} in ${player.age_group} age group
- Percentile: ${playerStats.percentile}th percentile

Full scorecard PDF can be downloaded from WooCombine.

Best regards,
${selectedEvent?.name || 'Coaching Staff'}`;

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
