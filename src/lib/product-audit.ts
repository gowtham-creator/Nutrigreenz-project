/**
 * Product audit log: every change to every product, field by field.
 *
 * Each admin action on the catalog (adding, editing, re-pricing, restocking,
 * archiving or deleting a product, and the same for its variants, by hand or by
 * CSV import) writes one row saying who did it, when, and each field's old and
 * new value. The product's name is copied onto the row, so a deleted product
 * keeps its history.
 *
 * Writing is best-effort and never throws: a logging hiccup must not fail the
 * save the admin just made. Reads return [] when the table is missing.
 */
import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";
import type { ProductRecord, ProductVariantRecord } from "@/lib/catalog";

export type ProductAuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "stock"
  | "variant_created"
  | "variant_updated"
  | "variant_deleted"
  | "variant_stock";

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ProductAuditEntry {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantLabel: string | null;
  action: ProductAuditAction;
  changes: FieldChange[];
  actorEmail: string | null;
  actorRole: string | null;
  source: "admin" | "import";
  createdAt: string;
}

export interface AuditActor {
  email: string | null;
  role: string | null;
}

/** The product fields worth recording, in the order a person reads them. */
export const PRODUCT_FIELDS = [
  "name",
  "status",
  "pricePaise",
  "stock",
  "reserved",
  "categoryName",
  "sku",
  "slug",
  "description",
  "imageUrl",
  "gallery",
] as const;

export const VARIANT_FIELDS = [
  "label",
  "isActive",
  "pricePaise",
  "stock",
  "reserved",
  "pack",
  "sizeValue",
  "sizeUnit",
  "sku",
  "sort",
  "imageUrl",
] as const;

/** Long text is clipped so a description edit can't bloat the log. */
const CLIP = 400;

function normal(v: unknown): unknown {
  if (v === undefined || v === "") return null;
  if (typeof v === "string") return v.length > CLIP ? `${v.slice(0, CLIP)}…` : v;
  if (Array.isArray(v)) return v.map(normal);
  return v;
}

/**
 * The fields that differ between two versions of a record. Pure. A missing
 * `before` means the record was created, so every set field is listed; a
 * missing `after` means it was deleted.
 */
export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  fields: readonly string[],
): FieldChange[] {
  const out: FieldChange[] = [];
  for (const field of fields) {
    const from = normal(before?.[field]);
    const to = normal(after?.[field]);
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    // A new record lists only the fields that were filled in.
    if (!before && to === null) continue;
    if (!after && from === null) continue;
    out.push({ field, from, to });
  }
  return out;
}

interface RecordInput {
  action: ProductAuditAction;
  product: Pick<ProductRecord, "id" | "name">;
  variant?: Pick<ProductVariantRecord, "id" | "label"> | null;
  changes: FieldChange[];
  actor: AuditActor;
  source?: "admin" | "import";
}

/** Write audit rows. Edits that changed nothing are skipped. Never throws. */
export async function recordProductAudit(inputs: RecordInput | RecordInput[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  const rows = (Array.isArray(inputs) ? inputs : [inputs])
    .filter((i) => i.changes.length > 0 || i.action === "deleted" || i.action === "variant_deleted")
    .map((i) => ({
      product_id: i.product.id,
      product_name: i.product.name,
      variant_id: i.variant?.id ?? null,
      variant_label: i.variant?.label ?? null,
      action: i.action,
      changes: i.changes,
      actor_email: i.actor.email,
      actor_role: i.actor.role,
      source: i.source ?? "admin",
    }));
  if (rows.length === 0) return;
  try {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabaseAdmin().from("product_audit").insert(rows.slice(i, i + 200));
      if (error) console.error(`[product-audit] write failed: ${error.message}`);
    }
  } catch (err) {
    console.error("[product-audit] write failed:", err);
  }
}

/** One product change, from the product's before and after. */
export function productChange(
  before: ProductRecord | null,
  after: ProductRecord | null,
  actor: AuditActor,
  source: "admin" | "import" = "admin",
): RecordInput | null {
  const product = after ?? before;
  if (!product) return null;
  const changes = diffFields(
    before as unknown as Record<string, unknown> | null,
    after as unknown as Record<string, unknown> | null,
    PRODUCT_FIELDS,
  );
  const onlyStock = changes.length > 0 && changes.every((c) => c.field === "stock" || c.field === "reserved");
  const action: ProductAuditAction = !before ? "created" : !after ? "deleted" : onlyStock ? "stock" : "updated";
  return { action, product, changes, actor, source };
}

/** One variant change, from the variant's before and after. */
export function variantChange(
  product: Pick<ProductRecord, "id" | "name">,
  before: ProductVariantRecord | null,
  after: ProductVariantRecord | null,
  actor: AuditActor,
  source: "admin" | "import" = "admin",
): RecordInput | null {
  const variant = after ?? before;
  if (!variant) return null;
  const changes = diffFields(
    before as unknown as Record<string, unknown> | null,
    after as unknown as Record<string, unknown> | null,
    VARIANT_FIELDS,
  );
  const onlyStock = changes.length > 0 && changes.every((c) => c.field === "stock" || c.field === "reserved");
  const action: ProductAuditAction = !before
    ? "variant_created"
    : !after
      ? "variant_deleted"
      : onlyStock
        ? "variant_stock"
        : "variant_updated";
  return { action, product, variant, changes, actor, source };
}

/**
 * Compare two whole-catalog snapshots, for CSV imports: every product (or
 * variant) the import added or changed becomes its own audit row.
 */
export function snapshotChanges<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[],
  toChange: (b: T | null, a: T) => RecordInput | null,
): RecordInput[] {
  const was = new Map(before.map((r) => [r.id, r]));
  const out: RecordInput[] = [];
  for (const a of after) {
    const change = toChange(was.get(a.id) ?? null, a);
    if (change && change.changes.length > 0) out.push(change);
  }
  return out;
}

export type AuditKind = "all" | "price" | "stock" | "details" | "variants" | "added-removed";

export interface AuditQuery {
  productId?: string | null;
  sinceIso?: string | null;
  /** Only rows older than this, to page back through history. */
  beforeIso?: string | null;
  kind?: AuditKind;
  limit?: number;
}

const COLS =
  "id, product_id, product_name, variant_id, variant_label, action, changes, actor_email, actor_role, source, created_at";

interface AuditRow {
  id: string;
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_label: string | null;
  action: ProductAuditAction;
  changes: FieldChange[] | null;
  actor_email: string | null;
  actor_role: string | null;
  source: "admin" | "import";
  created_at: string;
}

function toEntry(r: AuditRow): ProductAuditEntry {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    variantId: r.variant_id,
    variantLabel: r.variant_label,
    action: r.action,
    changes: Array.isArray(r.changes) ? r.changes : [],
    actorEmail: r.actor_email,
    actorRole: r.actor_role,
    source: r.source,
    createdAt: r.created_at,
  };
}

/** Does this entry belong under a filter? Pure, so the screen and tests agree. */
export function matchesKind(e: Pick<ProductAuditEntry, "action" | "changes">, kind: AuditKind): boolean {
  const fields = e.changes.map((c) => c.field);
  switch (kind) {
    case "price":
      return fields.includes("pricePaise");
    case "stock":
      return fields.includes("stock") || fields.includes("reserved");
    case "variants":
      return e.action.startsWith("variant_");
    case "added-removed":
      return ["created", "deleted", "variant_created", "variant_deleted"].includes(e.action);
    case "details":
      return e.action === "updated" && fields.some((f) => f !== "pricePaise" && f !== "stock" && f !== "reserved");
    default:
      return true;
  }
}

const MISSING_TABLE = /does not exist|42P01|schema cache|Could not find the table/i;

/** Newest first. Throws "setup-pending" when the table hasn't been created. */
export async function listProductAudit(q: AuditQuery = {}): Promise<ProductAuditEntry[]> {
  if (!isSupabaseConfigured) return [];
  const limit = Math.min(Math.max(1, q.limit ?? 100), 500);
  const kind = q.kind ?? "all";
  // Kind filters are applied after reading, so read more to fill the page.
  const read = kind === "all" ? limit : Math.min(limit * 4, 1000);
  let query = supabaseAdmin().from("product_audit").select(COLS);
  if (q.productId) query = query.eq("product_id", q.productId);
  if (q.sinceIso) query = query.gte("created_at", q.sinceIso);
  if (q.beforeIso) query = query.lt("created_at", q.beforeIso);
  if (kind === "variants") query = query.like("action", "variant_%");
  if (kind === "added-removed") query = query.in("action", ["created", "deleted", "variant_created", "variant_deleted"]);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(read);
  if (error) {
    if (MISSING_TABLE.test(error.message)) throw new Error("setup-pending");
    throw new Error(error.message);
  }
  return ((data as AuditRow[] | null) ?? [])
    .map(toEntry)
    .filter((e) => matchesKind(e, kind))
    .slice(0, limit);
}
