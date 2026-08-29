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

interface ProxyState {
  configured: boolean;
  expectedIp: string | null;
  probe?: { ok: boolean; ip?: string; matchesWhitelist?: boolean; error?: string };
}

interface GatewayStatus {
  proxy: ProxyState;
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
  const [probing, setProbing] = useState(false);
  const [selftest, setSelftest] = useState<
    { ok: boolean; checks: { step: string; ok: boolean; detail: string }[] } | null
  >(null);
  const [testing, setTesting] = useState(false);
  const [testOrder, setTestOrder] = useState<{
    ok: boolean;
    error?: string;
    attempts?: {
      mode: string;
      explain: string;
      ok: boolean;
      orderRefNumber?: string;
      transactionUrl?: string;
      sameHostUrl?: string;
      sentReturnUrl?: string;
      sbiOrderRefNumber?: string;
      raw?: { sent: unknown; received: unknown };
      orderHash?: string;
      readBack?: string;
      error?: string;
    }[];
  } | null>(null);
  const [ordering, setOrdering] = useState(false);

  /*
   * Run the end-to-end check. It authenticates against SBI's own endpoint but
   * creates nothing, so it is safe to run as often as needed — and it refuses
   * outright when pointed at the live gateway.
   */
  async function runSelftest() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/payments/selftest", { cache: "no-store" });
      setSelftest(await res.json());
    } catch {
      setSelftest({ ok: false, checks: [{ step: "request", ok: false, detail: "could not reach the server" }] });
    } finally {
      setTesting(false);
    }
  }

  /*
   * Create a ₹1 order on the sandbox and hand back its payment URL.
   *
   * Lives behind a button rather than being a URL you visit, because the admin
   * session travels on this app's own fetch — typing the endpoint into the
   * address bar arrives without it and is simply rejected.
   *
   * Records nothing on our side: the order exists only in SBI's sandbox, so it
   * cannot reach revenue figures, stock or the invoice sequence.
   */
  async function runTestOrder() {
    setOrdering(true);
    try {
      const res = await fetch("/api/admin/payments/testorder", { cache: "no-store" });
      setTestOrder(await res.json());
    } catch {
      setTestOrder({ ok: false, error: "could not reach the server" });
    } finally {
      setOrdering(false);
    }
  }

  /*
   * Ask the server to call out through the proxy and report the address it
   * arrives from. Separated from the page load because it is a real network
   * round trip — and because it answers a different question: not "is the
   * variable set" but "does traffic actually leave from the IP SBI whitelisted".
   */
  async function probeProxy() {
    setProbing(true);
    try {
      const res = await fetch("/api/admin/payments/status?probe=1", { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as GatewayStatus);
    } finally {
      setProbing(false);
    }
  }

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
          icon="wallet"
          title="Payment gateway"
          caption="What the live server can actually see. Values are never shown. Only whether each credential is present."
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
                name={ready ? "verified" : "info-circle-bold"}
                size={19}
                className={cn("mt-px shrink-0", ready ? "text-ng-forest" : "text-ng-clay-deep")}
              />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-ng-forest-deep">
                  {ready
                    ? "Online payment is available"
                    : "Online payment is off. Checkout offers Cash on Delivery only"}
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

            {/*
              Outbound IP. SBI refuses calls from any address but the one they
              whitelisted, and Vercel functions have no stable outbound IP — so
              this is a hard requirement, not a hardening step.
            */}
            <div className="mt-4 rounded-xl border border-ng-line-soft bg-ng-paper px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon
                    name={status.proxy.configured ? "verified" : "close-circle-bold"}
                    size={15}
                    className={status.proxy.configured ? "text-ng-green-bright" : "text-ng-danger"}
                  />
                  <span className="text-[12.5px] font-semibold text-ng-forest-deep">
                    Static IP proxy
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void probeProxy()}
                  disabled={!status.proxy.configured || probing}
                  className="cursor-pointer rounded-full border border-ng-line px-3 py-1 text-[11.5px] font-semibold text-ng-forest transition-colors hover:bg-ng-sage/30 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {probing ? "Checking…" : "Test outbound IP"}
                </button>
              </div>

              <p className="mt-1.5 text-[11.5px] text-ng-ink-muted">
                {status.proxy.configured
                  ? `SBI calls leave through the proxy${status.proxy.expectedIp ? ` — expecting ${status.proxy.expectedIp}` : ""}.`
                  : "SBIEPAY_PROXY_URL is not set. Calls would leave from a Vercel address SBI has not whitelisted, so they are refused before they are attempted."}
              </p>

              {status.proxy.probe ? (
                <p
                  className={cn(
                    "mt-2 font-mono text-[11.5px]",
                    status.proxy.probe.ok && status.proxy.probe.matchesWhitelist !== false
                      ? "text-ng-green-bright"
                      : "text-ng-danger",
                  )}
                >
                  {status.proxy.probe.ok
                    ? status.proxy.probe.matchesWhitelist === false
                      ? `arrives from ${status.proxy.probe.ip}. NOT the whitelisted address`
                      : `arrives from ${status.proxy.probe.ip} ✓`
                    : `proxy unreachable: ${status.proxy.probe.error}`}
                </p>
              ) : null}
            </div>

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
                        name={c.present ? "verified" : "close-circle-bold"}
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

            {/*
              The end-to-end check. Configuration, crypto, egress IP and
              authentication, in the order a real payment depends on them, so
              the first failure names the thing to fix.
            */}
            <div className="mt-4 rounded-xl border border-ng-line-soft bg-ng-paper px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] font-semibold text-ng-forest-deep">
                  Integration self-test
                </span>
                <button
                  type="button"
                  onClick={() => void runSelftest()}
                  disabled={testing}
                  className="cursor-pointer rounded-full bg-ng-forest-deep px-3.5 py-1 text-[11.5px] font-semibold text-ng-cream transition-colors hover:bg-ng-forest disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {testing ? "Running…" : "Run self-test"}
                </button>
              </div>
              <p className="mt-1.5 text-[11.5px] text-ng-ink-muted">
                Authenticates against SBI without creating an order or moving money.
                Refuses to run against the live gateway.
              </p>

              {selftest ? (
                <ul className="mt-2.5 space-y-1.5">
                  {selftest.checks.map((c) => (
                    <li key={c.step} className="flex items-start gap-2">
                      <Icon
                        name={c.ok ? "verified" : "close-circle-bold"}
                        size={14}
                        className={cn("mt-px shrink-0", c.ok ? "text-ng-green-bright" : "text-ng-danger")}
                      />
                      <span className="min-w-0 text-[11.5px]">
                        <span className="font-semibold text-ng-forest-deep">{c.step}</span>
                        <span className="text-ng-ink-muted"> — {c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/*
                Offered only once the self-test has gone green end to end.
                Creating a sandbox order before authentication works produces a
                failure that says nothing the self-test has not already said
                more precisely.
              */}
              {selftest?.ok ? (
                <div className="mt-3 border-t border-ng-line-soft pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-ng-forest-deep">
                      ₹1 sandbox order
                    </span>
                    <button
                      type="button"
                      onClick={() => void runTestOrder()}
                      disabled={ordering}
                      className="cursor-pointer rounded-full border border-ng-forest-deep px-3.5 py-1 text-[11.5px] font-semibold text-ng-forest-deep transition-colors hover:bg-ng-forest-deep hover:text-ng-cream disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {ordering ? "Creating…" : "Create test order"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-ng-ink-muted">
                    Creates orders in SBI&rsquo;s sandbox only. Nothing is written here,
                    and no money moves. One per way the bank might read the expiry
                    field, since the documentation contradicts its own validator.
                    Open each link: the one that loads a real payment page rather
                    than a 404 is the encoding checkout will use.
                  </p>

                  {testOrder?.attempts ? (
                    <ul className="mt-2.5 space-y-2">
                      {testOrder.attempts.map((a) => (
                        <li key={a.mode} className="flex items-start gap-2">
                          <Icon
                            name={a.ok ? "verified" : "close-circle-bold"}
                            size={14}
                            className={cn(
                              "mt-0.5 shrink-0",
                              a.ok ? "text-ng-green-bright" : "text-ng-danger",
                            )}
                          />
                          <div className="min-w-0">
                            <span className="text-[11.5px] font-semibold text-ng-forest-deep">
                              {a.mode}
                            </span>
                            <span className="text-[11.5px] text-ng-ink-muted"> — {a.explain}</span>
                            {a.ok ? (
                              /*
                                `rel="noopener"`, deliberately NOT "noreferrer".
                                SBI whitelists the merchant's source domain and
                                their payment page checks it, so stripping the
                                Referer makes the page fail the very check they
                                configured. noopener still denies the opened tab
                                access to window.opener, which is the part that
                                matters for safety.
                              */
                              <div className="mt-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {/*
                                    Only SBI's own transactionUrl is offered.
                                    The constructed variant used a "#" fragment,
                                    which is wrong for their BrowserRouter, and a
                                    link that never works is worse than no link.
                                  */}
                                  {a.transactionUrl ? (
                                    <a
                                      href={a.transactionUrl}
                                      target="_blank"
                                      rel="noopener"
                                      className="inline-flex items-center gap-1 rounded-full border border-ng-line px-2.5 py-0.5 text-[11px] font-semibold text-ng-ink-muted transition-colors hover:text-ng-forest-deep"
                                    >
                                      Open payment page
                                      <Icon name="arrow-right-up-linear" size={11} />
                                    </a>
                                  ) : null}
                                </div>
                                {/* The raw string, so a wrong host is visible rather than inferred. */}
                                {a.readBack ? (
                                  <p className="text-[11px] text-ng-ink-muted">{a.readBack}</p>
                                ) : null}
                                {/*
                                  The two references SBI support ask for by name.
                                  Grouped and selectable so they can be pasted
                                  into a ticket without hunting through a URL.
                                */}
                                <div className="mt-1 select-all rounded-lg bg-ng-sage/25 px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-ng-forest-deep">
                                  <div>Order Ref Number: {a.orderRefNumber}</div>
                                  <div>SBI Order Ref Number: {a.sbiOrderRefNumber}</div>
                                  <div>Source URL: {a.sentReturnUrl?.replace(/\/api\/.*$/, "")}</div>
                                  <div className="break-all">Return URL: {a.sentReturnUrl}</div>
                                </div>
                                <p className="break-all font-mono text-[10px] leading-snug text-ng-ink-muted">
                                  {a.transactionUrl}
                                </p>
                                {/* Everything, so nothing has to be inferred. */}
                                {a.raw ? (
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-[11px] font-semibold text-ng-forest-deep">
                                      Full request &amp; response from SBI
                                    </summary>
                                    <pre className="mt-1 max-h-72 select-all overflow-auto rounded-lg bg-ng-forest-deep/[0.04] p-2.5 font-mono text-[10px] leading-relaxed text-ng-ink">
{JSON.stringify(a.raw, null, 2)}
                                    </pre>
                                  </details>
                                ) : null}
                              </div>
                            ) : (
                              <p className="text-[11px] text-ng-danger">{a.error}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : testOrder ? (
                    <p className="mt-2.5 text-[11.5px] text-ng-danger">
                      {testOrder.error ?? "could not create the order"}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

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
