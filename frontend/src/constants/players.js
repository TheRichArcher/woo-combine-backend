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

// Default to football template for backward compatibility
const defaultTemplate = getDefaultFootballTemplate();

export const DRILLS = defaultTemplate.drills;
export const DRILL_WEIGHTS = defaultTemplate.defaultWeights;

// Legacy exports for backward compatibility
export const FOOTBALL_DRILLS = getDrillsFromTemplate('football');
export const FOOTBALL_WEIGHTS = getDefaultWeightsFromTemplate('football');

// New dynamic exports
export { 
  getDrillsFromTemplate, 
  getDefaultWeightsFromTemplate,
  getAllTemplates,
  getTemplateById,
  getPresetsFromTemplate
} from './drillTemplates.js';

// Use presets from default template for backward compatibility
export const WEIGHT_PRESETS = defaultTemplate.presets;

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