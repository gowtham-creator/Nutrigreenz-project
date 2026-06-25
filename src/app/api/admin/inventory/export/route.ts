import { isSignedInAdmin } from "../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { exportProductsCsv } from "@/lib/catalog";

/** GET — download the full product catalog as a CSV attachment. */
export async function GET(): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const csv = await exportProductsCsv();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv;charset=utf-8;",
      "content-disposition": `attachment; filename="nutrigreenz-products-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
