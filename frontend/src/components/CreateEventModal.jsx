import React from "react";
import EventFormModal from "./EventFormModal";

/**
 * CreateEventModal - THIN WRAPPER (Canonical: EventFormModal)
 * 
 * This component exists for backward compatibility only.
 * All create logic lives in EventFormModal.jsx
 */
export default function CreateEventModal({ open, onClose, onCreated }) {
  return (
    <EventFormModal
      open={open}
      onClose={onClose}
      mode="create"
      onSuccess={onCreated}
    />
  );
}
