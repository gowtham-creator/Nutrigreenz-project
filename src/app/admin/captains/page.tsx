"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { shortCommunity } from "@/lib/community-label";
import { AdminShell, Card, Pill, StatTile } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { UiIcon } from "@/components/ui/ui-icon";
import { CaptainAllocationModal } from "@/components/ng/admin/captain-allocation-modal";
import { CaptainModal, Switch, type CaptainDraft } from "./captain-modal";
import type {
  Captain,
  CaptainCapture,
  CaptainCaptureItem,
  CaptainSettlement,
  CaptainStats,
  CaptainWithStats,
} from "@/types/nutrigreenz";

/**
 * Admin · Captains — the field-sales roster.
 *
 * One row per captain (from `/api/admin/captains`), each carrying today's stall
 * figures. Admins add / edit captains, flip them active, and drill into a
 * captain's recent captures + end-of-day settlements. Money is INTEGER PAISE
 * end-to-end and only ever formatted to INR at render.
 *
 * The roster may be empty (a freshly-migrated or unconfigured DB) — that is a
 * friendly empty state, not an error.
 */

interface CaptainListResponse {
  ok: boolean;
  captains: CaptainWithStats[];
}

interface CaptainDetailResponse {
  ok: boolean;
  captain: Captain;
  captures: CaptainCapture[];
  settlements: CaptainSettlement[];
  todayStats: CaptainStats;
}

/** API codes the modal surfaces inline — these must NOT also fire a toast. */
const INLINE_ERRORS = new Set(["name_required", "invalid_phone", "invalid_commission", "phone_taken"]);

const GRID = "grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.5fr)]";

/** INTEGER PAISE → the admin's INR string (rupee-rounded, en-IN grouped). */
function inr(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

/** 1–2 letter avatar monogram from a captain's name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDay(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "3 items · Spinach, Kale +2" — a compact one-line summary of a capture. */
function itemsSummary(items: CaptainCaptureItem[]): string {
  if (items.length === 0) return "No items";
  const qty = items.reduce((n, i) => n + (Number(i.qty) || 0), 0);
  const titles = items.map((i) => i.title).filter(Boolean).slice(0, 3).join(", ");
  const more = items.length > 3 ? ` +${items.length - 3}` : "";
  return `${qty} item${qty === 1 ? "" : "s"}${titles ? ` · ${titles}${more}` : ""}`;
}

async function sendJson<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error || "request-failed");
  return data;
}

function draftToPayload(draft: CaptainDraft) {
  const commission = draft.commissionPercent.trim();
  return {
    name: draft.name.trim(),
    phone: draft.phone.replace(/\D/g, ""),
    area: draft.area.trim() || null,
    stall: draft.stall.trim() || null,
    communities: draft.communities,
    commissionPercent: commission === "" ? 0 : Number(commission),
    active: draft.active,
  };
}

function payTone(mode: CaptainCapture["payMode"]): "info" | "success" {
  return mode === "upi" ? "success" : "info";
}

export default function AdminCaptains() {
  const [captains, setCaptains] = useState<CaptainWithStats[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Captain | null>(null);
  /* Which captain we are allocating stall products to, if any. */
  const [allocating, setAllocating] = useState<Captain | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaptainDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/captains", { cache: "no-store" });
      if (!res.ok) throw new Error("request-failed");
      const json = (await res.json()) as CaptainListResponse;
      setCaptains(json.captains ?? []);
    } catch {
      setError(true);
      setCaptains(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = captains ?? [];

  const stats = useMemo(() => {
    let active = 0;
    let gmvPaise = 0;
    let captures = 0;
    for (const c of rows) {
      if (c.active) active += 1;
      gmvPaise += c.todayStats.gmvPaise;
      captures += c.todayStats.count;
    }
    return { total: rows.length, active, gmvPaise, captures };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) => {
      const haystack = [c.name, c.phone, c.area ?? "", c.stall ?? "", ...c.communities]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search]);

  function openAdd() {
    setEditing(null);
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(c: Captain) {
    setEditing(c);
    setSaveError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setSaveError(null);
  }

  const saveCaptain = useCallback(
    async (draft: CaptainDraft) => {
      setSaving(true);
      setSaveError(null);
      const payload = draftToPayload(draft);
      try {
        if (editing) {
          await sendJson(`/api/admin/captains/${editing.id}`, "PATCH", payload);
          toast.success("Captain updated", { description: payload.name });
        } else {
          await sendJson("/api/admin/captains", "POST", payload);
          toast.success("Captain added", { description: payload.name });
        }
        setModalOpen(false);
        setEditing(null);
        await load();
      } catch (err) {
        const code = err instanceof Error ? err.message : "request-failed";
        setSaveError(code);
        if (!INLINE_ERRORS.has(code)) {
          toast.error("Could not save captain", { description: "Please try again." });
        }
      } finally {
        setSaving(false);
      }
    },
    [editing, load],
  );

  const deleteCaptain = useCallback(
    async (c: Captain) => {
      try {
        await sendJson(`/api/admin/captains/${c.id}`, "DELETE", {});
        toast.success("Captain removed", { description: c.name });
        setModalOpen(false);
        setEditing(null);
        if (selectedId === c.id) closeDetail();
        await load();
      } catch {
        toast.error("Could not remove captain", { description: "Please try again." });
      }
    },
    [load, selectedId],
  );

  const toggleActive = useCallback(async (c: CaptainWithStats, next: boolean) => {
    setTogglingId(c.id);
    // Optimistic flip — revert on failure.
    setCaptains((prev) => (prev ? prev.map((x) => (x.id === c.id ? { ...x, active: next } : x)) : prev));
    try {
      await sendJson(`/api/admin/captains/${c.id}`, "PATCH", { active: next });
    } catch {
      setCaptains((prev) =>
        prev ? prev.map((x) => (x.id === c.id ? { ...x, active: !next } : x)) : prev,
      );
      toast.error("Could not update captain", { description: "Please try again." });
    } finally {
      setTogglingId(null);
    }
  }, []);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/captains/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("detail-failed");
      const json = (await res.json()) as CaptainDetailResponse;
      setDetail(json);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  return (
    <AdminShell
      active="/admin/captains"
      title={
        <span>
          Captains <em className="italic text-ng-clay font-display">roster</em>
        </span>
      }
      subtitle="Field-sales captains: their communities, commission, and today's stall sales"
      actions={
        <>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-4 py-2 text-[12.5px] hover:bg-ng-paper transition-colors cursor-pointer"
          >
            <Icon name="refresh-bold" size={15} className="text-ng-forest" />
            Refresh
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
          >
            <Icon name="add-circle-bold" size={15} />
            Add captain
          </button>
        </>
      }
    >
      {/* Roster + today's field snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Captains" value={stats.total.toLocaleString("en-IN")} />
        <StatTile label="Active" value={stats.active.toLocaleString("en-IN")} />
        <StatTile label="GMV today" value={inr(stats.gmvPaise)} />
        <StatTile label="Captures today" value={stats.captures.toLocaleString("en-IN")} />
      </div>

      <Card
        title="Roster"
        action={
          <label className="relative flex items-center">
            <UiIcon
              name="search"
              size={15}
              className="absolute left-3 text-ng-ink-muted pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, area or community"
              className="w-72 max-w-[60vw] rounded-full border border-ng-line bg-ng-cream pl-9 pr-3 py-2 text-[12.5px] font-medium text-ng-ink placeholder:text-ng-ink-muted focus:outline-none focus:border-ng-leaf transition-colors"
            />
          </label>
        }
        className="!p-0 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <div className="min-w-[940px]">
            <div
              className={cn(
                "grid gap-4 px-6 py-3 bg-ng-cream border-b border-ng-line-soft text-[11px] uppercase tracking-wider text-ng-ink-muted font-semibold",
                GRID,
              )}
            >
              <span>Captain</span>
              <span>Area</span>
              <span>Communities</span>
              <span className="text-right">Comm</span>
              <span className="text-right">GMV today</span>
              <span className="text-right">Captures</span>
              <span className="text-center">Active</span>
              <span></span>
            </div>

            {loading ? (
              <ul>
                {Array.from({ length: 5 }).map((_, i) => (
                  <li
                    key={i}
                    className={cn(
                      "grid gap-4 px-6 py-4 items-center border-b border-ng-line-soft last:border-0",
                      GRID,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-ng-line-soft animate-pulse shrink-0" />
                      <div className="h-3.5 w-28 rounded bg-ng-line-soft animate-pulse" />
                    </div>
                    <div className="h-3 w-20 rounded bg-ng-line-soft animate-pulse" />
                    <div className="h-5 w-28 rounded-full bg-ng-line-soft animate-pulse" />
                    <div className="h-3 w-8 rounded bg-ng-line-soft animate-pulse ml-auto" />
                    <div className="h-3 w-16 rounded bg-ng-line-soft animate-pulse ml-auto" />
                    <div className="h-3 w-8 rounded bg-ng-line-soft animate-pulse ml-auto" />
                    <div className="h-6 w-11 rounded-full bg-ng-line-soft animate-pulse mx-auto" />
                    <div />
                  </li>
                ))}
              </ul>
            ) : error ? (
              <div className="px-6 py-16 text-center">
                <UiIcon name="caution" size={28} className="text-ng-terracotta mx-auto" />
                <p className="mt-3 text-[14px] font-semibold text-ng-ink">Couldn&apos;t load captains</p>
                <p className="mt-1 text-[12.5px] font-medium text-ng-ink-muted">
                  Please try again in a moment.
                </p>
                <button
                  onClick={() => void load()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
                >
                  <Icon name="refresh-bold" size={14} />
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="size-14 rounded-full bg-ng-cream flex items-center justify-center mx-auto">
                  <UiIcon name="location" size={26} className="text-ng-forest" />
                </div>
                <p className="mt-4 text-[15px] font-display text-ng-forest-deep">
                  {search ? "No captains match that search" : "No captains yet"}
                </p>
                <p className="mt-1.5 text-[12.5px] font-medium text-ng-ink-muted max-w-md mx-auto leading-relaxed">
                  {search
                    ? "Try a different name, phone, area or community."
                    : "Add your first field-sales captain to start capturing community stall sales."}
                </p>
                {!search ? (
                  <button
                    onClick={openAdd}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep text-ng-cream font-semibold px-4 py-2 text-[12.5px] hover:bg-ng-forest transition-colors cursor-pointer"
                  >
                    <Icon name="add-circle-bold" size={14} />
                    Add captain
                  </button>
                ) : null}
              </div>
            ) : (
              <ul>
                {filtered.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "grid gap-4 px-6 py-3.5 items-center text-[13px] border-b border-ng-line-soft last:border-0 hover:bg-ng-cream/40 transition-colors",
                      GRID,
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-full bg-ng-sage text-ng-forest-deep flex items-center justify-center font-display text-[14px] shrink-0">
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-ng-ink truncate">{c.name}</div>
                        <div className="font-mono text-[11.5px] tabular-nums font-medium text-ng-ink-soft">
                          {c.phone}
                        </div>
                      </div>
                    </div>
                    <span className="text-[12.5px] font-medium text-ng-ink-muted truncate">
                      {c.area || "—"}
                    </span>
                    <CommunityCell communities={c.communities} />
                    <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep text-right">
                      {c.commissionPercent}%
                    </span>
                    <span className="font-mono text-[12.5px] tabular-nums font-semibold text-ng-forest-deep text-right">
                      {inr(c.todayStats.gmvPaise)}
                    </span>
                    <span className="font-mono text-[12.5px] tabular-nums font-medium text-ng-ink text-right">
                      {c.todayStats.count}
                    </span>
                    <div className="flex justify-center">
                      <Switch
                        checked={c.active}
                        disabled={togglingId === c.id}
                        onChange={(next) => void toggleActive(c, next)}
                        label={`${c.active ? "Deactivate" : "Activate"} ${c.name}`}
                      />
                    </div>
                    <button
                      onClick={() => void openDetail(c.id)}
                      className="text-[12px] text-ng-forest font-bold hover:text-ng-leaf transition-colors cursor-pointer text-right"
                    >
                      View →
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <CaptainModal
        open={modalOpen}
        captain={editing}
        saving={saving}
        error={saveError}
        onClose={closeModal}
        onSave={saveCaptain}
        onDelete={deleteCaptain}
      />

      {selectedId ? (
        <CaptainDrawer
          loading={detailLoading}
          detail={detail}
          onClose={closeDetail}
          onAllocate={(c) => setAllocating(c)}
          onEdit={(c) => {
            closeDetail();
            openEdit(c);
          }}
        />
      ) : null}
      {allocating ? (
        <CaptainAllocationModal
          captainId={allocating.id}
          captainName={allocating.name}
          onClose={() => setAllocating(null)}
        />
      ) : null}
    </AdminShell>
  );
}

/* ── Table cell ─────────────────────────────────────────────────────────── */

/**
 * One assigned community.
 *
 * Deliberately NOT the generic <Pill>: Pill is uppercase, 11px and wraps, which
 * turned a 65-character Places address into a four-line block. This is a single
 * line that truncates, sentence-case (uppercase makes an address both wider and
 * harder to read), with the full stored value on hover.
 */
function CommunityChip({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex max-w-[220px] items-center gap-1.5 truncate whitespace-nowrap rounded-full",
        "bg-ng-forest/12 px-2.5 py-1 text-[11.5px] font-semibold text-ng-forest",
        className,
      )}
    >
      <UiIcon name="location" size={12} className="shrink-0 opacity-70" />
      <span className="truncate">{shortCommunity(name)}</span>
    </span>
  );
}

function CommunityCell({ communities }: { communities: string[] }) {
  if (communities.length === 0) {
    return <span className="text-[12px] font-medium text-ng-ink-muted">—</span>;
  }
  // One chip in the table row — the row has no height to spare, and the drawer
  // lists them all in full.
  const [first, ...rest] = communities;
  return (
    <span className="flex items-center gap-1.5">
      <CommunityChip name={first} className="max-w-[180px]" />
      {rest.length > 0 ? (
        <span
          title={rest.join("\n")}
          className="shrink-0 text-[11.5px] font-semibold text-ng-ink-muted"
        >
          +{rest.length}
        </span>
      ) : null}
    </span>
  );
}

/* ── Detail drawer ──────────────────────────────────────────────────────── */

function CaptainDrawer({
  loading,
  detail,
  onClose,
  onEdit,
  onAllocate,
}: {
  loading: boolean;
  detail: CaptainDetailResponse | null;
  onClose: () => void;
  onEdit: (captain: Captain) => void;
  onAllocate: (captain: Captain) => void;
}) {
  const c = detail?.captain ?? null;
  const today = detail?.todayStats ?? null;
  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ng-forest-deep/30 backdrop-blur-sm cursor-pointer"
      />
      <aside className="relative w-full max-w-md h-full bg-ng-cream border-l border-ng-line-soft overflow-y-auto shadow-2xl">
        <header className="sticky top-0 z-10 bg-ng-cream/90 backdrop-blur border-b border-ng-line-soft px-6 py-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-[18px] text-ng-forest-deep">Captain detail</h2>
          <div className="flex items-center gap-1.5">
            {c ? (
              <button
                onClick={() => onAllocate(c)}
                className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-3 py-1.5 text-[12px] hover:bg-ng-paper transition-colors cursor-pointer"
              >
                <UiIcon name="bag" size={13} className="text-ng-forest" />
                Products
              </button>
            ) : null}
            {c ? (
              <button
                onClick={() => onEdit(c)}
                className="inline-flex items-center gap-1.5 rounded-full border border-ng-line text-ng-ink font-medium px-3 py-1.5 text-[12px] hover:bg-ng-paper transition-colors cursor-pointer"
              >
                <Icon name="pen-2-bold" size={13} className="text-ng-forest" />
                Edit
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="text-ng-ink-muted hover:text-ng-forest transition-colors cursor-pointer"
              aria-label="Close detail"
            >
              <Icon name="close-circle-bold" size={22} />
            </button>
          </div>
        </header>

        <div className="px-6 py-6 space-y-6">
          {loading ? (
            <div className="space-y-3">
              <div className="h-14 w-14 rounded-full bg-ng-line-soft animate-pulse" />
              <div className="h-4 w-40 rounded bg-ng-line-soft animate-pulse" />
              <div className="h-3 w-56 rounded bg-ng-line-soft animate-pulse" />
            </div>
          ) : !c ? (
            <div className="text-center py-10">
              <UiIcon name="caution" size={26} className="text-ng-terracotta mx-auto" />
              <p className="mt-3 text-[13px] font-medium text-ng-ink-muted">
                This captain could not be loaded.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-full bg-ng-sage text-ng-forest-deep flex items-center justify-center font-display text-[22px] shrink-0">
                  {initials(c.name)}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-[18px] text-ng-forest-deep truncate">{c.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-[12.5px] tabular-nums font-medium text-ng-ink-muted">
                      {c.phone}
                    </span>
                    <Pill tone={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Inactive"}</Pill>
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <Field icon="map-point-bold" label="Area" value={c.area} />
                <Field icon="shop-bold" label="Stall" value={c.stall} />
                <Field icon="tag-price-bold" label="Commission" value={`${c.commissionPercent}%`} />
                <Field icon="calendar-bold" label="Joined" value={fmtDay(c.createdAt)} />
              </dl>

              {today ? (
                <div className="grid grid-cols-3 gap-2">
                  <Mini label="Captures" value={String(today.count)} />
                  <Mini label="GMV" value={inr(today.gmvPaise)} />
                  <Mini label="Cash / UPI" value={`${inr(today.cashPaise)} / ${inr(today.upiPaise)}`} />
                </div>
              ) : null}

              <Section icon="map-point-wave-bold" title="Communities">
                {c.communities.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {c.communities.map((name) => (
                      <CommunityChip key={name} name={name} />
                    ))}
                  </div>
                ) : (
                  <EmptyLine>No communities assigned.</EmptyLine>
                )}
              </Section>

              <Section
                icon="cart-large-2-bold"
                title={`Recent captures (${detail?.captures.length ?? 0})`}
              >
                {detail && detail.captures.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.captures.map((cap) => (
                      <li key={cap.id} className="rounded-xl border border-ng-line-soft bg-ng-paper p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-ng-ink truncate">
                                {cap.customerName || "Walk-up customer"}
                              </span>
                              <Pill tone={payTone(cap.payMode)}>{cap.payMode}</Pill>
                            </div>
                            <div className="mt-0.5 font-mono text-[11.5px] tabular-nums font-medium text-ng-ink-muted">
                              {cap.customerMobile || "—"}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono text-[13px] tabular-nums font-semibold text-ng-forest-deep">
                              {inr(cap.totalPaise)}
                            </div>
                            <div className="text-[11px] font-medium text-ng-ink-soft">
                              {fmtDateTime(cap.capturedAt)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 border-t border-ng-line-soft/60 pt-2">
                          <span className="text-[11.5px] font-medium text-ng-ink-muted truncate">
                            {itemsSummary(cap.items)}
                          </span>
                          {cap.linkedCustomerId ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-ng-success shrink-0">
                              <Icon name="link-round-bold" size={12} />
                              Linked
                            </span>
                          ) : (
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-ng-ink-soft shrink-0">
                              Guest
                            </span>
                          )}
                        </div>
                        {cap.community ? (
                          <div className="mt-1.5 text-[11px] font-medium text-ng-ink-soft">
                            {cap.community}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No captures recorded yet.</EmptyLine>
                )}
              </Section>

              <Section
                icon="wallet-money-bold"
                title={`Recent settlements (${detail?.settlements.length ?? 0})`}
              >
                {detail && detail.settlements.length > 0 ? (
                  <ul className="space-y-2">
                    {detail.settlements.map((s) => (
                      <li key={s.id} className="rounded-xl border border-ng-line-soft bg-ng-paper p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[12.5px] font-semibold text-ng-ink">
                            {fmtDay(s.settleDate)}
                          </span>
                          <VarianceValue paise={s.variancePaise} />
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-ng-line-soft/60 pt-2">
                          <MiniRow label="Expected GMV" value={inr(s.expectedGmvPaise)} />
                          <MiniRow label="Commission" value={inr(s.commissionPaise)} />
                          <MiniRow label="Cash expected" value={inr(s.cashExpectedPaise)} />
                          <MiniRow label="Cash counted" value={inr(s.cashCountedPaise)} />
                          <MiniRow label="UPI expected" value={inr(s.upiExpectedPaise)} />
                          <MiniRow label="Submitted" value={fmtDateTime(s.submittedAt)} />
                        </dl>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No settlements submitted yet.</EmptyLine>
                )}
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function VarianceValue({ paise }: { paise: number }) {
  if (paise === 0) {
    return (
      <span className="font-mono tabular-nums text-[12px] font-semibold text-ng-ink-muted">
        Balanced
      </span>
    );
  }
  const short = paise < 0;
  return (
    <span
      className={cn(
        "font-mono tabular-nums text-[12px] font-semibold",
        short ? "text-ng-terracotta" : "text-ng-success",
      )}
    >
      {short ? "−" : "+"}
      {inr(Math.abs(paise))} {short ? "short" : "over"}
    </span>
  );
}

function Field({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-ng-line-soft bg-ng-paper p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ng-ink-muted">
        <Icon name={icon} size={13} className="text-ng-forest" />
        {label}
      </div>
      <div className="mt-1 text-[13px] font-semibold text-ng-ink truncate">{value || "—"}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ng-line-soft bg-ng-paper p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ng-ink-muted">{label}</div>
      <div className="mt-1 font-mono text-[13px] tabular-nums font-semibold text-ng-forest-deep truncate">
        {value}
      </div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-ng-ink-muted">{label}</span>
      <span className="font-mono text-[11.5px] tabular-nums font-semibold text-ng-ink">{value}</span>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-ng-ink-muted mb-2.5">
        <Icon name={icon} size={15} className="text-ng-forest" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium text-ng-ink-muted rounded-xl border border-dashed border-ng-line-soft px-3 py-3">
      {children}
    </p>
  );
}
