import "server-only";
import { ProxyAgent, fetch as undiciFetch, type RequestInit as UndiciInit } from "undici";
import { sbiepayBaseUrl, isLiveGateway } from "@/lib/payments";

/**
 * Every outbound call to SBIePay, routed through the whitelisted static IP.
 *
 * SBI whitelists one merchant IP for server-to-server calls. Vercel functions
 * run on shared infrastructure with no stable outbound address — it changes
 * between invocations — so a call made directly from a function arrives from an
 * address the bank does not recognise and is refused.
 *
 * A small proxy on AWS holds the whitelisted Elastic IP. This module sends SBI
 * traffic through it, and nothing else: the storefront, the admin portal, email
 * and every other request continue to leave Vercel directly. If the proxy box
 * dies, card payments stop and the rest of the site is untouched. That
 * containment is the whole reason for routing here rather than putting the
 * application behind a proxy.
 *
 * ── Failing closed ────────────────────────────────────────────────────────
 *
 * With no proxy configured this THROWS rather than falling back to a direct
 * call. A direct call would leave from a random Vercel IP and be rejected by
 * the bank — but on the LIVE endpoint the failure mode is worse than an error:
 * an intermittently-working payment path, where some calls happen to succeed
 * and reconciliation quietly drifts. Refusing outright keeps that impossible.
 */

/** One agent per proxy URL — a new agent per request would leak sockets. */
let cachedAgent: ProxyAgent | null = null;
let cachedFor: string | null = null;

function proxyUrl(): string | null {
  return process.env.SBIEPAY_PROXY_URL?.trim() || null;
}

/** True when outbound SBI traffic has a fixed address to leave from. */
export function isProxyConfigured(): boolean {
  return proxyUrl() !== null;
}

function agent(): ProxyAgent {
  const url = proxyUrl();
  if (!url) throw new Error("sbiepay-proxy-not-configured");
  if (!cachedAgent || cachedFor !== url) {
    cachedAgent = new ProxyAgent(url);
    cachedFor = url;
  }
  return cachedAgent;
}

export interface SbiepayRequest {
  /** Path only, e.g. "/v1/order". The environment supplies the host. */
  path: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  /**
   * Milliseconds before giving up. A hung bank call must not hold a serverless
   * function open until the platform kills it — that surfaces to the customer
   * as a blank page rather than a payment error they can act on.
   */
  timeoutMs?: number;
}

export interface SbiepayResponse {
  status: number;
  ok: boolean;
  body: string;
}

/**
 * Make one request to SBIePay through the static-IP proxy.
 *
 * Returns the raw body rather than parsed JSON: the caller has to verify a
 * signature over the exact bytes the bank sent, and re-serialising parsed JSON
 * would change them (key order, whitespace, number formatting) and break the
 * check.
 */
export async function sbiepayFetch(req: SbiepayRequest): Promise<SbiepayResponse> {
  const base = sbiepayBaseUrl();
  if (!base) throw new Error("sbiepay-environment-not-set");

  if (!isProxyConfigured()) {
    /*
     * Deliberately fatal. See the note above: a direct call would leave from an
     * unwhitelisted address, and on the live endpoint a partially-working
     * payment path is worse than a hard failure.
     */
    throw new Error(
      isLiveGateway()
        ? "sbiepay-proxy-not-configured (live gateway — refusing to call from an unwhitelisted IP)"
        : "sbiepay-proxy-not-configured",
    );
  }

  const url = `${base}${req.path.startsWith("/") ? "" : "/"}${req.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 20_000);

  try {
    const res = await undiciFetch(url, {
      method: req.method ?? "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...req.headers,
      },
      body: req.body,
      dispatcher: agent(),
      signal: controller.signal,
    } as UndiciInit);

    return { status: res.status, ok: res.ok, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Confirm the proxy is reachable and reporting the address SBI expects.
 *
 * Worth having as its own check: the difference between "the proxy is down" and
 * "the credentials are wrong" is invisible from a failed payment, and this
 * separates them before anyone starts debugging the wrong half.
 */
export async function checkProxy(expectedIp?: string): Promise<{
  ok: boolean;
  ip?: string;
  matchesWhitelist?: boolean;
  error?: string;
}> {
  if (!isProxyConfigured()) return { ok: false, error: "not-configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    // A third-party echo service, used ONLY for this diagnostic — never in the
    // payment path, so it is not a dependency of taking money.
    const res = await undiciFetch("https://api.ipify.org?format=json", {
      dispatcher: agent(),
      signal: controller.signal,
    } as UndiciInit);
    const { ip } = (await res.json()) as { ip?: string };
    if (!ip) return { ok: false, error: "no-ip-returned" };
    return {
      ok: true,
      ip,
      matchesWhitelist: expectedIp ? ip === expectedIp : undefined,
    };
  } catch (err) {
    /*
     * Translate the transport error into what it actually means.
     *
     * The raw messages are useless to whoever is reading this at 2am:
     * "This operation was aborted" is what an abort signal says, and it reads
     * like a crash rather than a timeout. Each of these has a different fix, so
     * the message names the fix.
     */
    const raw = err instanceof Error ? err.message : "";
    const code = (err as { cause?: { code?: string } })?.cause?.code ?? "";
    const host = proxyUrl()?.replace(/\/\/[^@]*@/, "//") ?? "the proxy";

    let error: string;
    if (/abort/i.test(raw) || code === "UND_ERR_CONNECT_TIMEOUT") {
      error = `no response from ${host} within 8s — the proxy is not running, or the security group is not allowing inbound on its port`;
    } else if (code === "ECONNREFUSED") {
      error = `${host} refused the connection — the instance is up but nothing is listening on that port`;
    } else if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      error = `${host} does not resolve — check the host in SBIEPAY_PROXY_URL`;
    } else if (/407|authentication|credentials/i.test(raw)) {
      error = "the proxy rejected the credentials in SBIEPAY_PROXY_URL";
    } else {
      error = raw || "unreachable";
    }
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}
