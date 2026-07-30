"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { shortCommunity } from "@/lib/community-label";
import {
  autocompleteAddress,
  isPlacesConfigured,
  newSessionToken,
  type PlaceSuggestion,
} from "@/lib/places-client";

/**
 * Search-and-assign picker for gated communities.
 *
 * Replaces a hardcoded list of Hyderabad societies, which cannot work once the
 * catalogue serves the rest of the country. Communities are looked up live
 * through Google Places (India-wide, no city bias) — the same source the
 * customer address form uses, so an operator recognises the behaviour.
 *
 * Free text is accepted too: many gated communities are not listed as places,
 * and an operator must never be blocked from assigning one that plainly exists.
 * Whatever is typed is stored verbatim, so it matches what coupon area-targeting
 * and the serviceable-areas list compare against.
 */
export function CommunityPicker({
  value,
  onChange,
  label = "Communities",
  hint = "Search and assign the communities this captain runs stalls in.",
  placeholder = "Search a community, apartment or society…",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<string>(newSessionToken());
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when focus leaves the whole control.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Debounced lookup — one request per pause, not per keystroke. All state
  // updates happen inside the timeout callback rather than in the effect body,
  // which the React Compiler rejects as a synchronous render-phase update.
  useEffect(() => {
    const q = query.trim();
    let alive = true;
    const t = setTimeout(async () => {
      if (!alive) return;
      if (!isPlacesConfigured || q.length < 3) {
        setResults([]);
        setBusy(false);
        return;
      }
      setBusy(true);
      const hits = await autocompleteAddress(q, sessionRef.current, { biasHyderabad: false });
      if (!alive) return;
      setResults(hits.slice(0, 6));
      setBusy(false);
      setOpen(true);
    }, 280);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  const add = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      // Case-insensitive de-dupe: "My Home Bhooja" and "my home bhooja" must not
      // both end up assigned, or area targeting would only match one of them.
      if (!value.some((v) => v.toLowerCase() === clean.toLowerCase())) {
        onChange([...value, clean]);
      }
      setQuery("");
      setResults([]);
      setOpen(false);
      // A new billing session per completed search, per Places session pricing.
      sessionRef.current = newSessionToken();
    },
    [value, onChange],
  );

  const remove = (name: string) => onChange(value.filter((v) => v !== name));

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted">
        {label}
      </label>

      {/* Assigned communities */}
      {value.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {value.map((c) => (
            <span
              key={c}
              title={c}
              /* max-w + truncate: a Places result is the full formatted address
                 ("SAS Crown, Golden Mile Road, Kokapet, Hyderabad, Telangana,
                 India"), which wrapped this chip onto four lines. The full
                 value stays in the title and in the saved record. */
              className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-ng-forest/25 bg-ng-forest/10 py-1.5 pl-3 pr-1.5 text-[13px] font-medium text-ng-forest-deep"
            >
              <span className="truncate whitespace-nowrap">{shortCommunity(c)}</span>
              <button
                type="button"
                onClick={() => remove(c)}
                aria-label={`Remove ${c}`}
                className="grid size-5 shrink-0 place-items-center rounded-full text-ng-forest/70 transition-colors hover:bg-ng-forest/15 hover:text-ng-forest-deep cursor-pointer"
              >
                <Icon name="close-circle-bold" size={14} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Search */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ng-ink-soft">
          <Icon name="magnifer-linear" size={16} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // Enter assigns the top match, or the raw text when nothing matched.
              add(results[0]?.text ?? query);
            }
          }}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-ng-line-soft bg-ng-paper pl-10 pr-3 text-[14px] text-ng-ink outline-none transition-colors placeholder:text-ng-ink-soft focus:border-ng-forest"
        />
        {busy ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ng-ink-soft">
            Searching…
          </span>
        ) : null}
      </div>

      {/* Suggestions */}
      {open && (results.length > 0 || query.trim().length >= 3) ? (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-ng-line bg-ng-paper shadow-[var(--shadow-ng-float)]">
          <ul className="max-h-64 overflow-y-auto">
            {results.map((r) => (
              <li key={r.placeId}>
                <button
                  type="button"
                  onClick={() => add(r.text)}
                  className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-ng-sage/40 cursor-pointer"
                >
                  <Icon name="map-point-bold" size={15} className="mt-0.5 shrink-0 text-ng-forest" />
                  <span className="text-[13.5px] leading-snug text-ng-ink">{r.text}</span>
                </button>
              </li>
            ))}
          </ul>

          {/* Always offer the typed value — not every society is on Places. */}
          {query.trim().length >= 3 ? (
            <button
              type="button"
              onClick={() => add(query)}
              className="flex w-full items-center gap-2 border-t border-ng-line-soft px-3.5 py-2.5 text-left text-[13px] font-medium text-ng-forest transition-colors hover:bg-ng-sage/40 cursor-pointer"
            >
              <Icon name="add-circle-bold" size={15} />
              Add “{query.trim()}” as typed
            </button>
          ) : null}
        </div>
      ) : null}

      <p className={cn("mt-2 text-[12px] leading-relaxed text-ng-ink-soft")}>
        {isPlacesConfigured
          ? hint
          : "Address search isn’t configured, so type the community name and press Enter."}
      </p>
    </div>
  );
}
