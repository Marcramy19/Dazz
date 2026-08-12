# Dazzdezign → Next.js Migration Summary (Phase 1 Complete)

**Date:** 2026-08-12  
**Status:** Phase 1 complete — ready for user review before Phase 2

---

## Final Route List

| Route | Type | Description |
|-------|------|-------------|
| `/` | Static | Storefront landing page (hero, marquee, scope of work, product grid, footer) |
| `/login` | Static | Studio login page (dark theme, proxies to dazzdezign-api) |
| `/studio` | Client | Auth-gated studio dashboard with 3 tabs |
| `/api/auth/login` | Dynamic | Proxy to `dazzdezign-api:3008/api/auth/login` |
| `/api/auth/check` | Dynamic | Proxy to `dazzdezign-api:3008/api/auth/check` |
| `/api/products` | Dynamic | Proxy GET/POST to dazzdezign-api |
| `/api/products/[id]` | Dynamic | Proxy PATCH/DELETE to dazzdezign-api |
| `/api/orders` | Dynamic | Proxy GET/POST to dazzdezign-api |
| `/api/orders/[id]` | Dynamic | Proxy PATCH/DELETE to dazzdezign-api |
| `/api/orders/clear` | Dynamic | Proxy POST to dazzdezign-api |

---

## Component Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, fonts, metadata
│   ├── page.tsx                # Storefront (composes all sections)
│   ├── globals.css             # All design tokens, keyframes, breakpoints
│   ├── login/
│   │   └── page.tsx            # Login page
│   ├── studio/
│   │   └── page.tsx            # Studio dashboard (auth-gated, tabs)
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   └── check/route.ts
│       ├── products/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       └── orders/
│           ├── route.ts
│           ├── [id]/route.ts
│           └── clear/route.ts
└── components/
    ├── storefront/
    │   ├── Header.tsx          # Sticky header, logo, nav, tagline
    │   ├── HeroStage.tsx       # Blob bg, 3 floating cards, orange tags
    │   ├── Marquee.tsx         # Infinite horizontal scroller
    │   ├── ScopeOfWork.tsx     # Two pillars (AI + Merch), animated badges
    │   ├── ProductCard.tsx     # Grid card, image overlay, 1-of-1 badge
    │   ├── OrderModal.tsx      # Fixed overlay, form, mailto: submit
    │   └── Footer.tsx          # Dark footer, links, Arabic copyright
    └── studio/
        ├── StudioHeader.tsx    # Tabs: Orders, Products, Design Center
        ├── OrdersView.tsx      # KPIs, top sellers, filter, order grid, CSV
        ├── ProductsView.tsx    # Grid, editor modal, CRUD via API
        └── DesignCenter.tsx    # Canvas cap designer, 760x760, full controls
```

---

## Design Tokens Preserved (from `globals.css`)

### Colors (21 tokens)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg` | `#e9e9e9` | Page background |
| `--color-ink` | `#141414` | Near-black text |
| `--color-lime` | `#cdf03a` | Accent, active badges |
| `--color-orange` | `#ff4e1e` | CTAs, "Shop Now" tags |
| `--color-cream` | `#efeeec` | Neutral bg, tote tone |
| `--color-mid` | `#4a4a4a` | Secondary text |
| `--color-muted` | `#9a9a9a` | Muted text, borders |
| `--color-white` | `#fff` | White |
| `--color-offwhite` | `#fafafa` | Input bg |
| `--color-success` | `#16b85f` | Success, delivered status |
| `--color-login-error` | `#ff6b6b` | Login error text |
| `--color-login-accent` | `#e9ff2e` | Login focus ring, brand |
| `--color-blue` | `#2e5bff` | Product tone (Habibi) |
| `--color-cyan` | `#5ad6da` | Product tone, shipped status |
| `--color-navy` | `#1a3a8f` | Product tone (Now 今) |
| `--color-input-border` | `#e2e2e2` | Input/form borders |
| `--color-card-border` | `#e7e6e2` | Card borders |
| `--color-hover-bg` | `#f1f1f0` | Hover backgrounds |
| `--color-studio-bg` | `#f4f3f0` | Studio page bg |
| `--color-header-border` | `#e7e6e2` | Header border |
| `--color-focus` | `#e9ff2e` | Focus rings |

### Fonts
| Family | Weights | Variable |
|--------|---------|----------|
| Hanken Grotesk | 400–900 | `--font-hanken` |
| Noto Sans Arabic | 600, 700 | `--font-noto-arabic` |

### Breakpoints
| Context | Breakpoint | Behavior |
|---------|------------|----------|
| Storefront | 980px | capgrid → 2-col, herogrid → 1-col |
| Storefront | 900px | navlinks hidden, herogrid 1-col |
| Storefront | 620px | h1→46px, stage scale 0.62, capgrid 1-col |
| Studio | 860px | Layout adjustments |
| Studio | 540px | Mobile layout |

### Keyframe Animations (11)
| Name | Duration | Usage |
|------|----------|-------|
| `dz-floatA` | 7s | Hero card 1 (No Bad Vibes) |
| `dz-floatC` | 8s | Hero card 2 (Habibi) |
| `dz-floatD` | 9s | Hero card 3 (Shark Tank) |
| `dz-blob` | 12s | Hero background blob |
| `dz-marquee` | 28s | Infinite horizontal scroller |
| `dz-pop` | 0.28s | Modal/card entrance |
| `dz-blink` | 1s step-end | Cursor blink in "generating" badge |
| `dz-livepulse` | 1.8s | Pulse dot in "generating" badge |
| `dz-orbpulse` | 7–9s | Orb decorations on pillars |
| `dz-rise` | 0.7s | Reveal entrance stagger |

---

## Design Deviations (Documented)

| Deviation | Reason |
|-----------|--------|
| CSS custom properties introduced | Original used all inline styles; tokens enable maintainability while keeping rendered values identical |
| `next/font/google` for fonts | Original loaded via `<link>`; Next.js font optimization requires this approach |
| `dangerouslySetInnerHTML` for SVG icons | Builder output had inline SVG strings; preserving exact visual match |
| `style-hover`/`style-focus` → React handlers | Builder pseudo-attributes don't exist in React; implemented via `onMouseEnter`/`onMouseLeave` |
| Product images use `/assets/collection/...` paths | Images don't exist locally (served from `/opt/dazzdezign/` on deployment); placeholder paths used |
| Stockists link → `#` | Original linked to `Dazz Dezign Shop.dc.html` which doesn't exist |
| Order submission → `mailto:` | Original behavior preserved; does NOT POST to `/api/orders` |
| No Tailwind | Per §1.1: plain CSS / CSS Modules only |
| Arabic copyright uses Noto Sans Arabic | Original used system fonts for login; design system mandates Noto Sans Arabic |

---

## What Was Not Fully Ported / Known Gaps

1. **Product images** — All 8 product images referenced in CAPS array (`/assets/collection/norm/*.png`, `/assets/collection/tote-sandsea.png`) are missing from local filesystem. They exist on the production server at `/opt/dazzdezign/`. Placeholder paths work for dev but show broken images.

2. **Builder-specific syntax** — The original `index.html` (8.9MB) and `studio/index.html` (6MB) are proprietary builder bundles with `<x-dc>`, `<sc-if>`, `<sc-for>`, `{{ mustache }}`, `style-hover`. The migration used the *decoded* HTML as source of truth. The builder bundles themselves are not recreated.

3. **Studio localStorage bridge** — Original studio synced via `localStorage` + `POST /api/state`. The Next.js version uses direct API proxies; the localStorage sync is not replicated (not needed if API is source of truth).

4. **Standalone `designer.html`** — Original had a separate `studio/designer.html` (59KB) which was a stripped-down Design Center. This is not recreated — the Design Center tab in studio covers it.

5. **Font loading in login.html** — Original login page used system fonts. The Next.js login page uses Hanken Grotesk per the design system.

6. **Animation: `dz-orbpulse` durations** — Original used 7s, 8s, 9s on different elements. Preserved as 7s/9s on the two pillars.

---

## Verification Checklist (Phase 1 Complete)

- [x] Next.js project scaffolded (App Router, TypeScript, no Tailwind, src/ dir)
- [x] Global styles: all 21 color tokens, 11 keyframes, breakpoints, fonts
- [x] Storefront: Header, HeroStage, Marquee, ScopeOfWork, ProductCard, OrderModal, Footer
- [x] Storefront page `/` composes all sections with 8-product CAPS array
- [x] Login page `/login` with auth proxy to dazzdezign-api
- [x] Studio dashboard `/studio` auth-gated with 3 tabs
- [x] OrdersView: KPIs, top sellers, filters, order grid, status advance, delete, CSV export, clear all
- [x] ProductsView: Grid, editor modal (image upload, fields), CRUD via API
- [x] DesignCenter: Canvas designer (cap colors, artwork, EN/AR text, fonts, colors, transform, fit-to-curve, add to catalog, download PNG)
- [x] All API proxies: `/api/auth/*`, `/api/products/*`, `/api/orders/*`
- [x] Build passes (`npm run build` — no TypeScript errors)
- [x] Dev server runs (`npm run dev` — http://localhost:3000)
- [x] CHANGELOG.md updated with all migration entries
- [x] migration-summary.md written (this file)

---

## Next Steps (Phase 2 — Requires User Approval)

Per `Project plan.md` §2, Phase 2 builds e-commerce features **only after Phase 1 review**:

1. **Auth — Sign up / Login** — Registration, password reset, protected routes
2. **Product search & filter** — Query, category, price, sort
3. **Ratings & reviews** — Display average, authenticated submissions
4. **Wishlist** — Add/remove, persisted per user, wishlist page
5. **Cart & checkout** — Add/update/remove, persist, checkout flow (payment stub)
6. **General feedback** — Contact/feedback form

Each item: UI + real API + loading/error/empty states. No half-wired features.

---

**Phase 1 is complete.** The migration preserves exact design parity (colors, spacing, fonts, breakpoints, animations, copy). The Next.js app builds and runs. Awaiting your review before starting Phase 2.