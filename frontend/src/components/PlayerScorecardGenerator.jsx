import React, { useMemo, useState } from 'react';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Share2,
  Download,
  FileText,
  Award,
  User,
  Trophy
} from 'lucide-react';
import Button from './ui/Button';
import { getDrillsFromTemplate, getTemplateById } from '../constants/drillTemplates';
import { formatViewerPlayerName } from '../utils/playerDisplayName';
import {
  buildPlayerScorecardPayload,
  downloadPlayerScorecardPdf,
  generatePlayerScorecardHTML
} from '../utils/playerScorecardReport';

const PlayerScorecardGenerator = ({
  player,
  allPlayers = [],
  weights = {},
  selectedDrillTemplate = 'football',
  drills: providedDrills = []
}) => {
  const { selectedEvent } = useEvent();
  const { userRole } = useAuth();
  const { showSuccess } = useToast();
  
  const [showPreview, setShowPreview] = useState(false);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [coachNotes, setCoachNotes] = useState('');
  
  const template = getTemplateById(selectedDrillTemplate);
  const drills = useMemo(() => {
    if (Array.isArray(providedDrills) && providedDrills.length > 0) {
      return providedDrills;
    }
    return getDrillsFromTemplate(selectedDrillTemplate);
  }, [providedDrills, selectedDrillTemplate]);
  const displayName = formatViewerPlayerName(player, userRole);
  
  const scorecardPayload = useMemo(
    () =>
      buildPlayerScorecardPayload({
        player,
        allPlayers,
        weights,
        drills,
        includeRecommendations
      }),
    [player, allPlayers, weights, drills, includeRecommendations]
  );
  const playerStats = scorecardPayload?.playerStats;
  const drillAnalysis = scorecardPayload?.drillAnalysis || [];

  if (userRole === 'viewer') {
    return null;
  }

  const previewHTML = useMemo(() => {
    if (!player || !playerStats) return '';
    return generatePlayerScorecardHTML({
      player,
      displayName,
      selectedEvent,
      templateName: template?.name,
      drills,
      playerStats,
      drillAnalysis,
      includeRecommendations,
      coachNotes
    });
  }, [player, playerStats, displayName, selectedEvent, template?.name, drills, drillAnalysis, includeRecommendations, coachNotes]);

  const generatePDFReport = () => {
    const opened = downloadPlayerScorecardPdf({
      player,
      displayName,
      selectedEvent,
      templateName: template?.name,
      drills,
      allPlayers,
      weights,
      includeRecommendations,
      coachNotes
    });

    if (opened) {
      showSuccess('Scorecard generated! Use your browser\'s print function to save as PDF.');
    }
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
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
        <div className="flex items-center">
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

      {/* Custom export actions */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button variant="primary" onClick={generatePDFReport} className="gap-2">
          <Download className="w-4 h-4" />
          Export with Custom Settings
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
      <p className="text-xs text-gray-500 mb-6">
        Use Quick Email Report above for the email draft action.
      </p>

      {/* Preview */}
      {showPreview && (
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
          <h3 className="font-bold text-gray-900 mb-4">Scorecard Preview</h3>
          <div className="bg-white rounded border p-4 max-h-96 overflow-y-auto text-sm">
            {/* Preview is rendered using shared scorecard report utility */}
            <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
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