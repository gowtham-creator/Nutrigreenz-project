import "server-only";

/**
 * The address customers are told to write to.
 *
 * customersupport@nutrigreenz.farm has NO MX RECORD, so mail sent there
 * bounces — printing it was sending people to a dead address. This falls
 * back to the inbox that does receive until that mailbox exists.
 */
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "nutrigreenzfarm@gmail.com";

import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getOrder, type OrderWithDetail } from "@/lib/orders";
import { render, type NotifyType } from "@/lib/notification-templates";
import { sendSms } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/whatsapp";
import { billingAttachments } from "@/lib/invoice-pdf";
import { gstFor } from "@/lib/gst";
import { sendAdminOrderAlert } from "@/lib/admin-order-alerts";

/**
 * Transactional ORDER emails via Brevo (reuses src/lib/email.ts). BEST-EFFORT:
 * every send is wrapped so a failure NEVER touches the order/checkout flow, and
 * it no-ops cleanly when Brevo is unconfigured or the order has no email on file.
 *
 * The HTML in `orderEmailHtml` is an on-brand DEFAULT — swap it for the client's
 * approved templates when they arrive; the trigger wiring below stays the same.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";
/**
 * Money for display, always to two decimals.
 *
 * Rounding to whole rupees broke the tax ladder: the taxable value and the
 * CGST/SGST halves would each round independently and stop summing to the total,
 * and the same order rendered different figures in the email than in the PDF.
 * A tax document has to reconcile line by line.
 */
const rupees = (paise: number) =>
  `₹${(Math.round(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

type Kind = "placed" | "confirmed" | "packed" | "shipped" | "delivered";

const COPY: Record<Kind, { subject: (n: string) => string; heading: string; intro: string }> = {
  // Sent the moment the customer completes checkout — the order exists, but the
  // team has not accepted it yet. Previously this said "confirmed", which then
  // repeated verbatim when an operator moved the order to the confirmed status.
  placed: {
    subject: (n) => `Order ${n} received · Nutri Greenz`,
    heading: "Order received 🌿",
    intro:
      "Thank you. We've got your order and our team is reviewing it. Your tax invoice is attached. We'll email you again the moment it's confirmed.",
  },
  confirmed: {
    subject: (n) => `Order ${n} confirmed · Nutri Greenz`,
    heading: "Order confirmed 🌿",
    intro: "Good news. Your order is confirmed and we're preparing it for your delivery slot.",
  },
  packed: {
    subject: (n) => `Order ${n} is packed · Nutri Greenz`,
    heading: "Packed and ready 📦",
    intro: "Your order is packed and waiting for its delivery slot. Here's your summary:",
  },
  shipped: {
    subject: (n) => `Order ${n} is on its way 🚚 · Nutri Greenz`,
    heading: "Your order shipped 🚚",
    intro: "Good news. Your order is on its way. We'll confirm once it reaches you.",
  },
  delivered: {
    subject: (n) => `Order ${n} delivered 🎉 · Nutri Greenz`,
    heading: "Delivered 🎉",
    intro: "Your order has reached you. We hope you love it. Reply here if anything isn't perfect.",
  },
};

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (ch) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }) as Record<string, string>)[ch],
  );
}

/** Pull a string field out of a JSON snapshot without trusting its shape. */
function snap(source: Record<string, unknown> | null, key: string): string {
  const v = source?.[key];
  return typeof v === "string" ? v.trim() : "";
}

/** The delivery address as display lines, skipping anything not captured. */
function addressLines(order: OrderWithDetail): string[] {
  const a = order.addressSnapshot as Record<string, unknown> | null;
  if (!a) return [];
  const street = [snap(a, "line1"), snap(a, "line2")].filter(Boolean).join(", ");
  const city = [snap(a, "city"), snap(a, "state"), snap(a, "pincode")].filter(Boolean).join(" ");
  return [snap(a, "fullName"), street, city, snap(a, "phone")].filter(Boolean);
}

/**
 * The transactional order email.
 *
 * Built entirely from tables with inline styles — Outlook and most Indian
 * webmail clients ignore flexbox, grid and <style> blocks, so anything more
 * modern silently collapses into a single column of unstyled text. Width is
 * capped at 600px, the standard safe render width.
 */
/**
 * The transactional order email.
 *
 * Restrained on purpose, following the billing reference the client supplied: a
 * light page, the amount as the loudest element, muted label/value meta, and a
 * borderless totals ladder. A receipt is a record — heavy cards and coloured
 * banners make it read like marketing and bury the number that matters.
 *
 * Built entirely from tables with inline styles. Outlook and most Indian webmail
 * ignore flexbox, grid and <style> blocks, so anything more modern collapses into
 * unstyled text. Width is capped at 600px, the standard safe render width.
 *
 * The palette is pinned light: `color-scheme: light only` stops Gmail and Apple
 * Mail force-inverting it, which previously turned the body near-black and left
 * the text unreadable in dark mode.
 */
function orderEmailHtml(order: OrderWithDetail, kind: Kind): string {
  const c = COPY[kind];
  const INK = "#141414";
  const MUTED = "#6B6F72";
  const LINE = "#E4E4E5";
  const PAGE = "#FFFFFF";
  const GREEN = "#14331F";

  /**
   * Which emails are BILLING documents.
   *
   * Placing and confirming an order are money events, so those carry the full
   * priced ladder and the attached invoice. Packed, shipped and delivered are
   * logistics: the customer has already been billed and told what they paid, so
   * repeating the amount there adds nothing and reads like a second charge.
   */
  const isReceipt = kind === "placed" || kind === "confirmed";
  const paid = order.paymentStatus === "paid";
  const gst = gstFor(order);

  const when = new Date(order.placedAt ?? order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const itemRows = order.items
    .map(
      (it) => `
        <tr>
          <td style="padding:9px 0 0;font-size:14px;color:${INK};line-height:1.4">
            ${escapeHtml(it.title)}
            <div style="font-size:12px;color:${MUTED};margin-top:2px">Qty ${it.qty}</div>
          </td>
          <td style="padding:9px 0 0;font-size:14px;color:${INK};text-align:right;white-space:nowrap;vertical-align:top">
            ${rupees(it.lineTotalPaise)}
          </td>
        </tr>`,
    )
    .join("");

  /**
   * One line of the totals ladder. `always` keeps a zero row visible: on a tax
   * invoice a missing tax line reads as an error rather than as a saving, so the
   * full ladder is printed even when a value is nil.
   */
  const row = (
    label: string,
    paise: number,
    opts: { negative?: boolean; strong?: boolean; always?: boolean; zeroText?: string } = {},
  ) => {
    if (paise <= 0 && !opts.always) return "";
    const value =
      paise <= 0 && opts.zeroText ? opts.zeroText : `${opts.negative ? "-" : ""}${rupees(paise)}`;
    const weight = opts.strong ? "font-weight:700;" : "";
    const size = opts.strong ? "15px" : "13.5px";
    return `<tr>
      <td style="padding:11px 0;border-top:1px solid ${LINE};font-size:${size};color:${opts.strong ? INK : MUTED};${weight}">${label}</td>
      <td style="padding:11px 0;border-top:1px solid ${LINE};font-size:${size};color:${INK};text-align:right;white-space:nowrap;${weight}">${value}</td>
    </tr>`;
  };

  const meta = (label: string, value: string) => `
    <tr>
      <td style="padding:7px 0;font-size:13.5px;color:${MUTED}">${label}</td>
      <td style="padding:7px 0;font-size:13.5px;color:${INK};text-align:right">${value}</td>
    </tr>`;

  const address = addressLines(order);
  const slot = order.slotSnapshot as Record<string, unknown> | null;
  const slotLabel = [snap(slot, "label"), snap(slot, "windowText")].filter(Boolean).join(" · ");

  const detailBlock = (title: string, bodyHtml: string) => `
    <td style="vertical-align:top;padding:0 10px 0 0;width:50%">
      <div style="font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};margin-bottom:6px">${title}</div>
      <div style="font-size:13px;color:${INK};line-height:1.6">${bodyHtml}</div>
    </td>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(c.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};color:${INK};color-scheme:light only;-webkit-font-smoothing:antialiased">
  <!-- Preheader: the grey preview line in the inbox, hidden in the body. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(c.intro)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};padding:36px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">

        <!-- Brand -->
        <tr>
          <td style="padding:0 0 34px">
            <img src="${SITE}/brand/logo-horizontal.png" alt="Nutri Greenz" width="132"
                 style="display:block;border:0;height:auto;width:132px;max-width:132px" />
          </td>
        </tr>

        <!-- Amount, front and centre -->
        <tr>
          <td style="padding:0 0 6px;font-size:13.5px;color:${MUTED}">
            ${isReceipt ? "Order from Nutri Greenz" : c.heading}
          </td>
        </tr>
        <tr>
          <td style="padding:0;font-size:38px;line-height:1.1;font-weight:700;color:${INK}">
            ${rupees(order.totalPaise)}
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0 0;font-size:13.5px;color:${MUTED}">
            ${paid ? `Paid ${when}` : `Placed ${when}`}
          </td>
        </tr>

        <!-- Documents ride with the email as attachments, so a link that
             demands a sign-in first would be the slower path. -->
        ${
          isReceipt
            ? `<tr>
          <td style="padding:20px 0 0;font-size:12.5px;color:${MUTED}">
            ${paid ? "Your invoice and receipt are attached." : "Your invoice is attached."}
            Also available any time under <a href="${SITE}/account/orders" style="color:${GREEN}">your orders</a>.
          </td>
        </tr>`
            : ""
        }

        <!-- Meta -->
        <tr>
          <td style="padding:26px 0 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${meta("Order number", escapeHtml(order.orderNumber))}
              ${paid ? meta("Receipt number", `${escapeHtml(order.orderNumber)}-R`) : ""}
              ${meta("Payment", paid ? `Paid${order.paymentProvider ? ` · ${escapeHtml(order.paymentProvider)}` : ""}` : "Pending")}
              ${meta("Status", escapeHtml(kind.charAt(0).toUpperCase() + kind.slice(1)))}
            </table>
          </td>
        </tr>

        <!-- Items + totals -->
        <tr>
          <td style="padding:34px 0 0;font-size:15px;font-weight:700;color:${INK}">
            ${isReceipt ? "Order summary" : c.heading}
          </td>
        </tr>
        <tr>
          <td style="padding:4px 0 0;font-size:14px;line-height:1.6;color:${MUTED}">${c.intro}</td>
        </tr>
        ${
          isReceipt
            ? `<tr>
          <td style="padding:16px 0 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              ${itemRows}
              <tr><td colspan="2" style="height:14px"></td></tr>
              ${row("Subtotal", order.subtotalPaise, { always: true })}
              ${row(order.couponCode ? `Discount (${escapeHtml(order.couponCode)})` : "Discount", order.discountPaise, { negative: true })}
              ${row("Loyalty credit", order.loyaltyRedeemedPaise, { negative: true })}
              ${row("Delivery", order.shippingPaise, { always: true, zeroText: "Free" })}
              ${row("Total excluding tax", gst.taxablePaise, { always: true })}
              ${
                gst.intraState
                  ? `${row(`CGST (${gst.halfRatePercent}%)`, gst.cgstPaise, { always: true })}
              ${row(`SGST (${gst.halfRatePercent}%)`, gst.sgstPaise, { always: true })}`
                  : row(`IGST (${gst.ratePercent}%)`, gst.igstPaise, { always: true })
              }
              ${row(paid ? "Amount paid" : "Total", order.totalPaise, { always: true, strong: true })}
            </table>
          </td>
        </tr>`
            : ""
        }

        ${
          isReceipt
            ? `<tr>
          <td style="padding:10px 0 0;font-size:11.5px;color:${MUTED};line-height:1.6">
            Prices include GST at ${gst.ratePercent}%. Place of supply: ${escapeHtml(gst.placeOfSupply)}.
          </td>
        </tr>`
            : ""
        }

        ${
          (address.length || slotLabel) && isReceipt
            ? `<tr>
          <td style="padding:30px 0 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${address.length ? detailBlock("Delivering to", address.map(escapeHtml).join("<br />")) : ""}
                ${slotLabel ? detailBlock("Delivery slot", escapeHtml(slotLabel)) : ""}
              </tr>
            </table>
          </td>
        </tr>`
            : ""
        }

        <!-- Action -->
        <tr>
          <td style="padding:32px 0 0">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="background:${GREEN};border-radius:999px">
                <a href="${SITE}/orders/${order.id}"
                   style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none">
                  Track your order
                </a>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:36px 0 0;border-top:1px solid ${LINE}">
            <p style="margin:22px 0 10px;font-size:12.5px;line-height:1.7;color:${MUTED}">
              Questions about this order? Just reply to this email, or write to
              <a href="mailto:${SUPPORT_EMAIL}" style="color:${GREEN}">${SUPPORT_EMAIL}</a>.
            </p>
            <p style="margin:0 0 10px;font-size:12px;line-height:1.7;color:${MUTED}">
              <strong style="color:${INK}">Nutri Greenz Farm Technologies Pvt. Ltd.</strong><br />
              1st Floor, H.No. 5-35/167, Double Road, Near Moosapet Y Junction,<br />
              Prashanth Nagar, Kukatpally, Hyderabad, Telangana 500072 &nbsp;·&nbsp; +91 94918 93370
            </p>
            <p style="margin:0;font-size:12px;color:${MUTED}">
              <a href="${SITE}/shop" style="color:${GREEN};text-decoration:none">Shop</a> &nbsp;·&nbsp;
              <a href="${SITE}/orders/track" style="color:${GREEN};text-decoration:none">Track an order</a> &nbsp;·&nbsp;
              <a href="${SITE}/faq" style="color:${GREEN};text-decoration:none">Help</a> &nbsp;·&nbsp;
              <a href="${SITE}/policies/refund" style="color:${GREEN};text-decoration:none">Refunds</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function send(orderId: string, kind: Kind): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order) return;

    if (isEmailConfigured() && order.userEmail) {
      // The tax invoice (and the receipt, once paid) rides with every order
      // email, so the customer always has the current document to hand rather
      // than having to sign in and fetch it.
      // Generating it must never cost them the notification, so a failure here
      // is logged and the email still goes out without the attachment.
      // Only the billing emails carry documents — a shipping notice does not
      // need the invoice re-attached.
      let attachments: { name: string; content: string }[] | undefined;
      if (kind === "placed" || kind === "confirmed") {
        try {
          attachments = await billingAttachments(order);
        } catch (err) {
          console.error(`[order-emails] billing PDFs for ${order.orderNumber} failed:`, err);
        }
      }

      await sendEmail({
        to: order.userEmail,
        subject: COPY[kind].subject(order.orderNumber),
        html: orderEmailHtml(order, kind),
        attachments,
      });
    }

    // SMS + WhatsApp share the single source-of-truth templates. Both no-op until
    // MSG91 / WhatsApp is configured, so this is safe to call unconditionally.
    if (order.userPhone) {
      const type: NotifyType = kind === "placed" ? "orderPlaced" : "orderStatus";
      const vars = {
        orderNumber: order.orderNumber,
        status: kind,
        total: rupees(order.totalPaise),
        itemsSummary: order.items.map((it) => `${it.title} x${it.qty}`).join(", "),
        trackUrl: `${SITE}/orders/${order.id}`,
      };
      await Promise.allSettled([
        sendSms({ to: order.userPhone, body: render(type, "sms", vars).body }),
        sendWhatsApp({ to: order.userPhone, body: render(type, "whatsapp", vars).body }),
      ]);
    }
  } catch (err) {
    // Best-effort: a failed notification must never break the order or status
    // flow. But it must not vanish either — this was silent for weeks while
    // Brevo rejections and torn-down instances went unnoticed.
    console.error(`[order-emails] ${kind} notification for ${orderId} failed:`, err);
  }
}

/**
 * Sent at checkout, with the tax invoice attached.
 *
 * The operators are told at the same moment. Until now a placed order produced
 * exactly one notification — the customer's — and nobody on the Nutri Greenz
 * side heard anything until somebody happened to open the console.
 *
 * `allSettled`, so a failure to reach the operators cannot cost the customer
 * their confirmation, and vice versa.
 */
export async function sendOrderPlacedEmail(orderId: string): Promise<void> {
  await Promise.allSettled([send(orderId, "placed"), sendAdminOrderAlert(orderId)]);
}

/** Sent when an operator accepts the order — a distinct step from placing it. */
export function sendOrderConfirmedEmail(orderId: string): Promise<void> {
  return send(orderId, "confirmed");
}
export function sendOrderPackedEmail(orderId: string): Promise<void> {
  return send(orderId, "packed");
}

export function sendOrderShippedEmail(orderId: string): Promise<void> {
  return send(orderId, "shipped");
}
export function sendOrderDeliveredEmail(orderId: string): Promise<void> {
  return send(orderId, "delivered");
}
