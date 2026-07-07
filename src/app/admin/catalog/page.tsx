import { redirect } from "next/navigation";

/**
 * The former mock "Catalog" surface shadowed the real, functional inventory
 * admin. It has been retired: Catalog now maps onto /admin/inventory (the one
 * source of truth for products, pricing, stock and variants). This route
 * permanently forwards any old links or bookmarks to that surface.
 */
export default function AdminCatalogPage() {
  redirect("/admin/inventory");
}
