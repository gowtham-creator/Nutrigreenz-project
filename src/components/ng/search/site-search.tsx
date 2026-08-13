"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { EnterKey, EscKey, Keycap, ModifierKey } from "@/components/ui/keycap";
import { cn } from "@/lib/utils";
import type { SearchCategoryHit, SearchProductHit } from "@/app/api/search/route";

/**
 * SiteSearch — the header's search control, and the panel it opens.
 *
 * ── What was here originally ──────────────────────────────────────────────
 *
 * A `<button aria-label="Search">` with no onClick, no form and no handler. It
 * drew a magnifier and did nothing, on every page, and it was
 * `hidden xl:inline-flex`, so below 1280px there was no search control at all.
 *
 * ── What the panel does ───────────────────────────────────────────────────
 *
 * Opens on click or ⌘K / Ctrl+K. Live product and category results as you
 * type, fully keyboard-driven: ↑/↓ walk the list, Enter opens the highlighted
 * row, Enter on nothing highlighted runs the full search at /shop?q=…, Escape
 * closes. Recent searches are remembered and offered back when the box is
 * empty, alongside the category shortcuts.
 *
 * Every row — product, category, recent, suggestion — is one entry in a single
 * flat `items` list. That is deliberate: keeping a separate index per section
 * is how arrow-key navigation ends up skipping a row or trapping focus in one
 * group, because every section boundary becomes a special case. One list means
 * one index and no boundaries.
 *
 * ── Details that are load-bearing ─────────────────────────────────────────
 *
 * Requests are debounced 180ms, and each response carries the query it
 * answered so a slow reply for "hon" can never overwrite results already shown
 * for "honey" — out-of-order responses are the classic search-as-you-type bug,
 * and the check is cheaper than an abort controller.
 *
 * The panel is portalled to `document.body`. The header is sticky and carries
 * a backdrop-filter, and both `transform` and `backdrop-filter` create a
 * containing block for `position: fixed` descendants — rendered in place, the
 * overlay would position against the header and hang off the top bar rather
 * than covering the page.
 */

const RECENTS_KEY = "ng_recent_searches";
const MAX_RECENTS = 5;

/** Offered on an empty box: the categories we actually stock. */
const SUGGESTIONS = [
  { label: "Cold-pressed oils", href: "/shop/oils" },
  { label: "Ghee", href: "/shop/ghee" },
  { label: "Honey", href: "/shop/honey" },
] as const;

interface SearchResponse {
  query?: string;
  products?: SearchProductHit[];
  categories?: SearchCategoryHit[];
  total?: number;
}

/** A navigable row. `href` is where Enter/click goes. */
type Item =
  | { kind: "product"; href: string; hit: SearchProductHit }
  | { kind: "category"; href: string; hit: SearchCategoryHit }
  | { kind: "recent"; href: string; term: string }
  | { kind: "suggestion"; href: string; label: string }
  | { kind: "all"; href: string; label: string };

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    // Private mode, or somebody put something else under the key. Neither is
    // worth breaking search over.
    return [];
  }
}

/**
 * Bold the matched run inside a title.
 *
 * Matches on the first term only, and on the raw substring — enough to show
 * *why* a row matched without pulling in a highlighter that would need to
 * reason about overlapping ranges for a benefit nobody would notice.
 */
function Highlight({ text, term }: { text: string; term: string }) {
  const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-ng-forest">
        {text.slice(at, at + term.length)}
      </mark>
      {text.slice(at + term.length)}
    </>
  );
}

export function SiteSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchProductHit[]>([]);
  const [categories, setCategories] = useState<SearchCategoryHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const panelId = useId();

  const q = query.trim();
  const searching = q.length >= 2;

  const close = useCallback(() => {
    setOpen(false);
    // Focus goes back where it came from, or a keyboard user is dropped at the
    // top of the document with no idea what happened.
    triggerRef.current?.focus();
  }, []);

  const remember = useCallback((term: string) => {
    if (term.length < 2) return;
    setRecents((prev) => {
      const next = [term, ...prev.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(
        0,
        MAX_RECENTS,
      );
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        /* see readRecents */
      }
      return next;
    });
  }, []);

  const runFullSearch = useCallback(
    (term: string) => {
      remember(term);
      setOpen(false);
      router.push(`/shop?q=${encodeURIComponent(term)}`);
    },
    [remember, router],
  );

  const go = useCallback(
    (item: Item) => {
      if (item.kind === "recent") {
        setQuery(item.term);
        setActive(0);
        inputRef.current?.focus();
        return;
      }
      if (item.kind === "all") {
        runFullSearch(q);
        return;
      }
      if (item.kind === "product" || item.kind === "category") remember(q);
      setOpen(false);
      router.push(item.href);
    },
    [q, remember, router, runFullSearch],
  );

  /* One flat list, so arrow keys never need to know about section boundaries. */
  const items = useMemo<Item[]>(() => {
    if (!searching) {
      return [
        ...recents.map((term) => ({ kind: "recent" as const, href: "", term })),
        ...SUGGESTIONS.map((s) => ({
          kind: "suggestion" as const,
          href: s.href,
          label: s.label,
        })),
      ];
    }
    const list: Item[] = [
      ...products.map((hit) => ({ kind: "product" as const, href: `/products/${hit.slug}`, hit })),
      ...categories.map((hit) => ({ kind: "category" as const, href: `/shop/${hit.slug}`, hit })),
    ];
    if (total > 0) {
      list.push({
        kind: "all",
        href: `/shop?q=${encodeURIComponent(q)}`,
        label: `See all ${total} result${total === 1 ? "" : "s"} for “${q}”`,
      });
    }
    return list;
  }, [searching, recents, products, categories, total, q]);

  /* ⌘K / Ctrl+K opens from anywhere; Escape closes. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  /* The page behind must not scroll while the panel is over it. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    setRecents(readRecents());
  }, [open]);

  /* Debounced fetch, guarded against out-of-order responses. */
  useEffect(() => {
    if (!open) return;
    if (!searching) {
      setProducts([]);
      setCategories([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = (await res.json()) as SearchResponse;
        // Ignore a reply for a query the user has already typed past.
        if (json.query !== q.toLowerCase()) return;
        setProducts(json.products ?? []);
        setCategories(json.categories ?? []);
        setTotal(json.total ?? 0);
      } catch {
        setProducts([]);
        setCategories([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [q, open, searching]);

  /* A new query starts at the top of its own results. */
  useEffect(() => {
    setActive(0);
  }, [q]);

  /* Keep the highlighted row in view when walking with the keyboard. */
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, items.length]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) go(item);
      else if (searching) runFullSearch(q);
    }
  };

  const rowClass = (i: number) =>
    cn(
      "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors",
      i === active ? "bg-ng-sage/40" : "hover:bg-ng-sage/25",
    );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Search products"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ng-ink transition-colors hover:bg-ng-forest/[0.06] md:h-10 md:w-10",
          className,
        )}
      >
        <UiIcon name="search" size={19} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100]"
              role="dialog"
              aria-modal="true"
              aria-label="Search products"
            >
              <button
                type="button"
                aria-label="Close search"
                onClick={close}
                className="absolute inset-0 h-full w-full cursor-default bg-ng-forest-deep/45 backdrop-blur-[2px]"
              />

              <div
                id={panelId}
                className="relative mx-auto mt-[8vh] w-[min(680px,92vw)] overflow-hidden rounded-2xl border border-ng-line bg-ng-paper shadow-[0_40px_90px_-30px_rgba(10,31,18,0.5)]"
              >
                <div className="flex items-center gap-3 border-b border-ng-line-soft px-5 py-4">
                  <UiIcon name="search" size={20} className="shrink-0 text-ng-ink-muted" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    placeholder="Search oils, ghee, honey…"
                    aria-label="Search products"
                    aria-autocomplete="list"
                    aria-controls={`${panelId}-list`}
                    className="min-w-0 flex-1 bg-transparent text-[16px] text-ng-ink outline-none placeholder:text-ng-ink-muted/70"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        inputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ng-ink-muted transition-colors hover:bg-ng-sage hover:text-ng-forest"
                    >
                      <Icon name="close-circle-linear" size={18} />
                    </button>
                  ) : null}
                  <EscKey className="hidden shrink-0 sm:inline-flex" />
                </div>

                <div
                  ref={listRef}
                  id={`${panelId}-list`}
                  role="listbox"
                  aria-label="Search results"
                  className="max-h-[min(58vh,440px)] overflow-y-auto"
                >
                  {/* Skeleton rather than an empty box: a blank panel mid-type
                      reads as "no results" and makes people retype. */}
                  {searching && loading && products.length === 0 ? (
                    <div className="space-y-3 px-5 py-4">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-ng-sage/40" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-2/3 animate-pulse rounded bg-ng-sage/40" />
                            <div className="h-2.5 w-1/3 animate-pulse rounded bg-ng-sage/30" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : searching && items.length === 0 ? (
                    <div className="px-5 py-9 text-center">
                      <p className="text-[14px] font-medium text-ng-forest-deep">
                        Nothing matched “{q}”
                      </p>
                      <p className="mt-1.5 text-[13px] text-ng-ink-muted">
                        Try a category instead — oils, ghee or honey.
                      </p>
                    </div>
                  ) : (
                    <>
                      {!searching && recents.length > 0 ? (
                        <SectionLabel>
                          Recent
                          <button
                            type="button"
                            onClick={() => {
                              setRecents([]);
                              try {
                                localStorage.removeItem(RECENTS_KEY);
                              } catch {
                                /* see readRecents */
                              }
                            }}
                            className="font-medium text-ng-ink-soft normal-case tracking-normal hover:text-ng-forest"
                          >
                            Clear
                          </button>
                        </SectionLabel>
                      ) : null}

                      {items.map((item, i) => {
                        if (item.kind === "recent") {
                          return (
                            <button
                              key={`r-${item.term}`}
                              type="button"
                              data-idx={i}
                              role="option"
                              aria-selected={i === active}
                              onMouseEnter={() => setActive(i)}
                              onClick={() => go(item)}
                              className={rowClass(i)}
                            >
                              <Icon
                                name="history-bold"
                                size={17}
                                className="shrink-0 text-ng-ink-soft"
                              />
                              <span className="truncate text-[14px] text-ng-ink">{item.term}</span>
                            </button>
                          );
                        }

                        if (item.kind === "suggestion") {
                          const first = items.findIndex((x) => x.kind === "suggestion");
                          return (
                            <div key={`s-${item.label}`}>
                              {i === first ? <SectionLabel>Browse</SectionLabel> : null}
                              <button
                                type="button"
                                data-idx={i}
                                role="option"
                                aria-selected={i === active}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => go(item)}
                                className={rowClass(i)}
                              >
                                <UiIcon name="bag" size={17} className="shrink-0 text-ng-leaf" />
                                <span className="truncate text-[14px] text-ng-ink">
                                  {item.label}
                                </span>
                              </button>
                            </div>
                          );
                        }

                        if (item.kind === "category") {
                          const first = items.findIndex((x) => x.kind === "category");
                          return (
                            <div key={`c-${item.hit.slug}`}>
                              {i === first ? <SectionLabel>Categories</SectionLabel> : null}
                              <button
                                type="button"
                                data-idx={i}
                                role="option"
                                aria-selected={i === active}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => go(item)}
                                className={rowClass(i)}
                              >
                                <UiIcon name="bag" size={17} className="shrink-0 text-ng-leaf" />
                                <span className="min-w-0 flex-1 truncate text-[14px] text-ng-ink">
                                  <Highlight text={item.hit.title} term={q} />
                                </span>
                                <span className="shrink-0 text-[12px] text-ng-ink-soft">
                                  {item.hit.count} item{item.hit.count === 1 ? "" : "s"}
                                </span>
                              </button>
                            </div>
                          );
                        }

                        if (item.kind === "all") {
                          return (
                            <button
                              key="all"
                              type="button"
                              data-idx={i}
                              role="option"
                              aria-selected={i === active}
                              onMouseEnter={() => setActive(i)}
                              onClick={() => go(item)}
                              className={cn(
                                rowClass(i),
                                "border-t border-ng-line-soft text-[13px] font-semibold text-ng-forest",
                              )}
                            >
                              <UiIcon name="search" size={16} className="shrink-0" />
                              {item.label}
                            </button>
                          );
                        }

                        const first = items.findIndex((x) => x.kind === "product");
                        return (
                          <div key={`p-${item.hit.slug}`}>
                            {i === first ? <SectionLabel>Products</SectionLabel> : null}
                            <button
                              type="button"
                              data-idx={i}
                              role="option"
                              aria-selected={i === active}
                              onMouseEnter={() => setActive(i)}
                              onClick={() => go(item)}
                              className={rowClass(i)}
                            >
                              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ng-cream">
                                <Image
                                  src={item.hit.image}
                                  alt=""
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium text-ng-forest-deep">
                                  <Highlight text={item.hit.title} term={q} />
                                </span>
                                <span className="flex items-center gap-2 text-[12px] text-ng-ink-muted">
                                  {item.hit.unit ? (
                                    <span className="truncate">{item.hit.unit}</span>
                                  ) : null}
                                  {!item.hit.inStock ? (
                                    <span className="shrink-0 font-medium text-ng-terracotta">
                                      Out of stock
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block text-[14px] font-semibold tabular-nums text-ng-forest-deep">
                                  {rupees(item.hit.price)}
                                </span>
                                {item.hit.mrp && item.hit.mrp > item.hit.price ? (
                                  <span className="block text-[11px] tabular-nums text-ng-ink-soft line-through">
                                    {rupees(item.hit.mrp)}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>

                {/* Keyboard legend. Hidden on touch, where there are no keys to
                    press and the row would just be noise. */}
                <div className="hidden items-center gap-4 border-t border-ng-line-soft px-5 py-2.5 text-[11px] text-ng-ink-soft sm:flex">
                  <span className="inline-flex items-center gap-1">
                    <Keycap>↑</Keycap>
                    <Keycap>↓</Keycap>
                    navigate
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <EnterKey />
                    open
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <EscKey />
                    close
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1">
                    <ModifierKey />
                    <Keycap>K</Keycap>
                  </span>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ng-ink-soft">
      {children}
    </div>
  );
}

