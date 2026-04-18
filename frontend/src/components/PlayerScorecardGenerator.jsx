import React, { useState } from 'react';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Share2,
  Download,
  Mail,
  FileText,
  Award,
  TrendingUp,
  Target,
  BarChart3,
  User,
  Calendar,
  MapPin,
  Trophy,
  Star,
  Info
} from 'lucide-react';
import Button from './ui/Button';
import { getDrillsFromTemplate, getTemplateById } from '../constants/drillTemplates';
import { calculateOptimizedCompositeScore, calculateOptimizedRankings } from '../utils/optimizedScoring';
import { formatViewerPlayerName } from '../utils/playerDisplayName';

const PlayerScorecardGenerator = ({ player, allPlayers = [], weights = {}, selectedDrillTemplate = 'football' }) => {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const { showSuccess } = useToast();
  
  const [showPreview, setShowPreview] = useState(false);
  const [includeComparison, setIncludeComparison] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [coachNotes, setCoachNotes] = useState('');
  
  const template = getTemplateById(selectedDrillTemplate);
  const drills = getDrillsFromTemplate(selectedDrillTemplate);
  const displayName = formatViewerPlayerName(player, userRole);
  
  // Calculate player stats using optimized scoring
  const playerStats = React.useMemo(() => {
    if (!player) return null;
    
    // Convert decimal weights to percentage format expected by scoring utils
    const percentageWeights = {};
    Object.entries(weights).forEach(([key, value]) => {
      percentageWeights[key] = value * 100; // Convert 0.2 to 20
    });
    
    const compositeScore = calculateOptimizedCompositeScore(player, allPlayers, percentageWeights, drills);
    
    // Calculate rank among age group using optimized ranking
    const ageGroupPlayers = allPlayers.filter(p => p.age_group === player.age_group);
    // optimizedRankings already returns sorted array with ranks
    const rankedPlayers = calculateOptimizedRankings(ageGroupPlayers, percentageWeights, drills);
    
    const rankData = rankedPlayers.find(p => p.id === player.id);
    const rank = rankData ? rankData.rank : (rankedPlayers.length + 1);
    
    const totalInAgeGroup = rankedPlayers.length;
    const percentile = Math.round(((totalInAgeGroup - rank + 1) / totalInAgeGroup) * 100);
    
    return {
      compositeScore,
      rank,
      totalInAgeGroup,
      percentile
    };
  }, [player, allPlayers, weights, drills]);

  // Calculate drill-specific rankings and recommendations
  const drillAnalysis = React.useMemo(() => {
    if (!player || !playerStats) return [];
    
    return drills.map(drill => {
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
      
      // Calculate rank for this specific drill
      const ageGroupPlayers = allPlayers.filter(p => 
        p.age_group === player.age_group && (p.scores?.[drill.key] ?? p[drill.key]) !== null && (p.scores?.[drill.key] ?? p[drill.key]) !== undefined
      );
      
      const sortedByDrill = ageGroupPlayers.sort((a, b) => {
        const valA = a.scores?.[drill.key] ?? a[drill.key];
        const valB = b.scores?.[drill.key] ?? b[drill.key];
        
        if (drill.lowerIsBetter) {
          return valA - valB;
        } else {
          return valB - valA;
        }
      });
      
      const drillRank = sortedByDrill.findIndex(p => p.id === player.id) + 1;
      const drillPercentile = Math.round(((sortedByDrill.length - drillRank + 1) / sortedByDrill.length) * 100);
      
      // Generate recommendation
      let recommendation = '';
      if (drillPercentile >= 80) {
        recommendation = `Excellent ${drill.label.toLowerCase()} performance! Continue to maintain this strength.`;
      } else if (drillPercentile >= 60) {
        recommendation = `Good ${drill.label.toLowerCase()} performance. Consider focused training to reach elite level.`;
      } else if (drillPercentile >= 40) {
        recommendation = `Average ${drill.label.toLowerCase()} performance. Regular practice in this area recommended.`;
      } else {
        recommendation = `Focus area for improvement. Dedicated ${drill.label.toLowerCase()} training strongly recommended.`;
      }
      
      return {
        ...drill,
        playerScore,
        rank: drillRank,
        percentile: drillPercentile,
        recommendation
      };
    });
  }, [player, allPlayers, drills, playerStats]);

  const generateReportHTML = () => {
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
                ${drillAnalysis.map(drill => {
                  const ageCount = allPlayers.filter(p => p.age_group === player.age_group && (p.scores?.[drill.key] ?? p[drill.key]) !== null && (p.scores?.[drill.key] ?? p[drill.key]) !== undefined).length;
                  return `
                  <tr>
                    <td><strong>${drill.label}</strong></td>
                    <td class="drill-score">${drill.playerScore !== null && drill.playerScore !== undefined ? drill.playerScore + ' ' + drill.unit : '—'}</td>
                    <td>${drill.rank ? drill.rank + ' / ' + ageCount : '—'}</td>
                    <td>${drill.percentile !== null && drill.percentile !== undefined ? drill.percentile + '%' : '—'}</td>
                    ${includeRecommendations ? '<td class="drill-rec">' + drill.recommendation + '</td>' : ''}
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          
          ${coachNotes ? `
            <div class="section">
              <div class="section-title">💬 Coach Notes</div>
              <div class="notes-box">${coachNotes.replace(/\n/g, '<br>')}</div>
            </div>
          ` : ''}
          
          <div class="section">
            <div class="section-title">🎯 ${template?.name || 'Evaluation'} Summary</div>
            <div class="summary-box">
              <p><strong>Overall Assessment:</strong> ${displayName} scored ${playerStats.compositeScore.toFixed(1)} 
              overall, ranking ${playerStats.rank} out of ${playerStats.totalInAgeGroup} players in the ${player.age_group} age group 
              (${playerStats.percentile}th percentile).</p>
              
              <p><strong>Evaluation Methodology:</strong> This scorecard is based on the ${template?.name || 'evaluation'} 
              template with ${drills.length} drill assessments. Scores are weighted according to coaching preferences 
              and normalized within the age group for fair comparison.</p>
              
              ${includeRecommendations ? `
                <p><strong>Next Steps:</strong> Review the individual drill recommendations above for targeted 
                improvement areas. Focus on drills where percentile ranks are below 60% for maximum development impact.</p>
              ` : ''}
            </div>
          </div>
          
          <div class="footer">
            Generated by WooCombine — ${new Date().toLocaleString()} — 
            Event: ${selectedEvent?.name || 'N/A'}
          </div>
        </body>
      </html>
    `;
  };

  const generatePDFReport = () => {
    // In a real implementation, this would generate a proper PDF
    // For now, we'll create an HTML version that can be printed as PDF
    const reportHtml = generateReportHTML();
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    // Ensure styles are applied before printing
    const handleLoad = () => {
      try { printWindow.focus(); printWindow.print(); } catch { /* ignore print errors */ }
    };
    if (printWindow.document.readyState === 'complete') {
      handleLoad();
    } else {
      printWindow.onload = handleLoad;
    }
    
    showSuccess('Scorecard generated! Use your browser\'s print function to save as PDF.');
  };

  const shareViaEmail = () => {
    const subject = `${displayName} - Player Scorecard from ${selectedEvent?.name || 'Evaluation'}`;
    const body = `Hi,

Here are ${displayName}'s evaluation highlights:

- Composite Score: ${playerStats.compositeScore.toFixed(1)}
- Rank: ${playerStats.rank} of ${playerStats.totalInAgeGroup} in ${player.age_group} age group
- Percentile: ${playerStats.percentile}th percentile

Full scorecard PDF can be downloaded from WooCombine.

Best regards,
${selectedEvent?.name || 'Coaching Staff'}`;

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    
    showSuccess('Email client opened! Use "Download PDF" to generate the scorecard and attach it.');
  };

  const copyScoreToClipboard = () => {
    const text = `${displayName} — WooCombine Scorecard\nComposite Score: ${playerStats.compositeScore.toFixed(1)} | Rank: ${playerStats.rank}/${playerStats.totalInAgeGroup} | ${playerStats.percentile}th percentile`;
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('Player score summary copied to clipboard!');
    }).catch(() => {
      showSuccess('Could not copy to clipboard.');
    });
  };

  if (!player) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Player Selected</h3>
          <p className="text-gray-600">Select a player to generate their scorecard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Award className="w-6 h-6 text-yellow-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Player Scorecard Generator</h2>
          <p className="text-sm text-gray-600">
            Create professional scorecard for {displayName}
          </p>
        </div>
      </div>

      {/* Player Summary */}
      <div className="mb-6 p-4 bg-brand-light/20 border border-brand-primary/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="font-bold text-text">{displayName}</h3>
              <p className="text-sm text-text-muted">
                {player.number ? `#${player.number} · ` : ''}{player.age_group} · Score: {playerStats?.compositeScore.toFixed(1)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-brand-primary">
              #{playerStats?.rank}
            </div>
            <div className="text-xs text-text-muted">
              of {playerStats?.totalInAgeGroup}
            </div>
          </div>
        </div>
      </div>

      {/* Generation Options */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeComparison}
              onChange={(e) => setIncludeComparison(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Include age group comparison</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeRecommendations}
              onChange={(e) => setIncludeRecommendations(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Include improvement recommendations</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Coach Notes (Optional)
          </label>
          <textarea
            value={coachNotes}
            onChange={(e) => setCoachNotes(e.target.value)}
            placeholder="Add personal notes, observations, or specific feedback for the player and parents..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button variant="primary" onClick={generatePDFReport} className="gap-2">
          <Download className="w-4 h-4" />
          Generate PDF
        </Button>
        <Button variant="outline" onClick={shareViaEmail} className="gap-2">
          <Mail className="w-4 h-4" />
          Email
        </Button>
        <Button variant="subtle" onClick={copyScoreToClipboard} className="gap-2">
          <Share2 className="w-4 h-4" />
          Copy Summary
        </Button>
        <Button variant="subtle" onClick={() => setShowPreview(!showPreview)} className="gap-2">
          <FileText className="w-4 h-4" />
          {showPreview ? 'Hide Preview' : 'Preview'}
        </Button>
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
          <h3 className="font-bold text-gray-900 mb-4">Scorecard Preview</h3>
          <div className="bg-white rounded border p-4 max-h-96 overflow-y-auto text-sm">
            <div dangerouslySetInnerHTML={{ __html: generateReportHTML() }} />
          </div>
        </div>
      )}

      {/* Benefits Callout */}
      <div className="mt-6 p-4 bg-brand-light/20 border border-brand-primary/20 rounded-lg">
        <div className="flex items-start gap-3">
          <Trophy className="w-5 h-5 text-brand-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-text mb-1">Professional Player Communication</h4>
            <ul className="text-sm text-text-muted space-y-1">
              <li>- Share detailed performance analysis with players and parents</li>
              <li>- Provide clear improvement recommendations</li>
              <li>- Build trust through transparent evaluation results</li>
              <li>- Professional PDF reports enhance your program's credibility</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerScorecardGenerator;