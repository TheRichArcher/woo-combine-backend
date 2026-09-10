// Only explicitly supported SportsConnect fields are imported. Contact/payment data is discarded.
export function parseRegistrationCsv(text) {
  const rows = []; let row = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || value === '') quoted = !quoted;
      else throw new Error('Invalid CSV quoting.');
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(value); value = '';
      if (c !== ',') { if (row.some(v => v.trim())) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else value += c;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  row.push(value); if (row.some(v => v.trim())) rows.push(row);
  const headers = rows.shift() || [];
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate column headers; review the export.');
  for (const required of ['Player First Name', 'Player Last Name', 'Division Name']) {
    if (!headers.includes(required)) throw new Error(`Missing ${required}. Use a SportsConnect participant or enrollment export.`);
  }
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2} has a different column count.`);
    const r = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    const name = `${r['Player First Name'].trim()} ${r['Player Last Name'].trim()}`.trim();
    if (!r['Player First Name'].trim() || !r['Player Last Name'].trim() || !r['Division Name'].trim()) throw new Error(`Row ${index + 2} needs player name and division.`);
    return {
      name, registration_division: r['Division Name'],
      registration_program: r['Program Name'] || null,
      registration_source_id: r['Participant ID'] || r['Player ID'] || null,
      parent_reported_ability: r['Please rate the athletic ability of your child (5 being the strongest)'] || null,
      registration_previous_team: r['Players Recent Team'] || null,
      parent_reported_experience: r['How many seasons has the participant played flag football?'] || null,
      registration_source: 'SportsConnect',
    };
  });
}

export function prepareRegistrationImport(rows, division, existing, ageGroup) {
  const selected = rows.filter(r => r.registration_division === division);
  if (!selected.length) throw new Error('Select a division with players.');
  if (new Set(selected.map(p => p.registration_program || '')).size > 1) throw new Error('This division contains multiple programs. Export one program before importing.');
  const seen = new Set();
  const names = new Set(existing.map(p => p.name.trim().toLowerCase()));
  const ids = new Set(existing.map(p => p.registration_source_id).filter(Boolean));
  return selected.map(p => {
    const key = p.name.trim().toLowerCase();
    if (seen.has(key) || names.has(key) || (p.registration_source_id && ids.has(p.registration_source_id))) {
      throw new Error('Possible duplicate player. Review the source and existing players before importing; nothing was added.');
    }
    seen.add(key); if (p.registration_source_id) ids.add(p.registration_source_id);
    return { ...p, age_group: ageGroup || null };
  });
}
