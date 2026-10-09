/**
 * The name a receipt, invoice or email prints for how an order was paid.
 *
 * Pure and dependency-free so the e-mail and the PDF share one rule.
 *
 * `orders.payment_provider` is the gateway that settled the order and is the
 * column default 'none' for everything that never touched one - which is every
 * cash-on-delivery order, and every online order that was paid before the
 * provider was recorded. Printing it raw gave "Paid · none" on a receipt. The
 * label is built from the method first and the provider second.
 */
export function paymentMethodLabel(order: {
  paymentMethod?: string | null;
  paymentProvider?: string | null;
}): string {
  if (order.paymentMethod === "cod") return "Cash on delivery";

  const provider = order.paymentProvider?.trim().toLowerCase();
  if (!provider || provider === "none") return "Online";
  if (provider === "sbiepay") return "SBIePay";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
