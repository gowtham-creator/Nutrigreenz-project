/**
 * SBIePay crypto conformance: our port vs SBI's official SDK (epay_nodejs_sdk
 * 1.2.0, the real npm bundle) vs SBI's Crypto.ts, with Node's native cipher as
 * an independent fourth reading of the spec.
 *
 * Run: npm test
 */
import { afterAll, beforeAll, describe, test, vi } from "vitest";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { SBIEPayClient } from "epay_nodejs_sdk";
import { decodeCallbackPayload, decryptPayload, encryptPayload } from "@/lib/sbiepay-crypto";
import * as sbiRef from "./fixtures/sbi-crypto-reference";
import {
  STD_BASE64,
  makeTestCredentials,
  muteSbiDebugLogs,
  openEnvelope,
  sealEnvelope,
  withFixedRandom,
} from "./helpers";

// The libraries under test are `import "server-only"`; Next resolves that to a
// no-op on the server, so do the same here.
vi.mock("server-only", () => ({}));

const creds = makeTestCredentials(32);
const sdkFor = (encKey: string, responseType: "STRING" | "JSON") =>
  new SBIEPayClient(
    { apiKey: creds.keyId, apiSecret: creds.keySecret, encryptionKey: encKey },
    "LIVE",
    false,
    responseType,
  );

let unmute: () => void;
beforeAll(() => {
  unmute = muteSbiDebugLogs();
});
afterAll(() => unmute());

/* ── Payload corpus ───────────────────────────────────────────────────── */

const STRING_PAYLOADS: [label: string, value: string][] = [
  ["ascii word", "hello"],
  ["single char", "x"],
  ["exactly one AES block", "0123456789abcdef"],
  ["all printable ascii", Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("")],
  ["json text with escapes", '{"a":"quote \\" backslash \\\\ slash / newline \\n"}'],
  ["control chars", "line1\nline2\r\n\t\u0000\u001f\u007f"],
  ["rupee sign", "₹1,499.50"],
  ["devanagari", "नमस्ते — ताज़ी सब्ज़ियाँ"],
  ["cjk", "你好，世界"],
  ["emoji (astral plane)", "🌿🥬🥕 fresh"],
  ["combining marks", "é vs é"],
  ["large ~100 KB", "ab".repeat(50_000)],
];

const OBJECT_PAYLOADS: [label: string, value: unknown][] = [
  ["amount 1", { orderAmount: 1 }],
  ["amount 1.5", { orderAmount: 1.5 }],
  ["amount 0.1 + 0.2", { orderAmount: 0.1 + 0.2 }],
  ["amount 1999/100", { orderAmount: 1999 / 100 }],
  ["amount 1e21", { orderAmount: 1e21 }],
  ["-0 and min subnormal", { a: -0, b: 5e-324 }],
  [
    "order/create shape",
    {
      orderAmount: 1499.5,
      currencyCode: "INR",
      orderRefNumber: "NG-2026-000123",
      returnUrl: "https://nutrigreenz.farm/api/payments/sbiepay/callback",
      expiry: 25,
    },
  ],
  ["unicode values", { name: "श्री ₹ 你好", note: "🌿" }],
  ["nested + array + null/bool", { list: [1, "two", { three: 3 }, null, true, false] }],
  [
    "large array (~80 KB JSON)",
    { items: Array.from({ length: 2000 }, (_, i) => ({ sku: `SKU-${i}`, qty: i % 7, price: i / 100 })) },
  ],
];

const ALL: [string, unknown][] = [...STRING_PAYLOADS, ...OBJECT_PAYLOADS];
/** What both sides must put inside the envelope for a given input. */
const plaintextOf = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

/* ── 1. Cross-compatibility ───────────────────────────────────────────── */

describe("crypto: ours <-> SBI SDK 1.2.0 <-> SBI Crypto.ts", () => {
  const sdk = sdkFor(creds.encKey, "STRING");

  for (const [label, value] of ALL) {
    test(`ours encrypt -> SDK decrypt + Crypto.ts decrypt + native decrypt: ${label}`, async () => {
      const expected = plaintextOf(value);
      const envelope = await encryptPayload(creds.encKey, value);

      // Envelope: standard base64, padded, no whitespace / URL-safe chars.
      assert.match(envelope, STD_BASE64);
      assert.doesNotMatch(envelope, /[\s\-_]/);
      // Layout: iv(16) ‖ ciphertext(len(utf8)) ‖ tag(16), opened by Node's native GCM.
      const opened = openEnvelope(creds.encKey, envelope);
      assert.equal(opened.bytes.length, 16 + Buffer.byteLength(expected, "utf8") + 16);
      assert.equal(opened.plaintext, expected);

      assert.equal(await sdk.crypto.decrypt(envelope), expected);
      assert.equal(await sbiRef.decrypt(creds.encKey, envelope), expected);
    });

    test(`SDK encrypt -> ours decrypt (and Crypto.ts encrypt -> ours): ${label}`, async () => {
      const expected = plaintextOf(value);
      const fromSdk: string = await sdk.crypto.encrypt(value);
      assert.match(fromSdk, STD_BASE64);
      assert.equal(await decryptPayload(creds.encKey, fromSdk), expected);

      const fromRef = await sbiRef.encrypt(creds.encKey, expected);
      assert.equal(await decryptPayload(creds.encKey, fromRef), expected);
    });

    test(`same IV => byte-identical envelope from all four implementations: ${label}`, async () => {
      const iv = randomBytes(16);
      const expected = plaintextOf(value);
      const ours = await withFixedRandom(iv, () => encryptPayload(creds.encKey, value));
      const theirs: string = await withFixedRandom(iv, () => sdk.crypto.encrypt(value));
      const reference = await withFixedRandom(iv, () => sbiRef.encrypt(creds.encKey, expected));
      const native = sealEnvelope(creds.encKey, expected, iv);

      assert.equal(Buffer.from(ours, "base64").subarray(0, 16).toString("hex"), iv.toString("hex"));
      assert.equal(ours, theirs, "ours != SDK");
      assert.equal(ours, reference, "ours != Crypto.ts");
      assert.equal(ours, native, "ours != node-native AES-GCM");
    });
  }

  for (const keyBytes of [16, 24, 32]) {
    test(`AES-${keyBytes * 8} key: cross-decrypt both directions`, async () => {
      const k = randomBytes(keyBytes).toString("base64");
      const s = sdkFor(k, "STRING");
      for (const [, value] of [STRING_PAYLOADS[6], OBJECT_PAYLOADS[6]]) {
        const expected = plaintextOf(value);
        assert.equal(await s.crypto.decrypt(await encryptPayload(k, value)), expected);
        assert.equal(await decryptPayload(k, await s.crypto.encrypt(value)), expected);
      }
    });
  }

  test("every encryption draws a fresh 16-byte IV (no nonce reuse), in ours and the SDK", async () => {
    const ivs = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      ivs.add(Buffer.from(await encryptPayload(creds.encKey, "same"), "base64").subarray(0, 16).toString("hex"));
      ivs.add(Buffer.from(await sdk.crypto.encrypt("same"), "base64").subarray(0, 16).toString("hex"));
    }
    assert.equal(ivs.size, 40);
  });

  test("a flipped ciphertext bit is rejected by ours and by the SDK (GCM auth)", async () => {
    const bytes = Buffer.from(await encryptPayload(creds.encKey, { orderAmount: 1.5 }), "base64");
    bytes[20] ^= 0x01;
    const tampered = bytes.toString("base64");
    await assert.rejects(decryptPayload(creds.encKey, tampered));
    await assert.rejects(sdk.crypto.decrypt(tampered));
  });

  test("1 MB payload: ours encrypts it and the SDK decrypts it", async ({ annotate }) => {
    const big = "₹".repeat(350_000); // ~1 MB of UTF-8
    const envelope = await encryptPayload(creds.encKey, big);
    assert.equal(await sdk.crypto.decrypt(envelope), big);
    // Informational: the SDK's own encrypt spreads every byte into
    // String.fromCharCode(...) and overflows the stack well before this size.
    try {
      await sdk.crypto.encrypt(big);
      await annotate("SDK encrypt handled 1 MB on this runtime");
    } catch {
      await annotate("SDK encrypt cannot handle 1 MB (call-stack overflow in its btoa helper); ours can");
    }
  });
});

/* ── 4. Callback decode ───────────────────────────────────────────────── */

describe("callback: ours decodeCallbackPayload == SDK crypto.decodeCallback == Crypto.ts decodeCallback", () => {
  const sdkJson = sdkFor(creds.encKey, "JSON");
  const callback = {
    orderRefNumber: "NG-2026-000123",
    sbiOrderRefNumber: "SBI4F2A9C1D7E00",
    atrnNumber: "ATRN0000123456",
    orderAmount: 1499.5,
    totalAmount: 1501.27,
    currencyCode: "INR",
    status: "PAID",
    payMode: "UPI",
    note: "₹ paid ✓ 🌿",
  };

  /** The bank's side: Crypto.ts-encrypt, wrap as a JSON string, URL-safe base64. */
  async function bankCallback(): Promise<{ inner: string; quoted: string }> {
    const inner = await sbiRef.encrypt(creds.encKey, JSON.stringify(callback));
    return { inner, quoted: JSON.stringify(inner) };
  }

  test("all wrapping variants decode identically", async () => {
    const { inner, quoted } = await bankCallback();
    const std = Buffer.from(quoted, "utf8").toString("base64");
    // The wrapped text is pure ASCII, and base64 of bytes < 0x80 can never yield
    // sextets 62/63 — so for a real callback the URL-safe alphabet changes
    // nothing and only the '=' padding differs between the variants below.
    assert.doesNotMatch(std, /[+/]/);
    const variants: [string, string][] = [
      ["url-safe, unpadded, quoted (canonical)", Buffer.from(quoted).toString("base64url")],
      ["padded, quoted", std],
      ["url-safe, unquoted inner", Buffer.from(inner).toString("base64url")],
    ];
    for (const [label, payload] of variants) {
      const ours = await decodeCallbackPayload(creds.encKey, payload);
      const theirs = await sdkJson.crypto.decodeCallback(payload);
      const reference = await sbiRef.decodeCallback(payload, creds.encKey);
      assert.deepEqual(ours, theirs, `${label}: ours != SDK`);
      assert.deepEqual(ours, reference, `${label}: ours != Crypto.ts`);
      assert.deepEqual(ours, callback, `${label}: wrong plaintext`);
    }
  });

  test("an SDK-encrypted callback decodes the same way", async () => {
    const inner: string = await sdkFor(creds.encKey, "STRING").crypto.encrypt(callback);
    const payload = Buffer.from(JSON.stringify(inner)).toString("base64url");
    assert.deepEqual(await decodeCallbackPayload(creds.encKey, payload), await sdkJson.crypto.decodeCallback(payload));
  });

  test("a tampered callback is rejected by both", async () => {
    const { inner } = await bankCallback();
    const bytes = Buffer.from(inner, "base64");
    bytes[bytes.length - 1] ^= 0x80; // corrupt the tag
    const payload = Buffer.from(JSON.stringify(bytes.toString("base64"))).toString("base64url");
    await assert.rejects(decodeCallbackPayload(creds.encKey, payload));
    await assert.rejects(sdkJson.crypto.decodeCallback(payload));
  });

  test("documented divergence: ours also accepts a JSON-escaped '\\/' inner; the SDK does not", async () => {
    // Not a wire difference: it only widens what WE accept. Buffer's base64
    // decoder skips the backslashes; the SDK's atob() throws on them. GCM still
    // authenticates the result, so the extra leniency cannot admit a forgery.
    let inner = "";
    while (!inner.includes("/")) inner = await sbiRef.encrypt(creds.encKey, JSON.stringify(callback));
    const escaped = `"${inner.replace(/\//g, "\\/")}"`;
    const payload = Buffer.from(escaped).toString("base64url");
    assert.deepEqual(await decodeCallbackPayload(creds.encKey, payload), callback);
    await assert.rejects(sdkJson.crypto.decodeCallback(payload));
  });
});
