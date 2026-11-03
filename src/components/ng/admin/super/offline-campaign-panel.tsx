"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ng/admin/admin-shell";
import { shortCommunity } from "@/lib/community-label";
import { cn } from "@/lib/utils";
import type { Frequency, Schedule } from "@/lib/offline-campaigns";

/**
 * Send this coupon by SMS to offline customers: people who bought at a captain's
 * stall or were registered as a captain's customer. One send, or a repeat every
 * week, fortnight or month until the coupon ends, so stall customers keep
 * hearing about it.
 */

const REPEAT: { key: Frequency; label: string }[] = [
  { key: "once", label: "Once" },
  { key: "weekly", label: "Every week" },
  { key: "fortnightly", label: "Every 2 weeks" },
  { key: "monthly", label: "Every month" },
];

const BLOCKED: Record<string, string> = {
  "sms-provider-not-configured": "SMS isn't set up yet (MSG91 keys missing in Vercel).",
  "no-promotional-dlt-template":
    "Promotional SMS needs a DLT-registered promotional template. Register it in MSG91 and set MSG91_PROMO_TEMPLATE_ID in Vercel.",
  "setup-pending": "Run the offline campaigns SQL first.",
};

const FIELD =
  "h-11 w-full rounded-xl border border-ng-line bg-ng-paper px-3 text-[14px] text-ng-ink outline-none focus:border-ng-forest";

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function OfflineCampaignPanel({
  code,
  vars,
  endsOn,
}: {
  code: string;
  vars: Record<string, string>;
  /** The coupon's last day (IST, YYYY-MM-DD): repeats stop after it. */
  endsOn: string;
}) {
  const [captains, setCaptains] = useState<{ id: string; name: string; communities: string[] }[]>([]);
  const [captainId, setCaptainId] = useState("");
  const [community, setCommunity] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [info, setInfo] = useState<{ audience: number; blocked: string | null; schedules: Schedule[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [optOut, setOptOut] = useState("");

  useEffect(() => {
    let alive = true;
    void fetch("/api/admin/captains", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { captains?: { id: string; name: string; communities: string[] }[] } | null) => {
        if (alive) setCaptains(j?.captains ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams();
    if (captainId) q.set("captainId", captainId);
    if (community) q.set("community", community);
    void fetch(`/api/admin/marketing/offline-campaign?${q}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          audience?: number;
          blocked?: string | null;
          schedules?: Schedule[];
        };
        if (!alive) return;
        if (j.ok) {
          setInfo({ audience: j.audience ?? 0, blocked: j.blocked ?? null, schedules: j.schedules ?? [] });
          setError(null);
        } else setError(j.error ?? "unavailable");
      })
      .catch(() => alive && setError("unavailable"));
    return () => {
      alive = false;
    };
  }, [captainId, community, reloadKey]);

  const communities = useMemo(() => {
    const list = captainId ? captains.filter((c) => c.id === captainId) : captains;
    return [...new Set(list.flatMap((c) => c.communities))].sort((a, b) => a.localeCompare(b));
  }, [captains, captainId]);
  const mine = (info?.schedules ?? []).filter((s) => s.campaignKey === code);

  async function start() {
    setSending(true);
    try {
      const res = await fetch("/api/admin/marketing/offline-campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignKey: code, vars, audience: { captainId, community }, frequency, endsOn }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        result?: { audience: number; sent: number; failed: number };
      };
      if (!res.ok || !j.ok || !j.result) {
        toast.error("Campaign not started", {
          description:
            BLOCKED[j.error ?? ""] ??
            (j.error === "end-date-required" ? "Set the coupon's end date first, so the repeats know when to stop." : "Nothing was sent. Try again."),
        });
        return;
      }
      const r = j.result;
      toast.success(r.sent > 0 ? `Sent to ${r.sent} offline customers` : "Campaign started", {
        description:
          (frequency === "once" ? "" : `It repeats ${REPEAT.find((x) => x.key === frequency)?.label.toLowerCase()} until the coupon ends. `) +
          (r.failed ? `${r.failed} failed.` : ""),
      });
      setReloadKey((k) => k + 1);
    } finally {
      setSending(false);
    }
  }

  async function stop(id: string) {
    const res = await fetch(`/api/admin/marketing/offline-campaign/${id}`, { method: "PATCH" });
    if (res.ok) {
      toast.success("Repeats stopped");
      setReloadKey((k) => k + 1);
    } else toast.error("Couldn't stop it. Try again.");
  }

  async function addOptOut() {
    const res = await fetch("/api/admin/marketing/offline-optouts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mobile: optOut }),
    });
    if (res.ok) {
      toast.success("That number won't be messaged again");
      setOptOut("");
      setReloadKey((k) => k + 1);
    } else toast.error("Enter a valid 10-digit mobile number.");
  }

  const blocked = error ?? info?.blocked ?? null;
  return (
    <div className="mt-5 pt-5 border-t border-ng-clay/20">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="smartphone-bold" size={15} className="text-ng-clay-deep" />
        <span className="text-[12.5px] font-semibold text-ng-ink-muted">SMS to offline customers</span>
      </div>
      <p className="mb-3 text-[12.5px] text-ng-ink-soft">
        People who bought at a captain&rsquo;s stall or were registered as a captain&rsquo;s customer.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <select aria-label="Captain" value={captainId} onChange={(e) => { setCaptainId(e.target.value); setCommunity(""); }} className={FIELD}>
          <option value="">All captains</option>
          {captains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Community" value={community} onChange={(e) => setCommunity(e.target.value)} className={FIELD}>
          <option value="">All communities</option>
          {communities.map((c) => (
            <option key={c} value={c}>
              {shortCommunity(c)}
            </option>
          ))}
        </select>
        <select aria-label="Repeat" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={FIELD}>
          {REPEAT.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ng-ink">
          {info ? (
            <>
              Reaches <strong className="font-semibold">{info.audience}</strong> offline customer{info.audience === 1 ? "" : "s"}
              {frequency !== "once" && endsOn ? `, repeating until ${when(`${endsOn}T12:00:00+05:30`)}` : ""}.
            </>
          ) : (
            "Counting the audience…"
          )}
        </p>
        <button
          type="button"
          disabled={sending || Boolean(blocked) || !info?.audience}
          onClick={() => void start()}
          className="inline-flex items-center gap-1.5 rounded-full bg-ng-forest-deep px-4 py-2 text-[12.5px] font-semibold text-ng-cream hover:bg-ng-forest transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Icon name="plain-bold" size={14} />
          {sending ? "Sending…" : frequency === "once" ? "Send SMS now" : "Send now and repeat"}
        </button>
      </div>
      {blocked ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-ng-clay/30 bg-ng-clay/10 px-3 py-2 text-[12.5px] text-ng-clay-deep">
          <Icon name="danger-triangle-bold" size={14} className="mt-px shrink-0" />
          {BLOCKED[blocked] ?? "Offline campaigns aren't available right now."}
        </p>
      ) : null}

      {mine.length > 0 ? (
        <ul className="mt-4 divide-y divide-ng-line-soft rounded-xl border border-ng-line-soft bg-ng-paper">
          {mine.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-[12.5px]">
              <span className="text-ng-ink">
                {REPEAT.find((r) => r.key === s.frequency)?.label}
                {s.audience.captainId ? ` · ${captains.find((c) => c.id === s.audience.captainId)?.name ?? "one captain"}` : ""}
                {s.audience.community ? ` · ${shortCommunity(s.audience.community)}` : ""}
                {s.lastResult ? ` · last sent to ${s.lastResult.sent}` : ""}
                {s.active && s.frequency !== "once" ? ` · next ${when(s.nextRunAt)}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <Pill tone={s.active ? "success" : "neutral"}>{s.active ? "Repeating" : "Done"}</Pill>
                {s.active ? (
                  <button type="button" onClick={() => void stop(s.id)} className="font-semibold text-ng-danger hover:underline cursor-pointer">
                    Stop
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          aria-label="Mobile to stop messaging"
          inputMode="numeric"
          placeholder="Mobile that asked not to be messaged"
          value={optOut}
          onChange={(e) => setOptOut(e.target.value)}
          className={cn(FIELD, "h-10 max-w-xs")}
        />
        <button
          type="button"
          disabled={!optOut}
          onClick={() => void addOptOut()}
          className="h-10 rounded-full border border-ng-line px-4 text-[12.5px] font-semibold text-ng-ink hover:bg-ng-cream transition-colors cursor-pointer disabled:opacity-45"
        >
          Don&rsquo;t message
        </button>
      </div>
    </div>
  );
}
