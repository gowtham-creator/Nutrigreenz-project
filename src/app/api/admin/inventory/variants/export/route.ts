import { isSignedInAdmin } from "../../guard";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { exportVariantsCsv } from "@/lib/catalog";

/** GET — download all variants as a CSV attachment (SKU,product,label,pack,price,stock). */
export async function GET(): Promise<Response> {
  if (!(await isSignedInAdmin())) return Response.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured) {
    return Response.json({ ok: false, error: "db-unavailable" }, { status: 503 });
  }

  const csv = await exportVariantsCsv();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv;charset=utf-8;",
      "content-disposition": `attachment; filename="nutrigreenz-variants-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
