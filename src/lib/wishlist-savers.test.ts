/** Who saved what: grouped by customer, with contact details, newest first. */
import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type Responder } from "@/test/fake-supabase";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ isSupabaseConfigured: true, supabaseAdmin: () => h.db }));
vi.mock("@/lib/storefront-catalog", () => ({
  getStorefrontCatalog: async () => ({
    products: [{ slug: "groundnut-oil", title: "Groundnut Oil", image: "/g.webp", href: "/products/groundnut-oil", price: 270 }],
  }),
}));

import { listWishlistSavers } from "./wishlist-store";

describe("listWishlistSavers", () => {
  it("groups saves by customer with their contact details, most recent first", async () => {
    const respond: Responder = (op) => {
      if (op.table === "wishlists")
        return {
          data: [
            { customer_id: "c2", product_slug: "groundnut-oil", created_at: "2026-11-04T10:00:00Z" },
            { customer_id: "c1", product_slug: "groundnut-oil", created_at: "2026-11-03T10:00:00Z" },
            { customer_id: "c1", product_slug: "old-honey", created_at: "2026-11-01T10:00:00Z" },
          ],
        };
      if (op.table === "customers")
        return {
          data: [
            { id: "c1", display_name: "Asha", primary_email: "asha@x.in", primary_phone: "+919800000001" },
            { id: "c2", display_name: null, primary_email: "ravi@x.in", primary_phone: null },
          ],
        };
      return { data: [] };
    };
    h.db = createFakeSupabase(respond).client;

    const savers = await listWishlistSavers();
    expect(savers.map((s) => s.customerId)).toEqual(["c2", "c1"]);
    expect(savers[1]).toMatchObject({ name: "Asha", phone: "+919800000001", email: "asha@x.in" });
    expect(savers[1].items.map((i) => i.title)).toEqual(["Groundnut Oil", "old-honey"]);
    expect(savers[1].items[0].pricePaise).toBe(27000);
  });
});
