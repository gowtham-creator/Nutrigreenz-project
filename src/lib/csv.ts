/**
 * Dependency-free, server-safe CSV helpers for the catalog import/export API.
 *
 * - `toCsv` serialises a header + rows to an RFC-4180-ish string.
 * - `parseCsv` parses a CSV string into rows of string cells, honouring
 *   double-quoted fields that may span commas, quotes and newlines.
 *
 * Pure functions only — no DOM access — so they're safe in Node route handlers.
 */

/** Quote a single CSV field when it contains a delimiter, quote or newline. */
function escapeField(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from a header + rows of primitive cells. */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const lines = [header.map(escapeField).join(",")];
  for (const row of rows) lines.push(row.map(escapeField).join(","));
  return lines.join("\r\n");
}

/**
 * Parse a full CSV document into rows of trimmed string cells. Quote-aware: a
 * quoted field may contain commas, escaped (`""`) quotes and embedded newlines.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let started = false;

  const pushField = () => {
    row.push(field.trim());
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      started = true;
    } else if (ch === ",") {
      pushField();
      started = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (started || field.length > 0) pushRow();
    } else {
      field += ch;
      started = true;
    }
  }
  if (started || field.length > 0) pushRow();

  return rows.filter((r) => r.some((c) => c.length > 0));
}
