import { parseRegistrationCsv, prepareRegistrationImport } from './registrationImport';
const header = 'Player First Name,Player Last Name,Division Name,Players Recent Team,Please rate the athletic ability of your child (5 being the strongest),How many seasons has the participant played flag football?,User Email';
test('maps raw parent answers without inventing measured ability or retaining contact data', () => {
  const [p] = parseRegistrationCsv(header + '\r\nTest,Player,10U,"Blue, Team",4,Two seasons,private@example.com');
  expect(p.registration_previous_team).toBe('Blue, Team');
  expect(p.parent_reported_experience).toBe('Two seasons');
  expect(p.parent_reported_ability).toBe('4');
  expect(p).not.toHaveProperty('composite_score');
  expect(JSON.stringify(p)).not.toContain('private@example.com');
});
test('enrollment team name is not mistaken for previous team', () => {
  const [p] = parseRegistrationCsv('Player First Name,Player Last Name,Division Name,Team Name\nTest,Player,10U,Current Team');
  expect(p.registration_previous_team).toBeNull();
  expect(p.parent_reported_ability).toBeNull();
});
test('explicit division selection and duplicate rejection', () => {
  const rows = parseRegistrationCsv(header + '\nTest,One,10U,,,,\nTest,Two,12U,,,,');
  expect(prepareRegistrationImport(rows, '12U', [], '12U')).toHaveLength(1);
  expect(() => prepareRegistrationImport(rows, '10U', [{ name: 'Test One' }])).toThrow('duplicate');
  expect(() => prepareRegistrationImport([...rows, rows[0]], '10U', [])).toThrow('duplicate');
});
test('stable source IDs block renamed duplicates', () => {
 const p = {name: 'New Name', registration_division: '10U', registration_source_id: 'synthetic-1'};
 expect(() => prepareRegistrationImport([p], '10U', [{name: 'Old Name', registration_source_id: 'synthetic-1'}])).toThrow('duplicate');
});
test('malformed and unsupported CSVs reject before import', () => {
 expect(() => parseRegistrationCsv('Name\nTest')).toThrow('Missing');
 expect(() => parseRegistrationCsv(header + '\n"unfinished')).toThrow('unclosed');
 expect(() => parseRegistrationCsv(header + '\nTest,Player')).toThrow('column count');
});
test('does not mix programs sharing a division name', () => {
 expect(() => prepareRegistrationImport([
  {name: 'Test One', registration_division: '10U', registration_program: 'Fall'},
  {name: 'Test Two', registration_division: '10U', registration_program: 'Spring'},
 ], '10U', [])).toThrow('multiple programs');
});
