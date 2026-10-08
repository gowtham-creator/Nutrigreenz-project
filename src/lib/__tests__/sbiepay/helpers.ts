/**
 * Shared machinery for the SBIePay conformance tests.
 *
 * Nothing here talks to SBI. Every request either client makes is answered by
 * a local mock that stands in for the bank, and a socket guard refuses any
 * connection that is not to loopback, so a misrouted request fails the test
 * instead of reaching a whitelisted, money-moving endpoint.
 */
import {
  X509Certificate,
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
  type CipherGCMTypes,
} from "node:crypto";
import http from "node:http";
import net from "node:net";
import tls from "node:tls";

export const SBI_LIVE_HOST = "sbiepay.sbi.bank.in";
/** The SDK's hard-coded LIVE baseURL, and what our `live` env resolves to. */
export const SBI_LIVE_BASE = `https://${SBI_LIVE_HOST}/api/transaction/v1`;

/** Standard (RFC 4648 §4) base64 with padding: no URL-safe alphabet, no whitespace. */
export const STD_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface TestCredentials {
  keyId: string;
  keySecret: string;
  /** base64 AES key — random per run, never a real credential. */
  encKey: string;
}

export function makeTestCredentials(keyBytes = 32): TestCredentials {
  return {
    keyId: `test-key-id-${randomBytes(6).toString("hex")}`,
    keySecret: `test-key-secret-${randomBytes(12).toString("hex")}`,
    encKey: randomBytes(keyBytes).toString("base64"),
  };
}

/* ── An independent third implementation of the envelope ─────────────────
 *
 * Node's native cipher API, written from the spec rather than from either
 * client: base64( iv[16] ‖ ciphertext ‖ tag[16] ). The mock bank uses it, and
 * the tests use it to take envelopes apart, so agreement between ours and the
 * SDK is also checked against something neither of them wrote.
 */

const IV_BYTES = 16;
const TAG_BYTES = 16;

function gcmAlgorithm(key: Buffer): CipherGCMTypes {
  const alg = { 16: "aes-128-gcm", 24: "aes-192-gcm", 32: "aes-256-gcm" } as const;
  const found = alg[key.length as 16 | 24 | 32];
  if (!found) throw new Error(`unsupported AES key length ${key.length}`);
  return found;
}

export function sealEnvelope(encKey: string, plaintext: string, iv: Buffer = randomBytes(IV_BYTES)): string {
  const key = Buffer.from(encKey, "base64");
  const cipher = createCipheriv(gcmAlgorithm(key), key, iv, { authTagLength: TAG_BYTES });
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]).toString("base64");
}

export function openEnvelope(encKey: string, envelope: string) {
  const bytes = Buffer.from(envelope, "base64");
  const iv = bytes.subarray(0, IV_BYTES);
  const ciphertext = bytes.subarray(IV_BYTES, bytes.length - TAG_BYTES);
  const tag = bytes.subarray(bytes.length - TAG_BYTES);
  const key = Buffer.from(encKey, "base64");
  const decipher = createDecipheriv(gcmAlgorithm(key), key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return { bytes, iv, ciphertext, tag, plaintext };
}

/* ── Deterministic IV ─────────────────────────────────────────────────────
 *
 * Ours calls the global `crypto.getRandomValues`; the SDK calls
 * `require("crypto").getRandomValues`, which Node forwards to the same webcrypto
 * instance. Overriding it on that instance pins the IV for BOTH, so the two
 * outputs can be compared byte for byte rather than only by round trip.
 */
type RandomFill = <T extends ArrayBufferView | null>(array: T) => T;

export async function withFixedRandom<T>(bytes: Uint8Array, fn: () => Promise<T>): Promise<T> {
  const target = globalThis.crypto as unknown as { getRandomValues: RandomFill };
  const hadOwn = Object.prototype.hasOwnProperty.call(target, "getRandomValues");
  const previous = target.getRandomValues;
  const fixed: RandomFill = (array) => {
    if (array) {
      const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      view.set(bytes.subarray(0, view.length));
    }
    return array;
  };
  target.getRandomValues = fixed;
  try {
    return await fn();
  } finally {
    if (hadOwn) target.getRandomValues = previous;
    else delete (target as Partial<typeof target>).getRandomValues;
  }
}

/* ── Quieten SBI's debug prints ───────────────────────────────────────────
 * Both the SDK bundle and Crypto.ts console.log("encrypt aes") on every call.
 */
export function muteSbiDebugLogs(): () => void {
  const original = console.log;
  console.log = (...args: unknown[]) => {
    if (args.length === 1 && (args[0] === "encrypt aes" || args[0] === "encrypt aes return")) return;
    original(...args);
  };
  return () => {
    console.log = original;
  };
}

/* ── Network guard ────────────────────────────────────────────────────────
 *
 * Refuses every outbound socket that is not to loopback. Both clients reach
 * the mock as a PROXY on 127.0.0.1, so they never resolve or dial SBI's host;
 * if a code path ever bypassed the proxy, this turns that into a thrown error
 * (and a recorded attempt the tests assert is empty) rather than a live call.
 */
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export function installNetworkGuard(): { blocked: string[]; restore: () => void } {
  const blocked: string[] = [];
  const proto = net.Socket.prototype as unknown as { connect: (...args: unknown[]) => unknown };
  const original = proto.connect;
  proto.connect = function guardedConnect(this: net.Socket, ...args: unknown[]) {
    // net.connect() passes a normalised [options, cb] array; direct calls pass
    // (options, cb), (port, host, cb) or (path, cb).
    const first = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0];
    let host: string | undefined;
    let ipcPath: string | undefined;
    if (first && typeof first === "object") {
      host = (first as { host?: string }).host;
      ipcPath = (first as { path?: string }).path;
    } else if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
      host = typeof args[1] === "string" ? args[1] : undefined;
    } else if (typeof first === "string") {
      ipcPath = first;
    }
    if (!ipcPath && host !== undefined && !LOOPBACK.has(host)) {
      blocked.push(host);
      throw new Error(`network guard: refused outbound connection to ${host}`);
    }
    return original.apply(this, args);
  };
  return {
    blocked,
    restore: () => {
      proto.connect = original;
    },
  };
}

/* ── A throwaway certificate for sbiepay.sbi.bank.in ──────────────────────
 *
 * Our client tunnels through the proxy with CONNECT and speaks TLS to the
 * bank's hostname, so reading its request means terminating that TLS. The cert
 * is generated in memory per run (P-256, one day), trusted only inside this
 * test process via tls.setDefaultCACertificates, and never written to disk.
 * Hostname verification stays ON — the client still has to be talking to
 * "sbiepay.sbi.bank.in" for the handshake to succeed.
 */
function der(tag: number, ...parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts);
  let len: Buffer;
  if (body.length < 0x80) {
    len = Buffer.from([body.length]);
  } else {
    const hex = body.length.toString(16);
    const raw = Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex");
    len = Buffer.concat([Buffer.from([0x80 | raw.length]), raw]);
  }
  return Buffer.concat([Buffer.from([tag]), len, body]);
}
const seq = (...p: Buffer[]) => der(0x30, ...p);
const set = (...p: Buffer[]) => der(0x31, ...p);
function oid(dotted: string): Buffer {
  const [a, b, ...rest] = dotted.split(".").map(Number);
  const out = [40 * a + b];
  for (const n of rest) {
    const chunk = [n & 0x7f];
    for (let v = n >>> 7; v > 0; v >>>= 7) chunk.unshift((v & 0x7f) | 0x80);
    out.push(...chunk);
  }
  return der(0x06, Buffer.from(out));
}
const utcTime = (d: Date) =>
  der(0x17, Buffer.from(`${d.toISOString().replace(/[-:T]/g, "").slice(2, 14)}Z`, "ascii"));

export function makeServerCertificate(hostname: string): { certPem: string; keyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const ecdsaSha256 = seq(oid("1.2.840.10045.4.3.2"));
  const name = seq(set(seq(oid("2.5.4.3"), der(0x0c, Buffer.from(hostname, "utf8")))));
  const serial = randomBytes(8);
  serial[0] &= 0x7f;
  const now = Date.now();
  const san = seq(oid("2.5.29.17"), der(0x04, seq(der(0x82, Buffer.from(hostname, "ascii")))));
  const tbs = seq(
    der(0xa0, der(0x02, Buffer.from([2]))), // v3
    der(0x02, serial),
    ecdsaSha256,
    name,
    seq(utcTime(new Date(now - 60_000)), utcTime(new Date(now + 86_400_000))),
    name,
    publicKey.export({ type: "spki", format: "der" }),
    der(0xa3, seq(san)),
  );
  const signature = sign("sha256", tbs, privateKey);
  const cert = seq(tbs, ecdsaSha256, der(0x03, Buffer.concat([Buffer.from([0]), signature])));
  const b64 = cert.toString("base64").match(/.{1,64}/g)?.join("\n") ?? "";
  const certPem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;

  // Fail here, loudly, if the hand-rolled DER is malformed.
  const parsed = new X509Certificate(certPem);
  if (!parsed.verify(publicKey) || parsed.checkHost(hostname) !== hostname) {
    throw new Error("generated test certificate failed self-verification");
  }
  return { certPem, keyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
}

/* ── The mock bank, reachable only as a proxy ─────────────────────────────
 *
 * One HTTP server on 127.0.0.1 accepts both ways a client can use a proxy:
 *
 *   absolute-form  `POST https://sbiepay.sbi.bank.in/... HTTP/1.1` — what
 *                  axios (the SDK) sends when given a `proxy` config
 *   CONNECT        `CONNECT sbiepay.sbi.bank.in:443` then TLS — what our undici
 *                  ProxyAgent does. The tunnel is terminated here with the
 *                  throwaway cert and the inner HTTP request is read in clear.
 *
 * Either way the request is recorded exactly as received and answered the way
 * SBI does: `{ status: 1, data: [ <token> | <encrypted response> ] }`. Nothing
 * is ever forwarded anywhere.
 */
export interface RecordedRequest {
  channel: "absolute-form" | "connect-tunnel";
  /** The CONNECT authority for tunnelled requests, e.g. "sbiepay.sbi.bank.in:443". */
  connectTarget?: string;
  method: string;
  /** Absolute URL the client addressed. */
  url: string;
  /** Node lower-cases names, so lookups here are case-insensitive by construction. */
  headers: http.IncomingHttpHeaders;
  /** Header names exactly as the client sent them on the wire. */
  rawHeaderNames: string[];
  body: string;
}

export interface MockSbi {
  /** e.g. http://127.0.0.1:54321 — what SBIEPAY_PROXY_URL is set to. */
  proxyUrl: string;
  port: number;
  /** The bearer token the mock issues on token/access. */
  token: string;
  /** How data[0] is shaped in encrypted responses (SDK accepts both). */
  responseShape: "string" | "object";
  connectTargets: string[];
  /** Drain and return everything recorded since the last take(). */
  take(): RecordedRequest[];
  close(): Promise<void>;
}

/** SBI-like JWT: only the payload is read by our client (mId, exp). */
function makeToken(): string {
  const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({ mId: "TESTMID0001", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${header}.${payload}.${randomBytes(32).toString("base64url")}`;
}

/** Deterministic per order so both clients get byte-identical responses. */
export function mockOrderResponse(order: Record<string, unknown>) {
  const ref = String(order.orderRefNumber ?? "");
  const digest = createHash("sha256").update(ref).digest("hex");
  return {
    orderAmount: order.orderAmount,
    currencyCode: order.currencyCode,
    orderRefNumber: ref,
    sbiOrderRefNumber: `SBI${digest.slice(0, 12).toUpperCase()}`,
    status: "CREATED",
    // Never fetched by anything — just a value for beginPayment to hand back.
    transactionUrl: `https://${SBI_LIVE_HOST}/secure/mock-checkout/${digest.slice(0, 16)}`,
    orderHash: digest.slice(16, 48),
    returnUrl: order.returnUrl,
    orderRetryCount: 0,
    mId: "TESTMID0001",
  };
}

export async function startMockSbi(encKey: string): Promise<MockSbi> {
  const { certPem, keyPem } = makeServerCertificate(SBI_LIVE_HOST);
  let recorded: RecordedRequest[] = [];
  const connectTargets: string[] = [];
  const sockets = new Set<net.Socket>();
  const tunnelTarget = new WeakMap<net.Socket, string>();
  const state = { token: makeToken(), responseShape: "string" as "string" | "object" };

  const send = (res: http.ServerResponse, status: number, body: unknown) => {
    const text = JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
    res.end(text);
  };

  const answer = (url: string, body: string, res: http.ServerResponse) => {
    const path = new URL(url).pathname;
    if (path === "/api/transaction/v1/token/access") {
      return send(res, 200, { status: 1, data: [state.token] });
    }
    if (path === "/api/transaction/v1/order/create") {
      try {
        const { encryptedRequest } = JSON.parse(body) as { encryptedRequest: string };
        const order = JSON.parse(openEnvelope(encKey, encryptedRequest).plaintext) as Record<string, unknown>;
        const sealed = sealEnvelope(encKey, JSON.stringify(mockOrderResponse(order)));
        return send(res, 200, {
          status: 1,
          data: [state.responseShape === "object" ? { encryptedResponse: sealed } : sealed],
        });
      } catch (err) {
        return send(res, 200, {
          status: 0,
          errors: [{ errorCode: "905", errorMessage: `mock: could not decrypt request (${String(err)})` }],
        });
      }
    }
    return send(res, 404, { status: 0, errors: [{ errorCode: "404", errorMessage: `mock: no route ${path}` }] });
  };

  const recorder =
    (channel: RecordedRequest["channel"]) => (req: http.IncomingMessage, res: http.ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const connectTarget = channel === "connect-tunnel" ? tunnelTarget.get(req.socket) : undefined;
        const url =
          channel === "absolute-form"
            ? (req.url ?? "")
            : `https://${(connectTarget ?? "unknown").replace(/:443$/, "")}${req.url ?? ""}`;
        recorded.push({
          channel,
          connectTarget,
          method: req.method ?? "",
          url,
          headers: req.headers,
          rawHeaderNames: req.rawHeaders.filter((_, i) => i % 2 === 0),
          body,
        });
        answer(url, body, res);
      });
    };

  const inner = http.createServer(recorder("connect-tunnel"));
  const outer = http.createServer(recorder("absolute-form"));
  outer.on("connection", (s: net.Socket) => sockets.add(s));
  outer.on("connect", (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    const target = req.url ?? "";
    connectTargets.push(target);
    sockets.add(socket);
    if (target !== `${SBI_LIVE_HOST}:443`) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head.length) socket.unshift(head);
    const secure = new tls.TLSSocket(socket, { isServer: true, key: keyPem, cert: certPem });
    sockets.add(secure);
    tunnelTarget.set(secure, target);
    inner.emit("connection", secure);
  });

  await new Promise<void>((resolve) => outer.listen(0, "127.0.0.1", resolve));
  const port = (outer.address() as net.AddressInfo).port;

  // Trust the throwaway cert in this process only; restored on close().
  const defaultCAs = tls.getCACertificates("default");
  tls.setDefaultCACertificates([...defaultCAs, certPem]);

  return {
    proxyUrl: `http://127.0.0.1:${port}`,
    port,
    get token() {
      return state.token;
    },
    get responseShape() {
      return state.responseShape;
    },
    set responseShape(v: "string" | "object") {
      state.responseShape = v;
    },
    connectTargets,
    take() {
      const out = recorded;
      recorded = [];
      return out;
    },
    async close() {
      tls.setDefaultCACertificates(defaultCAs);
      for (const s of sockets) s.destroy();
      outer.closeAllConnections();
      await new Promise<void>((resolve) => outer.close(() => resolve()));
    },
  };
}

/** Point an SBIEPayClient's own axios instance at the mock, as a forward proxy. */
export function routeSdkThroughProxy(client: object, port: number): { baseURL: string | undefined } {
  const api = (client as { apiClient?: { defaults: { baseURL?: string; proxy?: unknown } } }).apiClient;
  if (!api) throw new Error("SBIEPayClient internals changed: no apiClient");
  // Explicit config, so a stray HTTPS_PROXY in the environment cannot reroute it.
  api.defaults.proxy = { protocol: "http", host: "127.0.0.1", port };
  return { baseURL: api.defaults.baseURL };
}
