// Player-related constants for WooCombine App
import { 
  getDefaultFootballTemplate, 
  getDrillsFromTemplate, 
  getDefaultWeightsFromTemplate 
} from './drillTemplates.js';

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
    id: 'players', 
    label: 'Player Management & Rankings', 
    icon: 'Users',
    description: 'Manage players and analyze prospects with real-time weight adjustments'
  },
  { 
    id: 'exports', 
    label: 'Export & Reports', 
    icon: 'Download',
    description: 'Export data and view analytics'
  }
];

// Age group suggestions for player forms
export const AGE_GROUP_OPTIONS = [
  "6U", "U6", "8U", "U8", "10U", "U10", "12U", "U12",
  "5-6", "7-8", "9-10", "11-12", "13-14", "15-16", "17-18"
];