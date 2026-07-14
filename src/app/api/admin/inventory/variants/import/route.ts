import { isSignedInAdmin, isSuperAdmin } from "../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { importVariantsCsv, type VariantCsvRow } from "@/lib/catalog";
import { parseCsv } from "@/lib/csv";
import { requireApiPermission } from "@/lib/admin-api-guard";

/** A single previewed variant row plus any validation note. */
interface PreviewRow extends VariantCsvRow {
  line: number;
  valid: boolean;
  note?: string;
}

const HEADER_KEYS = ["sku", "product", "label", "pack", "price", "stock"];

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
  if (first.includes("sku") || first.includes("label") || first.includes("product")) {
    startIdx = 1;
    cols = first;
  }

  const rows: PreviewRow[] = [];
  for (let i = startIdx; i < grid.length; i++) {
    const cells = grid[i];
    const get = (key: string): string => {
      const idx = cols.indexOf(key);
      return idx >= 0 ? (cells[idx] ?? "") : "";
    };
    const sku = get("sku").trim();
    rows.push({
      line: i + 1,
      sku,
      product: get("product").trim() || undefined,
      label: get("label").trim() || undefined,
      pack: get("pack").trim() || undefined,
      pricePaise: toPaise(get("price")),
      stock: toInt(get("stock")),
      valid: Boolean(sku),
      note: sku ? undefined : "missing SKU",
    });
  }
  return rows;
}

/**
 * POST — variant CSV import. Two modes:
 *   - `{ csv, commit: false }`  → parse + return a preview (no writes).
 *   - `{ csv, commit: true }`   → import the valid rows and return a summary.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await requireApiPermission("catalog");
  if (denied) return denied;
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  // Variant CSV import can change prices in bulk → super-admin only (preview included).
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

  const result = await importVariantsCsv(
    valid.map<VariantCsvRow>((r) => ({
      sku: r.sku,
      product: r.product,
      label: r.label,
      pack: r.pack,
      pricePaise: r.pricePaise,
      stock: r.stock,
    })),
  );
  return Response.json({ ok: true, committed: true, ...result });
}
