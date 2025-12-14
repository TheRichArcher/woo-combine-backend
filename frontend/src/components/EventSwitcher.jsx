import React, { useState, useEffect } from "react";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import { ChevronDown, CheckCircle, Plus, Calendar, MapPin } from 'lucide-react';
import CreateEventModal from "./CreateEventModal";

export default function EventSwitcher({ isOpen, onClose }) {
  const { events, selectedEvent, setSelectedEvent, setEvents, refreshEvents } = useEvent();
  const { userRole } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Close when clicking outside - handled by parent usually, but good to have safety
  useEffect(() => {
    if (!isOpen) return;
    
    // Add escape key listener
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    onClose();
  };

  const handleEventCreated = (newEvent) => {
    setEvents(prev => [newEvent, ...prev]);
    setSelectedEvent(newEvent);
    setShowCreateModal(false);
    onClose();
  };

  if (!isOpen) return null;
  if (!events || !Array.isArray(events)) return null;

  return (
    <>
      {/* Invisible backdrop to close dropdown when clicking outside */}
      <div 
        className="fixed inset-0 z-40 cursor-default" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
        <div className="px-4 py-2 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Switch Event</h3>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {events && events.length > 0 ? (
            events.map(event => {
              const isSelected = selectedEvent?.id === event.id;
              const dateLabel = event.date && !isNaN(Date.parse(event.date)) 
                ? new Date(event.date).toLocaleDateString() 
                : '';
                
              return (
                <button
                  key={event.id}
                  onClick={() => handleSelectEvent(event)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3 transition-colors ${
                    isSelected ? 'bg-brand-primary/5' : ''
                  }`}
                >
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    isSelected ? 'bg-brand-primary' : 'bg-gray-300'
                  }`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${
                      isSelected ? 'text-brand-primary' : 'text-gray-900'
                    }`}>
                      {event.name}
                    </div>
                    {(dateLabel || event.location) && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-2">
                        {dateLabel && <span>{dateLabel}</span>}
                        {event.location && (
                          <>
                            <span>•</span>
                            <span className="truncate">{event.location}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {isSelected && <CheckCircle className="w-4 h-4 text-brand-primary flex-shrink-0" />}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              No events found.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-100 p-2 space-y-1">
          {userRole === 'organizer' && (
            <button
              onClick={() => {
                // Keep dropdown open but show modal on top? 
                // Better to close dropdown and show modal.
                // But CreateEventModal is usually rendered by parent.
                // We'll render it here or trigger parent.
                // Actually, render it here via portal or local state.
                setShowCreateModal(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-brand-primary hover:bg-brand-primary/5 rounded-lg transition font-medium"
            >
              <Plus className="w-4 h-4" />
              Create New Event
            </button>
          )}
        </div>
      </div>

      <CreateEventModal 
        open={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onCreated={handleEventCreated}
      />
    </>
  );
}
