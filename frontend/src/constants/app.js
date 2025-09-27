// Application-wide constants and configuration
export const APP_CONFIG = {
  // Timeouts and delays (in milliseconds)
  TIMEOUTS: {
    AUTH_CHECK: 20000,           // 20s for auth verification 
    ROLE_CHECK: 20000,           // 20s for role verification
    COLD_START_NOTIFICATION: 5000, // 5s before showing cold start message
    TOAST_DEFAULT: 5000,         // 5s default toast duration
    TOAST_SUCCESS: 4000,         // 4s for success messages
    TOAST_ERROR: 6000,           // 6s for error messages
    TOAST_COLD_START: 20000,     // 20s for cold start notifications
    AUTO_ADVANCE_DELAY: 1500,    // 1.5s delay for auto-advancing steps
    VERIFICATION_RETRY: 10000,   // 10s between verification checks
    FOCUS_DELAY: 100,            // 100ms delay for input focus
    
    // API timeouts
    API_DEFAULT: 20000,          // 20s for better user experience
    API_COLD_START_RETRY: 15000, // 15s for severe cold starts
    API_NETWORK_RETRY: 12000,    // Network failures
    API_SERVER_RETRY: 10000,     // Server errors
    
    // Session management
    SESSION_TIMEOUT: 30 * 60 * 1000,  // 30 minutes
    SESSION_WARNING: 5 * 60 * 1000,   // 5 minutes before timeout
    
    // Firestore operations
    FIRESTORE_DEFAULT: 10000,    // 10s for Firestore operations
    FIRESTORE_BATCH: 10000,      // 10s for batch operations
    FIRESTORE_AUTH: 10000,       // 10s for auth operations
    
    // Component delays
    MODAL_ANIMATION: 100,        // Modal animation delay
    NAVIGATION_DELAY: 0,         // Navigation state update delay
    LOADING_SPINNER_MIN: 500     // Minimum spinner display time
  },

  // UI Configuration
  UI: {
    MAX_RECENT_ENTRIES: 10,      // Maximum recent entries to keep
    PAGINATION_SIZE: 50,         // Default pagination size
    MODAL_ANIMATION_DELAY: 100,  // Modal animation delay
    SMOOTH_SCROLL_OFFSET: 20     // Offset for smooth scrolling
  },

  // Player Management
  PLAYERS: {
    MAX_PLAYERS_PER_EVENT: 1000, // Maximum players per event
    DEFAULT_AGE_GROUP: 'Unknown', // Default age group
    AUTO_NUMBER_START: 1,        // Starting number for auto-numbering
    CSV_PREVIEW_ROWS: 10         // Number of rows to show in CSV preview
  },

  // File Upload
  UPLOAD: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB max file size
    ALLOWED_CSV_TYPES: ['text/csv', 'application/vnd.ms-excel'],
    MAX_CSV_ROWS: 500            // Maximum CSV rows to process
  },

  // Scoring and Rankings
  SCORING: {
    DRILL_SCORE_PRECISION: 2,    // Decimal places for drill scores
    RANKING_SCORE_PRECISION: 2,  // Decimal places for ranking scores
    DEFAULT_WEIGHT: 0.2,         // Default weight for drills (20%)
    MIN_WEIGHT: 0,               // Minimum weight value
    MAX_WEIGHT: 1,               // Maximum weight value
    WEIGHT_STEP: 0.001           // Weight adjustment step
  },

  // Retry configuration
  RETRY: {
    MAX_RETRIES: 2,              // Maximum retry attempts
    LEAGUE_RETRIES: 1,           // Only 1 retry for league fetching to prevent cascade
    BASE_DELAY: 3000,            // 3s base delay between retries
    MAX_DELAY: 15000,            // Maximum delay cap
    EXPONENTIAL_BASE: 2,         // Base for exponential backoff
    COLD_START_MULTIPLIER: 2,    // Multiply delay for cold start scenarios
    NETWORK_MULTIPLIER: 1.5      // Multiply delay for network issues
  },

  // Network and API
  NETWORK: {
    MAX_RETRY_ATTEMPTS: 3,       // Maximum retry attempts
    RETRY_DELAY_BASE: 1000,      // Base retry delay (1s)
    CONNECTION_TIMEOUT: 30000,   // 30s connection timeout
    REQUEST_TIMEOUT: 45000       // 45s request timeout
  }
};

// Route paths
export const ROUTES = {
  HOME: '/dashboard',
  PLAYERS: '/players',
  PLAYERS_ROSTER: '/players/roster',
  PLAYERS_RANKINGS: '/players/rankings',
  ADMIN: '/admin',
  LIVE_ENTRY: '/live-entry',
  LOGIN: '/login',
  SIGNUP: '/signup',
  WELCOME: '/welcome',
  SELECT_LEAGUE: '/select-league',
  SELECT_ROLE: '/select-role',
  CREATE_LEAGUE: '/create-league',
  JOIN_LEAGUE: '/join',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  ONBOARDING_EVENT: '/onboarding/event',
  EVENT_SHARING: '/event-sharing'
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK: {
    TIMEOUT: 'Request timed out. Please check your connection and try again.',
    OFFLINE: 'You appear to be offline. Please check your internet connection.',
    SERVER_ERROR: 'Server error occurred. Please try again later.',
    NOT_FOUND: 'The requested resource was not found.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    FORBIDDEN: 'Access denied. Please check your permissions.'
  },
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    INVALID_PHONE: 'Please enter a valid phone number.',
    INVALID_NUMBER: 'Please enter a valid number.',
    FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
    INVALID_FILE_TYPE: 'Invalid file type. Please select a valid file.'
  },
  AUTH: {
    LOGIN_FAILED: 'Login failed. Please check your credentials.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    VERIFICATION_FAILED: 'Verification failed. Please try again.',
    TOO_MANY_REQUESTS: 'Too many attempts. Please try again later.'
  }
};

// Success messages
export const SUCCESS_MESSAGES = {
  PLAYER_ADDED: 'Player added successfully!',
  PLAYERS_UPLOADED: 'Players uploaded successfully!',
  EVENT_CREATED: 'Event created successfully!',
  EVENT_UPDATED: 'Event updated successfully!',
  SCORE_RECORDED: 'Score recorded successfully!',
  FILE_DOWNLOADED: 'File downloaded successfully!',
  LINK_COPIED: 'Link copied to clipboard!',
  SETTINGS_SAVED: 'Settings saved successfully!'
};

// CSS Classes for consistent styling
export const CSS_CLASSES = {
  BUTTONS: {
    PRIMARY: 'bg-brand-primary hover:bg-brand-secondary text-white font-semibold py-3 px-6 rounded-xl transition min-h-[44px] touch-manipulation',
    SECONDARY: 'bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition min-h-[44px] touch-manipulation',
    DANGER: 'bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition min-h-[44px] touch-manipulation',
    SUCCESS: 'bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition min-h-[44px] touch-manipulation',
    OUTLINE_PRIMARY: 'border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white font-semibold py-3 px-6 rounded-xl transition min-h-[44px] touch-manipulation',
    OUTLINE_SECONDARY: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold py-3 px-6 rounded-xl transition min-h-[44px] touch-manipulation',
    SMALL: 'bg-brand-primary hover:bg-brand-secondary text-white font-medium py-2 px-4 rounded-lg transition min-h-[36px] touch-manipulation text-sm',
    ICON_ONLY: 'bg-brand-primary hover:bg-brand-secondary text-white p-3 rounded-xl transition min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center'
  },
  INPUTS: {
    DEFAULT: 'w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition min-h-[44px]',
    ERROR: 'w-full border border-red-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition min-h-[44px]',
    PHONE: 'w-full border border-brand-primary/30 rounded-xl px-4 py-3 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition min-h-[44px]'
  },
  CARDS: {
    DEFAULT: 'bg-white rounded-xl shadow-sm border border-gray-200',
    ELEVATED: 'bg-white rounded-2xl shadow-lg border border-gray-200',
    FEATURE: 'bg-white rounded-2xl shadow-lg border-2 border-brand-primary/30'
  },
  ALERTS: {
    SUCCESS: 'bg-green-50 border border-green-200 text-green-800 rounded-xl p-4',
    ERROR: 'bg-red-50 border border-red-200 text-red-800 rounded-xl p-4',
    WARNING: 'bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4',
    INFO: 'bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4'
  },
  TEXT: {
    HEADING_1: 'text-2xl sm:text-3xl font-bold text-gray-900',
    HEADING_2: 'text-xl font-semibold text-gray-900',
    HEADING_3: 'text-lg font-semibold text-gray-900',
    BODY: 'text-base text-gray-700 leading-relaxed',
    BODY_SMALL: 'text-sm text-gray-600',
    CAPTION: 'text-xs text-gray-500'
  }
};

// Local Storage Keys
export const STORAGE_KEYS = {
  SELECTED_LEAGUE_ID: 'selectedLeagueId',
  SELECTED_EVENT_ID: 'selectedEventId', 
  PENDING_EVENT_JOIN: 'pendingEventJoin',
  NOTIFICATIONS_ENABLED: 'woo-combine-notifications-enabled',
  USER_PREFERENCES: 'woo-combine-user-preferences'
};

// Development flags
export const DEV_FLAGS = {
  ENABLE_DEBUG_LOGGING: import.meta.env.DEV,
  SHOW_DEV_TOOLS: import.meta.env.DEV,
  MOCK_API_RESPONSES: false, // Can be toggled for testing
  SKIP_AUTH_IN_DEV: false    // Can be toggled for development
}; 