// Comprehensive Drill Templates System for Multiple Sports
// This replaces the hardcoded drill arrays and makes WooCombine multi-sport capable

export const DRILL_TEMPLATES = {
  // FOOTBALL COMBINE (Original)
  football: {
    id: 'football',
    name: 'Football Combine',
    description: 'Traditional football combine drills',
    sport: 'Football',
    drills: [
      { key: "40m_dash", label: "40-Yard Dash", unit: "sec", lowerIsBetter: true, category: "speed" },
      { key: "vertical_jump", label: "Vertical Jump", unit: "in", lowerIsBetter: false, category: "power" },
      { key: "catching", label: "Catching", unit: "pts", lowerIsBetter: false, category: "skills" },
      { key: "throwing", label: "Throwing", unit: "pts", lowerIsBetter: false, category: "skills" },
      { key: "agility", label: "Agility", unit: "pts", lowerIsBetter: false, category: "agility" },
    ],
    defaultWeights: {
      "40m_dash": 0.3,
      "vertical_jump": 0.2,
      "catching": 0.15,
      "throwing": 0.15,
      "agility": 0.2,
    },
    presets: {
      balanced: {
        name: "Balanced",
        description: "Equal emphasis on all skills",
        weights: { "40m_dash": 0.2, "vertical_jump": 0.2, "catching": 0.2, "throwing": 0.2, "agility": 0.2 }
      },
      speed: {
        name: "Speed Focused",
        description: "Emphasizes speed and athleticism",
        weights: { "40m_dash": 0.4, "vertical_jump": 0.3, "catching": 0.1, "throwing": 0.1, "agility": 0.1 }
      },
      skills: {
        name: "Skills Focused", 
        description: "Emphasizes catching and throwing",
        weights: { "40m_dash": 0.1, "vertical_jump": 0.1, "catching": 0.35, "throwing": 0.35, "agility": 0.1 }
      },
      athletic: {
        name: "Athletic",
        description: "Emphasizes physical abilities",
        weights: { "40m_dash": 0.25, "vertical_jump": 0.25, "catching": 0.15, "throwing": 0.15, "agility": 0.2 }
      }
    }
  },

  // SOCCER/FOOTBALL COMBINE
  soccer: {
    id: 'soccer',
    name: 'Soccer Combine', 
    description: 'Comprehensive soccer skills evaluation',
    sport: 'Soccer',
    drills: [
      { key: "sprint_speed", label: "20m Sprint", unit: "sec", lowerIsBetter: true, category: "speed" },
      { key: "ball_control", label: "Ball Control", unit: "pts", lowerIsBetter: false, category: "technical" },
      { key: "passing_accuracy", label: "Passing Accuracy", unit: "pts", lowerIsBetter: false, category: "technical" },
      { key: "shooting_power", label: "Shooting Power", unit: "mph", lowerIsBetter: false, category: "technical" },
      { key: "agility_cones", label: "Agility (Cones)", unit: "sec", lowerIsBetter: true, category: "agility" },
      { key: "endurance", label: "Endurance (Beep Test)", unit: "level", lowerIsBetter: false, category: "fitness" },
    ],
    defaultWeights: {
      "sprint_speed": 0.15,
      "ball_control": 0.25, 
      "passing_accuracy": 0.25,
      "shooting_power": 0.15,
      "agility_cones": 0.1,
      "endurance": 0.1,
    },
    presets: {
      technical: {
        name: "Technical Focus",
        description: "Emphasizes ball skills and accuracy",
        weights: { "sprint_speed": 0.05, "ball_control": 0.35, "passing_accuracy": 0.35, "shooting_power": 0.15, "agility_cones": 0.05, "endurance": 0.05 }
      },
      athletic: {
        name: "Athletic Focus", 
        description: "Emphasizes speed and fitness",
        weights: { "sprint_speed": 0.3, "ball_control": 0.15, "passing_accuracy": 0.15, "shooting_power": 0.1, "agility_cones": 0.2, "endurance": 0.1 }
      },
      balanced: {
        name: "Balanced",
        description: "Equal emphasis on all areas",
        weights: { "sprint_speed": 0.15, "ball_control": 0.2, "passing_accuracy": 0.2, "shooting_power": 0.15, "agility_cones": 0.15, "endurance": 0.15 }
      }
    }
  },

  // BASKETBALL COMBINE
  basketball: {
    id: 'basketball',
    name: 'Basketball Combine',
    description: 'Basketball skills and athleticism evaluation', 
    sport: 'Basketball',
    drills: [
      { key: "lane_agility", label: "Lane Agility", unit: "sec", lowerIsBetter: true, category: "agility" },
      { key: "vertical_jump", label: "Vertical Jump", unit: "in", lowerIsBetter: false, category: "power" },
      { key: "free_throws", label: "Free Throw %", unit: "%", lowerIsBetter: false, category: "shooting" },
      { key: "three_point", label: "3-Point Shooting %", unit: "%", lowerIsBetter: false, category: "shooting" },
      { key: "dribbling", label: "Ball Handling", unit: "pts", lowerIsBetter: false, category: "skills" },
      { key: "defensive_slide", label: "Defensive Slides", unit: "sec", lowerIsBetter: true, category: "defense" },
    ],
    defaultWeights: {
      "lane_agility": 0.15,
      "vertical_jump": 0.2,
      "free_throws": 0.2,
      "three_point": 0.2,
      "dribbling": 0.15,
      "defensive_slide": 0.1,
    },
    presets: {
      shooter: {
        name: "Shooter Focus",
        description: "Emphasizes shooting abilities",
        weights: { "lane_agility": 0.1, "vertical_jump": 0.1, "free_throws": 0.35, "three_point": 0.35, "dribbling": 0.05, "defensive_slide": 0.05 }
      },
      athletic: {
        name: "Athletic Focus",
        description: "Emphasizes physical abilities", 
        weights: { "lane_agility": 0.25, "vertical_jump": 0.35, "free_throws": 0.1, "three_point": 0.1, "dribbling": 0.1, "defensive_slide": 0.1 }
      },
      guard: {
        name: "Guard Skills",
        description: "Point guard and ball handling focus",
        weights: { "lane_agility": 0.2, "vertical_jump": 0.1, "free_throws": 0.2, "three_point": 0.2, "dribbling": 0.25, "defensive_slide": 0.05 }
      }
    }
  },

  // BASEBALL COMBINE  
  baseball: {
    id: 'baseball',
    name: 'Baseball Combine',
    description: 'Baseball skills and athletic evaluation',
    sport: 'Baseball',
    drills: [
      { key: "sprint_60", label: "60-Yard Sprint", unit: "sec", lowerIsBetter: true, category: "speed" },
      { key: "exit_velocity", label: "Exit Velocity", unit: "mph", lowerIsBetter: false, category: "hitting" },
      { key: "throwing_velocity", label: "Throwing Velocity", unit: "mph", lowerIsBetter: false, category: "throwing" },
      { key: "fielding_accuracy", label: "Fielding Accuracy", unit: "pts", lowerIsBetter: false, category: "fielding" },
      { key: "pop_time", label: "Pop Time (Catchers)", unit: "sec", lowerIsBetter: true, category: "catching" },
    ],
    defaultWeights: {
      "sprint_60": 0.2,
      "exit_velocity": 0.3,
      "throwing_velocity": 0.25,
      "fielding_accuracy": 0.15,
      "pop_time": 0.1,
    },
    presets: {
      hitter: {
        name: "Hitter Focus",
        description: "Emphasizes hitting abilities",
        weights: { "sprint_60": 0.15, "exit_velocity": 0.5, "throwing_velocity": 0.15, "fielding_accuracy": 0.15, "pop_time": 0.05 }
      },
      pitcher: {
        name: "Pitcher Focus", 
        description: "Emphasizes throwing velocity",
        weights: { "sprint_60": 0.1, "exit_velocity": 0.1, "throwing_velocity": 0.6, "fielding_accuracy": 0.15, "pop_time": 0.05 }
      },
      fielder: {
        name: "Fielder Focus",
        description: "Emphasizes defensive skills",
        weights: { "sprint_60": 0.25, "exit_velocity": 0.2, "throwing_velocity": 0.25, "fielding_accuracy": 0.25, "pop_time": 0.05 }
      }
    }
  },

  // TRACK & FIELD
  track: {
    id: 'track',
    name: 'Track & Field',
    description: 'Track and field athletic evaluation',
    sport: 'Track & Field', 
    drills: [
      { key: "sprint_100", label: "100m Sprint", unit: "sec", lowerIsBetter: true, category: "sprint" },
      { key: "sprint_400", label: "400m Sprint", unit: "sec", lowerIsBetter: true, category: "sprint" },
      { key: "long_jump", label: "Long Jump", unit: "ft", lowerIsBetter: false, category: "field" },
      { key: "high_jump", label: "High Jump", unit: "ft", lowerIsBetter: false, category: "field" },
      { key: "shot_put", label: "Shot Put", unit: "ft", lowerIsBetter: false, category: "field" },
      { key: "mile_time", label: "Mile Run", unit: "min", lowerIsBetter: true, category: "distance" },
    ],
    defaultWeights: {
      "sprint_100": 0.25,
      "sprint_400": 0.15,
      "long_jump": 0.2,
      "high_jump": 0.15,
      "shot_put": 0.15,
      "mile_time": 0.1,
    },
    presets: {
      sprinter: {
        name: "Sprinter Focus",
        description: "Short distance speed events",
        weights: { "sprint_100": 0.45, "sprint_400": 0.25, "long_jump": 0.15, "high_jump": 0.1, "shot_put": 0.025, "mile_time": 0.025 }
      },
      jumper: {
        name: "Jumper Focus",
        description: "Jumping events focus",
        weights: { "sprint_100": 0.2, "sprint_400": 0.1, "long_jump": 0.35, "high_jump": 0.25, "shot_put": 0.05, "mile_time": 0.05 }
      },
      distance: {
        name: "Distance Focus", 
        description: "Distance running events",
        weights: { "sprint_100": 0.05, "sprint_400": 0.2, "long_jump": 0.05, "high_jump": 0.05, "shot_put": 0.05, "mile_time": 0.6 }
      }
    }
  },

  // VOLLEYBALL
  volleyball: {
    id: 'volleyball',
    name: 'Volleyball Combine',
    description: 'Volleyball skills evaluation',
    sport: 'Volleyball',
    drills: [
      { key: "vertical_jump", label: "Vertical Jump", unit: "in", lowerIsBetter: false, category: "power" },
      { key: "approach_jump", label: "Approach Jump", unit: "in", lowerIsBetter: false, category: "power" },
      { key: "serving_accuracy", label: "Serving Accuracy", unit: "pts", lowerIsBetter: false, category: "skills" },
      { key: "passing_accuracy", label: "Passing Accuracy", unit: "pts", lowerIsBetter: false, category: "skills" },
      { key: "attack_power", label: "Attack Power", unit: "mph", lowerIsBetter: false, category: "offense" },
      { key: "blocking_reach", label: "Blocking Reach", unit: "in", lowerIsBetter: false, category: "defense" },
    ],
    defaultWeights: {
      "vertical_jump": 0.2,
      "approach_jump": 0.2,
      "serving_accuracy": 0.15,
      "passing_accuracy": 0.15,
      "attack_power": 0.15,
      "blocking_reach": 0.15,
    },
    presets: {
      hitter: {
        name: "Hitter Focus",
        description: "Outside hitter/attacker focus",
        weights: { "vertical_jump": 0.25, "approach_jump": 0.3, "serving_accuracy": 0.1, "passing_accuracy": 0.1, "attack_power": 0.2, "blocking_reach": 0.05 }
      },
      setter: {
        name: "Setter Focus",
        description: "Setting and ball control focus", 
        weights: { "vertical_jump": 0.1, "approach_jump": 0.1, "serving_accuracy": 0.25, "passing_accuracy": 0.35, "attack_power": 0.05, "blocking_reach": 0.15 }
      },
      libero: {
        name: "Libero Focus",
        description: "Defensive specialist focus",
        weights: { "vertical_jump": 0.05, "approach_jump": 0.05, "serving_accuracy": 0.2, "passing_accuracy": 0.5, "attack_power": 0.05, "blocking_reach": 0.15 }
      }
    }
  }
};

// Utility functions for working with drill templates
export const getTemplateById = (templateId) => DRILL_TEMPLATES[templateId];

export const getAllTemplates = () => Object.values(DRILL_TEMPLATES);

export const getTemplatesByCategory = (category) => 
  getAllTemplates().filter(template => template.category === category);

export const getTemplatesBySport = (sport) =>
  getAllTemplates().filter(template => template.sport === sport);

// For backward compatibility with existing code
export const getDefaultFootballTemplate = () => DRILL_TEMPLATES.football;

// Helper to get drills array from template
export const getDrillsFromTemplate = (templateId) => {
  const template = getTemplateById(templateId);
  return template ? template.drills : [];
};

// Helper to get default weights from template
export const getDefaultWeightsFromTemplate = (templateId) => {
  const template = getTemplateById(templateId);
  return template ? template.defaultWeights : {};
};

// Helper to get presets from template
export const getPresetsFromTemplate = (templateId) => {
  const template = getTemplateById(templateId);
  return template ? template.presets : {};
};