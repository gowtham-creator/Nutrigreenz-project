/**
 * Dependency-free CSV export for the Reports analytics page.
 *
 * Turns an array of row objects (or a header + matrix) into RFC-4180-ish CSV
 * text and triggers a browser download via a Blob + a temporary <a> element.
 * No third-party libraries — works in any modern browser, client-side only.
 */

/** A single CSV cell value we know how to serialise. */
export type CsvCell = string | number | boolean | null | undefined;

/** One row, keyed by column. Values are coerced to text on export. */
export type CsvRow = Record<string, CsvCell>;

/** Escape one cell per RFC 4180: wrap in quotes if it contains "," CR/LF or a quote. */
function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialise rows to CSV text.
 * - Columns are derived from the union of keys across all rows (insertion order
 *   of the first row wins), unless `headers` is supplied to fix order/labels.
 */
export function toCsv(
  rows: readonly CsvRow[],
  headers?: readonly string[],
): string {
  if (rows.length === 0) return headers ? headers.map(escapeCell).join(",") + "\r\n" : "";
  const cols =
    headers && headers.length > 0
      ? headers
      : Array.from(
          rows.reduce<Set<string>>((set, r) => {
            for (const k of Object.keys(r)) set.add(k);
            return set;
          }, new Set<string>()),
        );
  const head = cols.map(escapeCell).join(",");
  const body = rows
    .map((row) => cols.map((c) => escapeCell(row[c])).join(","))
    .join("\r\n");
  return `${head}\r\n${body}\r\n`;
}

/**
 * Build a CSV string from the given rows and trigger a file download.
 * Prefixes a UTF-8 BOM so Excel reads non-ASCII (₹, names) correctly.
 * No-op on the server (guards on `document`).
 */
export function downloadCsv(
  filename: string,
  rows: readonly CsvRow[],
  headers?: readonly string[],
): void {
  if (typeof document === "undefined") return;
  const csv = toCsv(rows, headers);
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Download several named sheets concatenated into one CSV ("Export all"). */
export function downloadCsvBundle(
  filename: string,
  sheets: readonly { title: string; rows: readonly CsvRow[]; headers?: readonly string[] }[],
): void {
  if (typeof document === "undefined") return;
  const parts = sheets.map(
    (s) => `# ${s.title}\r\n${toCsv(s.rows, s.headers)}`,
  );
  const csv = parts.join("\r\n");
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
