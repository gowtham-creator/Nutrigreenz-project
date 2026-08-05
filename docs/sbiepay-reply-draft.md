# Reply to SBIePay — technical details

Everything below is verified against the codebase and infrastructure. The two
bracketed lines are yours to fill in; nothing else needs editing.

---

**Subject:** Re: Nutri Greenz — technical contact and technology stack

Dear SBIePay team,

Thank you for the integration documents and API keys.

**Technical contact**

- Name: **[your name]**
- Email / phone: **[your email] · [your phone]**
- Organisation: Nutri Greenz Farm Technologies Pvt. Ltd.

**Technology stack**

| | |
|---|---|
| Backend | Node.js 24 LTS (server-side API routes, Next.js 16 App Router) |
| Frontend | React 19 with Next.js 16, TypeScript |
| Language | TypeScript 5 (end to end) |
| Database | PostgreSQL 17 (Supabase) |
| Hosting | Vercel (serverless functions, Node.js runtime) |

We would therefore use the **Node.js server SDK**.

**Outbound IP**

All server-to-server calls to SBIePay egress through our fixed address
**15.252.0.167**, which your team has already whitelisted. This is an AWS
Elastic IP fronting a dedicated proxy; only SBIePay traffic is routed through
it.

**Callback / return URL**

`https://nutrigreenz.farm/api/payments/sbiepay/callback`

Please confirm this is registered against our merchant account. It accepts both
the browser return and the server-to-server notification.

**Three points we would like confirmed**

1. **Are the API keys already issued to us TEST or LIVE credentials?** We want
   to complete integration against the test environment first and will request
   live keys separately once testing is signed off.

2. Could you share the **Node.js server SDK** package? We have the API
   integration documents; the SDK source would let us match your encryption and
   request-signing implementation exactly rather than inferring it.

3. Please confirm the **encryption specification** for the request payload —
   specifically the AES key size, cipher mode (CBC or ECB), IV handling and
   padding scheme, along with the checksum/signature algorithm used to verify
   your responses.

Kind regards,
**[your name]**
Nutri Greenz Farm Technologies Pvt. Ltd.

---

## Why point 3 is worth asking explicitly

It is the one thing that cannot be inferred. If the key size, mode, IV handling
or padding is wrong, the bank returns a generic decryption failure that does not
say which of the four was at fault — so a wrong guess costs days rather than
minutes. The SDK source answers all four at once, which is why it is worth
asking for even if the PDFs describe the fields.

## What not to claim yet

Do **not** state a PCI SAQ level. If SBIePay's flow keeps card entry on their
hosted page then SAQ-A applies and this application never touches card data —
which is almost certainly the case — but that should be confirmed from their
documentation before it is asserted in writing to a bank.
