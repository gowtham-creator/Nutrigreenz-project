/**
 * "New order" alerts to the operators, sent when a customer places an order.
 *
 * ── What this fixes ───────────────────────────────────────────────────────
 *
 * Until now the ONLY notification a placed order produced was the customer's
 * own confirmation. Nobody on the Nutri Greenz side was told anything — an
 * order landed in the console and waited to be noticed. This mails every
 * active operator so a new order reaches a person rather than a dashboard.
 *
 * ── Where each alert is delivered ─────────────────────────────────────────
 *
 * To the address the operator actually reads, which is often NOT the address
 * they sign in with: several @nutrigreenz.farm mailboxes have no MX record and
 * bounce (the reason `ADMIN_MAILBOX_OVERRIDE` exists at all). Resolution order:
 *
 *   1. `admin_security.otp_email` — the address linked to the account in the
 *      console. An explicit per-admin choice, so it wins outright.
 *   2. `adminMailbox(email)` — the login address, via the existing super-admin
 *      override.
 *
 * Addresses are de-duplicated case-insensitively at the end: two operators can
 * legitimately share one linked inbox, and that inbox should get one copy of
 * each order, not two.
 *
 * ── Why sends are individual, not one mail with many recipients ───────────
 *
 * A single message addressed to every operator would disclose the whole admin
 * roster to each of them, and to anyone later forwarded the mail. One send per
 * recipient costs a few extra API calls and leaks nothing.
 *
 * ── Best-effort, always ───────────────────────────────────────────────────
 *
 * Every failure is swallowed and logged. An operator alert must never be able
 * to fail a customer's checkout.
 */
import "server-only";

import { sendEmail, isEmailConfigured } from "@/lib/email";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";
import { adminMailbox } from "@/lib/admin-identity";
import { getOrder, type OrderWithDetail } from "@/lib/orders";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";

const GREEN = "#14331F";
const INK = "#2B2B26";
const MUTED = "#6B6B60";
const LINE = "#E4E0D2";

/**
 * Accounts that must never receive order alerts, lowercased.
 *
 * These are the penetration-test logins from the Entersoft engagement. They are
 * still active admins by an explicit decision, but an order alert carries a
 * customer's name, delivery address, phone number and order value, and two of
 * these are external Gmail accounts — one named after a Burp Collaborator
 * out-of-band domain. Mailing customer PII there on every order is not
 * something a notification feature should quietly start doing.
 *
 * This is a guard, not a fix: the accounts still hold live admin access. It is
 * env-overridable (comma-separated) so the list can be corrected without a
 * deploy, and it should be emptied once the accounts themselves are gone.
 */
const DEFAULT_ALERT_EXCLUDE = [
  "pentest-admin@nutrigreenz.farm",
  "pentest-superadmin@nutrigreenz.farm",
  "pentesterz1130@gmail.com",
  "pentesterz1130+1@gmail.com",
  "sam214800@gmail.com",
];

function excludedLogins(): Set<string> {
  const raw = process.env.ORDER_ALERT_EXCLUDE;
  const list =
    raw === undefined
      ? DEFAULT_ALERT_EXCLUDE
      : raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
  return new Set(list.map((s) => s.toLowerCase()));
}

/** ₹ for display, two decimals. */
function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Escape for interpolation into the alert HTML. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A readable one-line delivery address from the order's snapshot. */
function addressLine(order: OrderWithDetail): string {
  const a = order.addressSnapshot;
  if (!a) return "—";
  const parts = ["line1", "line2", "landmark", "city", "state", "pincode"]
    .map((k) => a[k])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return parts.length ? parts.join(", ") : "—";
}

/** The recipient name on the order, when the snapshot carries one. */
function customerName(order: OrderWithDetail): string {
  const a = order.addressSnapshot;
  const name = a && typeof a.name === "string" ? a.name.trim() : "";
  return name || "—";
}

/**
 * Every active operator's deliverable address, de-duplicated.
 *
 * Returns an empty list rather than throwing when the DB is unconfigured or the
 * query fails — the caller treats "nobody to tell" and "could not find out who
 * to tell" the same way, because neither may interfere with the order.
 */
async function alertRecipients(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const db = supabaseAdmin();

  const { data: admins, error } = await db
    .from("admins")
    .select("email, status")
    .eq("status", "active");
  if (error || !admins) return [];

  const rows = admins as { email: string | null; status: string }[];
  const logins = rows
    .map((r) => r.email?.trim())
    .filter((e): e is string => !!e);
  if (logins.length === 0) return [];

  // Linked addresses, keyed by login. A missing row simply means "no linked
  // address", which the fallback below handles.
  const linked = new Map<string, string>();
  const { data: security } = await db
    .from("admin_security")
    .select("email, otp_email")
    .in("email", logins);
  for (const row of (security as { email: string; otp_email: string | null }[] | null) ?? []) {
    if (row.otp_email?.trim()) linked.set(row.email.toLowerCase(), row.otp_email.trim());
  }

  const excluded = excludedLogins();
  const out = new Map<string, string>();
  for (const login of logins) {
    if (excluded.has(login.toLowerCase())) continue;
    const target = linked.get(login.toLowerCase()) || adminMailbox(login);
    if (!target.includes("@")) continue;
    // Keyed lowercase so one inbox shared by two operators gets one copy.
    if (!out.has(target.toLowerCase())) out.set(target.toLowerCase(), target);
  }
  return [...out.values()];
}

/** The alert body — a scannable summary plus a link straight to the order. */
function alertHtml(order: OrderWithDetail): string {
  const items = order.items
    .map(
      (it) => `
      <tr>
        <td style="padding:6px 0;color:${INK};font-size:14px">${esc(it.title)}${
          it.variantSku ? ` <span style="color:${MUTED}">(${esc(it.variantSku)})</span>` : ""
        }</td>
        <td style="padding:6px 0;color:${MUTED};font-size:14px;text-align:center">×${it.qty}</td>
        <td style="padding:6px 0;color:${INK};font-size:14px;text-align:right">${rupees(
          it.lineTotalPaise,
        )}</td>
      </tr>`,
    )
    .join("");

  const paid = order.paymentStatus === "paid";
  const payTone = paid ? GREEN : "#B84329";
  const payText = `${order.paymentMethod.toUpperCase()} · ${order.paymentStatus.toUpperCase()}`;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:4px 0;color:${MUTED};font-size:13px;width:120px">${label}</td>
      <td style="padding:4px 0;color:${INK};font-size:13px">${value}</td>
    </tr>`;

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F7F5EC;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#FFFDF6;border:1px solid ${LINE};border-radius:14px;overflow:hidden">
      <div style="background:${GREEN};padding:16px 20px">
        <div style="color:#F2EFE0;font-size:12px;letter-spacing:.08em;text-transform:uppercase">New order</div>
        <div style="color:#FFFDF6;font-size:22px;font-weight:700;margin-top:2px">${esc(
          order.orderNumber,
        )}</div>
      </div>
      <div style="padding:20px">
        <div style="font-size:26px;font-weight:700;color:${GREEN}">${rupees(order.totalPaise)}</div>
        <div style="display:inline-block;margin-top:6px;padding:3px 10px;border-radius:999px;background:${payTone};color:#FFFDF6;font-size:12px;font-weight:700">${esc(
          payText,
        )}</div>

        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          ${row("Customer", esc(customerName(order)))}
          ${row("Phone", esc(order.userPhone || "—"))}
          ${row("Email", esc(order.userEmail || "—"))}
          ${row("Deliver to", esc(addressLine(order)))}
        </table>

        <table style="width:100%;border-collapse:collapse;margin-top:16px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE}">
          ${items}
        </table>

        <a href="${SITE}/admin/orders"
           style="display:inline-block;margin-top:18px;background:${GREEN};color:#FFFDF6;text-decoration:none;padding:11px 20px;border-radius:999px;font-size:14px;font-weight:600">
          Open in admin
        </a>
      </div>
    </div>
  </div>`;
}

/**
 * Tell every active operator that an order has been placed.
 *
 * Safe to call unconditionally: no-ops when email or the DB is unconfigured,
 * and never throws.
 */
export async function sendAdminOrderAlert(orderId: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;
    const order = await getOrder(orderId);
    if (!order) return;

    const recipients = await alertRecipients();
    if (recipients.length === 0) return;

    const subject = `New order ${order.orderNumber} · ${rupees(order.totalPaise)}`;
    const html = alertHtml(order);

    // allSettled: one bad address must not stop the rest being told.
    const results = await Promise.allSettled(
      recipients.map((to) => sendEmail({ to, subject, html })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      console.error(
        `[admin-order-alerts] ${order.orderNumber}: ${failed}/${recipients.length} sends failed`,
      );
    }
  } catch (err) {
    console.error(`[admin-order-alerts] alert for ${orderId} failed:`, err);
  }
}
