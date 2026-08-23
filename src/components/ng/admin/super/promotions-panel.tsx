"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ng/button";
import { Input } from "@/components/ng/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * PromotionsPanel — the REAL occasion / seasonal sale manager backed by the
 * `promotions` table (super-admin `/api/admin/marketing/promotions`). It lists
 * every promotion with its banner, discount, targeting scope and schedule
 * window, clearly highlights the one that is LIVE right now, and supports
 * create / edit / delete against the same guarded APIs as the coupon surface.
 *
 * The nine banner backgrounds ship at `/images/banners/sale-<key>.webp` and are
 * offered as a thumbnail picker. Types + the banner-key list are declared
 * locally (NOT imported from `@/lib/promotions`, which is `server-only`) so this
 * stays a client component. All money-less percent markdowns are whole 1..90.
 */

/* ── banner + scope constants (mirror the server contract) ─────────────────── */

const BANNER_KEYS = [
  "ganesh-chaturthi",
  "diwali",
  "ugadi",
  "sankranti",
  "dussehra",
  "summer-end",
  "winter-end",
  "end-of-season",
  "end-of-month",
] as const;
type BannerKey = (typeof BANNER_KEYS)[number];

const BANNER_LABELS: Record<BannerKey, string> = {
  "ganesh-chaturthi": "Ganesh Chaturthi",
  diwali: "Diwali",
  ugadi: "Ugadi",
  sankranti: "Sankranti",
  dussehra: "Dussehra",
  "summer-end": "Summer End",
  "winter-end": "Winter End",
  "end-of-season": "End of Season",
  "end-of-month": "End of Month",
};

const bannerSrc = (key: string) => `/images/banners/sale-${key}.webp`;

function isBannerKey(v: string): v is BannerKey {
  return (BANNER_KEYS as readonly string[]).includes(v);
}

type ScopeMode = "all" | "category" | "product";

const CATEGORIES = [
  { slug: "ghee", label: "Ghee" },
  { slug: "honey", label: "Honey" },
  { slug: "oils", label: "Oils" },
] as const;

/** A persisted promotion as returned by GET (camelCase, client-safe subset). */
interface PromotionRow {
  id: string;
  title: string;
  slug: string;
  bannerKey: string;
  headline: string;
  subcopy: string | null;
  announcement: string | null;
  discountPercent: number;
  scope: ScopeMode;
  scopeValues: string[];
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  ctaLabel: string;
  ctaHref: string;
  autoMonth: boolean;
  priority: number;
}

interface FormState {
  bannerKey: BannerKey;
  title: string;
  headline: string;
  subcopy: string;
  announcement: string;
  discountPercent: string;
  scope: ScopeMode;
  categories: string[];
  productSlugs: string;
  startsAt: string;
  endsAt: string;
  ctaLabel: string;
  ctaHref: string;
  autoMonth: boolean;
  priority: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  bannerKey: "diwali",
  title: "",
  headline: "",
  subcopy: "",
  announcement: "",
  discountPercent: "",
  scope: "all",
  categories: [],
  productSlugs: "",
  startsAt: "",
  endsAt: "",
  ctaLabel: "",
  ctaHref: "",
  autoMonth: false,
  priority: "0",
  active: true,
};

/**
 * On-brand copy presets per occasion — the "auto-generate from one word" source.
 * `{p}` → the discount %, `{month}` → the current month. Pick a banner + discount,
 * hit Auto-generate, and the title / headline / subcopy / CTA and the storefront
 * marquee line are all filled in (then freely editable).
 */
const COPY_PRESETS: Record<
  BannerKey,
  { title: string; headline: string; subcopy: string; cta: string; announcement: string }
> = {
  "ganesh-chaturthi": {
    title: "Ganesh Chaturthi Sale",
    headline: "Blessings & {p}% off this Ganesh Chaturthi",
    subcopy: "Celebrate with pure, wholesome pantry staples, {p}% off everything.",
    cta: "Shop the sale",
    announcement: "🕉️ Ganesh Chaturthi Sale · {p}% OFF everything · Shop now",
  },
  diwali: {
    title: "Diwali Dhamaka",
    headline: "Light up Diwali with {p}% off",
    subcopy: "Festival of lights, festival of savings across every shelf.",
    cta: "Shop the sale",
    announcement: "🪔 Diwali Dhamaka · {p}% OFF everything · Shop now",
  },
  ugadi: {
    title: "Ugadi Special",
    headline: "A fresh start this Ugadi, {p}% off",
    subcopy: "Ring in the Telugu new year with clean, honest food, {p}% off.",
    cta: "Shop the sale",
    announcement: "🌿 Ugadi Special · {p}% OFF everything · Shop now",
  },
  sankranti: {
    title: "Sankranti Sale",
    headline: "Harvest joy this Sankranti, {p}% off",
    subcopy: "Celebrate the harvest with pure oils, ghee & honey, {p}% off.",
    cta: "Shop the sale",
    announcement: "🪁 Sankranti Sale · {p}% OFF everything · Shop now",
  },
  dussehra: {
    title: "Dussehra Dhamaka",
    headline: "Victory savings this Dussehra, {p}% off",
    subcopy: "Purity over shortcuts. {p}% off across the whole pantry.",
    cta: "Shop the sale",
    announcement: "🏹 Dussehra Sale · {p}% OFF everything · Shop now",
  },
  "summer-end": {
    title: "Summer End Sale",
    headline: "Summer's ending. {p}% off before it's gone",
    subcopy: "Stock the pantry for the season ahead, {p}% off.",
    cta: "Shop the sale",
    announcement: "☀️ Summer End Sale · {p}% OFF · Shop now",
  },
  "winter-end": {
    title: "Winter End Sale",
    headline: "Warm savings before winter ends, {p}% off",
    subcopy: "Cosy up with ghee, honey & cold-pressed oils, {p}% off.",
    cta: "Shop the sale",
    announcement: "❄️ Winter End Sale · {p}% OFF · Shop now",
  },
  "end-of-season": {
    title: "End of Season Sale",
    headline: "End of Season. {p}% off across the pantry",
    subcopy: "The season's best staples at their best price, {p}% off.",
    cta: "Shop the sale",
    announcement: "🍂 End of Season Sale · {p}% OFF · Shop now",
  },
  "end-of-month": {
    title: "{month} Sale",
    headline: "{month} savings, {p}% off everything",
    subcopy: "This month only. {p}% off across every shelf.",
    cta: "Shop the sale",
    announcement: "🗓️ {month} Sale · {p}% OFF everything · Shop now",
  },
};

const ERROR_COPY: Record<string, string> = {
  "title-required": "Title is required.",
  "headline-required": "Headline is required.",
  "invalid-banner-key": "Pick a banner.",
  "invalid-discount-percent": "Discount must be a whole number 1–90%.",
  "slug-exists": "A promotion with that title already exists.",
  "db-unavailable": "Database unavailable. Check the Supabase config.",
};

/* ── pure helpers ──────────────────────────────────────────────────────────── */

/** LIVE right now = active AND started (or open start) AND not ended (or open end). */
function isLiveNow(p: PromotionRow, now: number): boolean {
  if (!p.active) return false;
  const startsOk = p.startsAt === null || new Date(p.startsAt).getTime() <= now;
  const endsOk = p.endsAt === null || new Date(p.endsAt).getTime() >= now;
  return startsOk && endsOk;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function scheduleText(p: PromotionRow): string {
  if (p.startsAt && p.endsAt) return `${fmtDate(p.startsAt)} → ${fmtDate(p.endsAt)}`;
  if (p.startsAt) return `From ${fmtDate(p.startsAt)}`;
  if (p.endsAt) return `Until ${fmtDate(p.endsAt)}`;
  return "Always on";
}

function scopeText(p: PromotionRow): string {
  if (p.scope === "all") return "All products";
  const label = p.scope === "category" ? "Categories" : "Products";
  return p.scopeValues.length ? `${label}: ${p.scopeValues.join(", ")}` : label;
}

/** timestamptz → the `YYYY-MM-DD` a <input type="date"> expects (or ""). */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/* ── tiny presentational controls ──────────────────────────────────────────── */

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-ng-forest" : "bg-ng-line",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-ng-paper shadow transition-transform",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}

/* ── panel ─────────────────────────────────────────────────────────────────── */

export function PromotionsPanel() {
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const sectionRef = useRef<HTMLElement>(null);

  const now = useMemo(() => Date.now(), [promotions]);
  const liveCount = useMemo(
    () => promotions.filter((p) => isLiveNow(p, now)).length,
    [promotions, now],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/promotions", { cache: "no-store" });
      if (!res.ok) {
        setPromotions([]);
        return;
      }
      const json = (await res.json()) as { promotions?: PromotionRow[] };
      setPromotions(json.promotions ?? []);
    } catch {
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEdit(p: PromotionRow) {
    setForm({
      bannerKey: isBannerKey(p.bannerKey) ? p.bannerKey : "diwali",
      title: p.title,
      headline: p.headline,
      subcopy: p.subcopy ?? "",
      announcement: p.announcement ?? "",
      discountPercent: String(p.discountPercent),
      scope: p.scope,
      categories: p.scope === "category" ? p.scopeValues : [],
      productSlugs: p.scope === "product" ? p.scopeValues.join(", ") : "",
      startsAt: toDateInput(p.startsAt),
      endsAt: toDateInput(p.endsAt),
      ctaLabel: p.ctaLabel,
      ctaHref: p.ctaHref,
      autoMonth: p.autoMonth,
      priority: String(p.priority),
      active: p.active,
    });
    setEditingId(p.id);
    setShowForm(true);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** One-click copy: fill title/headline/subcopy/CTA + the marquee line from the
   *  chosen occasion's preset, injecting the discount % (and current month). */
  function autoGenerate() {
    const pct = form.discountPercent.trim() || "20";
    const month = new Date().toLocaleString("en-US", { month: "long" });
    const fill = (s: string) => s.replace(/\{p\}/g, pct).replace(/\{month\}/gi, month);
    const preset = COPY_PRESETS[form.bannerKey];
    setForm((f) => ({
      ...f,
      title: fill(preset.title),
      headline: fill(preset.headline),
      subcopy: fill(preset.subcopy),
      ctaLabel: preset.cta,
      ctaHref: f.ctaHref.trim() || "/shop",
      announcement: fill(preset.announcement),
      discountPercent: f.discountPercent.trim() || pct,
      autoMonth: f.bannerKey === "end-of-month" ? true : f.autoMonth,
    }));
    toast.success("Copy generated. Tweak anything you like.");
  }

  async function submit() {
    const title = form.title.trim();
    const headline = form.headline.trim();
    const percent = Number(form.discountPercent);
    if (!title) return toast.error("Enter a title.");
    if (!headline) return toast.error("Enter a headline.");
    if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
      return toast.error("Discount must be a whole number 1–90%.");
    }
    const productSlugs = form.productSlugs
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (form.scope === "category" && form.categories.length === 0) {
      return toast.error("Pick at least one category.");
    }
    if (form.scope === "product" && productSlugs.length === 0) {
      return toast.error("Enter at least one product slug.");
    }

    const scopeValues =
      form.scope === "category" ? form.categories : form.scope === "product" ? productSlugs : [];

    const priorityNum = Math.round(Number(form.priority || "0"));
    const body: Record<string, unknown> = {
      title,
      bannerKey: form.bannerKey,
      headline,
      subcopy: form.subcopy.trim() || null,
      announcement: form.announcement.trim() || null,
      discountPercent: Math.round(percent),
      scope: form.scope,
      scopeValues,
      // A date input is a plain day — anchor start to 00:00 and end to 23:59:59
      // so the window is inclusive of the chosen end date. Blank → open-ended.
      startsAt: form.startsAt ? `${form.startsAt}T00:00:00` : null,
      endsAt: form.endsAt ? `${form.endsAt}T23:59:59` : null,
      autoMonth: form.autoMonth,
      priority: Number.isFinite(priorityNum) ? priorityNum : 0,
      active: form.active,
    };
    const ctaLabel = form.ctaLabel.trim();
    if (ctaLabel) body.ctaLabel = ctaLabel;
    const ctaHref = form.ctaHref.trim();
    if (ctaHref) body.ctaHref = ctaHref;

    const editing = editingId !== null;
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/admin/marketing/promotions/${editingId}` : "/api/admin/marketing/promotions",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(
          json.error ? (ERROR_COPY[json.error] ?? `Couldn't save (${json.error}).`) : "Couldn't save promotion.",
        );
        return;
      }
      toast.success(editing ? `${title} updated` : `${title} created`);
      closeForm();
      await load();
    } catch {
      toast.error("Couldn't save promotion.");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(p: PromotionRow, active: boolean) {
    try {
      const res = await fetch(`/api/admin/marketing/promotions/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !json.ok) {
        toast.error("Couldn't update promotion.");
        return;
      }
      toast.success(`${p.title} ${active ? "activated" : "paused"}`);
      await load();
    } catch {
      toast.error("Couldn't update promotion.");
    }
  }

  async function remove(p: PromotionRow) {
    if (!window.confirm(`Delete “${p.title}”? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/marketing/promotions/${p.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !json.ok) {
        toast.error("Couldn't delete promotion.");
        return;
      }
      toast.success(`${p.title} deleted`);
      if (editingId === p.id) closeForm();
      await load();
    } catch {
      toast.error("Couldn't delete promotion.");
    }
  }

  return (
    <section
      ref={sectionRef}
      id="promotions"
      className="mb-6 scroll-mt-32 overflow-hidden rounded-3xl border border-ng-clay/25 bg-gradient-to-b from-ng-amber/[0.06] to-ng-paper p-6 shadow-[var(--shadow-ng-card)]"
    >
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-ng-amber/30 to-ng-clay/30 text-ng-clay-deep">
            <Icon name="tag-price-bold" size={20} />
          </span>
          <div>
            <h2 className="font-display text-[22px] leading-tight text-ng-forest-deep">Promotions</h2>
            <p className="text-[13px] text-ng-ink-muted">
              Occasion &amp; seasonal sales. Banner, discount, targeting &amp; schedule, applied live to catalogue prices.
            </p>
          </div>
        </div>
        {!showForm ? (
          <Button type="button" variant="primary" onClick={openCreate} className="h-10 shrink-0 !bg-ng-clay hover:!bg-ng-clay-deep !text-ng-paper">
            <Icon name="add-circle-bold" size={16} />
            New promotion
          </Button>
        ) : null}
      </div>

      {/* Create / edit form */}
      {showForm ? (
        <div className="mb-6 rounded-2xl border border-ng-clay/20 bg-ng-amber/[0.07] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-display text-[16px] text-ng-forest-deep">
              {editingId ? "Edit promotion" : "New promotion"}
            </h3>
            <span className="rounded-full bg-ng-clay/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ng-clay-deep">
              {editingId ? "Editing" : "Draft"}
            </span>
          </div>

          {/* Banner picker */}
          <span className="mb-2 block text-[13px] font-semibold text-ng-ink">Banner</span>
          <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {BANNER_KEYS.map((key) => {
              const selected = form.bannerKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setForm((f) => ({ ...f, bannerKey: key }))}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border-2 bg-ng-paper transition-all",
                    selected
                      ? "border-ng-clay ring-2 ring-ng-clay/30"
                      : "border-transparent hover:border-ng-amber",
                  )}
                >
                  <div className="relative aspect-[16/10] w-full">
                    <Image
                      src={bannerSrc(key)}
                      alt={BANNER_LABELS[key]}
                      fill
                      sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 160px"
                      className="object-cover"
                    />
                    {selected ? (
                      <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ng-clay text-ng-paper">
                        <Icon name="check-circle-bold" size={14} />
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "flex min-h-[38px] items-center justify-center px-2 py-1.5 text-center text-[11px] font-semibold leading-tight",
                      selected ? "bg-ng-clay/10 text-ng-clay-deep" : "text-ng-ink-muted",
                    )}
                  >
                    {BANNER_LABELS[key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Auto-generate — fills all the copy + the marquee line from the chosen
              occasion + discount, in one click (each field stays editable). */}
          <button
            type="button"
            onClick={autoGenerate}
            className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ng-clay/50 bg-ng-clay/5 px-4 py-2.5 text-[13px] font-semibold text-ng-clay-deep transition-colors hover:bg-ng-clay/10"
          >
            <span aria-hidden>✨</span>
            Auto-generate copy for {BANNER_LABELS[form.bannerKey]}
          </button>

          {/* Copy + discount */}
          <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Input
              label="Title"
              placeholder="Diwali festive sale"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              label="Discount"
              inputMode="numeric"
              suffix="%"
              placeholder="20"
              value={form.discountPercent}
              onChange={(e) =>
                setForm((f) => ({ ...f, discountPercent: e.target.value.replace(/[^\d]/g, "") }))
              }
            />
          </div>
          <div className="mb-4">
            <Input
              label="Headline"
              placeholder="Light up the season with 20% off"
              value={form.headline}
              onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            />
          </div>
          <div className="mb-4">
            <Input
              label="Subcopy (optional)"
              placeholder="On all cold-pressed oils, ends Sunday"
              value={form.subcopy}
              onChange={(e) => setForm((f) => ({ ...f, subcopy: e.target.value }))}
            />
          </div>
          <div className="mb-5">
            <Input
              label="Top-bar announcement (optional)"
              placeholder="🪔 Diwali Dhamaka · 15% OFF everything · Shop now"
              value={form.announcement}
              onChange={(e) => setForm((f) => ({ ...f, announcement: e.target.value }))}
            />
            <p className="mt-1 text-[11px] text-ng-ink-soft">
              Scrolls in the bar at the very top of the store while this sale is live. Leave blank to auto-build it from the title + discount.
            </p>
          </div>

          {/* Scope */}
          <span className="mb-2 block text-[13px] font-semibold text-ng-ink">Applies to</span>
          <div className="mb-3 flex gap-1.5">
            {(["all", "category", "product"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, scope: s }))}
                className={cn(
                  "h-11 flex-1 rounded-xl border text-[13px] font-semibold transition-all",
                  form.scope === s
                    ? "border-ng-clay bg-ng-clay text-ng-paper"
                    : "border-ng-line bg-ng-paper text-ng-ink-muted hover:border-ng-amber",
                )}
              >
                {s === "all" ? "All products" : s === "category" ? "Category" : "Specific products"}
              </button>
            ))}
          </div>
          {form.scope === "category" ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = form.categories.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        categories: on
                          ? f.categories.filter((x) => x !== c.slug)
                          : [...f.categories, c.slug],
                      }))
                    }
                    className={cn(
                      "h-11 rounded-xl border px-5 text-[13px] font-semibold transition-all",
                      on
                        ? "border-ng-clay bg-ng-clay text-ng-paper"
                        : "border-ng-line bg-ng-paper text-ng-ink-muted hover:border-ng-amber",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {form.scope === "product" ? (
            <div className="mb-5">
              <Input
                label="Product slugs (comma-separated)"
                placeholder="a2-cow-ghee, wild-forest-honey"
                value={form.productSlugs}
                onChange={(e) => setForm((f) => ({ ...f, productSlugs: e.target.value }))}
              />
            </div>
          ) : null}

          {/* Schedule + priority + CTA */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Starts"
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            />
            <Input
              label="Ends"
              type="date"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            />
            <Input
              label="Priority"
              inputMode="numeric"
              placeholder="0"
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: e.target.value.replace(/[^\d]/g, "") }))
              }
            />
            <Input
              label="CTA label"
              placeholder="Shop the sale"
              value={form.ctaLabel}
              onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
            />
          </div>
          <div className="mb-5">
            <Input
              label="CTA link"
              placeholder="/shop"
              value={form.ctaHref}
              onChange={(e) => setForm((f) => ({ ...f, ctaHref: e.target.value }))}
            />
          </div>

          {/* Toggles */}
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-10">
            <div className="flex items-center gap-3">
              <Toggle
                on={form.autoMonth}
                onClick={() => setForm((f) => ({ ...f, autoMonth: !f.autoMonth }))}
                label="Toggle auto-month"
              />
              <div>
                <div className="text-[13px] font-semibold text-ng-ink">Auto-month</div>
                <div className="max-w-[38ch] text-[11.5px] leading-snug text-ng-ink-soft">
                  Fills the current month name into the title. Pairs with the “End of Month” banner.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Toggle
                on={form.active}
                onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                label="Toggle active"
              />
              <div className="text-[13px] font-semibold text-ng-ink">Active</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="primary" onClick={() => void submit()} disabled={saving} className="h-11">
              {saving ? "Saving…" : editingId ? "Save changes" : "Create promotion"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm} disabled={saving} className="h-11">
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* List */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ng-ink-muted">
          All promotions{promotions.length ? ` · ${promotions.length}` : ""}
        </span>
        {liveCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-amber/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ng-clay-deep">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ng-clay" />
            {liveCount} live now
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="py-6 text-center text-[14px] text-ng-ink-muted">Loading promotions…</p>
      ) : promotions.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-ng-ink-muted">
          No promotions yet. Create your first with “New promotion”.
        </p>
      ) : (
        <ul className="divide-y divide-ng-line-soft overflow-hidden rounded-2xl border border-ng-line-soft">
          {promotions.map((p) => {
            const live = isLiveNow(p, now);
            return (
              <li
                key={p.id}
                className={cn(
                  "flex flex-col gap-4 border-l-4 p-4 sm:flex-row sm:items-center",
                  live ? "border-ng-clay bg-ng-amber/[0.06]" : "border-transparent bg-ng-paper",
                )}
              >
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-ng-line-soft">
                  <Image src={bannerSrc(p.bannerKey)} alt={p.title} fill sizes="96px" className="object-cover" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[15px] text-ng-forest-deep">{p.title}</span>
                    {live ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ng-amber/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ng-clay-deep">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ng-clay" />
                        Live now
                      </span>
                    ) : null}
                    {p.autoMonth ? (
                      <span className="rounded-full bg-ng-clay/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ng-clay-deep">
                        Auto-month
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ng-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="tag-price-bold" size={13} />
                      {scopeText(p)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="calendar-bold" size={13} />
                      {scheduleText(p)}
                    </span>
                    <span className="tabular-nums">Priority {p.priority}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:flex-nowrap sm:justify-end sm:gap-5">
                  <span className="font-display text-[20px] tabular-nums text-ng-forest-deep">
                    {p.discountPercent}%
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      p.active ? "bg-ng-green-bright/15 text-ng-forest" : "bg-ng-line text-ng-ink-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        p.active ? "bg-ng-green-bright" : "bg-ng-ink-soft",
                      )}
                    />
                    {p.active ? "Active" : "Inactive"}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void setActive(p, !p.active)}
                      className="text-[12.5px] font-semibold text-ng-ink-muted transition-colors hover:text-ng-forest"
                    >
                      {p.active ? "Pause" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="text-[12.5px] font-semibold text-ng-forest transition-colors hover:text-ng-leaf"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(p)}
                      className="text-[12.5px] font-semibold text-ng-terracotta transition-colors hover:opacity-80"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
