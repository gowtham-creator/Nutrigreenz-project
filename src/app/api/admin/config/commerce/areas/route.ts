import { requireSuperAdmin } from "../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listServiceableAreas, upsertArea, importAreas } from "@/lib/commerce-rules";
import { parseCsv } from "@/lib/csv";

/** GET — list all serviceable areas. Super-admin only. */
export async function GET(): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const areas = await listServiceableAreas();
  return Response.json({ ok: true, areas });
}

const HEADER_KEYS = ["pincode", "area", "community"];

/** Parse CSV text → area rows, auto-detecting and dropping a header row. */
function parseAreaCsv(text: string): { pincode: string; area?: string; community?: string }[] {
  const grid = parseCsv(text);
  if (grid.length === 0) return [];

  let startIdx = 0;
  let cols = HEADER_KEYS;
  const first = grid[0].map((c) => c.toLowerCase());
  if (first.includes("pincode") || first.includes("pin") || first.includes("area")) {
    startIdx = 1;
    cols = first.map((c) => (c === "pin" ? "pincode" : c));
  }

  const rows: { pincode: string; area?: string; community?: string }[] = [];
  for (let i = startIdx; i < grid.length; i++) {
    const cells = grid[i];
    const get = (key: string): string => {
      const idx = cols.indexOf(key);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    // Tolerate a single-column file: treat the first cell as the pincode.
    const pincode = get("pincode") || (cells[0] ?? "").trim();
    rows.push({
      pincode,
      area: get("area") || undefined,
      community: get("community") || undefined,
    });
  }
  return rows;
}

/**
 * POST — two modes:
 *   - `{ csv }`                       → bulk-import pincodes from CSV text.
 *   - `{ pincode, area?, community? }` → create a single serviceable area.
 * Super-admin only.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // CSV bulk import.
  if (typeof body.csv === "string") {
    const csv = body.csv;
    if (!csv.trim()) return Response.json({ ok: false, error: "empty" }, { status: 400 });
    const rows = parseAreaCsv(csv);
    const result = await importAreas(rows);
    return Response.json({ ok: true, imported: true, ...result });
  }

  // Single area create.
  const pincode = String(body.pincode ?? "").trim();
  if (!pincode) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  const area = body.area !== undefined ? String(body.area) : undefined;
  const community = body.community !== undefined ? String(body.community) : undefined;
  const active = typeof body.active === "boolean" ? body.active : undefined;

  try {
    const created = await upsertArea({ pincode, area, community, active });
    return Response.json({ ok: true, area: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create-failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
