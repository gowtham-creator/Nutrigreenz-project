/**
 * Instant loading UI for every admin route.
 *
 * Without a loading boundary a navigation inside the portal had nothing to
 * paint: the browser stayed on the previous page while the server resolved the
 * session and the page's guard, so clicking a nav item felt like nothing had
 * happened. This paints the moment a link is clicked.
 *
 * It also has a second, less obvious effect. Admin routes are dynamic
 * (cookie-gated), and Next only prefetches a dynamic route up to its nearest
 * loading boundary. With no boundary there was nothing to prefetch at all;
 * with one, hovering a nav item warms the route.
 *
 * The shape deliberately mirrors AdminShell — sidebar rail, header, content
 * cards — so the transition is a fill-in rather than a flash of a different
 * layout.
 */
export default function AdminLoading() {
  return (
    <div className="flex min-h-screen animate-pulse bg-ng-cream" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Sidebar rail */}
      <div className="hidden w-[248px] shrink-0 border-r border-ng-line-soft bg-ng-paper p-4 lg:block">
        <div className="mb-6 h-8 w-32 rounded-lg bg-ng-sage/40" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="mb-2 h-9 rounded-xl bg-ng-sage/25" />
        ))}
      </div>

      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ng-line-soft px-6 py-4">
          <div>
            <div className="h-6 w-44 rounded-lg bg-ng-sage/40" />
            <div className="mt-2 h-3.5 w-64 rounded bg-ng-sage/25" />
          </div>
          <div className="h-9 w-9 rounded-full bg-ng-sage/40" />
        </div>

        {/* Content */}
        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl border border-ng-line-soft bg-ng-paper" />
            ))}
          </div>
          <div className="h-72 rounded-2xl border border-ng-line-soft bg-ng-paper" />
        </div>
      </div>
    </div>
  );
}
