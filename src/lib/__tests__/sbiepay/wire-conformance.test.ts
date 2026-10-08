/**
 * SBIePay wire conformance: the HTTP requests our client puts on the wire vs
 * the ones SBI's official SDK (epay_nodejs_sdk 1.2.0, environment "LIVE")
 * sends for the same call.
 *
 * Both clients run their real transport code against a local mock bank:
 *
 *   ours  SBIEPAY_PROXY_URL → mock; undici ProxyAgent CONNECTs to
 *         sbiepay.sbi.bank.in:443 and the mock terminates that TLS with a
 *         throwaway cert trusted only in this process
 *   SDK   its own axios instance, LIVE baseURL untouched, given the mock as
 *         an HTTP forward proxy
 *
 * No request is forwarded anywhere and a socket guard refuses any non-loopback
 * connection, so nothing here can reach SBI.
 *
 * Run: npm test
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { SBIEPayClient } from "epay_nodejs_sdk";
import { beginPayment } from "@/lib/payments";
import { createSbiepayOrder, resetSbiepayToken, type CreateOrderInput } from "@/lib/sbiepay-client";
import {
  SBI_LIVE_BASE,
  SBI_LIVE_HOST,
  STD_BASE64,
  installNetworkGuard,
  makeTestCredentials,
  mockOrderResponse,
  muteSbiDebugLogs,
  openEnvelope,
  routeSdkThroughProxy,
  startMockSbi,
  type MockSbi,
  type RecordedRequest,
} from "./helpers";

const creds = makeTestCredentials(32);
const SITE = "https://nutrigreenz.farm";

/** The request headers SBI's API contract is made of (compared case-insensitively). */
const CONTRACT_HEADERS = ["content-type", "merchant-api-key-id", "merchant-api-key-secret", "authorization"] as const;

const ENV: Record<string, string> = {
  PAYMENT_PROVIDER: "sbiepay",
  SBIEPAY_ENV: "live",
  SBIEPAY_LIVE_API_KEY_ID: creds.keyId,
  SBIEPAY_LIVE_API_KEY_SECRET: creds.keySecret,
  SBIEPAY_LIVE_ENCRYPTION_KEY: creds.encKey,
  NEXT_PUBLIC_SITE_URL: SITE,
};

let mock: MockSbi;
let guard: ReturnType<typeof installNetworkGuard>;
let unmute: () => void;
const savedEnv = new Map<string, string | undefined>();

before(async () => {
  guard = installNetworkGuard();
  unmute = muteSbiDebugLogs();
  mock = await startMockSbi(creds.encKey);
  for (const [k, v] of Object.entries({ ...ENV, SBIEPAY_PROXY_URL: mock.proxyUrl })) {
    savedEnv.set(k, process.env[k]);
    process.env[k] = v;
  }
});

after(async () => {
  for (const [k, v] of savedEnv) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await mock.close();
  unmute();
  guard.restore();
  assert.deepEqual(guard.blocked, [], "a request tried to leave loopback");
});

beforeEach(() => {
  mock.responseShape = "string";
  resetSbiepayToken(); // ours caches the token; force token/access every scenario
  mock.take();
});

function newSdk(): SBIEPayClient {
  const client = new SBIEPayClient(
    { apiKey: creds.keyId, apiSecret: creds.keySecret, encryptionKey: creds.encKey },
    "LIVE",
    false,
    "JSON",
  );
  const { baseURL } = routeSdkThroughProxy(client, mock.port);
  // The SDK's own LIVE base URL is used unmodified — only the proxy is set.
  assert.equal(baseURL, SBI_LIVE_BASE);
  return client;
}

/** Run one call through each client and return what each put on the wire. */
async function capturePair<A, B>(ours: () => Promise<A>, sdk: () => Promise<B>) {
  mock.take();
  const oursResult = await ours();
  const oursReqs = mock.take();
  const sdkResult = await sdk();
  const sdkReqs = mock.take();
  return { oursResult, oursReqs, sdkResult, sdkReqs };
}

const byPath = (reqs: RecordedRequest[], suffix: string) => {
  const found = reqs.filter((r) => new URL(r.url).pathname.endsWith(suffix));
  assert.equal(found.length, 1, `expected exactly one ${suffix} request, got ${found.length}`);
  return found[0];
};

const decryptBody = (r: RecordedRequest) => {
  const parsed = JSON.parse(r.body) as { encryptedRequest: string };
  return openEnvelope(creds.encKey, parsed.encryptedRequest).plaintext;
};

/** Every header difference, for the report — informational, not asserted. */
function headerDiff(ours: RecordedRequest, sdk: RecordedRequest): string[] {
  const names = new Set([...Object.keys(ours.headers), ...Object.keys(sdk.headers)]);
  const out: string[] = [];
  for (const n of [...names].sort()) {
    const a = ours.headers[n];
    const b = sdk.headers[n];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      const shown = (v: unknown) => (n === "authorization" || n.includes("secret") ? "<redacted>" : JSON.stringify(v));
      out.push(`${n}: ours=${a === undefined ? "absent" : shown(a)} sdk=${b === undefined ? "absent" : shown(b)}`);
    }
  }
  return out;
}

function assertSameRequest(ours: RecordedRequest, sdk: RecordedRequest, label: string) {
  assert.equal(ours.method, sdk.method, `${label}: method`);
  assert.equal(ours.url, sdk.url, `${label}: absolute URL`);
  for (const h of CONTRACT_HEADERS) {
    assert.equal(ours.headers[h], sdk.headers[h], `${label}: header ${h}`);
  }
}

test("network guard refuses a non-loopback socket (RFC 5737 TEST-NET address)", () => {
  assert.throws(() => net.connect(9, "192.0.2.1"), /network guard/);
  assert.equal(guard.blocked.pop(), "192.0.2.1");
});

/* ── 3. Wire parity ───────────────────────────────────────────────────── */

describe("wire: token/access + order/create, ours vs SBIEPayClient('LIVE')", () => {
  const input: CreateOrderInput = {
    orderAmount: 1499.5,
    currencyCode: "INR",
    orderRefNumber: "NG-WIRE-000001",
    returnUrl: `${SITE}/api/payments/sbiepay/callback`,
    expiry: 25,
  };

  test("same endpoints, methods, contract headers, auth format and body shape", async (t) => {
    const sdk = newSdk();
    const { oursResult, oursReqs, sdkResult, sdkReqs } = await capturePair(
      () => createSbiepayOrder(input),
      () => sdk.order.create(input),
    );

    // Both: exactly token/access then order/create.
    assert.deepEqual(oursReqs.map((r) => new URL(r.url).pathname), [
      "/api/transaction/v1/token/access",
      "/api/transaction/v1/order/create",
    ]);
    assert.deepEqual(sdkReqs.map((r) => new URL(r.url).pathname), oursReqs.map((r) => new URL(r.url).pathname));

    // Ours really went to the LIVE host over TLS (tunnel), the SDK addressed the same URLs.
    assert.ok(oursReqs.every((r) => r.channel === "connect-tunnel" && r.connectTarget === `${SBI_LIVE_HOST}:443`));
    assert.ok(sdkReqs.every((r) => r.channel === "absolute-form"));

    /* token/access */
    const oursTok = byPath(oursReqs, "/token/access");
    const sdkTok = byPath(sdkReqs, "/token/access");
    assertSameRequest(oursTok, sdkTok, "token/access");
    assert.equal(oursTok.url, `${SBI_LIVE_BASE}/token/access`);
    assert.equal(oursTok.method, "POST");
    assert.equal(oursTok.headers["merchant-api-key-id"], creds.keyId);
    assert.equal(oursTok.headers["merchant-api-key-secret"], creds.keySecret);
    assert.equal(oursTok.headers.authorization, undefined, "no bearer on the token call");
    assert.equal(oursTok.body, sdkTok.body, "token/access body");
    assert.equal(oursTok.body, "");

    /* order/create */
    const oursOrd = byPath(oursReqs, "/order/create");
    const sdkOrd = byPath(sdkReqs, "/order/create");
    assertSameRequest(oursOrd, sdkOrd, "order/create");
    assert.equal(oursOrd.url, `${SBI_LIVE_BASE}/order/create`);
    assert.equal(oursOrd.headers["content-type"], "application/json");
    assert.equal(oursOrd.headers.authorization, `Bearer ${mock.token}`);
    assert.equal(sdkOrd.headers.authorization, `Bearer ${mock.token}`);

    // Body: exactly {"encryptedRequest":"<std base64>"}, byte-identical apart from the ciphertext.
    for (const r of [oursOrd, sdkOrd]) {
      const parsed = JSON.parse(r.body) as Record<string, unknown>;
      assert.deepEqual(Object.keys(parsed), ["encryptedRequest"]);
      assert.equal(typeof parsed.encryptedRequest, "string");
      assert.match(parsed.encryptedRequest as string, STD_BASE64);
    }
    const skeleton = (r: RecordedRequest) =>
      r.body.replace((JSON.parse(r.body) as { encryptedRequest: string }).encryptedRequest, "<ct>");
    assert.equal(skeleton(oursOrd), skeleton(sdkOrd));
    assert.equal(skeleton(oursOrd), '{"encryptedRequest":"<ct>"}');
    assert.equal(decryptBody(oursOrd), decryptBody(sdkOrd), "encrypted plaintext");
    assert.equal(decryptBody(oursOrd), JSON.stringify(input));

    // Both clients decrypt the bank's answer to the same object.
    assert.equal((sdkResult as { status: number }).status, 1);
    assert.deepEqual(oursResult, (sdkResult as { data: unknown[] }).data[0]);
    assert.deepEqual(oursResult, mockOrderResponse(input as unknown as Record<string, unknown>));

    // Informational: every non-contract header difference, and raw name casing.
    for (const line of headerDiff(oursTok, sdkTok)) t.diagnostic(`token/access  ${line}`);
    for (const line of headerDiff(oursOrd, sdkOrd)) t.diagnostic(`order/create  ${line}`);
    const contractNames = (r: RecordedRequest) =>
      r.rawHeaderNames.filter((n) => (CONTRACT_HEADERS as readonly string[]).includes(n.toLowerCase())).sort();
    t.diagnostic(`order/create raw header names  ours=${contractNames(oursOrd).join(",")}`);
    t.diagnostic(`order/create raw header names  sdk=${contractNames(sdkOrd).join(",")}`);
  });

  test("the key-id/secret pair rides on order/create too, as in the SDK", async () => {
    const sdk = newSdk();
    const { oursReqs, sdkReqs } = await capturePair(
      () => createSbiepayOrder({ ...input, orderRefNumber: "NG-WIRE-000002" }),
      () => sdk.order.create({ ...input, orderRefNumber: "NG-WIRE-000002" }),
    );
    for (const reqs of [oursReqs, sdkReqs]) {
      const ord = byPath(reqs, "/order/create");
      assert.equal(ord.headers["merchant-api-key-id"], creds.keyId);
      assert.equal(ord.headers["merchant-api-key-secret"], creds.keySecret);
    }
  });

  test("response envelope: data[0] as {encryptedResponse} decodes like the SDK", async () => {
    // SBI's SDK reads `data[0].encryptedResponse || data[0]` — the bank may send
    // either shape. Ours must accept both to be a drop-in for the SDK.
    mock.responseShape = "object";
    const sdk = newSdk();
    const ref = { ...input, orderRefNumber: "NG-WIRE-000003" };
    const sdkResult = (await sdk.order.create(ref)) as { status: number; data: unknown[] };
    assert.equal(sdkResult.status, 1);
    resetSbiepayToken();
    const oursResult = await createSbiepayOrder(ref);
    assert.deepEqual(oursResult, sdkResult.data[0]);
  });
});

/* ── 2. JSON serialisation parity for beginPayment's order payload ───── */

describe("serialisation: beginPayment's encrypted plaintext == SDK order.create plaintext", () => {
  const cases: [label: string, totalPaise: number, currency: string][] = [
    ["1 paisa", 1, "INR"],
    ["10 paise", 10, "INR"],
    ["30 paise", 30, "INR"],
    ["99 paise", 99, "INR"],
    ["₹1", 100, "INR"],
    ["₹1.50", 150, "INR"],
    ["₹19.99", 1999, "INR"],
    ["₹123.45", 12345, "INR"],
    ["₹1,000", 100000, "INR"],
    ["₹99,999.99", 9999999, "INR"],
    ["blank currency falls back to INR", 4999, ""],
  ];

  for (const [label, totalPaise, currency] of cases) {
    test(label, async () => {
      const orderNumber = `NG-SER-${totalPaise}`;
      // The object a merchant would hand the SDK for this order.
      const sameObject = {
        orderAmount: totalPaise / 100,
        currencyCode: currency || "INR",
        orderRefNumber: orderNumber,
        returnUrl: `${SITE}/api/payments/sbiepay/callback`,
        expiry: 25,
      };
      const sdk = newSdk();
      const { oursResult: handoff, oursReqs, sdkReqs } = await capturePair(
        () => beginPayment({ id: `id-${totalPaise}`, orderNumber, totalPaise, currency }),
        () => sdk.order.create(sameObject),
      );

      const oursPlain = decryptBody(byPath(oursReqs, "/order/create"));
      const sdkPlain = decryptBody(byPath(sdkReqs, "/order/create"));
      assert.equal(oursPlain, sdkPlain, "plaintext differs from what the SDK encrypts");
      assert.equal(oursPlain, JSON.stringify(sameObject));
      assert.deepEqual(JSON.parse(oursPlain), sameObject);

      // And beginPayment hands back the bank's transactionUrl / reference.
      const expected = mockOrderResponse(sameObject);
      assert.deepEqual(handoff, { action: expected.transactionUrl, fields: {}, reference: expected.sbiOrderRefNumber });
    });
  }
});
