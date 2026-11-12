/**
 * Browser-side calls for subscriptions, plus the SBIePay hand-off they share
 * with checkout. Types are imported as types only, so nothing server-side is
 * bundled into the page.
 */
import type {
  SubscriptionDeliveryRecord,
  SubscriptionRecord,
} from "@/lib/subscriptions";

export type { SubscriptionDeliveryRecord, SubscriptionRecord };

/** Set before leaving for the bank, so /checkout/success leaves the cart alone. */
export const SUBSCRIPTION_PAY_KEY = "ng.subscriptionPay";

export class SubscriptionApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    const code = typeof body.error === "string" ? body.error : "server-error";
    super(code);
    this.name = "SubscriptionApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok || body.ok === false) throw new SubscriptionApiError(res.status, body);
  return body as T;
}

export function fetchMySubscriptions(): Promise<{ subscriptions: SubscriptionRecord[] }> {
  return call("/api/subscriptions");
}

export interface CreateSubscriptionBody {
  items: { variantId: string; qty: number }[];
  frequencyDays: number;
  startOn: string;
  addressSnapshot: unknown;
  slotId: string;
  paymentMethod: "upi" | "cod";
}

export function createSubscription(
  body: CreateSubscriptionBody,
): Promise<{ subscription: SubscriptionRecord; firstDelivery: SubscriptionDeliveryRecord | null }> {
  return call("/api/subscriptions", { method: "POST", body: JSON.stringify(body) });
}

export type SubscriptionAction =
  | { action: "pause"; until?: string | null }
  | { action: "resume" }
  | { action: "skip" }
  | { action: "cancel"; reason?: string };

export function subscriptionAction(
  id: string,
  action: SubscriptionAction,
): Promise<{ subscription: SubscriptionRecord }> {
  return call(`/api/subscriptions/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function updateSubscription(
  id: string,
  patch: {
    frequencyDays?: number;
    paymentMethod?: "upi" | "cod";
    slotId?: string;
    addressSnapshot?: unknown;
    items?: { variantId: string; qty: number }[];
  },
): Promise<{ subscription: SubscriptionRecord }> {
  return call(`/api/subscriptions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function payDelivery(
  deliveryId: string,
): Promise<{ orderNumber: string; payment: { action: string; fields: Record<string, string> } | null }> {
  return call(`/api/subscriptions/deliveries/${encodeURIComponent(deliveryId)}/pay`, { method: "POST" });
}

export async function fetchPaymentMethods(): Promise<{ methods: ("upi" | "cod")[] }> {
  try {
    return await call("/api/payments/methods");
  } catch {
    return { methods: [] };
  }
}

/* ── SBIePay hand-off (same host rules as checkout) ───────────────────── */

const SBIEPAY_HOSTS = new Set(["sbiepay.sbi.bank.in", "integration.sbiepay.sbiuat.bank.in"]);
const SBIEPAY_PARENT_DOMAINS = [".sbi.bank.in", ".sbiuat.bank.in"];

export function isSbiePayUrl(action: string): boolean {
  let url: URL;
  try {
    url = new URL(action);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return SBIEPAY_HOSTS.has(host) || SBIEPAY_PARENT_DOMAINS.some((d) => host.endsWith(d));
}

/** Send the customer to the bank. Returns false when the URL is not SBIePay's. */
export function goToGateway(
  orderNumber: string,
  payment: { action: string; fields: Record<string, string> },
): boolean {
  if (!isSbiePayUrl(payment.action)) return false;
  try {
    sessionStorage.setItem(SUBSCRIPTION_PAY_KEY, orderNumber);
  } catch {
    /* private mode: the cart may be cleared on return, which is harmless */
  }
  if (Object.keys(payment.fields).length === 0) {
    window.location.assign(payment.action);
    return true;
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = payment.action;
  for (const [name, value] of Object.entries(payment.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  return true;
}

/** Plain-language message for an API error code. */
export function subscriptionErrorMessage(err: unknown): string {
  const code = err instanceof SubscriptionApiError ? err.code : "";
  const body = err instanceof SubscriptionApiError ? err.body : {};
  switch (code) {
    case "unauthenticated":
      return "Please sign in again.";
    case "bad-frequency":
      return "Please choose how often you'd like it delivered.";
    case "bad-start-date":
      return "Please choose a delivery date from the list.";
    case "no-items":
      return "Add at least one product to your subscription.";
    case "too-many-items":
      return "A subscription can hold up to 10 products.";
    case "item-unavailable":
      return "One of these products isn't available for subscription right now.";
    case "below-minimum": {
      const min = typeof body.minOrderPaise === "number" ? Math.round(body.minOrderPaise / 100) : null;
      return min
        ? `Each delivery needs to be at least ₹${min.toLocaleString("en-IN")}. Add a little more.`
        : "Each delivery is below the minimum order. Add a little more.";
    }
    case "bad-address":
      return "Please choose a complete delivery address.";
    case "not-serviceable":
      return "We don't deliver to that pincode yet. Please choose another address.";
    case "slot-unavailable":
      return "That delivery slot isn't available any more. Please choose another.";
    case "payment-unavailable":
      return "That payment option isn't available right now. Please choose another.";
    case "out-of-stock":
      return "Something on this delivery just went out of stock. Please try again later or change the quantity.";
    case "bad-state":
      return "This can't be done right now. Refresh the page and try again.";
    case "busy":
      return "We're already processing this. Give it a moment and refresh.";
    case "not-found":
      return "We couldn't find that subscription.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function inr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
