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

  it('restricts /analytics to organizer and coach', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const analyticsGuardRegex =
      /path="\/analytics"[\s\S]*?<RequireAuth allowedRoles=\{\["organizer", "coach"\]\}>/m;
    expect(analyticsGuardRegex.test(source)).toBe(true);
  });

  it('restricts /team-formation to organizer and coach', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    const teamFormationGuardRegex =
      /path="\/team-formation"[\s\S]*?<RequireAuth allowedRoles=\{\["organizer", "coach"\]\}>/m;
    expect(teamFormationGuardRegex.test(source)).toBe(true);
  });
});
