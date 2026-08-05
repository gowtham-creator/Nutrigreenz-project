# SBIePay integration plan — Nutrigreenz

Replaces Razorpay as the payment gateway. We use the **redirect / hosted** model
(customer pays on SBIePay's page) so **no card data ever touches our servers → we
stay out of PCI-DSS scope**. Our `orders` table is already gateway-agnostic
(`payment_provider`, `payment_ref`, `payment_status`), and `payments-razorpay.ts`
exposes `createPaymentIntent()` + `verifyPayment()` — SBIePay slots in as a parallel
module behind the same seam.

## 0. Blocked on — we can't finalise code until these arrive
1. **SBIePay merchant integration kit** (given after onboarding):
   - Merchant ID (MID), Aggregator ID
   - AES **encryption key** (+ mode/IV/padding spec) and any checksum secret
   - Staging + Production endpoint URLs
   - Request/response field spec + sample code (usually Java/.NET — we port to Node)
2. **Static egress IP decision** — Vercel serverless has no fixed outbound IP;
   SBIePay whitelists the merchant server IP for server-to-server calls.
   Options: Vercel Dedicated IP (Enterprise) **or** route SBIePay S2S calls through a
   fixed-IP proxy (QuotaGuard Static / Fixie / a small always-on NAT box).
3. Signed Technical Information Form submitted + MID activated.

## 1. Payment flow (redirect model)
1. Checkout → `POST /api/payments/sbiepay/initiate` with the cart/order.
2. Server creates a **pending order** (`payment_provider='sbiepay'`, `payment_status='pending'`),
   builds the request string (MID, our txn id, amount, currency, callback URL…),
   **AES-encrypts** it with the SBIePay key → returns an auto-submitting HTML form
   POSTing `encData` (+ merchant id) to SBIePay's hosted URL.
3. Customer pays on SBIePay's page (cards / netbanking / UPI / wallets).
4. SBIePay POSTs an **encrypted response** to our **callback (push response) URL**
   (and redirects the browser back).
5. Callback **decrypts + verifies** (status, **amount tamper-check**, txn id, checksum),
   updates the order → `paid`/`failed`, clears the cart, redirects to
   `/checkout/success` or `/checkout/failure`.
6. **Reconciliation**: a status-enquiry (double-verification) call resolves any
   pending/ambiguous txns (on-demand + a cron sweep).

## 2. Files to build (mirrors the Razorpay module)
- `src/lib/payments/sbiepay/crypto.ts` — AES encrypt/decrypt per the kit spec (Node `crypto`).
- `src/lib/payments/sbiepay/client.ts` — build request, parse response, status-enquiry, refund.
  Exposes `isSbiepayConfigured`, `createPaymentIntent()`, `verifyPayment()` to match the seam.
- `src/app/api/payments/sbiepay/initiate/route.ts` — creates order + returns redirect form.
- `src/app/api/payments/sbiepay/callback/route.ts` — the **Push response URL** in the bank form
  (`/api/payments/sbiepay/callback`); decrypt → verify → update order. **Idempotent**
  (SBIePay may post twice).
- `src/app/api/payments/sbiepay/status/route.ts` — server-to-server double verification.
- `src/app/api/payments/sbiepay/refund/route.ts` — admin-triggered refunds (S2S).
- Optional migration: `payment_events` log table (raw encrypted req/resp for audit &
  dispute resolution). `orders` already carries provider/ref/status.
- Gateway **feature flag** (`PAYMENT_PROVIDER=razorpay|sbiepay`) so we can cut over and roll back.

## 3. Env vars (Vercel — Production/Preview, never committed)
```
PAYMENT_PROVIDER=sbiepay
SBIEPAY_MERCHANT_ID=...
SBIEPAY_AGGREGATOR_ID=...
SBIEPAY_ENC_KEY=...            # secret (AES key)
SBIEPAY_BASE_URL=...          # staging vs production
SBIEPAY_CALLBACK_URL=https://nutrigreenz.farm/api/payments/sbiepay/callback
```

## 4. Must-get-right
- **Match SBIePay's AES spec exactly** (key length, CBC/ECB, IV, padding) — their sample is
  Java/.NET; port carefully and test vectors against their sample output.
- **Amount + txn-id verification** server-side on callback (never trust redirect params).
- **Idempotent callback** + signed order → prevent replay / double-credit.
- **Refunds** via SBIePay refund API; reflect in order + loyalty reversal.
- Keep the **redirect model** → no PCI scope.

## 5. Sequence to go live
1. Fill + sign the Technical Info Form → submit → get MID + kit.
2. Sort the static-IP solution.
3. Build the module + endpoints against **staging**.
4. UAT on SBIePay staging (test cards/UPI/netbanking) → success/failure/refund/reconciliation.
5. Whitelist prod IP + set prod env → flip `PAYMENT_PROVIDER=sbiepay` → smoke test → done.
6. Retire Razorpay once stable.

**Effort (once the kit is in hand):** ~2–4 focused days for build + UAT, plus the
static-IP setup. I can start the module skeleton now (crypto stub + endpoints + flag)
so only the kit-specific spec needs slotting in when it arrives.
