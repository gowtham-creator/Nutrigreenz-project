# Nutri Greenz

Farm-to-table e-commerce storefront and operations portal for **Nutri Greenz Farm Technologies** — single-origin, lab-tested produce delivered across Hyderabad.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict)
- **Styling:** Tailwind CSS v4 with design tokens
- **UI:** shadcn/ui primitives + a custom `ng-*` component system
- **Type:** Roboto Slab (display) · Figtree (body) · JetBrains Mono (data)
- **Icons:** Solar (Iconify)

## Getting Started

```bash
npm install
npm run dev        # http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run check` | Lint + typecheck + build |

## Project Structure

```
src/
  app/           # Routes — storefront, account, checkout, admin portal
  components/ng/ # Nutri Greenz UI system (sections, commerce, account, admin)
  lib/           # Cart, wishlist, auth, addresses, commerce-rules, location
  types/         # Shared TypeScript types
public/          # Static assets, brand logos
```

## Surfaces

- **Storefront** — home, shop, product detail, cart, checkout, order confirmation.
- **Account** — profile, addresses, orders & tracking, wishlist, loyalty, referrals.
- **Admin** — orders management, community bundles, inventory, catalog, marketing, people, configuration (auth-gated).

## Environment

Copy `.env.example` to `.env.local` and fill in the values for authentication and integrations.
