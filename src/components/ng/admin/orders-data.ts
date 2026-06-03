/**
 * Shared admin Orders dataset — the single source of truth for the Orders
 * Portal: the orders list, the order-detail view, and the community-bundle
 * view all read from here. Hyderabad-focused with gated-community addresses so
 * the §3.11 community-bundle grouping (community + delivery date) is meaningful.
 */

export type OrderTone = "neutral" | "success" | "warn" | "danger" | "info";

export type OrderStatus =
  | "Awaiting payment"
  | "Paid"
  | "Packed"
  | "Shipped"
  | "Out for delivery"
  | "Delivered"
  | "Refund req."
  | "Payment failed";

export type OrderChannel = "Web" | "App" | "Captain bundle" | "Community bundle";

export interface AdminOrderItem {
  sku: string;
  title: string;
  unit: string;
  qty: number;
  price: number;
  lot: string;
}

export interface AdminOrderEvent {
  label: string;
  at: string;
  done: boolean;
}

export interface AdminOrder {
  id: string;
  placedAgo: string;
  placedAt: string;
  customer: { name: string; phone: string; email: string };
  address: { line1: string; community: string; area: string; pincode: string; city: string };
  items: AdminOrderItem[];
  total: number;
  status: OrderStatus;
  payment: { method: string; state: string };
  channel: OrderChannel;
  slot: string;
  /** ISO date (yyyy-mm-dd) used for community-bundle grouping. */
  deliveryDate: string;
  timeline: AdminOrderEvent[];
}

/** Status → Pill tone (matches @/components/ng/admin/admin-shell Pill tones). */
export const STATUS_TONE: Record<OrderStatus, OrderTone> = {
  "Awaiting payment": "warn",
  Paid: "success",
  Packed: "info",
  Shipped: "success",
  "Out for delivery": "info",
  Delivered: "success",
  "Refund req.": "warn",
  "Payment failed": "danger",
};

/** Operator status pipeline (left→right); refund/failed are off-pipeline states. */
export const STATUS_FLOW: OrderStatus[] = [
  "Awaiting payment",
  "Paid",
  "Packed",
  "Out for delivery",
  "Delivered",
];

const ev = (label: string, at: string, done: boolean): AdminOrderEvent => ({ label, at, done });

export const ADMIN_ORDERS: AdminOrder[] = [
  {
    id: "NG-25-1058",
    placedAgo: "12 min ago",
    placedAt: "3 Jun 2026, 11:48",
    customer: { name: "Anjali Verma", phone: "+91 98480 11058", email: "anjali.verma@gmail.com" },
    address: { line1: "Flat 1204, Tower 3", community: "Aparna Sarovar Zenith", area: "Nallagandla", pincode: "500019", city: "Hyderabad" },
    items: [
      { sku: "OIL-GN-1L", title: "Cold-Pressed Groundnut Oil", unit: "1 L glass", qty: 2, price: 645, lot: "ANT-24-049" },
      { sku: "GHE-A2-500", title: "A2 Gir Cow Bilona Ghee", unit: "500 ml", qty: 1, price: 552, lot: "ANT-24-051" },
    ],
    total: 1842,
    status: "Packed",
    payment: { method: "UPI · Google Pay", state: "Paid" },
    channel: "Community bundle",
    slot: "Morning · 7–10 AM",
    deliveryDate: "2026-06-04",
    timeline: [ev("Order placed", "11:48 AM", true), ev("Payment confirmed", "11:49 AM", true), ev("Packed", "12:02 PM", true), ev("Out for delivery", "—", false), ev("Delivered", "—", false)],
  },
  {
    id: "NG-25-1057",
    placedAgo: "24 min ago",
    placedAt: "3 Jun 2026, 11:36",
    customer: { name: "Rahul Menon", phone: "+91 99012 21057", email: "rahul.menon@gmail.com" },
    address: { line1: "Villa 22", community: "Aparna Sarovar Zenith", area: "Nallagandla", pincode: "500019", city: "Hyderabad" },
    items: [
      { sku: "HON-ML-500", title: "Multifloral Raw Honey", unit: "500 g", qty: 1, price: 540, lot: "ANT-24-049" },
      { sku: "MIL-FX-500", title: "Foxtail Millet", unit: "500 g", qty: 2, price: 190, lot: "ANT-24-049" },
    ],
    total: 920,
    status: "Paid",
    payment: { method: "Card · HDFC", state: "Paid" },
    channel: "Web",
    slot: "Morning · 7–10 AM",
    deliveryDate: "2026-06-04",
    timeline: [ev("Order placed", "11:36 AM", true), ev("Payment confirmed", "11:37 AM", true), ev("Packed", "—", false), ev("Out for delivery", "—", false), ev("Delivered", "—", false)],
  },
  {
    id: "NG-25-1056",
    placedAgo: "1 hr ago",
    placedAt: "3 Jun 2026, 10:55",
    customer: { name: "Priya Kapoor", phone: "+91 90087 31056", email: "priya.k@gmail.com" },
    address: { line1: "Flat 802, Block B", community: "My Home Avatar", area: "Narsingi", pincode: "500089", city: "Hyderabad" },
    items: [
      { sku: "OIL-CO-500", title: "Cold-Pressed Coconut Oil", unit: "500 ml", qty: 1, price: 425, lot: "ANT-24-051" },
      { sku: "GHE-A2-1L", title: "A2 Desi Cow Ghee", unit: "1 L jar", qty: 1, price: 1480, lot: "ANT-24-038" },
      { sku: "SPC-TUR-200", title: "Stone-Ground Turmeric", unit: "200 g", qty: 3, price: 185, lot: "ANT-24-044" },
    ],
    total: 3460,
    status: "Shipped",
    payment: { method: "Wallet + UPI", state: "Paid" },
    channel: "Community bundle",
    slot: "Evening · 5–8 PM",
    deliveryDate: "2026-06-04",
    timeline: [ev("Order placed", "10:55 AM", true), ev("Payment confirmed", "10:56 AM", true), ev("Packed", "11:30 AM", true), ev("Out for delivery", "12:40 PM", true), ev("Delivered", "—", false)],
  },
  {
    id: "NG-25-1055",
    placedAgo: "2 hr ago",
    placedAt: "3 Jun 2026, 09:58",
    customer: { name: "Vikram Teja", phone: "+91 98661 41055", email: "vikram.teja@gmail.com" },
    address: { line1: "Flat 309", community: "Manjeera Trinity", area: "Kukatpally", pincode: "500072", city: "Hyderabad" },
    items: [{ sku: "OIL-SF-1L", title: "Wood-Pressed Sunflower Oil", unit: "1 L", qty: 1, price: 540, lot: "—" }],
    total: 540,
    status: "Payment failed",
    payment: { method: "Card · Axis", state: "Declined — 3D-Secure timeout" },
    channel: "Web",
    slot: "Morning · 7–10 AM",
    deliveryDate: "2026-06-05",
    timeline: [ev("Order placed", "09:58 AM", true), ev("Payment failed", "09:59 AM", true), ev("Packed", "—", false), ev("Out for delivery", "—", false), ev("Delivered", "—", false)],
  },
  {
    id: "NG-25-1054",
    placedAgo: "3 hr ago",
    placedAt: "3 Jun 2026, 08:40",
    customer: { name: "Meera Shankar", phone: "+91 90030 51054", email: "meera.s@gmail.com" },
    address: { line1: "Flat 1502, Tower 5", community: "Lodha Bellezza", area: "Kukatpally", pincode: "500072", city: "Hyderabad" },
    items: [
      { sku: "PUL-TUR-1K", title: "Toor Dal (heritage)", unit: "1 kg", qty: 2, price: 210, lot: "ANT-24-049" },
      { sku: "FLR-WHT-5K", title: "Stone-Ground Whole Wheat Atta", unit: "5 kg", qty: 1, price: 420, lot: "ANT-24-049" },
    ],
    total: 1240,
    status: "Packed",
    payment: { method: "UPI · PhonePe", state: "Paid" },
    channel: "Captain bundle",
    slot: "Evening · 5–8 PM",
    deliveryDate: "2026-06-05",
    timeline: [ev("Order placed", "08:40 AM", true), ev("Payment confirmed", "08:41 AM", true), ev("Packed", "09:10 AM", true), ev("Out for delivery", "—", false), ev("Delivered", "—", false)],
  },
  {
    id: "NG-25-1053",
    placedAgo: "5 hr ago",
    placedAt: "3 Jun 2026, 06:50",
    customer: { name: "Karthik Rao", phone: "+91 99490 61053", email: "karthik.rao@gmail.com" },
    address: { line1: "Villa 8", community: "Lodha Bellezza", area: "Kukatpally", pincode: "500072", city: "Hyderabad" },
    items: [
      { sku: "GHE-A2-500", title: "A2 Gir Cow Bilona Ghee", unit: "500 ml", qty: 1, price: 552, lot: "ANT-24-038" },
      { sku: "SF-MOR-200", title: "Moringa Superfood Powder", unit: "200 g", qty: 2, price: 320, lot: "ANT-24-051" },
    ],
    total: 2180,
    status: "Delivered",
    payment: { method: "Subscription · auto", state: "Paid" },
    channel: "App",
    slot: "Morning · 7–10 AM",
    deliveryDate: "2026-06-03",
    timeline: [ev("Order placed", "06:50 AM", true), ev("Payment confirmed", "06:50 AM", true), ev("Packed", "07:20 AM", true), ev("Out for delivery", "08:05 AM", true), ev("Delivered", "09:42 AM", true)],
  },
  {
    id: "NG-25-1052",
    placedAgo: "Yesterday",
    placedAt: "2 Jun 2026, 18:20",
    customer: { name: "Sneha Bhat", phone: "+91 90142 71052", email: "sneha.bhat@gmail.com" },
    address: { line1: "Flat 410, Tower 1", community: "Aparna Sarovar Zenith", area: "Nallagandla", pincode: "500019", city: "Hyderabad" },
    items: [{ sku: "HON-ML-500", title: "Multifloral Raw Honey", unit: "500 g", qty: 1, price: 540, lot: "ANT-24-049" }],
    total: 780,
    status: "Refund req.",
    payment: { method: "UPI · Paytm", state: "Refund requested ₹780" },
    channel: "Web",
    slot: "Morning · 7–10 AM",
    deliveryDate: "2026-06-04",
    timeline: [ev("Order placed", "06:20 PM", true), ev("Payment confirmed", "06:21 PM", true), ev("Delivered", "Jun 3, 8:30 AM", true), ev("Refund requested", "10:15 AM", true), ev("Refund resolved", "—", false)],
  },
  {
    id: "NG-25-1051",
    placedAgo: "Yesterday",
    placedAt: "2 Jun 2026, 17:05",
    customer: { name: "Arjun Dev", phone: "+91 98851 81051", email: "arjun.dev@gmail.com" },
    address: { line1: "Flat 1101, Block C", community: "My Home Avatar", area: "Narsingi", pincode: "500089", city: "Hyderabad" },
    items: [
      { sku: "OIL-GN-1L", title: "Cold-Pressed Groundnut Oil", unit: "1 L glass", qty: 2, price: 645, lot: "ANT-24-044" },
      { sku: "GHE-A2-1L", title: "A2 Desi Cow Ghee", unit: "1 L jar", qty: 1, price: 1480, lot: "ANT-24-051" },
      { sku: "MIL-MX-1K", title: "Mixed Millet Pack", unit: "1 kg", qty: 3, price: 483, lot: "ANT-24-038" },
    ],
    total: 4220,
    status: "Delivered",
    payment: { method: "Card · ICICI", state: "Paid" },
    channel: "Community bundle",
    slot: "Evening · 5–8 PM",
    deliveryDate: "2026-06-04",
    timeline: [ev("Order placed", "05:05 PM", true), ev("Payment confirmed", "05:06 PM", true), ev("Packed", "05:40 PM", true), ev("Out for delivery", "Jun 4, 5:10 PM", true), ev("Delivered", "Jun 4, 6:28 PM", true)],
  },
  {
    id: "NG-25-1050",
    placedAgo: "Yesterday",
    placedAt: "2 Jun 2026, 14:12",
    customer: { name: "Fatima Sheikh", phone: "+91 90325 91050", email: "fatima.sheikh@gmail.com" },
    address: { line1: "Flat 605, Tower 2", community: "My Home Avatar", area: "Narsingi", pincode: "500089", city: "Hyderabad" },
    items: [{ sku: "SF-ASH-200", title: "Ashwagandha Root Powder", unit: "200 g", qty: 2, price: 295, lot: "ANT-24-051" }],
    total: 590,
    status: "Awaiting payment",
    payment: { method: "UPI · pending", state: "Awaiting confirmation" },
    channel: "App",
    slot: "Evening · 5–8 PM",
    deliveryDate: "2026-06-04",
    timeline: [ev("Order placed", "02:12 PM", true), ev("Payment confirmed", "—", false), ev("Packed", "—", false), ev("Out for delivery", "—", false), ev("Delivered", "—", false)],
  },
  {
    id: "NG-25-1049",
    placedAgo: "Yesterday",
    placedAt: "2 Jun 2026, 10:30",
    customer: { name: "Ananya Rao", phone: "+91 98765 43210", email: "ananya.rao@gmail.com" },
    address: { line1: "Flat 402, Lake View Residency", community: "Manjeera Trinity", area: "Kukatpally", pincode: "500072", city: "Hyderabad" },
    items: [
      { sku: "OIL-GN-1L", title: "Cold-Pressed Groundnut Oil", unit: "1 L glass", qty: 1, price: 645, lot: "ANT-24-049" },
      { sku: "HON-ML-500", title: "Multifloral Raw Honey", unit: "500 g", qty: 2, price: 540, lot: "ANT-24-049" },
    ],
    total: 1725,
    status: "Out for delivery",
    payment: { method: "UPI · Google Pay", state: "Paid" },
    channel: "Web",
    slot: "Morning · 7–10 AM",
    deliveryDate: "2026-06-03",
    timeline: [ev("Order placed", "10:30 AM", true), ev("Payment confirmed", "10:31 AM", true), ev("Packed", "11:05 AM", true), ev("Out for delivery", "12:15 PM", true), ev("Delivered", "—", false)],
  },
];

export function itemCount(o: AdminOrder): number {
  return o.items.reduce((n, it) => n + it.qty, 0);
}

export function lotsInBox(o: AdminOrder): string {
  const lots = Array.from(new Set(o.items.map((i) => i.lot).filter((l) => l && l !== "—")));
  return lots.length ? lots.join(", ") : "—";
}

export function getOrder(id: string): AdminOrder | undefined {
  return ADMIN_ORDERS.find((o) => o.id === id);
}

export const INR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
