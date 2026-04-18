import api from '../lib/api';

export const leagueService = {
  // Get user's leagues
  getUserLeagues: () => {
    return api.get('/leagues/me');
  },

  // Create a new league
  createLeague: (leagueData) => {
    return api.post('/leagues', leagueData);
  },

  // Join a league by code. Coaches must supply invited_event_id elsewhere.
  joinLeague: (leagueCode, role = 'viewer', invitedEventId = null) => {
    const payload = { role };
    if (invitedEventId && (role === 'coach' || role === 'viewer')) {
      payload.invited_event_id = invitedEventId;
    }
    return api.post(`/leagues/join/${leagueCode}`, payload);
  },

  // Get league events
  getLeagueEvents: (leagueId) => {
    return api.get(`/leagues/${leagueId}/events`);
  },

  // Get league details
  getLeague: (leagueId) => {
    return api.get(`/leagues/${leagueId}`);
  }
};

export default leagueService; 