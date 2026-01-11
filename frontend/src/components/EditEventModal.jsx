import React from "react";
import EventFormModal from "./EventFormModal";

/**
 * EditEventModal - THIN WRAPPER (Canonical: EventFormModal)
 * 
 * This component exists for backward compatibility only.
 * All edit logic lives in EventFormModal.jsx
 * 
 * CRITICAL: key prop forces EventFormModal to remount when editing different events
 * This eliminates useEffect race conditions entirely
 */
export default function EditEventModal({ open, onClose, event, onUpdated }) {
  return (
    <EventFormModal
      key={event?.id || 'edit'}  // Force remount on event change
      open={open}
      onClose={onClose}
      mode="edit"
      event={event}
      onSuccess={onUpdated}
    />
  );
}
