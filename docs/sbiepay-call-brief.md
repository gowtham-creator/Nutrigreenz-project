# SBIePay call — 4:10pm brief

Have the admin payments page open and signed in **before** the call starts.

---

## The one sentence to open with

> "Our integration is complete and every API call you provide succeeds — we can
> create orders and read their status. The only thing that fails is your hosted
> payment page: it loads, your own lookup call returns HTTP 200, and then it
> displays 'Something Went Wrong'. We would like to watch your logs while we
> create one live."

That last clause is the whole point of the call. Everything else is supporting
evidence.

---

## What to show, in this order

**1. Self-test — all four green** (~10 seconds)

Proves, in one screen, that this is not a credentials, encryption, network or
whitelisting problem:

| Check | What it proves |
|---|---|
| configuration | all keys present |
| crypto | AES-GCM round-trips with their encryption key |
| proxy | traffic leaves from `15.252.0.167`, the IP they whitelisted |
| authentication | **SBI issued a token and answered our call** |

**2. Create a test order — live, on the call**

This is the moment to ask them to watch their logs. Read out the Order Ref
Number and SBI Order Ref Number as soon as they appear.

**3. Expand "Full request & response from SBI"**

Screen-share this. It shows exactly what was sent and exactly what came back,
including `mId`, `payMode`, `orderRetryCount`. Ask them to confirm every value
is what they expect for our merchant profile.

**4. Open the transactionUrl — let them watch it 404**

Use *their* URL, unmodified. Then open DevTools → Network and show them:

> Their own order-lookup XHR returns **200 with a 1.4 kB body**. It is not a
> failed request. Their page fetches the order successfully and then chooses to
> show 404.

This is the single most important technical fact of the call. It moves the
problem unambiguously onto their side, politely and with evidence.

---

## What to ask — in priority order

**1. What is in that 1.4 kB response?**
Only they can decrypt it. It is the direct answer to why the page refuses.
*"Your lookup returns 200. What does that payload say, and what does the page
check before deciding to render?"*

**2. Which exact source URL is whitelisted against our merchant ID?**
Ask them to read it back character by character. A typo or a different domain
would look precisely like this.

**3. Are Internet Banking and UPI QR enabled on the merchant ID we are actually
using?** Give them the `mId` from the response on screen. Their earlier answer
said the modes are enabled *in the test environment* — confirm they are enabled
for **this** merchant ID, not the environment generally.

**4. Is there any step between `order/create` and opening `transactionUrl`?**
Some activation, initiation or registration call we have not made. Ask directly.

**5. Must we create a customer first and pass `customerId`?**
The field table marks it optional and your own sample leaves it `null` — please
confirm the hosted page does not require it.

**6. Are the keys issued to us TEST or LIVE?**
Never confirmed in writing. Get it stated on the call.

**7. Walk through one Net Banking payment together.**
If they can make the page render, have them do it while sharing their screen so
we can see what differs.

---

## Two documentation defects worth raising

Raise these near the end. They cost days, they are verifiable, and they
establish that the integration work has been careful.

1. **`expiry` is documented as a timestamp; it is a number of minutes (max 30).**
   Any epoch value is rejected with error 2104. `25` works. The sample value in
   the guide, `1767551400000`, could not pass their own validator.

2. **`order/status` requires `orderAmount`**, but the mandatory-field list gives
   only `{fromDate, toDate, atrn, arrn, sbiOrderRefNumber}`. Omitting it returns
   "Order Amount is required". Their own sample request includes it.

---

## Before hanging up — get these

- [ ] Name + direct email of the **engineer**, not just the support desk
- [ ] A commitment: who checks the logs, and by when
- [ ] Test Net Banking credentials confirmed working (or new ones)
- [ ] Written confirmation of TEST vs LIVE keys
- [ ] If they cannot resolve it on the call: a ticket number

---

## What not to do

Do not agree to change anything on our side without a reason attached. Four
theories have already been tested and disproved — expiry encoding, the URL host,
the return URL domain, and IP restriction. If they suggest one of those, say it
has been tested and ask what specifically they expect to be different.

Do not let the call end with "we will check and revert" and nothing else. Ask
for the log line for the order reference created during the call.
