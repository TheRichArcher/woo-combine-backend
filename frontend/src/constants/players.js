// Player-related constants for WooCombine App

export const DRILLS = [
  { key: "40m_dash", label: "40-Yard Dash", unit: "sec" },
  { key: "vertical_jump", label: "Vertical Jump", unit: "in" },
  { key: "catching", label: "Catching", unit: "pts" },
  { key: "throwing", label: "Throwing", unit: "pts" },
  { key: "agility", label: "Agility", unit: "pts" },
];

export const DRILL_WEIGHTS = {
  "40m_dash": 0.3,
  "vertical_jump": 0.2,
  "catching": 0.15,
  "throwing": 0.15,
  "agility": 0.2,
};

export const WEIGHT_PRESETS = {
  balanced: {
    name: "Balanced",
    description: "Equal emphasis on all skills",
    weights: { "40m_dash": 20, "vertical_jump": 20, "catching": 20, "throwing": 20, "agility": 20 }
  },
  speed: {
    name: "Speed Focused",
    description: "Emphasizes speed and athleticism",
    weights: { "40m_dash": 50, "vertical_jump": 15, "catching": 10, "throwing": 10, "agility": 15 }
  },
  skills: {
    name: "Skills Focused", 
    description: "Emphasizes catching and throwing",
    weights: { "40m_dash": 10, "vertical_jump": 10, "catching": 35, "throwing": 35, "agility": 10 }
  },
  athletic: {
    name: "Athletic",
    description: "Emphasizes overall athleticism",
    weights: { "40m_dash": 30, "vertical_jump": 25, "catching": 10, "throwing": 10, "agility": 25 }
  }
};

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