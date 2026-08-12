# CHANGELOG

Running log for the dazzdezign → Next.js migration. Entries appended chronologically,
never rewritten. Per `Project plan.md` §3.

---

## [2026-08-12] API audit complete

**What changed:**
- Read and audited every file in `dazzdezign-api` (`server.js`, `data.json`,
  `auth.json`, `regen.js`, `website.template.html`).
- Wrote findings to `docs/api-audit.md`.

**Why / decisions made:**
- No stack assumptions were made — everything in the audit was read from disk.
- The plan's ground rule "do not guess the stack" drove the read-first approach.

**Files touched:**
- `docs/api-audit.md` (new)
- `docs/CHANGELOG.md` (this file, new)

**Key findings (summary):**
- Zero-dependency Node.js (CommonJS) raw `http` server, no framework, no
  `package.json`, no database — flat-file JSON store (`data.json`, `auth.json`).
- Runs on `127.0.0.1:3008`; intended to sit behind nginx.
- Auth = signed-cookie sessions (`dazz_sess`, 7-day TTL, HMAC-SHA256), **single**
  static admin user (`dazz`), scrypt-hashed password. No per-user accounts.
- Routes: `/api/health`, `/api/auth/login|check|logout`, `/api/state` GET/POST
  (dashboard bridge), `/api/products` GET, `/api/orders` GET/POST. Write endpoints
  are not auth-enforced server-side (nginx `auth_request` expected to gate them).
- Products: `{ id, name, type, img, tone, price, active }`. Orders: phone-based
  checkout (name, dial, phone, city, address, notes), no email/payment.
- `regen.js` rebuilds `index.html` from `website.template.html` by injecting the
  active catalog into a `__DAZZ_CAPS__` marker. Upload/regen paths are hard-coded
  Linux paths (`/opt/dazzdezign/...`) that don't exist on this Windows box.
- Phase-2 features (accounts, search/filter/sort, ratings, wishlist, cart) have no
  existing endpoints and will need to be built later.

**Known gaps / TODO:**
- Next: inventory the `dazzdezign` HTML/CSS site → `docs/migration-inventory.md`
  (Section 4 Step 2).

---

## [2026-08-12] Site inventory complete

**What changed:**
- Read and analyzed all 4 HTML pages in `dazzdezign/`:
  - `index.html` (8.9 MB builder bundle → decoded to 74 KB)
  - `login.html` (3 KB, plain HTML)
  - `studio/index.html` (6 MB builder bundle → decoded to 111 KB)
  - `studio/designer.html` (59 KB, plain HTML)
- Created `scripts/decode-site.js` to extract page source from builder bundles
- Wrote complete inventory to `docs/migration-inventory.md` covering:
  - Page-by-page section breakdown (4 pages, 18+ sections)
  - 15 shared components to extract as React components
  - Full color palette (21 tokens extracted from inline styles)
  - Typography (12 fonts loaded across storefront + studio, with weights/sizes)
  - Breakpoints (storefront: 980/900/620px; studio: 860/540px)
  - 11 keyframe animations with durations and usage
  - All JS-driven interactive behavior (order modal, marquee, studio tabs, canvas designer, etc.)
  - Cross-cutting concerns for migration (missing assets, builder syntax, mailto: orders, localStorage bridge)

**Why / decisions made:**
- All visual design values are captured directly from the HTML source — no Tailwind, no CSS variables in the original. The inventory documents what must be matched 1:1 in Phase 1.
- The builder's `<x-dc>`, `<sc-if>`, `<sc-for>`, `{{ mustache }}`, `style-hover` syntax is proprietary — the inventory treats the decoded HTML as the semantic truth and notes these as things to translate to React.

**Files touched:**
- `scripts/decode-site.js` (new)
- `docs/decoded/index.html` (generated)
- `docs/decoded/studio/index.html` (generated)
- `docs/migration-inventory.md` (new)
- `docs/CHANGELOG.md` (this file)

**Key findings (summary):**
- The storefront is a single-page landing site with anchor links (#work, #drop), hero with floating product cards, infinite marquee, scope pillars, product grid, and a mailto:-based order modal.
- The studio is an admin dashboard with 3 tabs (Sales/Products/Design Center) that syncs via localStorage + POST /api/state.
- Product images are missing locally (served from /opt/dazzdezign/ on deployment).
- The login page uses system fonts, not Hanken Grotesk.
- The standalone designer.html is a stripped-down version of the Design Center tab.

**Known gaps / TODO:**
- Next: Phase 1 migration — set up Next.js project (App Router, TypeScript) in `dazzdezign/web/` with plain CSS/CSS Modules, then migrate pages/components one by one preserving exact design.

---

## [2026-08-12] Next.js project scaffolded

**What changed:**
- Created `dazzdezign/web/` with `create-next-app@latest`:
  - App Router, TypeScript, ESLint
  - No Tailwind (`--no-tailwind`), using plain CSS / CSS Modules
  - `src/` directory structure, import alias `@/*`
  - npm package manager

**Why / decisions made:**
- Per `Project plan.md` §1.1: "Use plain CSS / CSS Modules that mirror the existing stylesheets as closely as possible first. Only introduce Tailwind or another framework if explicitly asked."
- Created inside `dazzdezign/` as a subfolder to avoid clobbering existing HTML files.

**Files touched:**
- `dazzdezign/web/` (entire Next.js project scaffold)

**Known gaps / TODO:**
- Now migrate pages/components one by one from `docs/migration-inventory.md`:
  1. Global styles (colors, fonts, keyframes, breakpoints) → `src/app/globals.css`
  2. Shared components (Header, Footer, HeroStage, Marquee, ProductCard, OrderModal, etc.)
  3. Routes: `/` (storefront), `/login`, `/studio` (auth-gated)
  4. Studio sub-views: Orders, Products, Design Center
  5. Verify parity → write `docs/migration-summary.md`

---

## [2026-08-12] Storefront components migrated

**What changed:**
- Created global styles in `src/app/globals.css` with all 21 color tokens, 11 keyframe animations, breakpoints for storefront (980/900/620px) and studio (860/540px), reveal animations, prefers-reduced-motion support
- Created `src/app/layout.tsx` with `next/font/google` loading Hanken Grotesk (variable 400-900) and Noto Sans Arabic (600, 700) as CSS variables `--font-hanken` / `--font-noto-arabic`
- Migrated storefront components:
  - `Header.tsx` — sticky header with logo, nav links (What we do, AI content, Merch, Stockists), brand tagline
  - `HeroStage.tsx` — dz-blob background, 3 floating cards with dz-floatA/C/D, orange "Shop Now" tags
  - `Marquee.tsx` — infinite horizontal scroller (dz-marquee 28s), seamless loop
  - `ScopeOfWork.tsx` — two pillars (AI content on dark, Merch on lime), animated badges, orb pulses, dz-reveal entrance
  - `ProductCard.tsx` — aspect-ratio 1, rounded-22px, image overlay, "1 of 1" badge, hover translateY(-6px)
  - `OrderModal.tsx` — fixed overlay, two-column preview+form, quantity stepper, 11 dial codes, validation, mailto: submit, success state
  - `Footer.tsx` — dark bg, white logo, links (Caps, Bags, Instagram, LinkedIn, Stockists), Arabic copyright
- Migrated storefront page `src/app/page.tsx` composing all components with 8-product CAPS array

**Why / decisions made:**
- All inline styles from decoded HTML preserved exactly as CSS custom properties in globals.css
- No Tailwind — plain CSS with design tokens per §1.1
- `dangerouslySetInnerHTML` used for SVG icons extracted from builder output (exact visual match)
- `style-hover`/`style-focus` from builder → React onMouseEnter/onMouseLeave + CSS transitions
- Product images referenced via `/assets/collection/...` paths (missing locally, placeholder paths used)
- Stockists link points to `#` (original linked to missing `Dazz Dezign Shop.dc.html`)

**Files touched:**
- `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
- `src/components/storefront/Header.tsx`, `HeroStage.tsx`, `Marquee.tsx`, `ScopeOfWork.tsx`, `ProductCard.tsx`, `OrderModal.tsx`, `Footer.tsx`

---

## [2026-08-12] Login page and auth proxies migrated

**What changed:**
- `src/app/login/page.tsx` — dark card on #141414, "Dazz" + lime "Dezign" brand, username/password with lime focus ring, POST to /api/auth/login, error display, redirects to /studio
- `src/app/api/auth/login/route.ts` — proxies to dazzdezign-api:3008/api/auth/login, forwards session cookie
- `src/app/api/auth/check/route.ts` — proxies to dazzdezign-api:3008/api/auth/check with cookie

**Why / decisions made:**
- Auth remains on the existing API server — Next.js only proxies cookies
- Visual match: original login.html used system fonts; this uses Hanken Grotesk per design system

**Files touched:**
- `src/app/login/page.tsx`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/check/route.ts`

---

## [2026-08-12] Studio dashboard and all three tabs migrated

**What changed:**
- `src/app/studio/page.tsx` — auth-gated, checks /api/auth/check on mount, redirects to /login if unauthorized, renders header + active tab view
- `src/components/studio/StudioHeader.tsx` — sticky header with logo, 3 tab buttons (Sales & orders, Products, Design center), active tab highlighted, labels hidden on mobile
- `src/components/studio/OrdersView.tsx` — 4 KPI cards (revenue lime highlight, orders, units, avg), top sellers bar chart, filter toolbar (All/New/Confirmed/Shipped/Delivered), order list grid with status advance + delete, Export CSV, Clear orders
- `src/components/studio/ProductsView.tsx` — product count, Add product CTA, 3-col grid, image with tone bg, active/hidden badge, Edit/Hide/Show/Delete buttons, editor modal with image upload (drag/drop), name/type/price/tone/active fields, POST/PATCH to /api/products
- `src/components/studio/DesignCenter.tsx` — 760x760 canvas cap designer, cap color swatches (8), artwork upload, English text + font select (5), Arabic text + font select (5), text color swatches (6), transform panel (size/rotate/reset), fit-to-curve toggle + slider, "Add to catalog" → POST /api/products, "Download" → PNG blob
- API proxies: `/api/products`, `/api/products/[id]`, `/api/orders`, `/api/orders/[id]`, `/api/orders/clear` all proxy to dazzdezign-api:3008 with cookie forwarding

**Why / decisions made:**
- Canvas-based designer ports the original HTML canvas logic 1:1
- All studio views are client components ("use client") for interactivity
- API proxies keep auth on the existing server — no session logic duplicated
- Font lists include builder's 8 extra fonts for parity

**Files touched:**
- `src/app/studio/page.tsx`, `src/components/studio/StudioHeader.tsx`, `OrdersView.tsx`, `ProductsView.tsx`, `DesignCenter.tsx`
- `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`, `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/route.ts`, `src/app/api/orders/clear/route.ts`
