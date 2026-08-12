# Dazzdezign — Next.js Migration & E-commerce Build Plan

This file is written **as instructions for Claude Code**. Drop it in the root of your
`dazzdezign` project folder (the one with the HTML/CSS site) and start Claude Code
there, referencing this file first thing (e.g. `claude "read PROJECT_PLAN.md and follow it"`).

Two folders are involved:
- `dazzdezign` — the current HTML/CSS site (source of truth for design)
- `dazzdezign-api` — the backend/API project

---

## 0. Ground rules for Claude Code (read this first)

1. **Do not guess the stack of `dazzdezign-api`.** Before writing any backend-integration
   code, open `dazzdezign-api` and inspect it: language, framework, database, existing
   routes/endpoints, auth strategy already in place (if any). Summarize findings in
   `docs/api-audit.md` before touching integration code.
2. **Pixel/behavior parity first, features second.** Do not add e-commerce logic until
   Phase 1 (the Next.js migration) is fully done and confirmed working.
3. **Never silently change the design.** Colors, spacing, fonts, breakpoints, animations,
   and copy must match the original HTML/CSS site unless something is technically
   impossible to port 1:1 — in that case, document the deviation and why.
4. **Document continuously, not at the end.** After every meaningful chunk of work
   (a component migrated, a feature added, a decision made), append an entry to the
   running log described in Section 3. Don't batch this up for a final summary.
5. **Ask before assuming on ambiguous business logic** (e.g. what counts as "in stock",
   whether guest checkout/guest cart is allowed, whether reviews require a verified
   purchase). Log the question and the assumption you proceeded with if you can't ask.

---

## 1. Phase 1 — Migrate `dazzdezign` (HTML/CSS) → Next.js

### 1.1 Setup
- Create a new Next.js app (App Router, TypeScript) either inside `dazzdezign` as a
  subfolder (e.g. `dazzdezign/web`) or alongside it — pick whichever avoids
  clobbering the existing HTML files, and record the choice in the log.
- Use plain CSS / CSS Modules that mirror the existing stylesheets as closely as
  possible first. Only introduce Tailwind or another framework if explicitly asked —
  default is: **carry over the existing CSS**, don't rewrite the design system.

### 1.2 Inventory before converting
- Walk every `.html` file in the project and list all pages/routes found.
- Walk the CSS and note shared partials, variables (colors/fonts/spacing), and any
  JS-driven behavior (carousels, modals, accordions, mobile nav, etc).
- Save this inventory as `docs/migration-inventory.md` before converting anything —
  this becomes the checklist for what "done" means.

### 1.3 Convert
- One page → one route at a time. For each:
  - Break repeated HTML (header, footer, nav, product card, etc.) into reusable
    React components under `components/`.
  - Preserve class names where practical so the ported CSS keeps working; refactor
    only where Next.js structure forces it (e.g. `<img>` → `next/image`, inline
    `<script>` → `useEffect`/client components).
  - Any interactive JS behavior (menus, sliders, tabs) must be ported and re-tested,
    not dropped.
- Optimize images with `next/image`, but do not change how they visually appear
  (respect original dimensions/aspect ratio/object-fit).
- Keep SEO metadata (`<title>`, `<meta description>`, OG tags) equivalent to the
  original pages using the Next.js Metadata API.

### 1.4 Verify
- Once all pages are converted, do a side-by-side pass: original HTML page vs new
  Next.js page, for every route in the inventory. Note any visual or behavioral diffs
  in the log, fixed or not.

---

## 2. Phase 2 — E-commerce logic

**Only start this after Phase 1 is complete and verified.** Build against `dazzdezign-api`
wherever it already has relevant endpoints; only add new backend endpoints where needed
(and document them in `docs/api-audit.md` as you add them).

Build in this order — each item should work end-to-end (UI + API) before moving to the next:

1. **Auth — Sign up / Login**
   - Registration, login, logout, session/token handling (e.g. JWT or session cookies —
     match whatever `dazzdezign-api` already uses, or propose an approach and log it).
   - Protected routes/pages (e.g. account page, checkout) redirect unauthenticated users.
   - Basic password reset flow if the API supports it (or stub + note it as future work).

2. **Product search & filter**
   - Search bar with query matching against product name/description.
   - Filters: category, price range, and whatever attributes the product data actually
     has (size, color, etc. — check the real data model, don't invent fields).
   - Sorting (price, newest, rating).

3. **Ratings & reviews**
   - Display average rating + review count on product cards/pages.
   - Authenticated users can submit a rating + written feedback.
   - Decide/document: one review per user per product? Editable after posting?

4. **Wishlist**
   - Add/remove product to wishlist, persisted per logged-in user via the API.
   - Wishlist page listing saved items.

5. **Cart & checkout**
   - Add to cart, update quantity, remove from cart.
   - Cart persists across sessions for logged-in users (via API); guest cart
     behavior should be explicitly decided and documented, not assumed.
   - Checkout flow through to an order confirmation (payment integration only if
     explicitly requested — otherwise stub it clearly and say so in the log).

6. **General feedback**
   - A general contact/feedback form (not tied to a specific product) if the
     original site had one, or add a simple one if useful — document the decision.

For each of the six items above: implement UI + connect to real API + basic loading/
error/empty states. Don't leave features half-wired (UI with no working backend call,
or vice versa) without flagging it clearly in the log as incomplete.

---

## 3. Documentation requirement (do this throughout, not just Phase 2)

Maintain a running file at `docs/CHANGELOG.md`. Every time you finish a meaningful
piece of work, append an entry — don't rewrite history, just keep adding:

```md
## [YYYY-MM-DD] Short title of what was done

**What changed:**
- ...

**Why / decisions made:**
- ...

**Files touched:**
- ...

**Known gaps / TODO:**
- ...
```

At the end of Phase 1, also produce `docs/migration-summary.md` (one-time, not per-entry)
covering: final route list, component structure, any design deviations from the
original site, and anything not fully ported.

At the end of Phase 2, produce `docs/ecommerce-features.md` summarizing how each
feature (auth, search/filter, ratings, wishlist, cart, feedback) works, which API
endpoints it uses, and what's still stubbed/incomplete.

---

## 4. Suggested order of operations for Claude Code

1. Audit `dazzdezign-api` → `docs/api-audit.md`
2. Inventory `dazzdezign` HTML/CSS → `docs/migration-inventory.md`
3. Set up Next.js project
4. Migrate pages/components one by one, logging as you go in `docs/CHANGELOG.md`
5. Verify parity → `docs/migration-summary.md`
6. Build e-commerce features in the order listed in Section 2, logging as you go
7. Final summary → `docs/ecommerce-features.md`

---

## What you (the user) should do

1. Save this file as `PROJECT_PLAN.md` in your `dazzdezign` project root.
2. Make sure both `dazzdezign` and `dazzdezign-api` are accessible in the same
   workspace/session Claude Code runs in (e.g. open the parent folder containing
   both, or point Claude Code at both paths).
3. Start Claude Code and tell it to read and follow `PROJECT_PLAN.md`.
4. Check in after Phase 1 (migration) before letting it start Phase 2 (e-commerce
   logic) — confirm the design/behavior matches before new features get layered on.
5. Periodically skim `docs/CHANGELOG.md` — that's your documentation trail of
   everything done.