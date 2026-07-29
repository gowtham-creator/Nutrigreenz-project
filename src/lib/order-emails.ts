import "server-only";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getOrder, type OrderWithDetail } from "@/lib/orders";
import { render, type NotifyType } from "@/lib/notification-templates";
import { sendSms } from "@/lib/sms";
import { sendWhatsApp } from "@/lib/whatsapp";

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

type Kind = "confirmed" | "packed" | "shipped" | "delivered";

const COPY: Record<Kind, { subject: (n: string) => string; heading: string; intro: string }> = {
  confirmed: {
    subject: (n) => `Order ${n} confirmed · Nutri Greenz`,
    heading: "Order confirmed 🌿",
    intro: "Thank you for your order — we're getting it ready. Here's your summary:",
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

function orderEmailHtml(order: OrderWithDetail, kind: Kind): string {
  const c = COPY[kind];
  const rows = order.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:#1a2b22">${escapeHtml(it.title)} <span style="color:#5b6b60">× ${it.qty}</span></td><td style="padding:6px 0;font-size:14px;color:#1a2b22;text-align:right;white-space:nowrap">${rupees(it.lineTotalPaise)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f1e8;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1a2b22">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:19px;font-weight:700;color:#14532d">Nutri Greenz</div>
    <h1 style="font-size:22px;color:#14532d;margin:18px 0 6px">${c.heading}</h1>
    <p style="font-size:14px;line-height:1.6;color:#3a4a40;margin:0 0 4px">${c.intro}</p>
    <p style="font-size:13px;color:#5b6b60;margin:0 0 18px">Order <b style="color:#14532d">${escapeHtml(order.orderNumber)}</b></p>
    <div style="background:#fff;border:1px solid #d9d3c2;border-radius:14px;padding:16px 18px">
      <table style="width:100%;border-collapse:collapse">${rows}
        <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:10px"></td></tr>
        <tr><td style="font-size:15px;font-weight:700;color:#14532d">Total</td><td style="font-size:15px;font-weight:700;color:#14532d;text-align:right">${rupees(order.totalPaise)}</td></tr>
      </table>
    </div>
    <a href="${SITE}/orders/${order.id}" style="display:inline-block;margin-top:20px;background:#14532d;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">Track your order</a>
    <p style="font-size:12px;color:#8a978d;margin-top:22px">Farm-fresh, from our partner farms to your kitchen. 🌱</p>
  </div></body></html>`;
}

async function send(orderId: string, kind: Kind): Promise<void> {
  try {
    const order = await getOrder(orderId);
    if (!order) return;

    // Email keeps its existing on-brand template.
    if (isEmailConfigured() && order.userEmail) {
      await sendEmail({
        to: order.userEmail,
        subject: COPY[kind].subject(order.orderNumber),
        html: orderEmailHtml(order, kind),
      });
    }

    // SMS + WhatsApp share the single source-of-truth templates. Both no-op until
    // MSG91 / WhatsApp is configured, so this is safe to call unconditionally.
    if (order.userPhone) {
      const type: NotifyType = kind === "confirmed" ? "orderPlaced" : "orderStatus";
      const vars = {
        orderNumber: order.orderNumber,
        status: kind === "confirmed" ? "placed" : kind,
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
