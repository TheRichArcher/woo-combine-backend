import React, { useEffect, useMemo } from "react";
import { Download, Mail, X } from 'lucide-react';
import PlayerDetailsPanel from './PlayerDetailsPanel';
import RecordedResultsSection from './RecordedResultsSection';
import { calculateOptimizedCompositeScore, calculateOptimizedRankingsAcrossAll } from '../../utils/optimizedScoring';
import { useAuth } from '../../context/AuthContext';
import { useEvent } from '../../context/EventContext';
import { useToast } from '../../context/ToastContext';
import { formatViewerPlayerName } from '../../utils/playerDisplayName';
import { createScorecardEmailDraft, downloadPlayerScorecardPdf } from '../../utils/playerScorecardReport';

const PlayerDetailsModal = React.memo(function PlayerDetailsModal({ 
  player, 
  allPlayers, 
  onClose, 
  persistedWeights, 
  sliderWeights, 
  persistSliderWeights,
  handleWeightChange, 
  activePreset, 
  applyPreset,
  drills = [],
  presets = {},
  normalizeAcrossAll = false,
  canManageResults = false,
  manageResultsDisabledReason = "",
  onResultsChanged
}) {
  const { userRole } = useAuth();
  const { selectedEvent } = useEvent();
  const { showSuccess } = useToast();
  const canUseReportActions = userRole !== 'viewer';

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const compositeScore = useMemo(() => {
    if (!player || !allPlayers || !drills.length) return 0;
    // Use sliderWeights for immediate feedback when sliders are moved
    if (normalizeAcrossAll) {
      const rankings = calculateOptimizedRankingsAcrossAll(allPlayers, sliderWeights, drills);
      return rankings.find((p) => p.id === player.id)?.compositeScore || 0;
    }
    return calculateOptimizedCompositeScore(player, allPlayers, sliderWeights, drills);
  }, [player, allPlayers, sliderWeights, drills, normalizeAcrossAll]);

  if (!player) return null;

  const handleDownloadScorecard = () => {
    const opened = downloadPlayerScorecardPdf({
      player,
      displayName: formatViewerPlayerName(player, userRole),
      selectedEvent,
      drills,
      allPlayers,
      weights: sliderWeights
    });

    if (opened) {
      showSuccess('Scorecard generated! Use your browser print dialog to save as PDF.');
    }
  };

  const handleEmailScorecard = () => {
    const mailtoLink = createScorecardEmailDraft({
      player,
      displayName: formatViewerPlayerName(player, userRole),
      selectedEvent,
      allPlayers,
      weights: sliderWeights,
      drills
    });
    if (!mailtoLink) return;
    window.location.href = mailtoLink;
    showSuccess('Email client opened with scorecard summary.');
  };

  return (
    <div className="fixed inset-0 wc-overlay flex items-center justify-center z-50 p-4 bg-black/50 backdrop-blur-sm" style={{zIndex: 9999}} onClick={onClose}>
        <div className="wc-card w-full max-w-xl max-h-[85vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
          <div>
              <h2 className="text-lg font-bold leading-tight text-gray-900">{formatViewerPlayerName(player, userRole)}</h2>
              <p className="text-brand-light text-xs">
                {player.number != null && player.number !== '' ? `#${player.number} • ` : ''}
                {player.age_group}
              </p>
            </div>
            <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>
            <div className="hidden sm:block">
               <div className="text-xl font-bold text-brand-primary leading-none">
                 {compositeScore.toFixed(1)}
               </div>
               <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Score</div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 bg-gray-50 hover:bg-gray-100 rounded-full flex items-center justify-center transition ml-auto"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
           <PlayerDetailsPanel 
              player={player}
              allPlayers={allPlayers}
              persistedWeights={persistedWeights}
              sliderWeights={sliderWeights}
              persistSliderWeights={persistSliderWeights}
              handleWeightChange={handleWeightChange}
              activePreset={activePreset}
              applyPreset={applyPreset}
              drills={drills}
              presets={presets}
              normalizeAcrossAll={normalizeAcrossAll}
              readOnly={userRole === 'viewer'}
           />
           <RecordedResultsSection
             player={player}
             drills={drills}
             eventId={selectedEvent?.id}
             canManageResults={canManageResults}
             manageResultsDisabledReason={manageResultsDisabledReason}
             onResultsChanged={onResultsChanged}
           />
        </div>

        {canUseReportActions && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleDownloadScorecard}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition"
            >
              <Download className="w-4 h-4" />
              Download Scorecard
            </button>
            <button
              onClick={handleEmailScorecard}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-100 transition"
            >
              <Mail className="w-4 h-4" />
              Email Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default PlayerDetailsModal;