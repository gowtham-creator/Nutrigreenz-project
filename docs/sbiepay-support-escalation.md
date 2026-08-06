# SBIePay — hosted payment page returns 404 for orders their own API confirms

Everything below is measured, not inferred. Fill in the two bracketed lines and
send; nothing else needs editing.

---

**Subject:** Integration environment — hosted payment page 404s for a CREATED order

Dear SBIePay team,

Our integration against the **integration environment** is complete and working:
authentication, encryption, order creation and order status all succeed. One
step does not, and we believe it is on the gateway side.

**The problem**

`order/create` returns successfully with a `transactionUrl`. Opening that URL —
the one your API returns, unmodified — shows your "OOPs! Something Went Wrong!!
The page you are looking for is not found" page. The same happens for every
order we create.

**What we have verified**

| Step | Result |
|---|---|
| `POST /api/transaction/v1/token/access` | succeeds, JWT issued |
| AES‑GCM request encryption | accepted; you decrypt and return field‑level validation errors |
| `POST /api/transaction/v1/order/create` | succeeds — returns `status: CREATED`, `sbiOrderRefNumber`, `orderHash`, `transactionUrl` |
| `POST /api/transaction/v1/order/status` | **confirms the order exists, `orderStatus: CREATED`** |
| `GET /ui/<orderHash>` | HTTP **200**, serves your SPA shell — then the app itself renders the 404 screen |

So the order is registered in your system by your own API's account, and your
payment page will not display it.

**Why we do not think this is our URL**

- We use your `transactionUrl` verbatim. We also tried constructing it from
  `orderHash`; identical result.
- `/ui/`, `/ui/<real-orderHash>` and `/ui/<an-invented-string>` all return HTTP
  200 with a byte-identical response, so your server accepts any path and the
  404 is produced client-side after the order lookup fails.
- Your SPA's router declares a `/:hash` route, so the URL shape we are opening
  is the one it expects.

**Sample order for you to trace**

- Order reference: **[paste an NGT… reference from the panel]**
- SBI order reference: **[paste the sbiOrderRefNumber]**
- Merchant API Key Id: the one issued to Nutri Greenz (not repeated here)

**Our questions**

1. Is our **merchant profile on the integration environment provisioned for the
   hosted payment page** — specifically, are any pay modes (UPI / Net Banking /
   Cards / Wallet) enabled against it? We suspect the page cannot render because
   the profile has no payment channels configured.
2. If pay modes must be enabled by your team, please enable them for testing.
3. Are there **test instrument details** for the integration environment, or does
   the page present a success/failure simulator?

**Two documentation issues we found**

Both cost us significant time and may affect other integrators:

1. **`expiry` is documented as a timestamp** ("Number (Timestamp)" in the API
   guide, "Long — Order expiry timestamp" in the server SDK guide). It is not —
   it is a **count of minutes**, capped at 30. Any epoch value, in seconds or
   milliseconds, is rejected with error 2104 "expiry cannot exceed 30 minutes",
   because the number read as minutes exceeds the cap. The value `25` is
   accepted. The documented sample value `1767551400000` could not pass your own
   validator.
2. **`order/status` requires `orderAmount`**, but the mandatory-field list gives
   only `{fromDate, toDate, atrn, arrn, sbiOrderRefNumber}`. Omitting
   `orderAmount` returns "Order Amount is required". Your own sample request
   includes it; the field table does not mark it mandatory.

Kind regards,
**[your name]**
Nutri Greenz Farm Technologies Pvt. Ltd.

---

## Notes for us, not for the email

**Most likely cause.** The UAT merchant profile has no pay modes enabled. The
page fetches the order plus its available channels, gets nothing usable, and
routes to `/404`. This is the one thing in the chain we cannot see or fix from
outside, and it is configuration only SBI holds.

**What is already proven and needs no further work:** credentials, AES-GCM
encryption, the static-IP proxy and whitelist, order creation, order status,
and both documented-wrongly field encodings.

**What remains untested and cannot be tested until the page renders:** the
customer paying, the callback arriving, `confirmGatewayPayment` marking the
order paid, and invoice generation. All of it is written and typechecked.
