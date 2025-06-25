import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { ChevronDown, Search, Users, Calendar, MessageCircle, Video, Home as HomeIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Roster() {
  const { user, selectedLeagueId } = useAuth();
  const { selectedEvent } = useEvent();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Get user initials for the avatar
  const getUserInitials = () => {
    if (!user?.email) return 'RA';
    const email = user.email;
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

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
        console.error('Error fetching players:', error);
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
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          {/* User Avatar */}
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">{getUserInitials()}</span>
          </div>

          {/* Event Title */}
          <div className="flex-1 text-center">
            <h1 className="text-xl font-bold text-gray-900">
              {selectedEvent?.name || "Lil' Ballers Fall 24"}
            </h1>
            <div className="flex items-center justify-center mt-1">
              <div className="w-4 h-3 bg-blue-600 mr-2 flex items-center justify-center">
                <span className="text-white text-xs font-bold">🏳️</span>
              </div>
              <p className="text-sm text-gray-600">Central Mass Flag (Worcester)</p>
            </div>
          </div>

          {/* Settings Icon */}
          <div className="w-8 h-8 flex items-center justify-center">
            <div className="w-6 h-6 text-gray-400">
              ⚙️
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6">
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

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around items-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex flex-col items-center py-2"
          >
            <HomeIcon className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400 mt-1">Home</span>
          </button>
          
          <button className="flex flex-col items-center py-2">
            <Users className="w-6 h-6 text-purple-600" />
            <span className="text-xs text-purple-600 font-medium mt-1">Roster</span>
          </button>
          
          <button className="flex flex-col items-center py-2 relative">
            <MessageCircle className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400 mt-1">Chat</span>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">3</span>
            </div>
          </button>
          
          <button className="flex flex-col items-center py-2">
            <Calendar className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400 mt-1">Schedule</span>
          </button>
          
          <button className="flex flex-col items-center py-2">
            <Video className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400 mt-1">Media</span>
          </button>
        </div>
      </div>

      {/* Add bottom padding to account for fixed nav */}
      <div className="h-20"></div>
    </div>
  );
} 