import { redirect } from "next/navigation";

/**
 * /orders/[id]/invoice — the billing document for an order.
 *
 * This page used to render from sessionStorage, so the invoice existed only in
 * the browser that placed the order. Opening it on another device, or from the
 * link in the confirmation email, produced a graceful but entirely fictitious
 * SAMPLE invoice — a billing document showing invented figures is worse than
 * none at all.
 *
 * It now forwards to the server-generated PDF, built from the order row itself
 * and access-checked against the signed-in customer (or an operator). The `doc`
 * query is carried through, so the "Download receipt" link in the order email
 * resolves to the receipt rather than the invoice.
 */
export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { id } = await params;
  const { doc } = await searchParams;
  const kind = doc === "receipt" ? "receipt" : "invoice";
  redirect(`/api/orders/${encodeURIComponent(id)}/document?doc=${kind}`);
}
