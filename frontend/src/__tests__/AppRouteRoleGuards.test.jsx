import fs from 'fs';
import path from 'path';

const appPath = path.resolve(__dirname, '../App.jsx');

describe('App route role guards', () => {
  it('restricts /players to organizer and coach', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const playersGuardRegex =
      /path="\/players"[\s\S]*?<RequireAuth allowedRoles=\{\["organizer", "coach"\]\}>/m;
    expect(playersGuardRegex.test(source)).toBe(true);
  });

  it('restricts /analytics to organizer only', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const analyticsGuardRegex =
      /path="\/analytics"[\s\S]*?<RequireAuth allowedRoles=\{\["organizer"\]\}>/m;
    expect(analyticsGuardRegex.test(source)).toBe(true);
  });

  it('restricts /team-formation to organizer and coach', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const teamFormationGuardRegex =
      /path="\/team-formation"[\s\S]*?<RequireAuth allowedRoles=\{\["organizer", "coach"\]\}>/m;
    expect(teamFormationGuardRegex.test(source)).toBe(true);
  });

  it('redirects viewers away from /sport-templates at route level', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    expect(source.includes('function SportTemplatesRoute()')).toBe(true);
    expect(source.includes('if (userRole === "viewer")')).toBe(true);
    expect(source.includes('return <Navigate to="/live-standings" replace />;')).toBe(true);
    expect(source.includes('if (userRole !== "organizer")')).toBe(true);
  });

  it('redirects viewers away from /evaluators at route level', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    expect(source.includes('function EvaluatorsRoute()')).toBe(true);
    expect(source.includes('if (userRole === "viewer")')).toBe(true);
    expect(source.includes('return <Navigate to="/live-standings" replace />;')).toBe(true);
    expect(source.includes('if (userRole !== "organizer")')).toBe(true);
  });

  it('restricts /live-entry to organizer and coach', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const liveEntryGuardRegex =
      /path="\/live-entry"[\s\S]*?<RequireAuth allowedRoles=\{\["organizer", "coach"\]\}>/m;
    expect(liveEntryGuardRegex.test(source)).toBe(true);
  });
});
