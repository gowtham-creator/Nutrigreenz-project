"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ng/admin/admin-shell";
import { SectionHeader } from "@/components/ng/admin/super/command-center";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Payment gateway configuration, read from the running server.
 *
 * This exists because a pasted credential cannot otherwise be verified. Vercel
 * encrypts environment variables and never returns them, so a trailing space, a
 * swapped secret and encryption key, or a value still left as a placeholder
 * looks exactly like a correct one — until a customer tries to pay.
 *
 * It shows shape, never values: present or not, and the length. Length catches
 * the paste errors that matter (empty, truncated) while keeping secrets out of
 * a response that might be logged or shared on a screen.
 */

interface CredentialShape {
  name: string;
  present: boolean;
  length: number;
}

interface GatewayStatus {
  provider: string;
  environment: string | null;
  baseUrl: string | null;
  live: boolean;
  onlinePaymentAvailable: boolean;
  checkoutOffers: string[];
  credentials: CredentialShape[];
  problems: string[];
}

export function PaymentGatewayPanel() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/payments/status", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as GatewayStatus;
        if (alive) setStatus(data);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const ready = status?.onlinePaymentAvailable ?? false;

  return (
    <section id="payments" className="mb-6 scroll-mt-32">
      <Card>
        <SectionHeader
          icon="wallet-money-bold"
          title="Payment gateway"
          caption="What the live server can actually see. Values are never shown — only whether each credential is present."
        />

        {failed ? (
          <p className="rounded-xl border border-ng-danger/40 bg-ng-danger/5 px-3.5 py-3 text-[12.5px] text-ng-danger">
            Couldn&rsquo;t read the gateway status.
          </p>
        ) : !status ? (
          <p className="text-[12.5px] text-ng-ink-muted">Checking…</p>
        ) : (
          <>
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3.5",
                ready
                  ? "border-ng-forest/30 bg-ng-sage/25"
                  : "border-ng-clay/40 bg-ng-clay/[0.07]",
              )}
            >
              <Icon
                name={ready ? "check-circle-bold" : "info-circle-bold"}
                size={19}
                className={cn("mt-px shrink-0", ready ? "text-ng-forest" : "text-ng-clay-deep")}
              />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-ng-forest-deep">
                  {ready
                    ? "Online payment is available"
                    : "Online payment is off — checkout offers Cash on Delivery only"}
                </p>
                <p className="mt-0.5 text-[12px] text-ng-ink-muted">
                  Checkout offers: {status.checkoutOffers.join(", ").toUpperCase() || "nothing"}
                </p>
              </div>
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              <Row label="Provider" value={status.provider === "none" ? "Not configured" : "SBIePay"} />
              <Row
                label="Environment"
                value={status.environment ?? "not set"}
                tone={status.live ? "warn" : undefined}
                note={status.live ? "REAL MONEY" : status.environment ? "test mode" : undefined}
              />
              <Row label="Endpoint" value={status.baseUrl ?? "—"} mono span />
            </dl>

            {status.credentials.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ng-ink-muted">
                  Credentials for this environment
                </p>
                <ul className="overflow-hidden rounded-xl border border-ng-line-soft">
                  {status.credentials.map((c) => (
                    <li
                      key={c.name}
                      className="flex items-center gap-2.5 border-b border-ng-line-soft bg-ng-paper px-3.5 py-2.5 last:border-b-0"
                    >
                      <Icon
                        name={c.present ? "check-circle-bold" : "close-circle-bold"}
                        size={15}
                        className={c.present ? "text-ng-green-bright" : "text-ng-danger"}
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ng-ink">
                        {c.name}
                      </span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-ng-ink-soft">
                        {c.present ? `${c.length} chars` : "not set"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {status.problems.length > 0 ? (
              <div className="mt-4 rounded-xl border border-ng-clay/40 bg-ng-clay/[0.06] px-3.5 py-3">
                <p className="mb-1.5 text-[12px] font-semibold text-ng-clay-deep">
                  Still needed
                </p>
                <ul className="space-y-1">
                  {status.problems.map((p) => (
                    <li key={p} className="font-mono text-[11.5px] text-ng-ink-muted">
                      · {p}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  span,
  tone,
  note,
}: {
  label: string;
  value: string;
  mono?: boolean;
  span?: boolean;
  tone?: "warn";
  note?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", span && "sm:col-span-2")}>
      <dt className="shrink-0 text-[12px] text-ng-ink-muted">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right text-[12.5px] font-medium",
          mono && "font-mono text-[11.5px]",
          tone === "warn" ? "text-ng-danger" : "text-ng-ink",
        )}
      >
        {value}
        {note ? (
          <span
            className={cn(
              "ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              tone === "warn"
                ? "bg-ng-danger/10 text-ng-danger"
                : "bg-ng-sage/50 text-ng-forest",
            )}
          >
            {note}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
