// Player-related constants for WooCombine App
import {
  getDrillsFromTemplate,
  getDefaultWeightsFromTemplate
} from './drillTemplates.js';
import { getDrillsForEvent as getDrillsFromSchema } from '../services/schemaService';

// Dynamic function to get drills based on event schema (preferred) or fallback to template
export const getDrillsForEvent = async (event) => {
  if (!event?.id) {
    // Fallback to template system
    return event?.drillTemplate ? getDrillsFromTemplate(event.drillTemplate) : [];
  }

  try {
    // Try to get drills from event schema first
    const drills = await getDrillsFromSchema(event.id);
    if (drills && drills.length > 0) {
      return drills;
    }
  } catch (error) {
    console.warn('Failed to fetch event schema, falling back to template:', error);
  }

  // Fallback to template system
  return event?.drillTemplate ? getDrillsFromTemplate(event.drillTemplate) : [];
};

// Dynamic function to get weights based on event template
export const getWeightsForEvent = (event) => {
  return event?.drillTemplate ? getDefaultWeightsFromTemplate(event.drillTemplate) : {};
};

// New dynamic exports
export {
  getDrillsFromTemplate,
  getDefaultWeightsFromTemplate,
  getAllTemplates,
  getTemplateById,
  getPresetsFromTemplate
} from './drillTemplates.js';

export const TABS = [
  {
    id: 'manage',
    label: 'Manage Roster',
    icon: 'Users',
    description: 'Add/edit players and record results'
  },
  {
    id: 'analyze',
    label: 'Analyze Rankings',
    icon: 'Download',
    description: 'Adjust weights, view rankings, and export data'
  }
];

// Age group suggestions for player forms
export const AGE_GROUP_OPTIONS = [
  "6U", "U6", "8U", "U8", "10U", "U10", "12U", "U12",
  "5-6", "7-8", "9-10", "11-12", "13-14", "15-16", "17-18"
];