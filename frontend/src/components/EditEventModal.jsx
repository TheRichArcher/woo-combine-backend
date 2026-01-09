import React from "react";
import EventFormModal from "./EventFormModal";

/**
 * EditEventModal - THIN WRAPPER (Canonical: EventFormModal)
 * 
 * This component exists for backward compatibility only.
 * All edit logic lives in EventFormModal.jsx
 */
export default function EditEventModal({ open, onClose, event, onUpdated }) {
  return (
    <EventFormModal
      open={open}
      onClose={onClose}
      mode="edit"
      event={event}
      onSuccess={onUpdated}
    />
  );
}
