import React, { memo } from 'react';
import { Edit, Eye, Trophy, Trash2, Check } from 'lucide-react';

/**
 * PlayerCard - CANONICAL PLAYER DISPLAY COMPONENT
 * 
 * Single source of truth for all player card/list renderings across the app.
 * 
 * @param {object} player - Player object with name, number, age_group, etc.
 * @param {function} onEdit - Optional edit callback
 * @param {function} onViewStats - Optional view stats callback
 * @param {function} onDelete - Optional delete callback
 * @param {function} onSelect - Optional select callback (for selection mode)
 * @param {boolean} canEdit - Show edit button
 * @param {boolean} canDelete - Show delete button
 * @param {boolean} showRank - Show rank with trophy icon
 * @param {boolean} showScore - Show composite score
 * @param {boolean} selected - Selected state styling
 * @param {boolean} disabled - Disabled state
 * @param {string} variant - 'card' | 'compact' | 'list'
 * @param {number} rankIndex - Manual rank index (for rankings list)
 * @param {string} className - Additional CSS classes
 */
const PlayerCard = memo(function PlayerCard({ 
  player, 
  onEdit, 
  onViewStats,
  onDelete,
  onSelect,
  canEdit = false,
  canDelete = false,
  showRank = false,
  showScore = false,
  selected = false,
  disabled = false,
  variant = 'card', // 'card' | 'compact' | 'list'
  rankIndex = null,
  className = ''
}) {
  if (!player) return null;
  
  const playerNumber = player.number || player.jersey_number || '#';
  const playerAge = player.age_group || 'N/A';
  const playerName = player.name || 'Unknown Player';
  const displayRank = rankIndex !== null ? rankIndex + 1 : player.rank;
  const displayScore = player.weightedScore !== undefined ? player.weightedScore : player.composite_score;
  
  // Get initials for avatar
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleEdit = (e) => {
    e?.stopPropagation();
    if (onEdit && !disabled) onEdit(player);
  };

  const handleViewStats = (e) => {
    e?.stopPropagation();
    if (onViewStats && !disabled) onViewStats(player);
  };

  const handleDelete = (e) => {
    e?.stopPropagation();
    if (onDelete && !disabled) onDelete(player);
  };

  const handleSelect = (e) => {
    e?.stopPropagation();
    if (onSelect && !disabled) onSelect(player);
  };

  // Base classes
  const baseClasses = `
    bg-white rounded-lg transition-shadow
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${selected ? 'ring-2 ring-blue-500 shadow-lg' : 'border border-gray-200'}
    ${onSelect && !disabled ? 'cursor-pointer hover:shadow-md' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // Variant-specific rendering
  if (variant === 'compact') {
    // Compact variant: For rankings lists, very minimal spacing
    return (
      <div 
        className={`${baseClasses} p-2 hover:bg-gray-50`}
        onClick={handleSelect}
      >
        <div className="flex items-center gap-2">
          {/* Rank Number */}
          {(showRank || rankIndex !== null) && (
            <div className="font-bold w-6 text-center text-gray-500 text-sm">
              {displayRank}
            </div>
          )}
          
          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate text-sm">
              {playerName}
            </div>
            <div className="text-xs text-gray-500">
              #{playerNumber}
            </div>
          </div>
          
          {/* Score */}
          {showScore && displayScore !== undefined && (
            <div className="font-bold text-blue-600 text-sm">
              {displayScore.toFixed(1)}
            </div>
          )}
          
          {/* Selected Indicator */}
          {selected && (
            <div className="text-blue-600">
              <Check className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    // List variant: Table-like row, more horizontal space
    return (
      <div 
        className={`${baseClasses} p-3 hover:bg-gray-50`}
        onClick={handleSelect}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Rank */}
            {(showRank || rankIndex !== null) && (
              <div className="font-bold w-8 text-center">
                {displayRank}
              </div>
            )}
            
            {/* Avatar */}
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
              {getInitials(playerName)}
            </div>
            
            {/* Name & Number */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">
                {playerName}
              </div>
              <div className="text-sm text-gray-500">
                #{playerNumber} • {playerAge}
              </div>
            </div>
            
            {/* Score */}
            {showScore && displayScore !== undefined && (
              <div className="text-right">
                <div className="font-bold text-blue-600">
                  {displayScore.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">Score</div>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 ml-4">
            {onViewStats && (
              <button
                onClick={handleViewStats}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                title="View Stats"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            
            {canEdit && onEdit && (
              <button
                onClick={handleEdit}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                title="Edit Player"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            
            {canDelete && onDelete && (
              <button
                onClick={handleDelete}
                disabled={disabled}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                title="Delete Player"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            
            {selected && (
              <div className="text-blue-600 p-2">
                <Check className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default 'card' variant: Full-featured card with avatar
  return (
    <div 
      className={`${baseClasses} p-4 hover:shadow-md`}
      onClick={handleSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          {/* Player Avatar */}
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {getInitials(playerName)}
          </div>
          
          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">
                {playerName}
              </h3>
              {showRank && displayRank && (
                <div className="flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-600">
                    #{displayRank}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              <span>#{playerNumber}</span>
              <span>{playerAge}</span>
              {showScore && displayScore !== undefined && (
                <span className="font-medium text-blue-600">
                  Score: {displayScore.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 flex-shrink-0">
          {onViewStats && (
            <button
              onClick={handleViewStats}
              disabled={disabled}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
              title="View Stats"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          
          {canEdit && onEdit && (
            <button
              onClick={handleEdit}
              disabled={disabled}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
              title="Edit Player"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          
          {canDelete && onDelete && (
            <button
              onClick={handleDelete}
              disabled={disabled}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
              title="Delete Player"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          
          {selected && (
            <div className="text-blue-600 p-2">
              <Check className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * PlayerCardSkeleton - Loading state
 */
export const PlayerCardSkeleton = memo(function PlayerCardSkeleton({ variant = 'card' }) {
  if (variant === 'compact') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-2 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 bg-gray-200 rounded"></div>
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-2 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="w-8 h-3 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
          <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
});

/**
 * PlayerCardEmpty - Empty state
 */
export const PlayerCardEmpty = memo(function PlayerCardEmpty({ message = "No players found" }) {
  return (
    <div className="text-center py-8 text-gray-500">
      {message}
    </div>
  );
});

// Define prop types for better debugging
PlayerCard.displayName = 'PlayerCard';

export default PlayerCard;
