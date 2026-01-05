import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, Calendar, MapPin, Clock, Plus, AlertCircle, ArrowLeft } from 'lucide-react';
import { logger } from '../utils/logger';
import EventSelector from '../components/EventSelector';

export default function Schedule() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { selectedEvent, events } = useEvent();
  const { selectedLeagueId } = useAuth();

  // Convert events to schedule format with safe date handling
  // CRITICAL: Defensive filter - never render soft-deleted events
  const scheduleEvents = events.filter(event => !event.deleted_at && !event.deletedAt).map(event => {
    try {
      const eventDate = new Date(event.date);
      const isValidDate = !isNaN(eventDate.getTime());
      const isUpcoming = isValidDate && eventDate >= new Date();
      
      return {
        id: event.id,
        type: 'COMBINE',
        title: event.name || 'Untitled Event',
        date: event.date,
        time: isValidDate ? eventDate.toLocaleTimeString('en-US', { 
          hour: 'numeric',
          minute: '2-digit',
          hour12: true 
        }) : 'Time TBD',
        location: event.location || 'Location TBD',
        status: isUpcoming ? 'upcoming' : 'completed',
        description: `${event.name || 'Event'} - Player evaluation combine`
      };
    } catch (err) {
      logger.warn('SCHEDULE', 'Error processing event', { event, error: err });
      return {
        id: event.id || `error-${Date.now()}`,
        type: 'COMBINE',
        title: event.name || 'Invalid Event',
        date: event.date || new Date().toISOString().split('T')[0],
        time: 'Time TBD',
        location: 'Location TBD',
        status: 'completed',
        description: 'Event data may be corrupted'
      };
    }
  }).filter(Boolean);

  // For now, only show real events (combines) - practice scheduling to be added later
  const upcomingEvents = scheduleEvents;



  // Calendar helpers
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasEvent = upcomingEvents.some(event => event.date === dateStr);
      const dayEvents = upcomingEvents.filter(event => event.date === dateStr);
      days.push({ day, hasEvent, dateStr, events: dayEvents });
    }
    
    return days;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  const days = getDaysInMonth(currentMonth);

  // Filter upcoming events
  const futureEvents = upcomingEvents.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= new Date();
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!selectedLeagueId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-6 mt-20">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No League Selected</h2>
              <p className="text-gray-600 mb-6">
                Please select a league to view your schedule
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 mt-0">
        {/* Navigation Affordance */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="font-medium">Back to Dashboard</span>
          </Link>
          <div className="flex gap-3">
            <Link to="/players" className="text-sm font-medium text-brand-primary hover:text-brand-secondary bg-brand-light/10 px-3 py-1.5 rounded-lg border border-brand-primary/20">
              Manage Players
            </Link>
            <Link to="/live-entry" className="text-sm font-medium text-brand-primary hover:text-brand-secondary bg-brand-light/10 px-3 py-1.5 rounded-lg border border-brand-primary/20">
              Live Entry
            </Link>
          </div>
        </div>

        {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-brand-primary" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Schedule</h2>
              {selectedEvent && (
                <p className="text-sm text-gray-600">
                  {selectedEvent.name} • {futureEvents.length} upcoming events
                </p>
              )}
            </div>
          </div>
          
          {!selectedEvent && events.length > 0 && (
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-2">Select an event to see schedule</p>
              <EventSelector />
            </div>
          )}
        </div>

        {events.length === 0 ? (
          <div className="bg-semantic-warning/10 border border-semantic-warning/20 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-semantic-warning mt-0.5" />
              <div>
                <h3 className="font-semibold text-semantic-warning mb-2">No Events Found</h3>
                <p className="text-semantic-warning/90 mb-3">
                  You don't have any events in your current league yet.
                  Create or join an event to see your schedule.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <button 
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-full"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <h3 className="text-lg font-semibold text-gray-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            
            <button 
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-full"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {daysOfWeek.map(day => (
              <div key={day} className="px-2 py-2 text-center text-sm font-medium text-gray-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => (
              <div 
                key={index} 
                className="px-2 py-3 text-center text-sm border-r border-b border-gray-100 min-h-[64px] flex flex-col items-center justify-start relative hover:bg-gray-50 transition-colors"
                title={day?.events?.length > 0 ? day.events.map(e => e.title).join(', ') : ''}
              >
                {day && (
                  <>
                    <span className={`${day.hasEvent ? 'font-bold text-brand-primary' : 'text-gray-900'} mb-1`}>
                      {day.day}
                    </span>
                    {day.hasEvent && (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {day.events.slice(0, 2).map((event, eventIndex) => (
                          <div 
                            key={eventIndex}
                            className={`w-2 h-2 rounded-full ${
                              event.type === 'PRACTICE' ? 'bg-brand-accent' :
                              event.type === 'COMBINE' ? 'bg-brand-primary' :
                              'bg-semantic-success'
                            }`}
                            title={event.title}
                          ></div>
                        ))}
                        {day.events.length > 2 && (
                          <div className="text-xs text-gray-500 font-medium">
                            +{day.events.length - 2}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        {futureEvents.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Upcoming Events</h3>
              <span className="text-sm text-gray-500">{futureEvents.length} events</span>
            </div>
            
            {futureEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-4">
                  <div className="flex">
                    {/* Colored accent bar */}
                    <div className={`w-1 ${
                      event.type === 'PRACTICE' ? 'bg-brand-accent' : 
                      event.type === 'COMBINE' ? 'bg-brand-primary' : 
                      'bg-semantic-success'
                    } rounded-full mr-4`}></div>
                    
                    <div className="flex-1">
                      {/* Event Type */}
                      <div className={`${
                        event.type === 'PRACTICE' ? 'text-brand-accent bg-brand-accent/10' : 
                        event.type === 'COMBINE' ? 'text-brand-primary bg-brand-primary/10' : 
                        'text-semantic-success bg-semantic-success/10'
                      } font-bold text-xs uppercase tracking-wide mb-2 px-2 py-1 rounded-full inline-block`}>
                        {event.type}
                      </div>
                      
                      {/* Event Title */}
                      <div className="font-bold text-lg text-gray-900 mb-1">
                        {event.title}
                      </div>
                      
                      {/* Description */}
                      {event.description && (
                        <div className="text-sm text-gray-600 mb-2">
                          {event.description}
                        </div>
                      )}
                      
                      {/* Date and Time */}
                      <div className="flex items-center text-gray-700 text-sm mb-2">
                        <Clock className="w-4 h-4 mr-2" />
                        {new Date(event.date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })} at {event.time}
                      </div>
                      
                      {/* Location */}
                      <div className="flex items-center text-gray-600 text-sm">
                        <MapPin className="w-4 h-4 mr-2" />
                        {event.location}
                      </div>
                    </div>
                    
                    {/* Status indicator */}
                    <div className="flex items-start">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        event.status === 'upcoming' ? 'bg-semantic-success/10 text-semantic-success' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {event.status}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No upcoming events message */}
        {futureEvents.length === 0 && events.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">No Upcoming Events</h3>
            <p className="text-gray-600">
              All events for this league are in the past. Check back later for new events.
            </p>
          </div>
        )}
      </div>


    </div>
  );
} 