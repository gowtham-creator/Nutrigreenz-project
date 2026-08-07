import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { listStalePendingPayments, getOrder, transitionOrderPayment } from "@/lib/orders";
import { confirmGatewayPayment, isOnlinePaymentAvailable } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bounded so a large backlog cannot be killed halfway by the platform timeout.
export const maxDuration = 300;

/**
 * Find payments the gateway took and we never heard about.
 *
 * ── Why this has to exist ─────────────────────────────────────────────────
 *
 * The callback is not a guarantee. A customer who pays and immediately closes
 * the tab produces no browser return at all, and the server-to-server
 * notification can be lost to a deploy, a cold start, or a network blip. When
 * that happens the order sits at "pending" forever: the money has left the
 * customer's account, nothing is dispatched, and no part of the system is aware
 * anything is wrong. The customer finds out from their bank statement.
 *
 * This asks SBI directly about every order that was sent to the gateway and
 * never came back, and settles it. It is the only thing standing between a
 * dropped callback and a silently stolen payment.
 *
 * ── Why it is safe to run repeatedly ──────────────────────────────────────
 *
 * Every write goes through `transitionOrderPayment`, an atomic compare-and-set.
 * If a callback lands while this sweep is mid-flight, one of them wins and the
 * other gets `null` and stops. Running it every fifteen minutes, twice over, or
 * concurrently with itself all produce the same result.
 *
 * Schedule: see `crons` in `vercel.json`.
 */

interface Outcome {
  orderNumber: string;
  result: "paid" | "failed" | "still-pending" | "error";
  detail?: string;
}

/**
 * Vercel signs cron invocations with CRON_SECRET. Without this the endpoint is
 * a public button that re-queries the payment gateway for every pending order
 * — cheap to abuse, and it talks to a bank.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // Fail CLOSED. An unset secret in production must not mean "open to all".
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorised(request)) {
    return Response.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  if (!isSupabaseConfigured || !isOnlinePaymentAvailable()) {
    return Response.json({ ok: true, skipped: "payments-unavailable", checked: 0 });
  }

  /*
   * Only orders older than the payment window. A checkout still in progress is
   * legitimately "pending", and asking the bank about it — or worse, marking it
   * failed — would break a live payment.
   */
  const stale = await listStalePendingPayments({
    olderThanMinutes: 30,
    withinHours: 48,
    limit: 100,
  });

  const outcomes: Outcome[] = [];

  for (const candidate of stale) {
    try {
      const order = await getOrder(candidate.id);
      // Re-read: a callback may have settled it between the list and here.
      if (!order || order.paymentStatus !== "pending") continue;

      /*
       * No payload — there was never a callback. `confirmGatewayPayment` falls
       * back to a date-range lookup keyed on our own order reference, which is
       * exactly the case this sweep is for.
       */
      const result = await confirmGatewayPayment(
        {
          id: order.id,
          orderNumber: order.orderNumber,
          totalPaise: order.totalPaise,
          currency: order.currency,
          customerEmail: order.userEmail,
          customerPhone: order.userPhone,
        },
        {},
      );

      if (result.ok) {
        /*
         * Same amount guard as the callback. A sweep that skipped it would be a
         * way around the check simply by not triggering a callback.
         */
        if (result.capturedPaise !== null && result.capturedPaise < order.totalPaise) {
          await transitionOrderPayment(order.id, "pending", "failed", result.reference ?? null);
          outcomes.push({
            orderNumber: order.orderNumber,
            result: "failed",
            detail: "amount-mismatch",
          });
          continue;
        }
        const won = await transitionOrderPayment(
          order.id,
          "pending",
          "paid",
          result.reference ?? null,
        );
        outcomes.push({
          orderNumber: order.orderNumber,
          result: "paid",
          detail: won ? "recovered by sweep" : "settled concurrently",
        });
        continue;
      }

      /*
       * A gateway we could not reach is NOT a failed payment.
       *
       * `confirmGatewayPayment` returns ok:false for both "the bank says this
       * failed" and "we could not ask the bank". Marking the second as failed
       * would write off a real payment because of a network problem, and the
       * order would never be looked at again. Only the bank's own terminal
       * words close an order here; anything else is left pending for the next
       * run, which is the recoverable direction.
       */
      const terminal = new Set(["failed", "cancel", "expired", "attempt_fail", "not-found"]);
      if (result.reason && terminal.has(result.reason)) {
        await transitionOrderPayment(order.id, "pending", "failed", result.reference ?? null);
        outcomes.push({ orderNumber: order.orderNumber, result: "failed", detail: result.reason });
      } else {
        outcomes.push({
          orderNumber: order.orderNumber,
          result: "still-pending",
          detail: result.reason ?? "gateway unreachable — will retry",
        });
      }
    } catch (err) {
      // One bad order must not stop the sweep for the rest.
      outcomes.push({
        orderNumber: candidate.orderNumber,
        result: "error",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  const summary = {
    checked: stale.length,
    paid: outcomes.filter((o) => o.result === "paid").length,
    failed: outcomes.filter((o) => o.result === "failed").length,
    stillPending: outcomes.filter((o) => o.result === "still-pending").length,
    errors: outcomes.filter((o) => o.result === "error").length,
  };

  // Recovering a payment means a callback was lost. Worth a loud line.
  if (summary.paid > 0) {
    console.warn("[reconcile-payments] recovered paid orders:", summary.paid);
  }
  console.info("[reconcile-payments]", JSON.stringify(summary));

  return Response.json({ ok: true, ...summary, outcomes });
}
