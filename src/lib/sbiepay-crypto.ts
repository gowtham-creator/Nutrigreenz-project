import "server-only";

/**
 * SBIePay payload encryption.
 *
 * Ported from SBI's own `epay_nodejs_sdk@1.0.1` (`Crypto.ts`) so the wire format
 * matches byte for byte. The SDK itself is deliberately NOT installed — see
 * the note at the bottom of this file for why.
 *
 * ── The specification, as SBI implements it ───────────────────────────────
 *
 *   Cipher     AES-GCM
 *   Key        base64-encoded, imported raw; size implied by its length
 *              (16/24/32 bytes → AES-128/192/256)
 *   IV         16 random bytes, PREPENDED to the ciphertext
 *   Auth tag   128 bits, appended to the ciphertext by WebCrypto
 *   Envelope   base64( iv ‖ ciphertext ‖ tag )
 *
 * Two of those are not what a reasonable person would guess. GCM rather than
 * CBC means there is no padding scheme at all, and a 16-byte IV is unusual —
 * GCM's standard nonce is 12. Both had to come from their source; guessing
 * either produces a request the bank rejects with a generic decryption error
 * that names neither.
 *
 * WebCrypto is used rather than `createCipheriv` because SBI uses WebCrypto,
 * and the two differ in where they put the auth tag: WebCrypto appends it to
 * the ciphertext, Node's cipher hands it back separately via `getAuthTag()`.
 * Matching their implementation removes any chance of assembling it wrongly.
 */

const IV_BYTES = 16;
const TAG_BITS = 128;

/** Import the base64 working key. Key size is inferred from its length. */
async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = Buffer.from(base64Key, "base64");
  if (![16, 24, 32].includes(raw.length)) {
    // Caught here rather than at the bank: an oddly-sized key almost always
    // means the wrong value was pasted into the variable — the API secret
    // instead of the encryption key, say — and the bank's error for that is
    // indistinguishable from a dozen other faults.
    throw new Error(
      `sbiepay-bad-encryption-key: decoded to ${raw.length} bytes, expected 16, 24 or 32`,
    );
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypt a request payload. Returns base64( iv ‖ ciphertext ‖ tag ). */
export async function encryptPayload(base64Key: string, value: unknown): Promise<string> {
  const plaintext = typeof value === "string" ? value : JSON.stringify(value);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await importKey(base64Key);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: TAG_BITS },
    key,
    new TextEncoder().encode(plaintext),
  );

  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ciphertext), iv.length);
  // Buffer rather than btoa(String.fromCharCode(...)) — the spread in SBI's
  // own helper overflows the call stack on a large payload.
  return Buffer.from(out).toString("base64");
}

/** Decrypt a base64( iv ‖ ciphertext ‖ tag ) response into its plaintext. */
export async function decryptPayload(base64Key: string, encoded: string): Promise<string> {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length <= IV_BYTES) throw new Error("sbiepay-ciphertext-too-short");

  const key = await importKey(base64Key);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.subarray(0, IV_BYTES), tagLength: TAG_BITS },
    key,
    bytes.subarray(IV_BYTES),
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * Decode the payload SBIePay posts back to the return URL.
 *
 * It arrives URL-safe base64 encoded, wrapping the ordinary base64 envelope.
 * The quote-stripping mirrors SBI's own decoder: the inner value comes back as
 * a JSON string literal, so its surrounding quotes have to go before the result
 * is a valid base64 envelope.
 *
 * Decryption here is also the AUTHENTICATION step. GCM verifies the auth tag,
 * so a payload that decrypts is a payload that was produced with the shared
 * key and has not been altered — which is what lets the callback treat this
 * result as trustworthy while treating the surrounding query string as not.
 */
export async function decodeCallbackPayload(
  base64Key: string,
  payload: string,
): Promise<Record<string, unknown>> {
  let s = payload.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";

  const inner = Buffer.from(s, "base64").toString("utf8").replace(/"/g, "");
  const plaintext = await decryptPayload(base64Key, inner);
  return JSON.parse(plaintext) as Record<string, unknown>;
}

/*
 * ── Why the SDK is not installed ──────────────────────────────────────────
 *
 * `epay_nodejs_sdk` is a thin wrapper: two auth headers, eight endpoint paths,
 * and the crypto above. It is excellent as a specification and was necessary to
 * read. Depending on it is a different question, and the deciding factor is not
 * taste:
 *
 * The SDK issues its calls through **axios**. Our SBIePay traffic has to leave
 * from the static IP the bank has whitelisted, and that is implemented with an
 * undici `ProxyAgent` (see sbiepay-fetch.ts). Axios does not use undici
 * dispatchers — it uses Node's http/https agents — so every SDK call would
 * bypass the proxy, leave from a rotating Vercel address, and be refused.
 *
 * Making the SDK work would mean adding `https-proxy-agent`, wiring it into the
 * SDK's axios instance, and hoping that stays true across their releases. The
 * alternative is this file plus a request helper we already have, which routes
 * through the proxy and fails closed when it is absent.
 *
 * Pinned to the shape of 1.0.1. If SBI changes the envelope, this is the file
 * to re-check against their SDK.
 */
