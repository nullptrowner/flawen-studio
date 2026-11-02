export interface BatchRow {
  title: string;
  subtitle?: string;
}

// Quotes may only open at the start of a field; after closing, only a
// separator is legal. This catches damaged CSV instead of shifting columns.
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  const finishField = () => {
    row.push(field);
    field = '';
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else field += char;
      continue;
    }
    if (char === ',') {
      finishField();
      continue;
    }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      finishField();
      rows.push(row);
      row = [];
      continue;
    }
    if (closed)
      throw new Error(`CSV row ${rows.length + 1}: unexpected character after closing quote.`);
    if (char === '"') {
      if (field.length) throw new Error(`CSV row ${rows.length + 1}: quote must start a field.`);
      quoted = true;
    } else field += char;
  }
  if (quoted) throw new Error(`CSV row ${rows.length + 1}: unclosed quoted field.`);
  if (field.length || row.length || closed) {
    finishField();
    rows.push(row);
  }
  return rows;
}

export function parseBatchText(text: string, format: 'csv' | 'json'): BatchRow[] {
  if (new TextEncoder().encode(text).length > 200 * 1024)
    throw new Error('Batch file exceeds the 200 KB limit.');
  const content = text.replace(/^\uFEFF/, '');
  let records: unknown;
  if (format === 'json') {
    try {
      records = JSON.parse(content);
    } catch {
      throw new Error(
        'Invalid JSON. Expected an array of objects with title and optional subtitle.',
      );
    }
  } else if (format === 'csv') {
    const rows = csvRows(content);
    const headers = rows.shift();
    if (
      !headers ||
      !headers.includes('title') ||
      new Set(headers).size !== headers.length ||
      headers.some((header) => header !== 'title' && header !== 'subtitle')
    ) {
      throw new Error('CSV headers must be title and optional subtitle, without duplicates.');
    }
    records = rows.map((row, index) => {
      if (row.length !== headers.length)
        throw new Error(
          `CSV row ${index + 2}: expected ${headers.length} columns, received ${row.length}.`,
        );
      return Object.fromEntries(headers.map((header, i) => [header, row[i]]));
    });
  } else throw new Error('Unsupported batch format. Use csv or json.');

  if (!Array.isArray(records)) throw new Error('JSON batch must be an array of objects.');
  if (!records.length) throw new Error('Batch must contain at least one row.');
  if (records.length > 30) throw new Error('Batch may contain at most 30 rows.');
  return records.map((record: unknown, index: number) => {
    const prefix = `Row ${index + 1}`;
    if (record === null || typeof record !== 'object' || Array.isArray(record))
      throw new Error(`${prefix}: expected an object.`);
    const entry = record as Record<string, unknown>;
    if (Object.keys(entry).some((key) => key !== 'title' && key !== 'subtitle'))
      throw new Error(`${prefix}: only title and subtitle fields are allowed.`);
    if (typeof entry.title !== 'string' || !entry.title.trim())
      throw new Error(`${prefix}: title must be a non-empty string.`);
    if (entry.title.length > 1000) throw new Error(`${prefix}: title exceeds 1000 characters.`);
    if ('subtitle' in entry && typeof entry.subtitle !== 'string')
      throw new Error(`${prefix}: subtitle must be a string.`);
    if (typeof entry.subtitle === 'string' && entry.subtitle.length > 2000)
      throw new Error(`${prefix}: subtitle exceeds 2000 characters.`);
    return typeof entry.subtitle === 'string'
      ? { title: entry.title, subtitle: entry.subtitle }
      : { title: entry.title };
  });
}
