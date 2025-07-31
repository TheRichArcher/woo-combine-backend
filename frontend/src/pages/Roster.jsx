import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { Search } from 'lucide-react';
import api from '../lib/api';
import { playerLogger } from '../utils/logger';

export default function Roster() {
  const { user, selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');



  // Generate random initials for players
  const getPlayerInitials = (name) => {
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Generate a consistent color for each player based on their name
  const getPlayerColor = (name) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-gray-500'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  useEffect(() => {
    async function fetchPlayers() {
      if (!selectedEvent || !user || !selectedLeagueId) return;
      try {
        setLoading(true);
        const { data } = await api.get(`/players?event_id=${selectedEvent.id}`);
        setPlayers(data);
      } catch (error) {
        playerLogger.error('Error fetching players', error);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, [selectedEvent, user, selectedLeagueId]);

  const filteredPlayers = players.filter(player => 
    player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.number.toString().includes(searchTerm)
  );

  const groupedPlayers = filteredPlayers.reduce((groups, player) => {
    const ageGroup = player.age_group || 'Unknown';
    if (!groups[ageGroup]) {
      groups[ageGroup] = [];
    }
    groups[ageGroup].push(player);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 mt-20">
        {/* Page Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Team Roster</h2>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading players...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedPlayers).length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500">No players found</div>
              </div>
            ) : (
              Object.entries(groupedPlayers).map(([ageGroup, ageGroupPlayers]) => (
                <div key={ageGroup} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                    <h3 className="font-bold text-gray-900">{ageGroup}</h3>
                    <p className="text-sm text-gray-600">{ageGroupPlayers.length} player{ageGroupPlayers.length !== 1 ? 's' : ''}</p>
                  </div>
                  
                  <div className="divide-y divide-gray-200">
                    {ageGroupPlayers.map((player) => (
                      <div key={player.id} className="px-4 py-4 flex items-center space-x-3">
                        {/* Player Avatar */}
                        <div className={`w-12 h-12 ${getPlayerColor(player.name)} rounded-full flex items-center justify-center`}>
                          <span className="text-white font-bold text-sm">
                            {getPlayerInitials(player.name)}
                          </span>
                        </div>
                        
                        {/* Player Info */}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{player.name}</div>
                          <div className="text-sm text-gray-600">#{player.number}</div>
                        </div>
                        
                        {/* Player Status */}
                        <div className="text-right">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>


    </div>
  );
} 