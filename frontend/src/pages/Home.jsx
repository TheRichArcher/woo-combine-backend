import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEvent } from '../context/EventContext';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check, X, Calendar, Users, MessageCircle, Video, Clipboard, Home as HomeIcon } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const { selectedEvent } = useEvent();
  const navigate = useNavigate();
  const [showEventDropdown, setShowEventDropdown] = useState(false);

  // Mock data for upcoming events - you can replace this with real data from your API
  const upcomingEvents = [
    {
      id: 1,
      type: 'PRACTICE',
      date: 'JUN Sunday, 12:00 PM - 12:50 PM',
      day: '15',
      location: 'Location TBD',
      userResponse: null
    },
    {
      id: 2,
      type: 'PRACTICE', 
      date: 'JUN Sunday, 12:00 PM - 12:50 PM',
      day: '22',
      location: 'Location TBD',
      userResponse: null
    }
  ];

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

  const handleEventResponse = (eventId, response) => {
    // TODO: Implement event response logic
    console.log(`Event ${eventId} response: ${response}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          {/* User Avatar */}
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">{getUserInitials()}</span>
          </div>

          {/* Event Title with Dropdown */}
          <div className="flex-1 text-center">
            <div 
              className="flex items-center justify-center cursor-pointer"
              onClick={() => setShowEventDropdown(!showEventDropdown)}
            >
              <h1 className="text-xl font-bold text-gray-900">
                {selectedEvent?.name || "Lil' Ballers Fall 24"}
              </h1>
              <ChevronDown className="w-5 h-5 ml-2 text-gray-600" />
              <div className="w-2 h-2 bg-red-500 rounded-full ml-1"></div>
            </div>
            
            {/* League Name */}
            <div className="flex items-center justify-center mt-1">
              <div className="w-4 h-3 bg-cmf-primary mr-2 flex items-center justify-center">
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
        {/* Up Next Section */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Up Next</h2>
          <div className="flex space-x-2">
            <Calendar className="w-6 h-6 text-cmf-primary" />
            <div className="w-6 h-6 text-gray-400">➕</div>
          </div>
        </div>

        {/* Event Cards */}
        <div className="space-y-4 mb-6">
          {upcomingEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4">
                <div className="flex">
                  {/* Purple accent bar */}
                  <div className="w-1 bg-purple-500 rounded-full mr-4"></div>
                  
                  <div className="flex-1">
                    {/* Event Type */}
                    <div className="text-purple-600 font-bold text-sm uppercase tracking-wide mb-1">
                      {event.type}
                    </div>
                    
                    {/* Date and Time */}
                    <div className="flex items-center mb-2">
                      <div className="font-bold text-lg text-gray-900 mr-3">
                        {event.date}
                      </div>
                      <div className="text-3xl font-bold text-gray-900">
                        {event.day}
                      </div>
                    </div>
                    
                    {/* Location */}
                    <div className="flex items-center text-gray-600 text-sm mb-3">
                      <span className="mr-1">📍</span>
                      {event.location}
                    </div>
                    
                    {/* Response Section */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mr-3">
                          <span className="text-white font-bold text-sm">{getUserInitials()}</span>
                        </div>
                        <span className="text-gray-900 font-medium">Are you going?</span>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEventResponse(event.id, 'yes')}
                          className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-green-500 transition-colors"
                        >
                          <Check className="w-5 h-5 text-green-500" />
                        </button>
                        <button
                          onClick={() => handleEventResponse(event.id, 'no')}
                          className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-red-500 transition-colors"
                        >
                          <X className="w-5 h-5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All Events */}
        <button className="w-full text-left py-3 flex items-center justify-between border-b border-gray-200">
          <span className="text-gray-900 font-medium">View All Events</span>
          <ChevronDown className="w-5 h-5 text-gray-400 rotate-270" />
        </button>

        {/* Browse Training Videos & Plans */}
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Browse Training Videos & Plans
          </h3>
          <p className="text-gray-600 mb-6">
            Plan practices with team activities and practice plans, or build skills from your backyard with home training.
          </p>
          
          {/* Training Icons */}
          <div className="flex justify-center space-x-8">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <div className="text-2xl">🔄</div>
            </div>
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <Clipboard className="w-8 h-8 text-cmf-primary" />
            </div>
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <div className="text-2xl">🏠</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around items-center">
          <button className="flex flex-col items-center py-2">
            <HomeIcon className="w-6 h-6 text-purple-600" />
            <span className="text-xs text-purple-600 font-medium mt-1">Home</span>
          </button>
          
          <button 
            onClick={() => navigate('/roster')}
            className="flex flex-col items-center py-2"
          >
            <Users className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400 mt-1">Roster</span>
          </button>
          
          <button className="flex flex-col items-center py-2 relative">
            <MessageCircle className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400 mt-1">Chat</span>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">3</span>
            </div>
          </button>
          
          <button 
            onClick={() => navigate('/schedule')}
            className="flex flex-col items-center py-2"
          >
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