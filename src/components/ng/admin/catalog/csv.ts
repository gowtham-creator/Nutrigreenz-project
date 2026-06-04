/**
 * Dependency-free CSV helpers for the admin catalog + inventory screens.
 *
 * - `toCsv` serialises rows to an RFC-4180-ish string (quotes fields that
 *   contain commas / quotes / newlines, doubles embedded quotes).
 * - `downloadCsv` triggers a client download via a Blob + temporary anchor.
 * - `parseProductCsv` parses an imported product CSV with a tolerant,
 *   quote-aware splitter and reports row-level errors instead of throwing.
 *
 * Everything here is pure + browser-only (the download/parse helpers touch the
 * DOM). No third-party CSV library — Milestone-2 server import can replace this.
 */

import type { AdminProduct, ProductStatus } from "./types";
import { STATUS_OPTIONS } from "./types";

/** Quote a single CSV field when it contains a delimiter, quote or newline. */
function escapeField(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from a header + rows of primitive cells. */
export function toCsv(header: readonly string[], rows: readonly (string | number)[][]): string {
  const lines = [header.map(escapeField).join(",")];
  for (const row of rows) lines.push(row.map(escapeField).join(","));
  return lines.join("\r\n");
}

/** Trigger a browser download of `content` as `filename` (text/csv). */
export function downloadCsv(filename: string, content: string): void {
  // Guard for SSR / non-browser — callers are client components, but be safe.
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the click has a chance to register first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Split a single CSV line into fields, honouring double-quoted fields that may
 * contain commas and escaped (`""`) quotes. Tolerant of trailing whitespace.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/** Coerce a free-text status cell to a valid `ProductStatus`. */
function normaliseStatus(raw: string): ProductStatus {
  const v = raw.trim().toLowerCase();
  if (v === "active" || v === "published" || v === "live") return "Published";
  if (v === "draft") return "Draft";
  if (v === "out of stock" || v === "oos" || v === "out") return "Out of stock";
  if (v === "archived" || v === "archive") return "Archived";
  // Exact match against known labels (case-insensitive) as a fallback.
  const exact = STATUS_OPTIONS.find((s) => s.toLowerCase() === v);
  return exact ?? "Draft";
}

/** Parse a possibly-messy integer cell; returns 0 when not parseable. */
function toInt(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export interface CsvParseResult {
  /** Successfully parsed rows, ready to merge into the product list. */
  rows: AdminProduct[];
  /** Count of rows that were skipped due to validation errors. */
  skipped: number;
  /** Human-readable issues (1-based line numbers) for the preview. */
  errors: string[];
  /** Total non-empty data lines seen (excludes the header). */
  total: number;
}

/**
 * Parse an imported product CSV.
 *
 * Expected columns (header is matched loosely; a header row is auto-detected):
 *   name, sku, category, price, mrp, stock, status
 *
 * Malformed rows are skipped (not thrown) and reported in `errors`.
 */
export function parseProductCsv(text: string): CsvParseResult {
  const result: CsvParseResult = { rows: [], skipped: 0, errors: [], total: 0 };
  const rawLines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) {
    result.errors.push("File is empty.");
    return result;
  }

  // Detect + drop a header row if the first cell looks like a column name.
  let startIdx = 0;
  const firstCells = splitCsvLine(rawLines[0]).map((c) => c.toLowerCase());
  if (firstCells.includes("name") || firstCells.includes("sku") || firstCells.includes("title")) {
    startIdx = 1;
  }

  for (let i = startIdx; i < rawLines.length; i++) {
    const lineNo = i + 1; // 1-based for messages
    const cells = splitCsvLine(rawLines[i]);
    result.total++;

    const [name = "", sku = "", category = "", price = "", mrp = "", stock = "", status = ""] = cells;

    if (!name.trim() && !sku.trim()) {
      result.skipped++;
      result.errors.push(`Line ${lineNo}: missing name and SKU — skipped.`);
      continue;
    }
    if (!name.trim()) {
      result.skipped++;
      result.errors.push(`Line ${lineNo}: missing product name — skipped.`);
      continue;
    }

    const priceNum = toInt(price);
    const mrpNum = toInt(mrp);
    const stockNum = toInt(stock);

    result.rows.push({
      id: `new-${Date.now()}-${i}`,
      title: name.trim(),
      sku: sku.trim() || `NG-IMP-${String(i).padStart(3, "0")}`,
      category: category.trim() || "Other",
      price: priceNum,
      mrp: mrpNum,
      stock: stockNum,
      status: normaliseStatus(status),
      lot: "",
      description: "",
      rating: 0,
      image: "/images/placeholder.svg",
    });
  }

  return result;
}

/** Column header used for product CSV export. */
export const PRODUCT_CSV_HEADER = [
  "name",
  "sku",
  "category",
  "price",
  "mrp",
  "stock",
  "status",
  "lot",
] as const;

/** Serialise the product list to a CSV string for export. */
export function productsToCsv(products: readonly AdminProduct[]): string {
  return toCsv(
    PRODUCT_CSV_HEADER,
    products.map((p) => [p.title, p.sku, p.category, p.price, p.mrp, p.stock, p.status, p.lot]),
  );
}
