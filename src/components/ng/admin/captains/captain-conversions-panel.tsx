"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/ng/admin/admin-shell";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { ConversionReport, ConversionStatus } from "@/lib/captain-conversions";

/**
 * Offline-to-online conversions, for one captain or everyone.
 *
 * A captain's customer counts as converted when they place an online order
 * after the captain first met them, at a stall sale or by being registered
 * here. The first captain to meet someone keeps the credit, and someone who
 * already shopped online is shown but never counted, so the figures hold up
 * when commission is paid on them.
 */

const STATUS: Record<ConversionStatus, { label: string; tone: "success" | "neutral" | "warn" }> = {
  converted: { label: "Converted", tone: "success" },
  "not-yet": { label: "Not yet online", tone: "neutral" },
  "already-online": { label: "Already online", tone: "warn" },
};

const ERRORS: Record<string, string> = {
  "invalid-mobile": "Enter a valid 10-digit mobile number.",
  "captain-unavailable": "Choose a captain.",
  "setup-pending": "Registering needs the new database table. Run the SQL first.",
};

function inr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

const FIELD =
  "h-11 w-full rounded-xl border border-ng-line bg-ng-paper px-3 text-[14px] text-ng-ink outline-none focus:border-ng-forest";

export function CaptainConversionsPanel({
  captainId,
  captains = [],
}: {
  captainId?: string;
  captains?: { id: string; name: string }[];
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ key: string; report: ConversionReport | null } | null>(null);
  const [filter, setFilter] = useState<ConversionStatus | "all">("all");
  const [form, setForm] = useState({ captainId: captainId ?? "", mobile: "", name: "" });
  const [saving, setSaving] = useState(false);
  const key = `${captainId ?? ""}#${reloadKey}`;

  useEffect(() => {
    let alive = true;
    const q = captainId ? `?captainId=${encodeURIComponent(captainId)}` : "";
    void fetch(`/api/admin/captains/conversions${q}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { report?: ConversionReport } | null) => {
        if (alive) setResult({ key, report: j?.report ?? null });
      })
      .catch(() => {
        if (alive) setResult({ key, report: null });
      });
    return () => {
      alive = false;
    };
  }, [captainId, key]);

  const report = result?.report ?? null;
  const loading = result?.key !== key;
  const names = new Map(captains.map((c) => [c.id, c.name]));
  const rows = (report?.customers ?? []).filter((c) => filter === "all" || c.status === filter);

  async function register() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/captains/conversions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; captainName?: string };
      if (!res.ok || !data.ok) {
        toast.error("Customer not registered", {
          description:
            data.error === "already-registered"
              ? `This mobile is already registered${data.captainName ? ` to ${data.captainName}` : ""}.`
              : ERRORS[data.error ?? ""] ?? "Couldn't save it. Try again.",
        });
        return;
      }
      toast.success("Customer registered", {
        description: "When they buy online with this mobile, it counts as this captain's conversion.",
      });
      setForm((f) => ({ ...f, mobile: "", name: "" }));
      setReloadKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  const o = report?.overall;
  return (
    <div className="space-y-5" aria-busy={loading}>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label="Offline customers" value={o ? o.offlineCustomers.toLocaleString("en-IN") : "…"} />
        <Tile label="Converted" value={o ? o.converted.toLocaleString("en-IN") : "…"} strong />
        <Tile label="Conversion rate" value={o ? `${Math.round(o.rate * 100)}%` : "…"} />
        <Tile label="Online sales from them" value={o ? inr(o.onlinePaise) : "…"} />
        <Tile label="Typical days to convert" value={o ? (o.medianDaysToConvert ?? "–").toString() : "…"} />
      </div>
      {o && o.alreadyOnline > 0 ? (
        <p className="text-[13px] text-ng-ink-muted">
          {o.alreadyOnline} already shopped online before a captain met them, so they are not counted as conversions.
        </p>
      ) : null}

      {!captainId && report && report.captains.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-ng-line-soft bg-ng-paper">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead>
              <tr className="text-left text-[12px] font-semibold text-ng-ink-muted">
                <th className="px-4 py-3">Captain</th>
                <th className="px-4 py-3 text-right">Offline customers</th>
                <th className="px-4 py-3 text-right">Converted</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Online sales</th>
              </tr>
            </thead>
            <tbody>
              {report.captains.map((c) => (
                <tr key={c.captainId} className="border-t border-ng-line-soft">
                  <td className="px-4 py-3 font-semibold text-ng-ink">{c.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.offlineCustomers}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-ng-forest-deep">{c.converted}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Math.round(c.rate * 100)}%</td>
                  <td className="px-4 py-3 text-right tabular-nums">{inr(c.onlinePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Register an offline customer */}
      <div className="rounded-2xl border border-ng-line-soft bg-ng-cream/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ng-forest-deep">
          <Icon name="user-plus-bold" size={17} className="text-ng-forest" />
          Register an offline customer
        </div>
        <div className={cn("grid gap-3", captainId ? "sm:grid-cols-[1fr_1fr_auto]" : "sm:grid-cols-[1fr_1fr_1fr_auto]")}>
          {!captainId ? (
            <select
              aria-label="Introduced by captain"
              value={form.captainId}
              onChange={(e) => setForm((f) => ({ ...f, captainId: e.target.value }))}
              className={FIELD}
            >
              <option value="">Introduced by captain…</option>
              {captains.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
          <input
            aria-label="Customer mobile"
            inputMode="numeric"
            placeholder="Mobile number"
            value={form.mobile}
            onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
            className={FIELD}
          />
          <input
            aria-label="Customer name"
            placeholder="Name (optional)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={FIELD}
          />
          <button
            type="button"
            disabled={saving || !form.mobile || !form.captainId}
            onClick={() => void register()}
            className="h-11 rounded-full bg-ng-forest-deep px-5 text-[14px] font-semibold text-ng-cream hover:bg-ng-forest transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving…" : "Register"}
          </button>
        </div>
        <p className="mt-2 text-[12.5px] text-ng-ink-muted">
          Stall sales are tracked automatically. Use this for someone a captain brought in without a sale.
        </p>
      </div>

      {/* Customers */}
      <div>
        <div role="group" aria-label="Filter customers" className="mb-3 flex flex-wrap gap-2">
          {(["all", "converted", "not-yet", "already-online"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "min-h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors cursor-pointer",
                filter === f
                  ? "border-ng-forest bg-ng-forest text-ng-cream"
                  : "border-ng-line bg-ng-paper text-ng-ink hover:border-ng-leaf",
              )}
            >
              {f === "all" ? "All" : STATUS[f].label}
            </button>
          ))}
        </div>
        {report === null && !loading ? (
          <p className="rounded-2xl border border-ng-danger/40 bg-ng-danger/5 p-4 text-[14px] text-ng-danger">
            Conversions didn&rsquo;t load.{" "}
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline cursor-pointer">
              Try again
            </button>
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ng-line-soft px-4 py-5 text-center text-[14px] text-ng-ink-muted">
            {loading ? "Loading…" : "No customers here yet."}
          </p>
        ) : (
          <ul className="divide-y divide-ng-line-soft rounded-2xl border border-ng-line-soft bg-ng-paper">
            {rows.map((c) => (
              <li key={c.mobile} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-ng-ink">{c.name || "Customer"}</span>
                    <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>
                  </div>
                  <div className="mt-0.5 text-[13.5px] text-ng-ink-muted">
                    {c.mobile}
                    {!captainId ? ` · ${names.get(c.captainId) ?? "Captain"}` : ""} ·{" "}
                    {c.via === "sale" ? "first bought at the stall" : "registered"} {day(c.firstTouchAt)}
                  </div>
                  {c.status === "already-online" ? (
                    <div className="mt-0.5 text-[13.5px] text-ng-ink-muted">
                      Was already shopping online before this captain met them, so not counted.
                    </div>
                  ) : c.firstOnlineAt ? (
                    <div className="mt-0.5 text-[13.5px] text-ng-forest-deep">
                      First online order {c.firstOnlineOrder} on {day(c.firstOnlineAt)}
                      {c.daysToConvert !== null ? ` (${c.daysToConvert} days later)` : ""}
                    </div>
                  ) : null}
                </div>
                <div className="text-right text-[14px] tabular-nums">
                  {c.onlineOrders > 0 ? (
                    <>
                      <div className="font-semibold text-ng-forest-deep">{inr(c.onlinePaise)}</div>
                      <div className="text-[12.5px] text-ng-ink-muted">
                        {c.onlineOrders} online order{c.onlineOrders === 1 ? "" : "s"}
                      </div>
                    </>
                  ) : (
                    <div className="text-[12.5px] text-ng-ink-muted">
                      {c.offlineSales} stall sale{c.offlineSales === 1 ? "" : "s"}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", strong ? "border-ng-leaf bg-ng-sage/30" : "border-ng-line-soft bg-ng-paper")}>
      <div className="text-[13px] font-semibold text-ng-ink-muted">{label}</div>
      <div className="mt-1.5 font-display text-[26px] leading-none tabular-nums text-ng-forest-deep">{value}</div>
    </div>
  );
}
