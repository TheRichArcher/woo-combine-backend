import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Schedule() {
  const [currentMonth, setCurrentMonth] = useState(new Date());



  // Mock schedule data - you can replace this with real data from your API
  const scheduleEvents = [
    {
      id: 1,
      type: 'PRACTICE',
      title: 'Practice Session',
      date: '2024-06-15',
      time: '12:00 PM - 12:50 PM',
      location: 'Location TBD',
      status: 'upcoming'
    },
    {
      id: 2,
      type: 'PRACTICE',
      title: 'Practice Session',
      date: '2024-06-22',
      time: '12:00 PM - 12:50 PM',
      location: 'Location TBD',
      status: 'upcoming'
    },
    {
      id: 3,
      type: 'GAME',
      title: 'Championship Game',
      date: '2024-06-29',
      time: '2:00 PM - 3:30 PM',
      location: 'Main Field',
      status: 'upcoming'
    }
  ];

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
      const hasEvent = scheduleEvents.some(event => event.date === dateStr);
      days.push({ day, hasEvent, dateStr });
    }
    
    return days;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 mt-20">
        {/* Page Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Schedule</h2>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <button 
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            
            <h3 className="text-lg font-semibold text-gray-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            
            <button 
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-full"
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
                className="px-2 py-3 text-center text-sm border-r border-b border-gray-100 min-h-[48px] flex items-center justify-center relative"
              >
                {day && (
                  <>
                    <span className={`${day.hasEvent ? 'font-bold text-purple-600' : 'text-gray-900'}`}>
                      {day.day}
                    </span>
                    {day.hasEvent && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-purple-500 rounded-full"></div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900">Upcoming Events</h3>
          
          {scheduleEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4">
                <div className="flex">
                  {/* Colored accent bar */}
                  <div className={`w-1 ${event.type === 'PRACTICE' ? 'bg-purple-500' : 'bg-green-500'} rounded-full mr-4`}></div>
                  
                  <div className="flex-1">
                    {/* Event Type */}
                    <div className={`${event.type === 'PRACTICE' ? 'text-purple-600' : 'text-green-600'} font-bold text-sm uppercase tracking-wide mb-1`}>
                      {event.type}
                    </div>
                    
                    {/* Event Title */}
                    <div className="font-bold text-lg text-gray-900 mb-1">
                      {event.title}
                    </div>
                    
                    {/* Date and Time */}
                    <div className="text-gray-700 text-sm mb-2">
                      {new Date(event.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })} • {event.time}
                    </div>
                    
                    {/* Location */}
                    <div className="flex items-center text-gray-600 text-sm">
                      <span className="mr-1">📍</span>
                      {event.location}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
  );
} 