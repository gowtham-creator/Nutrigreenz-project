"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountShell } from "@/components/ng/account/account-shell";
import { Button } from "@/components/ng/button";
import { Reveal } from "@/components/ng/motion";
import { Icon } from "@/components/ui/icon";
import { SubscriptionCard } from "@/components/ng/subscriptions/subscription-card";
import { useAuth } from "@/lib/auth";
import {
  fetchMySubscriptions,
  SubscriptionApiError,
  type SubscriptionRecord,
} from "@/lib/subscriptions-client";

type LoadState = "loading" | "ready" | "error" | "unauth" | "off";

export default function AccountSubscriptionsPage() {
  const { isAuthed, loading: authLoading } = useAuth();
  const [subs, setSubs] = useState<SubscriptionRecord[]>([]);
  const [loadState, setState] = useState<LoadState>("loading");
  const state: LoadState = authLoading ? "loading" : !isAuthed ? "unauth" : loadState;

  // Bumped by "Try again" to re-run the load effect.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading || !isAuthed) return;
    let alive = true;
    fetchMySubscriptions()
      .then(({ subscriptions }) => {
        if (!alive) return;
        setSubs(subscriptions);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof SubscriptionApiError && err.status === 401) setState("unauth");
        else if (err instanceof SubscriptionApiError && err.status === 404) setState("off");
        else setState("error");
      });
    return () => {
      alive = false;
    };
  }, [authLoading, isAuthed, attempt]);

  const replace = (next: SubscriptionRecord) => setSubs((list) => list.map((s) => (s.id === next.id ? next : s)));

  return (
    <AccountShell active="subscriptions">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-tight text-ng-forest-deep">My subscriptions</h1>
            <p className="mt-1.5 text-[15px] text-ng-ink-muted">
              Pay, skip, pause or change any delivery. Nothing is ever charged automatically.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/shop">
              <Icon name="refresh-bold" size={16} />
              Subscribe to another product
            </Link>
          </Button>
        </div>
      </Reveal>

      <div className="mt-8 flex flex-col gap-5">
        {state === "loading" ? (
          [0, 1].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl border border-ng-line-soft bg-ng-cream/50" />
          ))
        ) : state === "unauth" ? (
          <EmptyCard
            title="Sign in to see your subscriptions"
            body="Your subscriptions are saved to your account."
            cta={{ href: "/auth?next=/account/subscriptions", label: "Sign in" }}
          />
        ) : state === "off" ? (
          <EmptyCard title="Subscriptions aren't available right now" body="Please check back soon." cta={{ href: "/shop", label: "Go to the shop" }} />
        ) : state === "error" ? (
          <div className="rounded-3xl border border-ng-line-soft bg-ng-paper p-8 text-center">
            <p className="text-[15px] text-ng-ink-muted">We couldn&apos;t load your subscriptions.</p>
            <Button
              className="mt-4"
              onClick={() => {
                setState("loading");
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : subs.length === 0 ? (
          <EmptyCard
            title="No subscriptions yet"
            body="Subscribe to your staples and save on every delivery. Open any product and choose Subscribe & save."
            cta={{ href: "/shop", label: "Browse products" }}
          />
        ) : (
          subs.map((s) => <SubscriptionCard key={s.id} sub={s} onChange={replace} />)
        )}
      </div>
    </AccountShell>
  );
}

function EmptyCard({ title, body, cta }: { title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <div className="rounded-3xl border border-dashed border-ng-line bg-ng-paper/70 px-6 py-12 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ng-cream text-ng-forest-deep">
        <Icon name="refresh-bold" size={24} />
      </span>
      <p className="mt-4 font-display text-[20px] text-ng-forest-deep">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-ng-ink-muted">{body}</p>
      <Button className="mt-5" asChild>
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    </div>
  );
}
