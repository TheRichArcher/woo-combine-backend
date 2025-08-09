import React, { useState } from 'react';
import { useEvent } from '../context/EventContext';
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
import { getDrillsFromTemplate, getTemplateById } from '../constants/drillTemplates';
import { calculateNormalizedCompositeScore, calculateNormalizedCompositeScores } from '../utils/normalizedScoring';

const PlayerScorecardGenerator = ({ player, allPlayers = [], weights = {}, selectedDrillTemplate = 'football' }) => {
  const { selectedEvent } = useEvent();
  const { showSuccess } = useToast();
  
  const [showPreview, setShowPreview] = useState(false);
  const [includeComparison, setIncludeComparison] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [coachNotes, setCoachNotes] = useState('');
  
  const template = getTemplateById(selectedDrillTemplate);
  const drills = getDrillsFromTemplate(selectedDrillTemplate);
  
  // Calculate player stats using normalized scoring
  const playerStats = React.useMemo(() => {
    if (!player) return null;
    
    // Convert decimal weights to percentage format expected by normalized scoring
    const percentageWeights = {};
    Object.entries(weights).forEach(([key, value]) => {
      percentageWeights[key] = value * 100; // Convert 0.2 to 20
    });
    
    const compositeScore = calculateNormalizedCompositeScore(player, allPlayers, percentageWeights);
    
    // Calculate rank among age group
    const ageGroupPlayers = allPlayers.filter(p => p.age_group === player.age_group);
    const rankedPlayers = calculateNormalizedCompositeScores(ageGroupPlayers, percentageWeights)
      .sort((a, b) => b.compositeScore - a.compositeScore);
    
    const rank = rankedPlayers.findIndex(p => p.id === player.id) + 1;
    const totalInAgeGroup = rankedPlayers.length;
    const percentile = Math.round(((totalInAgeGroup - rank + 1) / totalInAgeGroup) * 100);
    
    return {
      compositeScore,
      rank,
      totalInAgeGroup,
      percentile
    };
  }, [player, allPlayers, weights]);

  // Calculate drill-specific rankings and recommendations
  const drillAnalysis = React.useMemo(() => {
    if (!player || !playerStats) return [];
    
    return drills.map(drill => {
      const playerScore = player[drill.key];
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
        p.age_group === player.age_group && p[drill.key] !== null && p[drill.key] !== undefined
      );
      
      const sortedByDrill = ageGroupPlayers.sort((a, b) => {
        if (drill.lowerIsBetter) {
          return a[drill.key] - b[drill.key];
        } else {
          return b[drill.key] - a[drill.key];
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

  const generatePDFReport = () => {
    // In a real implementation, this would generate a proper PDF
    // For now, we'll create an HTML version that can be printed as PDF
    const reportHtml = generateReportHTML();
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.print();
    
    showSuccess('Scorecard generated! Use your browser\'s print function to save as PDF.');
  };

  const generateReportHTML = () => {
    if (!player || !playerStats) return '';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${player.name} - Player Scorecard</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: var(--color-text); }
            .header { text-align: center; border-bottom: 2px solid var(--color-primary); padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: var(--color-primary); }
            .player-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 18px; font-weight: bold; color: var(--color-primary); border-bottom: 1px solid var(--color-border); padding-bottom: 5px; margin-bottom: 15px; }
            .drill-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
            .drill-card { border: 1px solid var(--color-border); border-radius: 8px; padding: 15px; }
            .drill-title { font-weight: bold; margin-bottom: 10px; }
            .score-large { font-size: 24px; font-weight: bold; color: var(--color-primary); }
            .rank-info { font-size: 14px; color: var(--color-text-muted); margin-top: 5px; }
            .recommendation { font-size: 12px; color: var(--color-text); margin-top: 10px; font-style: italic; }
            .summary-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; margin-bottom: 20px; }
            .stat-box { border: 1px solid var(--color-border); border-radius: 8px; padding: 15px; }
            .stat-number { font-size: 28px; font-weight: bold; color: var(--color-primary); }
            .stat-label { font-size: 12px; color: var(--color-text-muted); margin-top: 5px; }
            .notes-section { background-color: var(--color-surface-subtle); border-radius: 8px; padding: 15px; }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: var(--color-text-muted); }
            @media print { body { margin: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">🏆 WooCombine Player Scorecard</div>
              <div style="margin-top: 10px; font-size: 14px; color: var(--color-text-muted);">
              ${selectedEvent?.name || 'Evaluation Event'} - ${new Date().toLocaleDateString()}
            </div>
          </div>
          
          <div class="player-info">
            <div>
              <h1 style="margin: 0; font-size: 28px;">${player.name}</h1>
              <div style="color: var(--color-text-muted); margin-top: 5px;">
                Player #${player.number || 'N/A'} - Age Group: ${player.age_group || 'N/A'}
              </div>
            </div>
            <div style="text-align: right;">
              <div class="score-large">${playerStats.compositeScore.toFixed(1)}</div>
              <div style="font-size: 14px; color: var(--color-text-muted);">Composite Score</div>
            </div>
          </div>
          
          <div class="summary-stats">
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
            <div class="drill-grid">
              ${drillAnalysis.map(drill => `
                <div class="drill-card">
                  <div class="drill-title">${drill.label}</div>
                  <div class="score-large">
                    ${drill.playerScore !== null && drill.playerScore !== undefined ? drill.playerScore + ' ' + drill.unit : 'Not Evaluated'}
                  </div>
                  ${drill.rank ? `
                    <div class="rank-info">
                      Rank: ${drill.rank} of ${allPlayers.filter(p => p.age_group === player.age_group && p[drill.key] !== null && p[drill.key] !== undefined).length} 
                      (${drill.percentile}th percentile)
                    </div>
                  ` : ''}
                  ${includeRecommendations ? `
                    <div class="recommendation">${drill.recommendation}</div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          
          ${coachNotes ? `
            <div class="section">
              <div class="section-title">💬 Coach Notes</div>
              <div class="notes-section">
                ${coachNotes.replace(/\n/g, '<br>')}
              </div>
            </div>
          ` : ''}
          
          <div class="section">
            <div class="section-title">🎯 ${template?.name || 'Evaluation'} Summary</div>
            <div style="background-color: color-mix(in srgb, var(--color-primary) 10%, white); border: 1px solid var(--color-primary); border-radius: 8px; padding: 15px;">
              <p><strong>Overall Assessment:</strong> ${player.name} scored ${playerStats.compositeScore.toFixed(1)} 
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
            Generated by WooCombine - ${new Date().toLocaleString()} - 
            Event: ${selectedEvent?.name || 'N/A'}
          </div>
        </body>
      </html>
    `;
  };

  const shareViaEmail = () => {
    const subject = `${player.name} - Player Scorecard from ${selectedEvent?.name || 'Evaluation'}`;
    const body = `Hi,

Please find ${player.name}'s evaluation scorecard attached.

Key Highlights:
- Overall Score: ${playerStats.compositeScore.toFixed(1)}
- Rank: ${playerStats.rank} of ${playerStats.totalInAgeGroup} in ${player.age_group} age group
- Percentile: ${playerStats.percentile}th percentile

Top Performing Areas:
${drillAnalysis
  .filter(drill => drill.percentile && drill.percentile >= 70)
  .map(drill => `- ${drill.label}: ${drill.playerScore} ${drill.unit} (${drill.percentile}th percentile)`)
  .join('\n')}

${coachNotes ? `Coach Notes:\n${coachNotes}` : ''}

Best regards,
${selectedEvent?.name || 'Coaching Staff'}

Generated by WooCombine - ${new Date().toLocaleDateString()}`;

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
    
    showSuccess('Email draft opened! You can attach the PDF scorecard to the email.');
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
            Create professional scorecard for {player.name}
          </p>
        </div>
      </div>

      {/* Player Summary */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900">{player.name}</h3>
              <p className="text-sm text-blue-700">
                #{player.number} - {player.age_group} - Score: {playerStats?.compositeScore.toFixed(1)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              #{playerStats?.rank}
            </div>
            <div className="text-xs text-blue-700">
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
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={generatePDFReport}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Generate PDF
        </button>
        <button
          onClick={shareViaEmail}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Mail className="w-4 h-4" />
          Share via Email
        </button>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors"
        >
          <FileText className="w-4 h-4" />
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
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
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Trophy className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-900 mb-1">Professional Player Communication</h4>
            <ul className="text-sm text-green-800 space-y-1">
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