# Nutrigreenz — Core Data Model (ERD)

> [!NOTE]
> **Original conceptual ERD, written at the start of the engagement.** It models
> the core commerce entities, not the full schema — the live database has 42
> tables. Verified on 2026-09-15: `customers`, `addresses`, `orders`, `coupons`
> and `loyalty_ledger` exist as modelled. `OFFLINE_CUSTOMER` and `REFERRAL_EDGE`
> were folded into other tables rather than built as standalone ones.


> 7 entities, 10 relationships. Renders at full size in any Mermaid viewer.

```mermaid
erDiagram
  CUSTOMER ||--o{ ADDRESS                  : "has"
  CUSTOMER ||--o{ ORDER                    : "places"
  ADDRESS  ||--o{ ORDER                    : "ships to"
  CUSTOMER ||--o{ LOYALTY_LEDGER           : "owns"
  ORDER    ||--o{ LOYALTY_LEDGER           : "produces"
  CUSTOMER ||--o{ REFERRAL_EDGE            : "refers (as referrer)"
  CUSTOMER ||--o| REFERRAL_EDGE            : "referred (as referee)"
  ORDER    ||--o| REFERRAL_EDGE            : "triggers"
  OFFLINE_CUSTOMER |o--o| CUSTOMER         : "converts to"
  CUSTOMER ||--o{ CUSTOMER                 : "referred by (self FK)"

  CUSTOMER {
    uuid id PK
    varchar phone UK
    varchar email
    varchar name
    enum tier "retail|club|community"
    varchar referral_code UK
    uuid referred_by FK
    timestamptz created_at
  }

  OFFLINE_CUSTOMER {
    uuid id PK
    uuid captain_id FK
    varchar phone
    varchar name
    varchar stall_event
    timestamptz captured_at
    uuid converted_to FK "nullable"
  }

  ADDRESS {
    uuid id PK
    uuid customer_id FK
    enum label "home|work|other"
    varchar line1
    varchar line2
    varchar city
    varchar state
    varchar pincode
    boolean is_default
  }

  ORDER {
    uuid id PK
    varchar display_id UK
    uuid customer_id FK
    uuid shipping_address_id FK
    enum status "pending|paid|fulfilled|cancelled"
    numeric subtotal
    numeric discount_total
    numeric shipping_total
    numeric grand_total
    enum payment_provider "razorpay|phonepe"
    timestamptz placed_at
  }

  LOYALTY_LEDGER {
    uuid id PK
    uuid customer_id FK
    uuid order_id FK "nullable"
    enum event "earn|burn|expire|adjust"
    integer points
    integer balance_after
    varchar reason
    timestamptz created_at
  }

  COUPON {
    uuid id PK
    varchar code UK
    enum discount_type "percent|amount"
    numeric value
    numeric min_order
    integer max_uses
    integer uses_count
    timestamptz valid_from
    timestamptz valid_until
    jsonb applies_to
  }

  REFERRAL_EDGE {
    uuid id PK
    uuid referrer_id FK
    uuid referee_id FK
    enum status "pending|qualified|rewarded"
    uuid trigger_order_id FK "nullable"
    integer reward_points
    timestamptz created_at
  }
```

## Key invariants

| Invariant | Enforced by |
|---|---|
| One default address per customer | Partial unique index on `address(customer_id) where is_default=true` |
| Loyalty balance never negative | DB check constraint on `balance_after >= 0` |
| Referral edge unique per pair | Unique constraint on `(referrer_id, referee_id)` |
| Self-referral blocked | Check constraint `referrer_id <> referee_id` |
| Coupon uses_count <= max_uses | DB check + advisory lock on apply |
| Order grand_total = subtotal − discount + shipping | Computed in service, validated by DB trigger |

## Why Coupon has no FK

`Coupon` is intentionally decoupled — `applies_to` is a JSONB shape (`{"sku_ids": [...]}` or `{"categories": [...]}`) so we can change scoping logic without a migration. The link to an order is captured implicitly in `Order.discount_total` and an `order_coupon` audit row (not shown here, can be added if needed).
