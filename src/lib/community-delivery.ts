/**
 * Community deliveries: an operator assigns a captain, a date and a slot to a
 * community's orders, and the captain takes them door to door.
 *
 * A pickup is one captain's run. `orders.pickup_id` links the orders to it, so an
 * order can only ever be on one run, and the conditional link below means two
 * operators assigning at once cannot both claim it.
 *
 * Service-role only. The customer read fails soft: a missing delivery line must
 * never stop someone seeing their order.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCaptainById } from "@/lib/captains";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { istDay } from "@/lib/order-periods";

const ASSIGNABLE_STATUSES = ["placed", "confirmed", "packed"];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const WINDOW_MAX = 80;

export type AssignError =
  | "invalid-date"
  | "past-date"
  | "invalid-window"
  | "no-orders"
  | "captain-unavailable"
  | "captain-network-off"
  | "unavailable";

export interface AssignInput {
  orderIds: string[];
  captainId: string;
  /** IST calendar day, YYYY-MM-DD. */
  deliveryDate: string;
  windowText: string;
  community: string;
  address: string | null;
  byEmail: string;
}

export type AssignResult =
  | { ok: true; pickupId: string; orderIds: string[] }
  | { ok: false; error: AssignError };

/** Assign a captain, date and slot to the given orders that are still unassigned. */
export async function assignCommunityDelivery(
  input: AssignInput,
  now: Date = new Date(),
): Promise<AssignResult> {
  const windowText = input.windowText.trim();
  if (!ISO_DAY.test(input.deliveryDate) || Number.isNaN(Date.parse(input.deliveryDate))) {
    return { ok: false, error: "invalid-date" };
  }
  if (input.deliveryDate < istDay(now.getTime())) return { ok: false, error: "past-date" };
  if (!windowText || windowText.length > WINDOW_MAX) return { ok: false, error: "invalid-window" };
  if (input.orderIds.length === 0) return { ok: false, error: "no-orders" };

  // With the network off the captain's screen is closed, so nobody would see it.
  if (!(await isFeatureEnabled("captain_network"))) {
    return { ok: false, error: "captain-network-off" };
  }
  const captain = await getCaptainById(input.captainId);
  if (!captain || !captain.active) return { ok: false, error: "captain-unavailable" };

  const db = supabaseAdmin();
  const { data: rows, error: readError } = await db
    .from("orders")
    .select("id")
    .in("id", input.orderIds)
    .in("status", ASSIGNABLE_STATUSES)
    .neq("payment_status", "failed")
    .is("pickup_id", null);
  if (readError) return { ok: false, error: "unavailable" };
  const eligible = ((rows as { id: string }[] | null) ?? []).map((r) => r.id);
  if (eligible.length === 0) return { ok: false, error: "no-orders" };

  const { data: pickup, error: insertError } = await db
    .from("captain_pickups")
    .insert({
      captain_id: captain.id,
      community: input.community,
      address: input.address,
      status: "due",
      due_at: new Date(`${input.deliveryDate}T00:00:00+05:30`).toISOString(),
      delivery_date: input.deliveryDate,
      window_text: windowText,
      assigned_by: input.byEmail,
    })
    .select("id")
    .single();
  if (insertError || !pickup) return { ok: false, error: "unavailable" };
  const pickupId = (pickup as { id: string }).id;

  // Conditional, so an order another operator just assigned stays on their run.
  const { data: linked, error: linkError } = await db
    .from("orders")
    .update({ pickup_id: pickupId })
    .in("id", eligible)
    .is("pickup_id", null)
    .select("id");
  const orderIds = ((linked as { id: string }[] | null) ?? []).map((r) => r.id);
  if (linkError || orderIds.length === 0) {
    await db.from("captain_pickups").delete().eq("id", pickupId);
    return { ok: false, error: linkError ? "unavailable" : "no-orders" };
  }
  return { ok: true, pickupId, orderIds };
}

/**
 * Remove a run the captain has not started, so its orders can be assigned again.
 * The foreign key unlinks them. Returns false once the captain has collected:
 * the goods have left, and only a person can sort that out.
 */
export async function removeCommunityDelivery(pickupId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("captain_pickups")
    .delete()
    .eq("id", pickupId)
    .eq("status", "due")
    .select("id");
  if (error) throw new Error(error.message);
  return ((data as unknown[] | null) ?? []).length > 0;
}

export interface OrderDelivery {
  deliveryDate: string;
  windowText: string;
  /** First name only: enough to recognise them at the door. */
  captainName: string;
}

/** The delivery assigned to an order, or null. Never throws. */
export async function deliveryForOrder(orderId: string): Promise<OrderDelivery | null> {
  try {
    const db = supabaseAdmin();
    const { data: order } = await db.from("orders").select("pickup_id").eq("id", orderId).maybeSingle();
    const pickupId = (order as { pickup_id: string | null } | null)?.pickup_id;
    if (!pickupId) return null;
    const { data: pickup } = await db
      .from("captain_pickups")
      .select("captain_id, delivery_date, window_text")
      .eq("id", pickupId)
      .maybeSingle();
    const p = pickup as {
      captain_id: string;
      delivery_date: string | null;
      window_text: string | null;
    } | null;
    if (!p?.delivery_date || !p.window_text) return null;
    const captain = await getCaptainById(p.captain_id);
    return {
      deliveryDate: p.delivery_date,
      windowText: p.window_text,
      captainName: captain?.name.trim().split(/\s+/)[0] ?? "",
    };
  } catch {
    return null;
  }
}
