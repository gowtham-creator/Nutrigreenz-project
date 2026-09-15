# Nutrigreenz — Full System Architecture

> [!NOTE]
> **Original design document, written at the start of the engagement.** The
> diagrams and the shape of the system still hold. Four vendor choices in the
> table below were decided differently during the build, verified against the
> code on 2026-09-15:
>
> | As designed | As built |
> |---|---|
> | Next.js 14 | Next.js 16.3 (App Router, React 19) |
> | Managed Postgres — Supabase **or Neon** | Supabase, `ap-south-1` Mumbai |
> | Razorpay / PhonePe | SBIePay, with nightly reconciliation |
> | Brevo / MailMonkey | Resend |
>
> The read replica shown in the data layer was never provisioned; reads and
> writes both go to the primary.


> Aligned to the **official tech stack** (CUBIXSO × Nutri Greenz Farm, 6-week engagement).
> Source of truth: `Nutri Greenz Farm - Tech Stack.pdf`.
> Mirrored in Miro: https://miro.com/app/board/uXjVHSoeG5I=/?moveToWidget=3458764672153151740

```mermaid
 ext
  class O1,O2 obs
```

## Official tech stack

| Component | Technology | Purpose |
|---|---|---|
| Core Framework | **Next.js 14 (App Router)** | Frontend UI + backend API via Server Actions / API Routes. Built-in SSR for SEO. |
| Database | **Managed PostgreSQL (Supabase / Neon)** | Relational data: users, multiple addresses, loyalty ledgers. Row-Level Locking handles checkout concurrency. |
| Authentication | **Firebase Auth** | Google Sign-In + Mobile OTP. OTP relayed via MSG91. |
| Hosting | **Vercel** | Edge caching + serverless API scaling. Replaces Hetzner/Cloudflare Pages. |
| Payments | **Razorpay / PhonePe** | UPI, Credit, Debit cards. |
| Email | **Brevo / MailMonkey** | Order confirmation + shipping notifications. |
| SMS | **MSG91** |%%{init: {'flowchart': {'nodeSpacing': 30, 'rankSpacing': 40}, 'themeVariables': {'fontSize': '12px'}}}%%
graph TB
  %% =================== ACTORS ===================
  subgraph ACTORS["ACTORS"]
    A1[Customer<br/>web]
    A2[Admin<br/>3 portals]
    A5[Captain<br/>PWA]
  end

  %% =================== EDGE + IDENTITY ===================
  subgraph EDGE_AUTH[" "]
    direction LR
    E1[Vercel Edge<br/>SSG + ISR]
    ID1[Firebase Auth<br/>Google + OTP]
  end

  %% =================== APP LAYER ===================
  subgraph APP["NEXT.JS 14 APP ROUTER"]
    direction LR
    N1[SSR Pages]
    N2[API Routes /<br/>Server Actions]
    N3[Admin<br/>Server Actions]
    N4[Payment<br/>Webhooks]
  end

  %% =================== DATA + ASYNC ===================
  subgraph DATA_ASYNC[" "]
    direction LR
    subgraph DATA["DATA — Postgres"]
      D1[(Supabase/Neon<br/>Row-Lock)]
      D2[(Read replica)]
    end
    subgraph ASYNC["ASYNC HANDLERS"]
      Q1[Loyalty]
      Q2[Referral]
      Q3[Notifications]
      Q4[Bundles]
    end
  end

  %% =================== EXTERNALS + OBS ===================
  subgraph EXT["EXTERNAL SERVICES"]
    direction LR
    X1[Razorpay]
    X2[PhonePe]
    X3[Brevo]
    X4[MSG91]
  end

  subgraph OBS["OBSERVABILITY"]
    direction LR
    O1[Vercel<br/>Analytics]
    O2[Sentry]
  end

  %% =================== EDGES ===================
  A1 --> E1
  A1 --> ID1
  A2 --> ID1
  A5 --> N2
  E1 --> N1
  ID1 --> N2
  ID1 -.-> X4
  A2 --> N3
  N1 --> N2
  N2 --> D1
  N3 --> D1
  N3 -.-> D2
  N2 --> X1
  N2 --> X2
  X1 --> N4
  X2 --> N4
  N4 --> D1
  N4 --> Q1
  N4 --> Q2
  N4 --> Q3
  N3 --> Q4
  Q1 --> D1
  Q2 --> D1
  Q3 --> X3
  Q3 --> X4
  Q4 --> D1
  N1 -.-> O1
  N2 -.-> O2
  N4 -.-> O2

  %% =================== STYLING ===================
  classDef actor fill:#c6dcff,stroke:#305bab,stroke-width:2px,color:#000
  classDef edge fill:#adf0c7,stroke:#087429,stroke-width:2px,color:#000
  classDef app fill:#fff6b6,stroke:#af7e02,stroke-width:2px,color:#000
  classDef auth fill:#f8d3af,stroke:#9b4a07,stroke-width:2px,color:#000
  classDef data fill:#f8d3af,stroke:#9b4a07,stroke-width:2px,color:#000
  classDef async fill:#dedaff,stroke:#6631d7,stroke-width:2px,color:#000
  classDef ext fill:#ffd8f4,stroke:#af3fb9,stroke-width:2px,color:#000
  classDef obs fill:#e7e7e7,stroke:#595959,stroke-width:2px,color:#000

  class A1,A2,A3,A4,A5 actor
  class E1 edge
  class N1,N2,N3,N4 app
  class ID1 auth
  class D1,D2 data
  class Q1,Q2,Q3,Q4 async
  class X1,X2,X3,X4 Transactional SMS, OTPs, coupon codes. |
| Animations | Framer Motion or GSAP | Scroll-triggered choreography for the storefront. |

## Architecture flow (per the official doc)

### A. Edge delivery — browsing & reading
Vercel Edge Network serves SSG / ISR-cached PLP, PDP, and SEO pages. **90-95% of traffic incurs zero DB load and zero server latency.**

### B. Serverless transaction processing — cart & checkout
On pay, Next.js API Route initiates the transaction and PostgreSQL **Row-Level Locking** locks the specific inventory row. Concurrent requests for out-of-stock items are safely rejected. No Redis/BullMQ.

### C. Asynchronous post-order handlers
On a successful Razorpay/PhonePe webhook, Next.js marks the order PAID, then fans out to **async background functions**:
- Credit loyalty points (post-fulfilment)
- Validate referral reward
- Dispatch Brevo email + MSG91 SMS
- (Admin-triggered) Aggregate community bundles

The main checkout thread stays unblocked.

## What is explicitly **not** in this architecture

These appeared in earlier drafts but are excluded by the official stack:

| Removed | Replaced by |
|---|---|
| Medusa core | Next.js API Routes + Server Actions |
| Redis + BullMQ | PostgreSQL Row-Level Locking + Next.js async background functions |
| Hetzner Cloud + Cloudflare Pages | Vercel |
| Meilisearch | Postgres full-text search (or static catalog) |
| Hono BFF on edge | Direct Next.js Server Actions |
| S3 / R2 for invoices | Out of Phase 1 scope |
| SendGrid | Brevo / MailMonkey |
| Posthog / Slack / Metabase | Vercel Analytics + Sentry only |

## Read / write lanes

- **Reads**: customer → Vercel Edge (SSG/ISR) → Postgres replica (only on cache miss / SSR fallback)
- **Writes**: customer → Server Action → Postgres primary with row-lock → success webhook → async fan-out
- **Async work**: post-order handlers run as Next.js background functions on Vercel, not a queue worker
