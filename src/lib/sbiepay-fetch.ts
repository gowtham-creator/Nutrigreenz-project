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

/** Undici nests the real failure several `cause` levels down. Walk to it. */
function rootCause(err: unknown): { message: string; code: string } {
  let node: unknown = err;
  let message = "";
  let code = "";
  for (let depth = 0; node instanceof Error && depth < 5; depth += 1) {
    // Keep the deepest non-empty values: the outer layers say "fetch failed",
    // which is true and useless.
    if (node.message) message = node.message;
    const c = (node as { code?: string }).code;
    if (c) code = c;
    node = (node as { cause?: unknown }).cause;
  }
  return { message, code };
}

/**
 * Confirm SBI is reachable through the proxy.
 *
 * Worth having as its own check: the difference between "the proxy is down" and
 * "the credentials are wrong" is invisible from a failed payment, and this
 * separates them before anyone starts debugging the wrong half.
 *
 * ── Why this probes SBI rather than an IP-echo service ────────────────────
 *
 * It used to fetch api.ipify.org to read the egress address back. That could
 * never have worked: the proxy's ACL allows SBI domains and denies everything
 * else, so squid correctly refused the echo service and the check reported the
 * proxy as broken while it was in fact working exactly as configured.
 *
 * Probing the gateway itself is the better test regardless. It exercises the
 * whole path a payment uses — proxy auth, the domain ACL, DNS, TLS to the bank
 * — so it cannot pass while real traffic fails. Any HTTP response at all is a
 * pass; a 404 from SBI still proves every hop in between is sound.
 *
 * The egress address is verified separately, and more reliably: the install
 * script prints it from the box itself, and `expectedIp` here confirms the
 * configured proxy is the machine holding that whitelisted address.
 */
export async function checkProxy(expectedIp?: string): Promise<{
  ok: boolean;
  ip?: string;
  matchesWhitelist?: boolean;
  error?: string;
}> {
  if (!isProxyConfigured()) return { ok: false, error: "not-configured" };

  const base = sbiepayBaseUrl();
  if (!base) return { ok: false, error: "sbiepay-environment-not-set" };

  // The proxy IS the egress point, so its host is the address SBI sees.
  let proxyHost: string | undefined;
  try {
    proxyHost = new URL(proxyUrl() as string).hostname;
  } catch {
    return { ok: false, error: "SBIEPAY_PROXY_URL is not a valid URL" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    await undiciFetch(base, {
      method: "GET",
      dispatcher: agent(),
      signal: controller.signal,
    } as UndiciInit);

    return {
      ok: true,
      ip: proxyHost,
      matchesWhitelist: expectedIp ? proxyHost === expectedIp : undefined,
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
    const { message: raw, code } = rootCause(err);
    // Never let the proxy password reach a screen or a log line.
    const host = proxyUrl()?.replace(/\/\/[^@]*@/, "//") ?? "the proxy";

    let error: string;
    if (/abort/i.test(raw) || code === "UND_ERR_CONNECT_TIMEOUT") {
      error = `no response from ${host} within 12s — squid is not running, or the Lightsail firewall is not allowing inbound on its port`;
    } else if (code === "ECONNREFUSED") {
      error = `${host} refused the connection — the instance is up but nothing is listening on that port`;
    } else if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      error = `${host} does not resolve — check the host in SBIEPAY_PROXY_URL`;
    } else if (/\b407\b|authentication required|credentials/i.test(raw)) {
      error = `the proxy rejected the credentials in SBIEPAY_PROXY_URL — re-run the install script to reissue the password`;
    } else if (/\b403\b|forbidden|denied/i.test(raw)) {
      /*
       * squid answered, and said no. Its ACL allows only SBI domains, so this
       * means the request was for something else — which is the proxy doing its
       * job, not a fault.
       */
      error = `the proxy is running but refused this destination — its ACL allows only SBI hosts`;
    } else {
      error = raw ? `${raw}${code ? ` (${code})` : ""}` : "unreachable";
    }
    return { ok: false, error };
  } finally {
    clearTimeout(timer);
  }
}
