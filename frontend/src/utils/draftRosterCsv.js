/** Serialize roster cells as CSV, preserving names containing quotes and line breaks. */
export function serializeRosterCsv(headers, rows) {
  const escape = value => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
}
