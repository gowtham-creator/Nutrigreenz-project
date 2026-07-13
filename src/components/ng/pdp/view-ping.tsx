"use client";

import { useEffect, useRef } from "react";

/**
 * Fire-and-forget PDP view ping. Records one `product_views` row (via
 * `POST /api/products/view`) when the product page mounts, feeding the admin
 * analytics "views" signal. Best-effort and non-blocking: it renders nothing,
 * fires at most once per mount, and swallows every failure so a telemetry
 * hiccup can never affect the storefront.
 */
export function ViewPing({ productId }: { productId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (!productId || sent.current) return;
    sent.current = true;
    void fetch("/api/products/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId }),
      keepalive: true,
    }).catch(() => {
      // ignore — view pings are best-effort
    });
  }, [productId]);
  return null;
}

export default ViewPing;
