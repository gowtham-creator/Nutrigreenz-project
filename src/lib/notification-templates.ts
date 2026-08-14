/**
 * Single source of truth for ALL customer notification copy, across every channel
 * (email / SMS / WhatsApp) and every message type (order placed, order status,
 * invoice, promotion, campaign, offer).
 *
 * WHY one module: the exact SMS/WhatsApp text must be pre-registered — SMS with
 * the DLT platform (as content templates with `{#var#}` placeholders) and WhatsApp
 * with Meta (as approved templates). Keeping the copy here means the app, the DLT
 * submission, and the Meta submission all say the SAME thing. See
 * docs/Notification-Templates.md for the human-readable list to submit.
 *
 * Placeholders use `{name}` here and are interpolated by `render()`. The matching
 * DLT/Meta templates use their own placeholder syntax (`{#var#}` / `{{1}}`) — the
 * doc maps them 1:1.
 */

export type NotifyType =
  | "orderPlaced"
  | "orderStatus"
  | "invoice"
  | "promotion"
  | "campaign"
  | "offer";

export type NotifyChannel = "email" | "sms" | "whatsapp";

/** Every variable any template may reference (all optional; unknowns → ""). */
export interface TemplateVars {
  brand?: string;
  customerName?: string;
  orderNumber?: string;
  status?: string;
  total?: string;
  itemsSummary?: string;
  trackUrl?: string;
  invoiceUrl?: string;
  offerTitle?: string;
  offerCode?: string;
  discount?: string;
  validTill?: string;
  ctaUrl?: string;
}

export interface RenderedMessage {
  /** Email subject (email channel only). */
  subject?: string;
  /** Plain-text body — the SMS/WhatsApp message, and the email's text fallback. */
  body: string;
  /** On-brand HTML (email channel only). */
  html?: string;
}

const BRAND = "Nutri Greenz";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz-project.vercel.app";

function interpolate(tpl: string, vars: TemplateVars): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = (vars as Record<string, string | undefined>)[k];
    return v == null ? "" : String(v);
  });
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }) as Record<string, string>)[c],
  );
}

/* ── plain-text templates (SMS + WhatsApp; also the email text fallback) ──────
 * SMS: keep short + single-segment where possible; these become DLT templates.
 * WhatsApp: can be richer (emoji, line breaks); become Meta templates.            */

const SMS: Record<NotifyType, string> = {
  orderPlaced: "{brand}: Order {orderNumber} placed successfully. Total {total}. Track: {trackUrl}",
  orderStatus: "{brand}: Your order {orderNumber} is now {status}. Track: {trackUrl}",
  invoice: "{brand}: Invoice for order {orderNumber} ({total}) is ready: {invoiceUrl}",
  promotion: "{brand}: {offerTitle} - {discount} off with code {offerCode}. Valid till {validTill}. Shop: {ctaUrl}",
  campaign: "{brand}: {offerTitle}. {discount} off this season. Shop now: {ctaUrl}",
  offer: "{brand}: New offer - {offerTitle}! Use {offerCode} for {discount} off. {ctaUrl}",
};

const WHATSAPP: Record<NotifyType, string> = {
  orderPlaced:
    "🌿 *{brand}*\nHi {customerName}, your order *{orderNumber}* is confirmed!\n\n{itemsSummary}\n*Total:* {total}\n\nWe'll message you as it ships. Track your order: {trackUrl}",
  orderStatus:
    "🌿 *{brand}*\nUpdate on order *{orderNumber}*: it's now *{status}*.\nTrack: {trackUrl}",
  invoice:
    "🧾 *{brand}*\nYour invoice for order *{orderNumber}* ({total}) is ready.\nDownload: {invoiceUrl}",
  promotion:
    "🎉 *{brand}*. {offerTitle}\nGet *{discount} off* with code *{offerCode}*.\nValid till {validTill}.\nShop now 👉 {ctaUrl}",
  campaign:
    "🌾 *{brand}*. {offerTitle}\n{discount} off this season on farm-fresh picks.\nShop now 👉 {ctaUrl}",
  offer:
    "✨ *{brand}*. New offer!\n{offerTitle}\nUse *{offerCode}* for *{discount} off*.\n👉 {ctaUrl}",
};

const EMAIL_SUBJECT: Record<NotifyType, string> = {
  orderPlaced: "Order {orderNumber} confirmed · {brand}",
  orderStatus: "Your order {orderNumber} is {status} · {brand}",
  invoice: "Invoice for order {orderNumber} · {brand}",
  promotion: "{offerTitle}. {discount} off · {brand}",
  campaign: "{offerTitle} · {brand}",
  offer: "New offer: {offerTitle} · {brand}",
};

/** On-brand HTML shell (forest #14532d / cream #f4f1e8) shared by every email. */
function emailHtml(heading: string, lines: string[], cta?: { label: string; url: string }): string {
  const body = lines
    .map((l) => `<p style="font-size:14px;line-height:1.6;color:#3a4a40;margin:0 0 10px">${l}</p>`)
    .join("");
  const button = cta
    ? `<a href="${cta.url}" style="display:inline-block;margin-top:14px;background:#14532d;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px">${escapeHtml(cta.label)}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f1e8;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1a2b22">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:19px;font-weight:700;color:#14532d">${BRAND}</div>
    <h1 style="font-size:22px;color:#14532d;margin:16px 0 10px">${escapeHtml(heading)}</h1>
    ${body}${button}
    <p style="font-size:12px;color:#8a978d;margin-top:24px">Farm-fresh, from our partner farms to your kitchen. 🌱</p>
  </div></body></html>`;
}

const EMAIL_HEADING: Record<NotifyType, string> = {
  orderPlaced: "Order confirmed 🌿",
  orderStatus: "Order update",
  invoice: "Your invoice 🧾",
  promotion: "A little something for you 🎉",
  campaign: "Fresh off the farm 🌾",
  offer: "New offer just dropped ✨",
};

/** Render a message for one type + channel with the given variables. */
export function render(type: NotifyType, channel: NotifyChannel, vars: TemplateVars): RenderedMessage {
  const v: TemplateVars = { brand: BRAND, ctaUrl: `${SITE}/shop`, ...vars };
  if (channel === "sms") return { body: interpolate(SMS[type], v) };
  if (channel === "whatsapp") return { body: interpolate(WHATSAPP[type], v) };

  // email
  const subject = interpolate(EMAIL_SUBJECT[type], v);
  const text = interpolate(WHATSAPP[type], v).replace(/\*/g, "");
  const bodyLines = text.split("\n").filter(Boolean).map(escapeHtml);
  const cta = v.trackUrl
    ? { label: "Track your order", url: v.trackUrl }
    : v.invoiceUrl
      ? { label: "View invoice", url: v.invoiceUrl }
      : v.ctaUrl
        ? { label: "Shop now", url: v.ctaUrl }
        : undefined;
  return { subject, body: text, html: emailHtml(EMAIL_HEADING[type], bodyLines, cta) };
}
