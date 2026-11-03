import { requireActiveCaptain } from "@/lib/captains";
import { conversionReport } from "@/lib/captain-conversions";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/captain/conversions — the signed-in captain's customers who went on
 * to buy online. Their own customers only. Mobiles are shortened to the last
 * four digits and online spend is left out: the captain needs to know who
 * converted, not what they spent.
 */
export async function GET(): Promise<Response> {
  const gate = await requireActiveCaptain();
  if (gate instanceof Response) return gate;
  if (!isSupabaseConfigured) {
    return Response.json({ ok: true, summary: null, customers: [] });
  }
  try {
    const report = await conversionReport(gate.captainId);
    return Response.json(
      {
        ok: true,
        summary: {
          offlineCustomers: report.overall.offlineCustomers,
          converted: report.overall.converted,
          alreadyOnline: report.overall.alreadyOnline,
          rate: report.overall.rate,
          onlineOrders: report.overall.onlineOrders,
        },
        customers: report.customers.map((c) => ({
          name: c.name,
          mobileEnd: c.mobile.slice(-4),
          via: c.via,
          firstTouchAt: c.firstTouchAt,
          status: c.status,
          firstOnlineAt: c.firstOnlineAt,
          onlineOrders: c.onlineOrders,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[captain] conversions failed:", err);
    return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
