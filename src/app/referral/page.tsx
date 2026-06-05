"use client";

import { useState } from "react";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Icon } from "@/components/ui/icon";

const REFERRAL_CODE = "GOWTHAM-NG-2026";
const REFERRAL_LINK = `https://nutrigreenz.farm/r/${REFERRAL_CODE}`;

const STEPS = [
  {
    n: "01",
    title: "Share your link",
    body: "Send it via WhatsApp, email, or copy the code. There's no cap on how many friends you can invite.",
    icon: "share-bold",
    block: "bg-ng-sage/45 border-ng-leaf/30",
    num: "text-ng-forest",
    chip: "bg-ng-forest/10 text-ng-forest",
  },
  {
    n: "02",
    title: "They get ₹100 off",
    body: "Your friend gets ₹100 off their first order over ₹399. No tricks, no expiry within 90 days.",
    icon: "tag-price-bold",
    block: "bg-ng-clay/15 border-ng-clay/30",
    num: "text-ng-clay-deep",
    chip: "bg-ng-clay/20 text-ng-clay-deep",
  },
  {
    n: "03",
    title: "You get ₹250 wallet",
    body: "The moment their first order ships, ₹250 lands in your harvest wallet. Redeemable on anything.",
    icon: "wallet-money-bold",
    block: "bg-ng-leaf/15 border-ng-leaf/30",
    num: "text-ng-forest",
    chip: "bg-ng-leaf/25 text-ng-forest",
  },
];

const FRIENDS = [
  { name: "Priya K.", status: "Ordered · ₹250 credited", date: "01 Apr 2026", credit: 250 },
  { name: "Rahul M.", status: "Signed up · waiting first order", date: "08 Apr 2026", credit: 0 },
  { name: "Anjali S.", status: "Ordered · ₹250 credited", date: "22 Mar 2026", credit: 250 },
  { name: "Vikram T.", status: "Link opened · not signed up", date: "12 Apr 2026", credit: 0 },
];

export default function ReferralPage() {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const totalEarned = FRIENDS.reduce((s, f) => s + f.credit, 0);

  const copy = (text: string, kind: "link" | "code") => {
    navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <AccountShell active="referral">
      <div className="mb-8">
        <span className="ng-eyebrow text-ng-clay">Refer a friend</span>
        <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] leading-tight text-ng-forest-deep">
          Good food spreads <em className="italic text-ng-leaf">by word of mouth</em>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ng-ink-muted">
          Share your link with a friend. They get ₹100 off their first order. You get ₹250 wallet
          credit when they receive it. Both win. No marketing budget burned.
        </p>
      </div>

      <div>
        {/* Share block */}
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 mb-20">
          <div className="rounded-3xl bg-gradient-to-br from-ng-forest via-ng-forest-deep to-ng-forest-deep text-ng-cream p-8 md:p-10 relative overflow-hidden shadow-[0_24px_60px_-28px_rgba(10,31,18,0.65)] ring-1 ring-ng-clay/25">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-ng-clay/30 blur-3xl" aria-hidden />
            <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-ng-leaf/20 blur-3xl" aria-hidden />
            <div className="relative">
              <span className="ng-eyebrow text-ng-clay inline-flex items-center gap-2">
                <Icon name="gift-bold" size={15} />
                Your referral link
              </span>
              <h2 className="font-display text-[clamp(26px,3.4vw,36px)] mt-3 leading-tight">
                Share this — it's the most useful thing you'll send today.
              </h2>

              <div className="mt-7 space-y-4">
                <div className="rounded-2xl bg-ng-cream/[0.08] border border-ng-cream/20 p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-ng-clay">Link</div>
                    <div className="text-[14px] text-ng-cream truncate font-mono">{REFERRAL_LINK}</div>
                  </div>
                  <button
                    onClick={() => copy(REFERRAL_LINK, "link")}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ng-clay text-ng-forest-deep font-semibold px-5 py-2 text-[13px] hover:bg-ng-clay-deep hover:text-ng-cream transition-colors"
                  >
                    <Icon name={copied === "link" ? "check-circle-bold" : "copy-bold"} size={14} />
                    {copied === "link" ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="rounded-2xl bg-ng-cream/[0.06] border-2 border-dashed border-ng-clay/45 p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-ng-clay">Code</div>
                    <div className="text-[18px] text-ng-cream font-mono tracking-[0.18em]">{REFERRAL_CODE}</div>
                  </div>
                  <button
                    onClick={() => copy(REFERRAL_CODE, "code")}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ng-cream/10 border border-ng-clay/40 text-ng-cream font-semibold px-5 py-2 text-[13px] hover:bg-ng-clay/25 transition-colors"
                  >
                    <Icon name={copied === "code" ? "check-circle-bold" : "copy-bold"} size={14} />
                    {copied === "code" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Try Nutrigreenz — farm-traceable pantry, ₹100 off your first order: ${REFERRAL_LINK}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-ng-leaf text-ng-forest-deep font-semibold px-5 py-2.5 text-[13px] hover:bg-ng-leaf/90 transition-colors"
                >
                  <Icon name="chat-round-line-bold" size={15} />
                  WhatsApp
                </a>
                <a
                  href={`mailto:?subject=Try Nutrigreenz&body=${encodeURIComponent(`Use my code ${REFERRAL_CODE} for ₹100 off your first order. ${REFERRAL_LINK}`)}`}
                  className="inline-flex items-center gap-2 rounded-full bg-ng-cream/10 border border-ng-clay/40 text-ng-cream font-semibold px-5 py-2.5 text-[13px] hover:bg-ng-clay/25 transition-colors"
                >
                  <Icon name="letter-bold" size={15} />
                  Email
                </a>
                <button className="inline-flex items-center gap-2 rounded-full bg-ng-cream/10 border border-ng-clay/40 text-ng-cream font-semibold px-5 py-2.5 text-[13px] hover:bg-ng-clay/25 transition-colors">
                  <Icon name="share-bold" size={15} />
                  X / Twitter
                </button>
              </div>
            </div>
          </div>

          {/* Stat tile */}
          <aside className="rounded-3xl bg-ng-clay/20 border border-ng-clay/40 p-8 flex flex-col justify-between">
            <div>
              <span className="ng-eyebrow text-ng-forest">Lifetime earned</span>
              <div className="font-display text-[64px] leading-none text-ng-forest-deep mt-4 tabular-nums">
                ₹{totalEarned.toLocaleString()}
              </div>
              <div className="text-[14px] text-ng-ink-muted mt-3">From {FRIENDS.filter((f) => f.credit > 0).length} successful invites</div>
            </div>
            <div className="mt-8 pt-6 border-t border-ng-clay/40 grid grid-cols-2 gap-4">
              <Stat label="Sent" value={FRIENDS.length} />
              <Stat label="Converted" value={FRIENDS.filter((f) => f.credit > 0).length} />
            </div>
          </aside>
        </div>

        {/* How it works */}
        <div className="mb-20">
          <h2 className="font-display text-[clamp(28px,4vw,42px)] text-ng-forest-deep mb-10">How it works.</h2>
          <div className="grid items-stretch md:grid-cols-3 gap-5">
            {STEPS.map((s) => (
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

        {/* Friend list */}
        <div className="rounded-3xl bg-ng-paper border border-ng-line-soft p-7 md:p-10">
          <div className="flex items-center justify-between mb-7">
            <h2 className="font-display text-[24px] text-ng-forest-deep">Friends you've invited</h2>
            <span className="text-[12px] text-ng-ink-soft">{FRIENDS.length} total</span>
          </div>
          <ul className="divide-y divide-ng-line-soft">
            {FRIENDS.map((f) => {
              const credited = f.credit > 0;
              return (
                <li key={f.name} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`size-10 rounded-full flex items-center justify-center font-display ring-2 ${
                        credited
                          ? "bg-ng-leaf/15 text-ng-forest ring-ng-leaf/40"
                          : "bg-ng-clay/15 text-ng-clay-deep ring-ng-clay/30"
                      }`}
                    >
                      {f.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-[15px] text-ng-ink">{f.name}</div>
                      <div className="text-[12px] text-ng-ink-soft mt-0.5">{f.status} · {f.date}</div>
                    </div>
                  </div>
                  {credited ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-leaf/15 text-ng-forest font-semibold px-3 py-1.5 text-[13px]">
                      <span className="size-1.5 rounded-full bg-ng-success" aria-hidden />
                      +₹{f.credit}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ng-amber/15 text-ng-clay-deep font-semibold px-3 py-1.5 text-[13px]">
                      <span className="size-1.5 rounded-full bg-ng-amber" aria-hidden />
                      Pending
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* FAQ */}
        <div className="mt-20">
          <h2 className="font-display text-[clamp(24px,3vw,32px)] text-ng-forest-deep mb-7">Common questions.</h2>
          <div className="grid items-stretch md:grid-cols-2 gap-5">
            <Faq tint="sage" q="Is there a cap on referrals?" a="No. Invite as many friends as you like. We've had members earn over ₹15,000 in wallet credit through referrals alone." />
            <Faq tint="paper" q="When does my credit appear?" a="The moment your friend's first order is marked 'shipped' in our system. Usually within 48 hours of their order." />
            <Faq tint="paper" q="Can I refer existing customers?" a="The ₹100 bonus is for new customers only. But if you refer a lapsed customer (no order in 12+ months), they qualify." />
            <Faq tint="sage" q="Does wallet credit expire?" a="No. Your referral wallet credit never expires. Redeem it on any order, up to 30% of the cart value." />
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
  const block =
    tint === "sage"
      ? "bg-ng-sage/25 border-ng-leaf/25"
      : "bg-ng-paper border-ng-line-soft";
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
