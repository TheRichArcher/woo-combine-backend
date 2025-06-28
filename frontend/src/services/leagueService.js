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

  // Join a league
  joinLeague: (leagueCode, role = null) => {
    const payload = { league_code: leagueCode };
    if (role) {
      payload.role = role;
    }
    return api.post('/leagues/join', payload);
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