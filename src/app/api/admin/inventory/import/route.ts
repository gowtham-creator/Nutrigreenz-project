import { isSignedInAdmin, isSuperAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { importProductsCsv, type ProductCsvRow } from "@/lib/catalog";
import { parseCsv } from "@/lib/csv";
import { requireApiPermission } from "@/lib/admin-api-guard";

/** A single previewed row plus any validation note. */
interface PreviewRow extends ProductCsvRow {
  line: number;
  valid: boolean;
  note?: string;
}

const HEADER_KEYS = ["name", "sku", "category", "price", "stock", "status", "description"];

/** Convert a rupee/paise price cell to integer paise. Accepts "₹89.00", "89", "8900p". */
function toPaise(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, "").trim();
  if (!cleaned) return 0;
  if (/p$/i.test(cleaned)) return Math.max(0, Math.round(Number(cleaned.replace(/p$/i, "")) || 0));
  const rupees = Number(cleaned);
  if (!Number.isFinite(rupees)) return 0;
  return Math.max(0, Math.round(rupees * 100));
}

function toInt(raw: string): number {
  const n = Math.round(Number(raw.replace(/[,\s]/g, "")));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Parse CSV text to preview rows, auto-detecting and dropping a header row. */
function buildPreview(text: string): PreviewRow[] {
  const grid = parseCsv(text);
  if (grid.length === 0) return [];

  let startIdx = 0;
  let cols = HEADER_KEYS;
  const first = grid[0].map((c) => c.toLowerCase());
  if (first.includes("name") || first.includes("sku") || first.includes("title")) {
    startIdx = 1;
    cols = first.map((c) => (c === "title" ? "name" : c));
  }

  const rows: PreviewRow[] = [];
  for (let i = startIdx; i < grid.length; i++) {
    const cells = grid[i];
    const get = (key: string): string => {
      const idx = cols.indexOf(key);
      return idx >= 0 ? (cells[idx] ?? "") : "";
    };
    const name = get("name").trim();
    const row: PreviewRow = {
      line: i + 1,
      name,
      sku: get("sku").trim() || undefined,
      category: get("category").trim() || undefined,
      pricePaise: toPaise(get("price")),
      stock: toInt(get("stock")),
      status: get("status").trim() || undefined,
      description: get("description").trim() || undefined,
      valid: Boolean(name),
      note: name ? undefined : "missing product name",
    };
    rows.push(row);
  }
  return rows;
}

/**
 * POST — CSV import. Two modes:
 *   - `{ csv, commit: false }`  → parse + return a preview (no writes).
 *   - `{ csv, commit: true }`   → import the valid rows and return a summary.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  // CSV import can change prices in bulk → super-admin only (preview included).
  if (!(await isSuperAdmin())) {
    return Response.json({ ok: false, error: "superadmin-required" }, { status: 403 });
  }
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const csv = String(body.csv ?? "");
  if (!csv.trim()) return Response.json({ ok: false, error: "empty" }, { status: 400 });

  const preview = buildPreview(csv);
  const valid = preview.filter((r) => r.valid);

  if (!body.commit) {
    return Response.json({
      ok: true,
      committed: false,
      total: preview.length,
      validCount: valid.length,
      invalidCount: preview.length - valid.length,
      rows: preview,
    });
  }

  const result = await importProductsCsv(
    valid.map<ProductCsvRow>((r) => ({
      name: r.name,
      sku: r.sku,
      category: r.category,
      pricePaise: r.pricePaise,
      stock: r.stock,
      status: r.status,
      description: r.description,
    })),
  );
  return Response.json({ ok: true, committed: true, ...result });
}
