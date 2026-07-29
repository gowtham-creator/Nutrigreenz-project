import "server-only";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getOrder, type OrderWithDetail } from "@/lib/orders";
import { render, type NotifyType } from "@/lib/notification-templates";
import { sendSms } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/whatsapp";
import { invoicePdfBase64 } from "@/lib/invoice-pdf";

/**
 * Transactional ORDER emails via Brevo (reuses src/lib/email.ts). BEST-EFFORT:
 * every send is wrapped so a failure NEVER touches the order/checkout flow, and
 * it no-ops cleanly when Brevo is unconfigured or the order has no email on file.
 *
 * The HTML in `orderEmailHtml` is an on-brand DEFAULT — swap it for the client's
 * approved templates when they arrive; the trigger wiring below stays the same.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://nutrigreenz.farm";
const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

type Kind = "placed" | "confirmed" | "packed" | "shipped" | "delivered";

const COPY: Record<Kind, { subject: (n: string) => string; heading: string; intro: string }> = {
  // Sent the moment the customer completes checkout — the order exists, but the
  // team has not accepted it yet. Previously this said "confirmed", which then
  // repeated verbatim when an operator moved the order to the confirmed status.
  placed: {
    subject: (n) => `Order ${n} received · Nutri Greenz`,
    heading: "Order received 🌿",
    intro:
      "Thank you — we've got your order and our team is reviewing it. Your tax invoice is attached. We'll email you again the moment it's confirmed.",
  },
  confirmed: {
    subject: (n) => `Order ${n} confirmed · Nutri Greenz`,
    heading: "Order confirmed 🌿",
    intro: "Good news — your order is confirmed and we're preparing it for your delivery slot.",
  },
  packed: {
    subject: (n) => `Order ${n} is packed · Nutri Greenz`,
    heading: "Packed and ready 📦",
    intro: "Your order is packed and waiting for its delivery slot. Here's your summary:",
  },
  shipped: {
    subject: (n) => `Order ${n} is on its way 🚚 · Nutri Greenz`,
    heading: "Your order shipped 🚚",
    intro: "Good news — your order is on its way. We'll confirm once it reaches you.",
  },
  delivered: {
    subject: (n) => `Order ${n} delivered 🎉 · Nutri Greenz`,
    heading: "Delivered 🎉",
    intro: "Your order has reached you — we hope you love it. Reply here if anything isn't perfect.",
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
function orderEmailHtml(order: OrderWithDetail, kind: Kind): string {
  const c = COPY[kind];
  const GREEN = "#14331F";
  const CREAM = "#F5F2E0";
  const PAPER = "#FFFFFF";
  const LINE = "#E3DFD0";
  const MUTED = "#6B7A70";

  const itemRows = order.items
    .map(
      (it) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:14px;color:#1A2B22;line-height:1.4">
            ${escapeHtml(it.title)}
            <div style="font-size:12px;color:${MUTED};margin-top:2px">Qty ${it.qty}</div>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:14px;color:#1A2B22;text-align:right;white-space:nowrap;vertical-align:top">
            ${rupees(it.lineTotalPaise)}
          </td>
        </tr>`,
    )
    .join("");

  /** One line of the money breakdown; omitted entirely when zero. */
  const money = (label: string, paise: number, opts?: { negative?: boolean }) =>
    paise > 0
      ? `<tr>
           <td style="padding:4px 0;font-size:13px;color:${MUTED}">${label}</td>
           <td style="padding:4px 0;font-size:13px;color:${opts?.negative ? "#2F6B3A" : "#1A2B22"};text-align:right;white-space:nowrap">${opts?.negative ? "−" : ""}${rupees(paise)}</td>
         </tr>`
      : "";

  const address = addressLines(order);
  const slot = order.slotSnapshot as Record<string, unknown> | null;
  const slotLabel = [snap(slot, "label"), snap(slot, "windowText")].filter(Boolean).join(" · ");

  const detailBlock = (title: string, body: string) => `
    <td style="vertical-align:top;padding:0 8px 0 0;width:50%">
      <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};margin-bottom:6px">${title}</div>
      <div style="font-size:13px;color:#1A2B22;line-height:1.55">${body}</div>
    </td>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(c.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};-webkit-font-smoothing:antialiased">
  <!-- Preheader: the grey preview line in the inbox, hidden in the body. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(c.intro)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${PAPER};border:1px solid ${LINE};border-radius:16px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">

        <!-- Masthead -->
        <tr>
          <td style="background:${GREEN};padding:22px 28px" align="left">
            <img src="${SITE}/brand/logo-horizontal-light.png" alt="Nutri Greenz" width="150"
                 style="display:block;border:0;height:auto;width:150px;max-width:150px" />
          </td>
        </tr>

        <!-- Headline -->
        <tr>
          <td style="padding:30px 28px 0">
            <h1 style="margin:0;font-size:24px;line-height:1.25;color:${GREEN};font-weight:700">${c.heading}</h1>
            <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#3A4A40">${c.intro}</p>
            <p style="margin:14px 0 0;font-size:13px;color:${MUTED}">
              Order <strong style="color:${GREEN};font-size:14px">${escapeHtml(order.orderNumber)}</strong>
            </p>
          </td>
        </tr>

        <!-- Items + money -->
        <tr>
          <td style="padding:22px 28px 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;background:#FBFAF5;border:1px solid ${LINE};border-radius:12px">
              <tr><td style="padding:6px 18px 0">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                  ${itemRows}
                  ${money("Subtotal", order.subtotalPaise)}
                  ${money("Discount", order.discountPaise, { negative: true })}
                  ${money("Loyalty credit", order.loyaltyRedeemedPaise, { negative: true })}
                  ${money("Delivery", order.shippingPaise)}
                  ${money("Tax", order.taxPaise)}
                  <tr>
                    <td style="padding:12px 0 14px;border-top:2px solid ${GREEN};font-size:15px;font-weight:700;color:${GREEN}">Total</td>
                    <td style="padding:12px 0 14px;border-top:2px solid ${GREEN};font-size:17px;font-weight:700;color:${GREEN};text-align:right;white-space:nowrap">${rupees(order.totalPaise)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        ${
          address.length || slotLabel
            ? `<!-- Delivery details -->
        <tr>
          <td style="padding:22px 28px 0">
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

        <!-- CTA -->
        <tr>
          <td style="padding:26px 28px 4px" align="left">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="background:${GREEN};border-radius:999px">
                <a href="${SITE}/orders/${order.id}"
                   style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none">
                  Track your order
                </a>
              </td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 28px 26px">
            <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED}">
              Questions about this order? Reply to this email or write to
              <a href="mailto:customersupport@nutrigreenz.farm" style="color:${GREEN};text-decoration:underline">customersupport@nutrigreenz.farm</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#FBFAF5;border-top:1px solid ${LINE};padding:22px 28px">
            <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${MUTED}">
              <strong style="color:${GREEN}">Nutri Greenz Farm Technologies Pvt. Ltd.</strong><br />
              1st Floor, H.No. 5-35/167, Double Road, Near Moosapet Y Junction,<br />
              Prashanth Nagar, Kukatpally, Hyderabad, Telangana 500072<br />
              +91 94918 93370
            </p>
            <p style="margin:0;font-size:12px;color:${MUTED}">
              <a href="${SITE}/shop" style="color:${GREEN};text-decoration:none">Shop</a> &nbsp;·&nbsp;
              <a href="${SITE}/orders/track" style="color:${GREEN};text-decoration:none">Track an order</a> &nbsp;·&nbsp;
              <a href="${SITE}/faq" style="color:${GREEN};text-decoration:none">Help</a> &nbsp;·&nbsp;
              <a href="${SITE}/policies/refund" style="color:${GREEN};text-decoration:none">Refunds</a>
            </p>
            <p style="margin:12px 0 0;font-size:11px;color:#9AA89F">
              Farm-fresh, fully traceable, from our partner farms to your kitchen.
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
      // The tax invoice rides with the first email, so the customer has it the
      // moment they order rather than having to open the site to print one.
      // Generating it must never cost them the notification, so a failure here
      // is logged and the email still goes out without the attachment.
      let attachments: { name: string; content: string }[] | undefined;
      if (kind === "placed") {
        try {
          attachments = [
            {
              name: `Invoice-${order.orderNumber}.pdf`,
              content: await invoicePdfBase64(order),
            },
          ];
        } catch (err) {
          console.error(`[order-emails] invoice PDF for ${order.orderNumber} failed:`, err);
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

/** Sent at checkout, with the tax invoice attached. */
export function sendOrderPlacedEmail(orderId: string): Promise<void> {
  return send(orderId, "placed");
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
