import { redirect } from "next/navigation";

/**
 * Legacy `/orders` — retired, the same way `/orders/[id]` was.
 *
 * This route rendered its own order list from `listReceipts()`: receipts the
 * checkout had written into *this browser's* storage. So it showed a different
 * history on every device, froze every order's status at "processing" for ever,
 * and disagreed with `/account/orders`, which reads the real ownership-checked
 * rows from the server. Two order lists that don't match is worse than one.
 *
 * Everything now lands on the real list. Links from emails, the shipping policy
 * and the tracking page keep working through this redirect.
 */
export default function LegacyOrdersRedirect(): never {
  redirect("/account/orders");
}
