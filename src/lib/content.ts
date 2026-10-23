/**
 * DB-backed editorial content — Supabase `public.journals` and `public.farms`.
 * Powers the storefront Journal + Farms pages (read) and the admin CRUD portal
 * (write). Service-role only — import from Server Components or Node route
 * handlers, never from client/Edge code.
 *
 * Every read falls back to the static sample arrays in `@/components/ng/data`
 * when Supabase is unconfigured, the table is empty, or a query errors, so the
 * storefront never breaks and looks identical to the pre-DB build after seeding.
 */
import "server-only";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase-admin";
import { JOURNAL as STATIC_JOURNAL, FARMS as STATIC_FARMS } from "@/components/ng/data";

/**
 * The long-form article body the detail page has always rendered (shared across
 * the sample articles). Used to seed the DB and as the fallback body so a
 * static-sourced article looks identical to a DB-sourced one.
 */
export const DEFAULT_ARTICLE_BODY_HTML = `<p>Almost every food we sell has a faster version, and ghee is no exception. A modern creamery can turn milk into finished fat in a few hours. We take five days. Bilona is slow by design, with three days of churning and two of resting, and that pace comes from chemistry. Nothing in modern dairy technology has found a way to shorten it.</p>
<h2>The science behind the slowness</h2>
<p>When milk is cultured at a low temperature for 48 hours, the lactic-acid bacteria break down more of the lactose. Churn that curd by hand, at the right rhythm, and it gives up a butter with a different fatty-acid profile: shorter-chain triglycerides, more conjugated linoleic acid and more of the aromatic compounds that give ghee its smell.</p>
<blockquote>"I learned from my grandmother. The butter tells you when it's done. You don't tell it."<footer>Hetal Pateel, Junagadh</footer></blockquote>
<h2>Why we won't industrialise it</h2>
<p>Several large dairies have asked about white-labeling our ghee using continuous-flow centrifuge methods. We politely declined. That route gives a higher yield and a lower cost per jar, but what comes out of it is a different product. We would rather sell fewer jars of the real thing than more jars of something we couldn't stand behind.</p>
<p>Scan the lot code on your jar and you will see Hetal's name, the day the milk was set and the day the ghee was bottled. That receipt is our contract with you, and it is the reason this company exists.</p>`;

/** Turn an arbitrary string into a URL-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── journals ─────────────────────────────────────────────────────────── */

export interface JournalRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Long-form HTML rendered inside `.prose-article` on the detail page. */
  body: string;
  /** Hero / card cover image URL. */
  cover: string;
  author: string;
  category: string;
  readMinutes: number;
  tags: string[];
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  /** Last edit (ISO), for dateModified and the sitemap. Absent on samples. */
  updatedAt?: string;
  sort: number;
}

export interface JournalInput {
  id?: string;
  slug?: string;
  title: string;
  excerpt?: string;
  body?: string;
  cover?: string | null;
  author?: string | null;
  category?: string;
  readMinutes?: number;
  tags?: string[];
  publishedAt?: string | null;
  sort?: number;
}

interface JournalRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  author: string | null;
  category: string | null;
  read_minutes: number | null;
  tags: string[] | null;
  published_at: string | null;
  updated_at?: string | null;
  sort: number | null;
}

const JOURNAL_COLS =
  "id, slug, title, excerpt, body, cover_url, author, category, read_minutes, tags, published_at, updated_at, sort";

function toJournal(r: JournalRow): JournalRecord {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? "",
    body: r.body || DEFAULT_ARTICLE_BODY_HTML,
    cover: r.cover_url ?? "/images/placeholder.svg",
    author: r.author ?? "Nutri Greenz Field Desk",
    category: r.category ?? "science",
    readMinutes: r.read_minutes ?? 5,
    tags: r.tags ?? [],
    publishedAt: r.published_at ?? "",
    updatedAt: r.updated_at ?? undefined,
    sort: r.sort ?? 0,
  };
}

/** Static fallback article → the same record shape the pages consume. */
function staticJournal(a: (typeof STATIC_JOURNAL)[number], i: number): JournalRecord {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    body: DEFAULT_ARTICLE_BODY_HTML,
    cover: a.cover,
    author: "Nutri Greenz Field Desk",
    category: a.category,
    readMinutes: a.readMinutes,
    tags: [],
    publishedAt: a.publishedAt,
    sort: i,
  };
}

const fallbackJournals = (): JournalRecord[] => STATIC_JOURNAL.map(staticJournal);

/**
 * All journal articles in display order (featured first). The storefront calls
 * this with `fallback` on so it renders the static sample content when the DB is
 * unconfigured/empty; the admin calls it with `fallback` off so it shows the DB
 * truth (an empty table stays empty rather than resurrecting seed rows).
 */
export async function listJournals(fallback = true): Promise<JournalRecord[]> {
  if (!isSupabaseConfigured) return fallback ? fallbackJournals() : [];
  try {
    const { data, error } = await supabaseAdmin()
      .from("journals")
      .select(JOURNAL_COLS)
      .order("sort", { ascending: true })
      .order("published_at", { ascending: false });
    if (error) throw error;
    const rows = (data as JournalRow[] | null) ?? [];
    if (rows.length === 0) return fallback ? fallbackJournals() : [];
    return rows.map(toJournal);
  } catch {
    return fallback ? fallbackJournals() : [];
  }
}

/** A single article by slug, or null when it exists nowhere. */
export async function getJournal(slug: string): Promise<JournalRecord | null> {
  const fromStatic = () => fallbackJournals().find((a) => a.slug === slug) ?? null;
  if (!isSupabaseConfigured) return fromStatic();
  try {
    const { data, error } = await supabaseAdmin()
      .from("journals")
      .select(JOURNAL_COLS)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (data) return toJournal(data as JournalRow);
    return fromStatic();
  } catch {
    return fromStatic();
  }
}

/** Insert (no id) or update (id present) a journal article. */
export async function upsertJournal(input: JournalInput): Promise<JournalRecord> {
  const db = supabaseAdmin();
  const title = input.title.trim();
  const slug = (input.slug?.trim() || slugify(title)) || slugify(title);

  const base: Record<string, unknown> = {
    title,
    slug,
    excerpt: input.excerpt?.trim() ?? "",
    body: input.body ?? "",
    cover_url: input.cover?.trim() || null,
    author: input.author?.trim() || "Nutri Greenz Field Desk",
    category: (input.category?.trim() || "science").toLowerCase(),
    read_minutes: Number.isFinite(input.readMinutes) ? Math.max(1, Math.round(input.readMinutes as number)) : 5,
    tags: input.tags ?? [],
    published_at: input.publishedAt?.trim() || null,
  };
  if (input.sort !== undefined) base.sort = input.sort;

  if (input.id) {
    const { data, error } = await db
      .from("journals")
      .update(base)
      .eq("id", input.id)
      .select(JOURNAL_COLS)
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to update article.");
    return toJournal(data as JournalRow);
  }

  const { data, error } = await db
    .from("journals")
    .insert({ sort: 0, ...base })
    .select(JOURNAL_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create article.");
  return toJournal(data as JournalRow);
}

export async function deleteJournal(id: string): Promise<void> {
  await supabaseAdmin().from("journals").delete().eq("id", id);
}

/* ── farms ────────────────────────────────────────────────────────────── */

export interface FarmRecord {
  id: string;
  name: string;
  region: string;
  hectares: number | null;
  practices: string[];
  partneredSince: string | null;
  farmerName: string | null;
  story: string | null;
  image: string | null;
  gallery: string[];
  /** Last edit (ISO), for the sitemap. Absent on samples. */
  updatedAt?: string;
  sort: number;
}

export interface FarmInput {
  id?: string;
  name: string;
  region?: string;
  hectares?: number | null;
  practices?: string[];
  partneredSince?: string | null;
  farmerName?: string | null;
  story?: string | null;
  image?: string | null;
  gallery?: string[];
  sort?: number;
}

interface FarmRow {
  id: string;
  name: string;
  region: string | null;
  hectares: number | string | null;
  practices: string[] | null;
  partnered_since: string | null;
  farmer_name: string | null;
  story: string | null;
  image_url: string | null;
  gallery: string[] | null;
  updated_at?: string | null;
  sort: number | null;
}

const FARM_COLS =
  "id, name, region, hectares, practices, partnered_since, farmer_name, story, image_url, gallery, updated_at, sort";

function toFarm(r: FarmRow): FarmRecord {
  return {
    id: r.id,
    name: r.name,
    region: r.region ?? "",
    hectares: r.hectares == null ? null : Number(r.hectares),
    practices: r.practices ?? [],
    partneredSince: r.partnered_since ?? null,
    farmerName: r.farmer_name ?? null,
    story: r.story ?? null,
    image: r.image_url ?? null,
    gallery: r.gallery ?? [],
    updatedAt: r.updated_at ?? undefined,
    sort: r.sort ?? 0,
  };
}

function staticFarm(f: (typeof STATIC_FARMS)[number], i: number): FarmRecord {
  return {
    id: f.id,
    name: f.name,
    region: f.region,
    hectares: f.hectares ?? null,
    practices: f.practices,
    partneredSince: f.partneredSince ?? null,
    farmerName: f.farmerName ?? null,
    story: f.story ?? null,
    image: f.image ?? null,
    gallery: [],
    sort: i,
  };
}

const fallbackFarms = (): FarmRecord[] => STATIC_FARMS.map(staticFarm);

/**
 * All partner farms in display order. `fallback` behaves as in {@link listJournals}
 * — storefront on (static sample when DB empty), admin off (DB truth).
 */
export async function listFarms(fallback = true): Promise<FarmRecord[]> {
  if (!isSupabaseConfigured) return fallback ? fallbackFarms() : [];
  try {
    const { data, error } = await supabaseAdmin()
      .from("farms")
      .select(FARM_COLS)
      .order("sort", { ascending: true })
      .order("partnered_since", { ascending: true, nullsFirst: false });
    if (error) throw error;
    const rows = (data as FarmRow[] | null) ?? [];
    if (rows.length === 0) return fallback ? fallbackFarms() : [];
    return rows.map(toFarm);
  } catch {
    return fallback ? fallbackFarms() : [];
  }
}

/** A single farm by id, or null when it exists nowhere. */
export async function getFarm(id: string): Promise<FarmRecord | null> {
  const fromStatic = () => fallbackFarms().find((f) => f.id === id) ?? null;
  if (!isSupabaseConfigured) return fromStatic();
  try {
    const { data, error } = await supabaseAdmin()
      .from("farms")
      .select(FARM_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (data) return toFarm(data as FarmRow);
    return fromStatic();
  } catch {
    return fromStatic();
  }
}

/** Insert (no id, id derived from name) or update (id present) a farm. */
export async function upsertFarm(input: FarmInput): Promise<FarmRecord> {
  const db = supabaseAdmin();
  const name = input.name.trim();

  const patch: Record<string, unknown> = {
    name,
    region: input.region?.trim() ?? "",
    hectares: input.hectares ?? null,
    practices: input.practices ?? [],
    partnered_since: input.partneredSince?.trim() || null,
    farmer_name: input.farmerName?.trim() || null,
    story: input.story?.trim() || null,
    image_url: input.image?.trim() || null,
    gallery: input.gallery ?? [],
  };
  if (input.sort !== undefined) patch.sort = input.sort;

  if (input.id) {
    const { data, error } = await db
      .from("farms")
      .update(patch)
      .eq("id", input.id)
      .select(FARM_COLS)
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to update farm.");
    return toFarm(data as FarmRow);
  }

  const id = (slugify(name) || `farm-${Date.now()}`).slice(0, 60);
  const { data, error } = await db
    .from("farms")
    .insert({ id, sort: 0, ...patch })
    .select(FARM_COLS)
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to create farm.");
  return toFarm(data as FarmRow);
}

export async function deleteFarm(id: string): Promise<void> {
  await supabaseAdmin().from("farms").delete().eq("id", id);
}
