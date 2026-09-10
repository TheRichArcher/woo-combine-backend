import { serializeRosterCsv } from '../utils/draftRosterCsv';

describe('roster CSV interoperability', () => {
  it('separates records using real line breaks and preserves ordinary names', () => {
    expect(serializeRosterCsv(['Team', 'Player'], [['Green', 'Ann'], ['Blue', 'Ben']]))
      .toBe('Team,Player\r\nGreen,Ann\r\nBlue,Ben');
  });
  it('escapes commas, quotes, CR and LF without dropping zero or Unicode', () => {
    expect(serializeRosterCsv(['Name', 'Number'], [['O\"Brien, José', 0], ['A\rB\nC', null]]))
      .toBe('Name,Number\r\n"O""Brien, José",0\r\n"A\rB\nC",');
  });
});
