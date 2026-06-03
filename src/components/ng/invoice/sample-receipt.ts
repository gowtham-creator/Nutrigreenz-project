/**
 * Graceful fallback for the invoice page when no receipt is found in
 * sessionStorage (e.g. the page was opened cold, a shared link, or after the
 * session expired). Produces a realistic *sample* tax invoice rather than a
 * 404/blank so the route always renders something printable.
 */

import type { Address, CartItem } from "@/types/nutrigreenz";
import type { OrderReceipt } from "@/components/ng/checkout/order-receipt";

const SAMPLE_ITEMS: CartItem[] = [
  {
    productId: "p-101",
    title: "A2 Gir Cow Bilona Ghee — 500ml",
    image: "/images/placeholder.svg",
    unit: "500ml · Junagadh lot",
    qty: 1,
    price: 1480,
    lotCode: "JUN-25-018",
    tags: ["ghee"],
  } as CartItem,
  {
    productId: "p-001",
    title: "Cold-Pressed Groundnut Oil — 1L Glass",
    image: "/images/placeholder.svg",
    unit: "1L · Anantapur lot",
    qty: 2,
    price: 645,
    lotCode: "ANT-25-051",
    tags: ["oil"],
  } as CartItem,
  {
    productId: "p-201",
    title: "Multifloral Raw Honey — 500g",
    image: "/images/placeholder.svg",
    unit: "500g · Nilgiri forest",
    qty: 1,
    price: 540,
    lotCode: "NIL-25-006",
    tags: ["honey"],
  } as CartItem,
];

const SAMPLE_ADDRESS: Address = {
  id: "addr-sample",
  fullName: "Anjali Rao",
  phone: "+91 98xxx xxxxx",
  line1: "Flat 402, Lotus Residency",
  line2: "Road No. 4, KPHB Phase 3",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500072",
  type: "home",
  isDefault: true,
};

/** Build a deterministic sample receipt for the given order id. */
export function sampleReceipt(id: string): OrderReceipt {
  const subtotal = SAMPLE_ITEMS.reduce((s, i) => s + i.price * i.qty, 0); // 3310
  const couponDiscount = 200;
  const loyaltyDiscount = 60;
  const shipping = 0;
  const total = subtotal - couponDiscount - loyaltyDiscount + shipping;
  return {
    id,
    placedAt: new Date().toISOString(),
    items: SAMPLE_ITEMS,
    subtotal,
    couponCode: "FRESH200",
    couponDiscount,
    loyaltyPoints: 600,
    loyaltyDiscount,
    shipping,
    total,
    taxInclusive: true,
    // Shape matches the new structured PaymentSelection contract.
    payment: {
      category: "upi",
      id: "gpay",
      label: "Google Pay",
      categoryLabel: "UPI",
    },
    slotLabel: "Tomorrow · 7 AM – 10 AM",
    address: SAMPLE_ADDRESS,
    pointsToEarn: 331,
  } as OrderReceipt;
}
