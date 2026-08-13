"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * SiteSearch — the header's search control, and the panel it opens.
 *
 * ── What was here before ──────────────────────────────────────────────────
 *
 * A `<button aria-label="Search">` with no `onClick`, no form and no handler.
 * It drew a magnifier and did nothing, on every page, and it was
 * `hidden xl:inline-flex`, so below 1280px there was no search control at all
 * — including on every phone, where a shopper is most likely to reach for one.
 * The `/shop` page had a working search box, but nothing anywhere pointed at it
 * and it could not be linked to with a query.
 *
 * ── Behaviour ─────────────────────────────────────────────────────────────
 *
 * Opens a panel with live product results as you type. Enter (or "See all
 * results") goes to /shop?q=…, which is now a real, shareable URL. Escape and
 * a click on the backdrop close it, and focus returns to the button that
 * opened it.
 *
 * Results are debounced by 180ms — long enough that a typed word is one request
 * rather than six, short enough to feel immediate. Each response carries the
 * query it answered, so a slow reply for "hon" can never overwrite the results
 * already shown for "honey": out-of-order responses are the classic
 * search-as-you-type bug and the guard is cheaper than an abort controller.
 *
 * ── Why the panel is portalled ────────────────────────────────────────────
 *
 * The header is sticky and carries a backdrop-filter. Both `transform` and
 * `backdrop-filter` create a containing block for `position: fixed`
 * descendants, so a fixed overlay rendered inside the header positions itself
 * against the header rather than the viewport — it would hang off the top bar
 * instead of covering the page. Portalling to `document.body` is what makes the
 * overlay actually cover the viewport.
 */

interface Hit {
  slug: string;
  title: string;
  image: string;
  price: number;
  mrp: number | null;
  unit: string | null;
  badge: string | null;
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function SiteSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const panelId = useId();

  const close = useCallback(() => {
    setOpen(false);
    // Send focus back where it came from, or a keyboard user is dropped at the
    // top of the document with no idea what just happened.
    triggerRef.current?.focus();
  }, []);

  /* Escape closes from anywhere, including while the input has focus. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
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
    if (open) inputRef.current?.focus();
  }, [open]);

  /* Debounced fetch, guarded against out-of-order responses. */
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = (await res.json()) as { query?: string; results?: Hit[] };
        // Ignore a reply for a query the user has already typed past.
        if (json.query !== q.toLowerCase()) return;
        setHits(json.results ?? []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  };

  const showEmpty = !loading && query.trim().length >= 2 && hits.length === 0;

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
        <Icon name="magnifer-linear" size={19} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Search products">
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
                <form onSubmit={submit} className="flex items-center gap-3 border-b border-ng-line-soft px-5 py-4">
                  <Icon name="magnifer-linear" size={20} className="shrink-0 text-ng-ink-muted" />
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search oils, ghee, honey…"
                    aria-label="Search products"
                    className="min-w-0 flex-1 bg-transparent text-[16px] text-ng-ink outline-none placeholder:text-ng-ink-muted/70"
                  />
                  <button
                    type="button"
                    onClick={close}
                    className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold text-ng-ink-muted transition-colors hover:bg-ng-sage/50 hover:text-ng-forest-deep"
                  >
                    Esc
                  </button>
                </form>

                <div className="max-h-[min(60vh,460px)] overflow-y-auto">
                  {query.trim().length < 2 ? (
                    <p className="px-5 py-8 text-center text-[13.5px] text-ng-ink-muted">
                      Type at least two letters to search the pantry.
                    </p>
                  ) : showEmpty ? (
                    <p className="px-5 py-8 text-center text-[13.5px] text-ng-ink-muted">
                      Nothing matched &ldquo;{query.trim()}&rdquo;. Try a category — oils, ghee or honey.
                    </p>
                  ) : (
                    <ul>
                      {hits.map((h) => (
                        <li key={h.slug}>
                          <Link
                            href={`/products/${h.slug}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ng-sage/30 focus-visible:bg-ng-sage/30 focus-visible:outline-none"
                          >
                            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ng-cream">
                              <Image src={h.image} alt="" fill sizes="48px" className="object-cover" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-medium text-ng-forest-deep">
                                {h.title}
                              </span>
                              {h.unit ? (
                                <span className="block truncate text-[12px] text-ng-ink-muted">{h.unit}</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-[14px] font-semibold tabular-nums text-ng-forest-deep">
                                {rupees(h.price)}
                              </span>
                              {h.mrp && h.mrp > h.price ? (
                                <span className="block text-[11px] tabular-nums text-ng-ink-soft line-through">
                                  {rupees(h.mrp)}
                                </span>
                              ) : null}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {query.trim().length >= 2 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const q = query.trim();
                      setOpen(false);
                      router.push(`/shop?q=${encodeURIComponent(q)}`);
                    }}
                    className="block w-full border-t border-ng-line-soft px-5 py-3.5 text-center text-[13px] font-semibold text-ng-forest transition-colors hover:bg-ng-sage/30"
                  >
                    See all results for &ldquo;{query.trim()}&rdquo; →
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
