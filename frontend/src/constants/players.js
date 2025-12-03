console.log('Loading players.js');

// Player-related constants for WooCombine App
import {
  getDefaultFootballTemplate,
  getDrillsFromTemplate,
  getDefaultWeightsFromTemplate
} from './drillTemplates.js';
import { getDrillsForEvent as getDrillsFromSchema } from '../services/schemaService';

// Dynamic function to get drills based on event schema (preferred) or fallback to template
export const getDrillsForEvent = async (event) => {
  if (!event?.id) {
    // Fallback to template system for backward compatibility
    const templateId = event?.drillTemplate || 'football';
    return getDrillsFromTemplate(templateId);
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
  const templateId = event?.drillTemplate || 'football';
  return getDrillsFromTemplate(templateId);
};

// Dynamic function to get weights based on event template
export const getWeightsForEvent = (event) => {
  const templateId = event?.drillTemplate || 'football';
  return getDefaultWeightsFromTemplate(templateId);
};

// Getter functions to avoid top-level function calls
export const getDefaultDrills = () => {
  const defaultTemplate = getDefaultFootballTemplate();
  return defaultTemplate.drills;
};

export const getDefaultWeights = () => {
  const defaultTemplate = getDefaultFootballTemplate();
  return defaultTemplate.defaultWeights;
};

export const getDefaultPresets = () => {
  const defaultTemplate = getDefaultFootballTemplate();
  return defaultTemplate.presets;
};

// Legacy exports for backward compatibility - move to functions to avoid top-level calls
export const getFootballDrills = () => getDrillsFromTemplate('football');
export const getFootballWeights = () => getDefaultWeightsFromTemplate('football');

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