"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Icon } from "@/components/ui/icon";
import { AppIcon } from "@/components/ui/app-icon";
import { UiIcon } from "@/components/ui/ui-icon";

/**
 * /referral — the customer's real Refer & Earn standing.
 *
 * Code, link, invite counts and credited earnings all come from
 * `/api/referrals/me`, which reads `referral_attributions`. The reward figures in
 * the copy come from the live programme config, so the page can never promise
 * terms the engine won't pay.
 *
 * Invitees are shown WITHOUT names. We hold only the referred customer's id, and
 * surfacing who signed up using someone's code would leak another customer's
 * personal data — the date and status are enough to track a referral.
 */

interface Terms {
  enabled: boolean;
  referrerReward: number;
  refereeDiscount: number;
  minOrder: number;
  expiryDays: number;
  maxPerMonth: number;
}

interface RecentInvite {
  status: "pending" | "rewarded" | "void";
  pointsAwarded: number;
  createdAt: string;
  rewardedAt: string | null;
}

interface Summary {
  code: string | null;
  link: string | null;
  rewardedCount: number;
  pendingCount: number;
  totalCount: number;
  earnedRupees: number;
  recent: RecentInvite[];
  terms: Terms;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Days remaining before an invite's window closes, or null when it has lapsed. */
function daysLeft(iso: string, expiryDays: number): number | null {
  if (expiryDays <= 0) return null;
  const end = new Date(iso).getTime() + expiryDays * 86_400_000;
  const left = Math.ceil((end - Date.now()) / 86_400_000);
  return left > 0 ? left : null;
}

export default function ReferralPage() {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/referrals/me", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const json = (await res.json()) as Summary & { ok?: boolean };
        if (alive && json.ok !== false) setData(json);
      } catch {
        /* leave the page in its empty state */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const copy = useCallback((text: string, kind: "link" | "code") => {
    void navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }, []);

  const code = data?.code ?? "";
  const link = data?.link ?? "";
  const t = data?.terms;
  const reward = t?.referrerReward ?? 0;
  const friendGets = t?.refereeDiscount ?? 0;
  const expiryDays = t?.expiryDays ?? 0;

  const steps = [
    {
      n: "01",
      title: "Share your link",
      body:
        t && t.maxPerMonth > 0
          ? `Send it by WhatsApp, email or copy the code. Up to ${t.maxPerMonth} rewarded invites a month.`
          : "Send it by WhatsApp, email, or copy the code and share it however you like.",
      icon: "share-bold",
      block: "bg-ng-sage/45 border-ng-leaf/30",
      num: "text-ng-forest",
      chip: "bg-ng-forest/10 text-ng-forest",
    },
    {
      n: "02",
      title: friendGets ? `They get ₹${friendGets} off` : "They get a welcome discount",
      body: t?.minOrder
        ? `Your friend saves on their first order over ₹${t.minOrder.toLocaleString("en-IN")}.`
        : "Your friend saves on their first order with you.",
      icon: "tag-price-bold",
      block: "bg-ng-clay/15 border-ng-clay/30",
      num: "text-ng-clay-deep",
      chip: "bg-ng-clay/20 text-ng-clay-deep",
    },
    {
      n: "03",
      title: reward ? `You get ₹${reward} credit` : "You earn wallet credit",
      body: "It lands in your harvest wallet once their first order is complete, redeemable on anything.",
      icon: "wallet-money-bold",
      block: "bg-ng-leaf/15 border-ng-leaf/30",
      num: "text-ng-forest",
      chip: "bg-ng-leaf/25 text-ng-forest",
    },
  ];

  const shareText = `Try Nutri Greenz, farm-traceable pantry${friendGets ? `, ₹${friendGets} off your first order` : ""}: ${link}`;

  return (
    <AccountShell active="referral">
      <div className="mb-8">
        <span className="ng-eyebrow">Refer a friend</span>
        <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] leading-tight text-ng-forest-deep">
          Good food spreads <em className="italic text-ng-leaf">by word of mouth</em>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ng-ink-muted">
          {reward && friendGets
            ? `Share your link. They get ₹${friendGets} off their first order, you get ₹${reward} in wallet credit once it completes. Both win.`
            : "Share your link with a friend. When their first order completes, you both earn."}
          {expiryDays > 0 ? ` Each invite is valid for ${expiryDays} days.` : ""}
        </p>
      </div>

      <div>
        {/* Share block */}
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 mb-20">
          <div className="rounded-3xl bg-gradient-to-br from-ng-forest via-ng-forest-deep to-ng-forest-deep text-ng-cream p-8 md:p-10 relative overflow-hidden shadow-[0_24px_60px_-28px_rgba(10,31,18,0.65)] ring-1 ring-ng-clay/25">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-ng-clay/30 blur-3xl" aria-hidden />
            <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-ng-leaf/20 blur-3xl" aria-hidden />
            <div className="relative">
              <span className="ng-eyebrow text-ng-clay-light inline-flex items-center gap-2">
                <Icon name="gift-bold" size={15} />
                Your referral link
              </span>
              <h2 className="font-display text-[clamp(26px,3.4vw,36px)] mt-3 leading-tight">
                Share this — it&rsquo;s the most useful thing you&rsquo;ll send today.
              </h2>

              <div className="mt-7 space-y-4">
                <div className="rounded-2xl bg-ng-cream/[0.08] border border-ng-cream/20 p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-ng-clay">Link</div>
                    <div className="text-[14px] text-ng-cream truncate font-mono">
                      {loading ? "Loading…" : link || "Unavailable"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!link}
                    onClick={() => copy(link, "link")}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ng-clay text-ng-forest-deep font-semibold px-5 py-2 text-[13px] hover:bg-ng-clay-deep hover:text-ng-cream transition-colors disabled:opacity-40"
                  >
                    <Icon name={copied === "link" ? "check-circle-bold" : "copy-bold"} size={14} />
                    {copied === "link" ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="rounded-2xl bg-ng-cream/[0.06] border-2 border-dashed border-ng-clay/45 p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-ng-clay">Code</div>
                    <div className="text-[18px] text-ng-cream font-mono tracking-[0.18em] truncate">
                      {loading ? "…" : code || "—"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!code}
                    onClick={() => copy(code, "code")}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ng-cream/10 border border-ng-clay/40 text-ng-cream font-semibold px-5 py-2 text-[13px] hover:bg-ng-clay/25 transition-colors disabled:opacity-40"
                  >
                    <Icon name={copied === "code" ? "check-circle-bold" : "copy-bold"} size={14} />
                    {copied === "code" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!link}
                  className="inline-flex items-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-semibold px-5 py-2.5 text-[13px] hover:bg-ng-leaf/90 transition-colors"
                >
                  <AppIcon name="message" size={15} />
                  WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent("Try Nutri Greenz")}&body=${encodeURIComponent(shareText)}`}
                  className="inline-flex items-center gap-2 rounded-full bg-ng-cream/10 border border-ng-clay/40 text-ng-cream font-semibold px-5 py-2.5 text-[13px] hover:bg-ng-clay/25 transition-colors"
                >
                  <UiIcon name="email" size={15} />
                  Email
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-ng-cream/10 border border-ng-clay/40 text-ng-cream font-semibold px-5 py-2.5 text-[13px] hover:bg-ng-clay/25 transition-colors"
                >
                  <Icon name="share-bold" size={15} />
                  X / Twitter
                </a>
              </div>
            </div>
          </div>

          {/* Stat tile — real figures */}
          <aside className="rounded-3xl bg-ng-clay/20 border border-ng-clay/40 p-8 flex flex-col justify-between">
            <div>
              <span className="ng-eyebrow text-ng-forest">Lifetime earned</span>
              <div className="font-display text-[64px] leading-none text-ng-forest-deep mt-4 tabular-nums">
                ₹{(data?.earnedRupees ?? 0).toLocaleString("en-IN")}
              </div>
              <div className="text-[14px] text-ng-ink-muted mt-3">
                {data && data.rewardedCount > 0
                  ? `From ${data.rewardedCount} successful invite${data.rewardedCount === 1 ? "" : "s"}`
                  : "No completed referrals yet"}
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-ng-clay/40 grid grid-cols-2 gap-4">
              <Stat label="Invited" value={data?.totalCount ?? 0} />
              <Stat label="Converted" value={data?.rewardedCount ?? 0} />
            </div>
          </aside>
        </div>

        {/* How it works */}
        <div className="mb-20">
          <h2 className="font-display text-[clamp(28px,4vw,42px)] text-ng-forest-deep mb-10">How it works.</h2>
          <div className="grid items-stretch md:grid-cols-3 gap-5">
            {steps.map((s) => (
              <article
                key={s.n}
                className={`flex h-full flex-col rounded-2xl border p-7 ${s.block} transition-shadow hover:shadow-[0_18px_40px_-26px_rgba(10,31,18,0.4)]`}
              >
                <div className="flex items-center justify-between">
                  <div className={`font-display text-[44px] leading-none ${s.num}`}>{s.n}</div>
                  <span className={`inline-flex size-10 items-center justify-center rounded-full ${s.chip}`}>
                    <Icon name={s.icon} size={20} />
                  </span>
                </div>
                <h3 className="font-display text-[20px] text-ng-forest-deep mt-5">{s.title}</h3>
                <p className="text-[14px] text-ng-ink-muted mt-3 leading-relaxed">{s.body}</p>
              </article>
            ))}
          </div>
        </div>

        {/* Invite activity — real, and anonymised by design */}
        <div className="rounded-3xl bg-ng-paper border border-ng-line-soft p-7 md:p-10">
          <div className="flex items-center justify-between mb-7">
            <h2 className="font-display text-[24px] text-ng-forest-deep">Your invites</h2>
            <span className="text-[12px] text-ng-ink-soft">
              {data?.totalCount ?? 0} total
              {data && data.pendingCount > 0 ? ` · ${data.pendingCount} pending` : ""}
            </span>
          </div>

          {loading ? (
            <p className="py-8 text-center text-[14px] text-ng-ink-soft">Loading…</p>
          ) : data && data.recent.length > 0 ? (
            <ul className="divide-y divide-ng-line-soft">
              {data.recent.map((f, i) => {
                const credited = f.status === "rewarded";
                const left = credited ? null : daysLeft(f.createdAt, expiryDays);
                return (
                  <li key={`${f.createdAt}-${i}`} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`size-10 rounded-full flex items-center justify-center ring-2 ${
                          credited
                            ? "bg-ng-leaf/15 text-ng-forest ring-ng-leaf/40"
                            : "bg-ng-clay/15 text-ng-clay-deep ring-ng-clay/30"
                        }`}
                      >
                        <Icon name={credited ? "check-circle-bold" : "clock-circle-bold"} size={18} />
                      </div>
                      <div>
                        <div className="text-[15px] text-ng-ink">
                          {credited ? "Friend ordered" : "Friend signed up"}
                        </div>
                        <div className="text-[12px] text-ng-ink-soft mt-0.5">
                          Invited {fmtDate(f.createdAt)}
                          {credited && f.rewardedAt ? ` · credited ${fmtDate(f.rewardedAt)}` : ""}
                          {!credited && left !== null ? ` · ${left} day${left === 1 ? "" : "s"} left` : ""}
                          {!credited && left === null && expiryDays > 0 ? " · window closed" : ""}
                        </div>
                      </div>
                    </div>
                    {credited ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-leaf/15 text-ng-forest font-semibold px-3 py-1.5 text-[13px] whitespace-nowrap">
                        <span className="size-1.5 rounded-full bg-ng-success" aria-hidden />
                        +₹{reward.toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-amber/15 text-ng-clay-deep font-semibold px-3 py-1.5 text-[13px] whitespace-nowrap">
                        <span className="size-1.5 rounded-full bg-ng-amber" aria-hidden />
                        Pending
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ng-cream text-ng-forest">
                <UiIcon name="customers" size={24} />
              </span>
              <p className="max-w-sm text-[14px] leading-relaxed text-ng-ink-muted">
                No invites yet. Share your link above — friends who join with it will appear here, and
                your credit lands once their first order completes.
              </p>
            </div>
          )}
        </div>

        {/* FAQ — driven by the live programme terms */}
        <div className="mt-20">
          <h2 className="font-display text-[clamp(24px,3vw,32px)] text-ng-forest-deep mb-7">Common questions.</h2>
          <div className="grid items-stretch md:grid-cols-2 gap-5">
            <Faq
              tint="sage"
              q="How long is my link valid?"
              a={
                expiryDays > 0
                  ? `Each invite is valid for ${expiryDays} days from the day it's issued. If your friend hasn't ordered by then, that invite closes, but you can always share your link again.`
                  : "Your link doesn't expire. Share it as often as you like."
              }
            />
            <Faq
              tint="paper"
              q="When does my credit appear?"
              a={`Once your friend's first order${t?.minOrder ? ` of ₹${t.minOrder.toLocaleString("en-IN")} or more` : ""} is complete, the credit is added to your harvest wallet automatically.`}
            />
            <Faq
              tint="paper"
              q="Is there a limit?"
              a={
                t && t.maxPerMonth > 0
                  ? `Up to ${t.maxPerMonth} rewarded invites per month. There's no limit on how many people you share with.`
                  : "No cap. Invite as many friends as you like."
              }
            />
            <Faq
              tint="sage"
              q="Who can use my code?"
              a="New customers only, and it can't be used on an account that already exists. Your friend applies it at checkout on their first order."
            />
          </div>
        </div>
      </div>
    </AccountShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-[32px] text-ng-forest-deep leading-none tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-ng-ink-soft mt-2">{label}</div>
    </div>
  );
}

function Faq({ q, a, tint }: { q: string; a: string; tint: "sage" | "paper" }) {
  const block = tint === "sage" ? "bg-ng-sage/25 border-ng-leaf/25" : "bg-ng-paper border-ng-line-soft";
  return (
    <div className={`flex h-full flex-col rounded-2xl border p-6 ${block}`}>
      <h3 className="font-display text-[18px] text-ng-forest-deep flex items-start gap-2.5">
        <Icon name="question-circle-bold" size={18} className="text-ng-clay mt-0.5" />
        {q}
      </h3>
      <p className="text-[14px] text-ng-ink-muted mt-2.5 leading-relaxed pl-[26px]">{a}</p>
    </div>
  );
}
