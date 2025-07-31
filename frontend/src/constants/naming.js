/**
 * Naming conventions and field mappings for consistent data handling
 */

// Database field mappings (snake_case from backend to camelCase for frontend)
export const FIELD_MAPPINGS = {
  // Player fields
  first_name: 'firstName',
  last_name: 'lastName',
  age_group: 'ageGroup',
  player_id: 'playerId',
  event_id: 'eventId',
  league_id: 'leagueId',
  user_id: 'userId',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  
  // Drill fields (normalized names)
  '40m_dash': 'fortyMeterDash',
  vertical_jump: 'verticalJump',
  catching: 'catching',
  throwing: 'throwing',
  agility: 'agility',
  
  // Composite fields
  composite_score: 'compositeScore',
  drill_scores: 'drillScores'
};

// Reverse mapping for sending data to backend
export const REVERSE_FIELD_MAPPINGS = Object.fromEntries(
  Object.entries(FIELD_MAPPINGS).map(([key, value]) => [value, key])
);

// Standard naming patterns
export const NAMING_CONVENTIONS = {
  // Component names: PascalCase
  COMPONENT_NAME: /^[A-Z][a-zA-Z0-9]*$/,
  
  // Function names: camelCase
  FUNCTION_NAME: /^[a-z][a-zA-Z0-9]*$/,
  
  // Constants: SCREAMING_SNAKE_CASE
  CONSTANT_NAME: /^[A-Z][A-Z0-9_]*$/,
  
  // CSS classes: kebab-case or utility classes
  CSS_CLASS: /^[a-z][a-z0-9-]*$|^[a-z]+:[a-z0-9-]+$/,
  
  // API endpoints: snake_case
  API_ENDPOINT: /^[a-z][a-z0-9_]*$/
};

// Data transformation utilities
export const transformToFrontend = (backendData) => {
  if (!backendData || typeof backendData !== 'object') return backendData;
  
  const transformed = {};
  for (const [key, value] of Object.entries(backendData)) {
    const frontendKey = FIELD_MAPPINGS[key] || key;
    transformed[frontendKey] = value;
  }
  return transformed;
};

export const transformToBackend = (frontendData) => {
  if (!frontendData || typeof frontendData !== 'object') return frontendData;
  
  const transformed = {};
  for (const [key, value] of Object.entries(frontendData)) {
    const backendKey = REVERSE_FIELD_MAPPINGS[key] || key;
    transformed[backendKey] = value;
  }
  return transformed;
}; 