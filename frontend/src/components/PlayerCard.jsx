import React, { memo } from 'react';
import { Edit, Eye, Trophy } from 'lucide-react';

const PlayerCard = memo(function PlayerCard({ 
  player, 
  onEdit, 
  onViewStats, 
  canEdit = false, 
  showRank = false,
  showScore = false 
}) {
  const playerNumber = player.number || '#';
  const playerAge = player.age_group || 'N/A';
  const playerName = player.name || 'Unknown Player';
  
  // Get initials for avatar
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleEdit = () => {
    if (onEdit) onEdit(player);
  };

  const handleViewStats = () => {
    if (onViewStats) onViewStats(player);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          {/* Player Avatar */}
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {getInitials(playerName)}
          </div>
          
          {/* Player Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{playerName}</h3>
              {showRank && player.rank && (
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-600">#{player.rank}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span>#{playerNumber}</span>
              <span>{playerAge}</span>
              {showScore && player.composite_score !== undefined && (
                <span className="font-medium text-blue-600">
                  Score: {player.composite_score.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          {onViewStats && (
            <button
              onClick={handleViewStats}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="View Stats"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          
          {canEdit && onEdit && (
            <button
              onClick={handleEdit}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
              title="Edit Player"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// Define prop types for better debugging
PlayerCard.displayName = 'PlayerCard';

export default PlayerCard; 