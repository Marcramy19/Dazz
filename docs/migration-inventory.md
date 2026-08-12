# Migration Inventory — dazzdezign (HTML/CSS)

> Written 2026-08-12. Per `Project plan.md` §4 Step 2: walk every `.html` file and
> note all pages/routes, shared components, CSS variables/breakpoints, and JS-driven
> interactive behavior. This becomes the checklist for what "done" means in Phase 1.

---

## 1. File map

| File | Role | Size | Bundled? |
|---|---|---|---|
| `dazzdezign/index.html` | Public storefront (landing page + product grid + order flow) | 8.9 MB | Yes — `<x-dc>` bundle |
| `dazzdezign/login.html` | Studio admin sign-in page | 3 KB | No — plain HTML + inline JS |
| `dazzdezign/studio/index.html` | Studio admin dashboard (sales, products, design center) | 6 MB | Yes — `<x-dc>` bundle |
| `dazzdezign/studio/designer.html` | Standalone cap designer (canvas-based, drag/drop artwork) | 59 KB | No — plain HTML + inline JS |

**Missing assets:** The storefront references `assets/collection/norm/*.png` and
`assets/collection/tote-sandsea.png` (product images). No `assets/` folder exists
locally — these images are served from the deployment server (`/opt/dazzdezign/`).
Product images will not render in local dev until placeholder assets are added or the
images are copied into the new project.

---

## 2. Page-by-page inventory

### 2A. `index.html` — Public storefront

**Route (Next.js):** `/` (and/or `/storefront`)

**Sections (top → bottom):**

| Section | DOM / section ID | Description |
|---|---|---|
| Header (sticky) | `<header>` | Logo SVG (black pill with white "D") + brand name "Dazz Dezign®" + tagline "by Fido (13 yrs old)" + desktop nav links: What we do → `#work`, AI content → `#work`, Merch → `#drop`, Stockists → `Dazz Dezign Shop.dc.html`. Nav hides at ≤ 900 px. Sticky with `backdrop-filter: blur(12px)`, semi-transparent `#e9e9e9` background. |
| Hero | `<section>` (no id) | Two-column grid (`1fr 1.12fr`). Left: glasses SVG icon, copy ("One design per cap…"), H1 "Make it your own" (with hand-drawn SVG underline), sub-copy, CTA button "Claim your one-of-one" (→ opens order modal for featured product). Right: `.dz-stage` — floating hero blob (animated organic `dz-blob`), three floating product cards (A: No Bad Vibes, C: Habibi, D: Shark Tank) with `dz-floatA/C/D` keyframe animations (rotates + Y translate, 7–9 s cycles), three orange "Shop Now" / "Shop" tag pills with hover-cursor→ order modal. Card A also has a "Shop Now" bottom bar. Hero stage scales to 0.82 at ≤ 900 px, 0.62 at ≤ 620 px. |
| Marquee | — | Dark strip (`#141414`), horizontally scrolling text: "AI CONTENT CREATION ✺ ONE-OF-ONE MERCH ✺ REELS, CAMPAIGNS & DROPS ✺ PRINTED ONCE, NEVER AGAIN ✺ DESIGNED IN CAIRO". Infinite `dz-marquee` animation, 28 s. Duplicated content for seamless loop. |
| Scope of Work (`#work`) | `<section id="work">` | Section header (orange overline, H2, copy). Two equal-column grid: Pillar A — AI content creation (dark card `#141414` bg, `#cdf03a` accent, animated "generating" badge with rotating word cycle: reels / campaigns / avatars / product films / brand worlds on 1.9 s `setInterval`), four sub-items (AI video & reels, Social campaigns, AI visuals & avatars, Content on tap). Pillar B — Merchandise (lime `#cdf03a` card, "Since day one" badge), four sub-items (One-of-one caps & bags, Custom merch for brands, Design to product, "Shop the drop" CTA → `#drop`). Both pillars have orbit-pulse decorative radial circles, hover translateX on sub-items. |
| Shop the Drop (`#drop`) | `<section id="drop">` | Section header + "One design, printed once" green pill badge. Product grid (`.dz-capgrid`, 3-col → 2-col at ≤ 980 px → 1-col at ≤ 620 px): iterates `caps` array, each card is a rounded square (`aspect-ratio: 1`, `border-radius: 22px`) with product image, bottom info bar (name + price), and an orange "1 of 1" badge top-right. Click opens order modal. `dz-reveal` fade-up animation on each card with staggered delays (nth-child delays up to 0.2 s). |
| Footer | `<footer>` | Dark strip (`#141414`): logo (white variant) + "Dazz Dezign®" + "by Fido (13 yrs old)". Link row: Caps → `#drop`, Bags → `#drop`, Instagram → external, LinkedIn → external, Stockists → `Dazz Dezign Shop.dc.html`. Bottom row: © 2026 Dazz Dezign · Designed in Cairo, shipped across Egypt. + Arabic "صيف ٢٠٢٦" in Noto Sans Arabic 700. |
| Order Modal | — | Fixed overlay (`z-index: 200`, blur backdrop), triggered on any product click. Two-column grid (0.82fr 1fr): left = product image + name/price badge; right = form. Form fields: quantity stepper (– / + buttons), Full name, dial-code select (EG+20, AE+971, SA+966, KW+965, QA+974, BH+973, OM+968, JO+962, LB+961, US+1, UK+44), Phone (WhatsApp), City / Governorate, Delivery address, Notes/textarea ("Your own idea? Describe it here — or note size, color, landmark…"). Validation error message. Total display. "Place order" CTA → builds mailto: body → `window.location.href` opens email client with order to `orders@dazzdezign.com`. Post-submit shows success state: check icon, "Order ready to send" message, "Done" button closes modal. Cash on delivery note. Body scroll locked while modal open (`overflow: hidden`). |

**Template system:** Uses `<x-dc>` custom element + `<sc-if>` / `<sc-for>` conditional
list rendering with `{{ mustache }}` bindings. The `DCLogic` class provides
`setState`, `componentDidMount`, `componentWillUnmount`, `renderVals()`. This is a
proprietary visual builder — not React, not Vue, not standard HTML. The bundle
runtime (the 8.9 MB part) provides the renderer. For the Next.js migration, these
components become standard React.

**Hover pseudo-behavior:** `style-hover="..."` / `style-focus="..."` — these are
builder-specific pseudo-attributes that toggle inline styles on hover/focus. In the
migration, these become CSS `:hover` / `:focus` rules or React `onMouseEnter`/`onMouseLeave`.

---

### 2B. `login.html` — Studio admin sign-in

**Route (Next.js):** `/login`

**Structure:** Single centered dark card (`#1c1c1c` bg, `#141414` body bg), brand
mark "Dazz" (white) + "Dezign" (lime `#e9ff2e`), "Studio Login" subtitle, username
input, password input, "Sign in" button (lime `#e9ff2e` bg, dark text). Error
message area. Simple inline `<script>` that POSTs credentials to `/api/auth/login`
and redirects to `/studio/` on success.

**Typography:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`).
Not Hanken Grotesk — this is an admin page with a different type system.

**Colors:** `#141414` body, `#1c1c1c` card, `#2a2a2a` border, `#333` input border,
`#9a9a9a` labels, `#8a8a8a` subtitle, `#e9ff2e` focus ring + button bg, `#ff6b6b` error text.

---

### 2C. `studio/index.html` — Studio admin dashboard

**Route (Next.js):** `/studio` (auth-gated)

**Tabs (3):**
1. **Sales & Orders** (`isOrders`): KPI cards (Total revenue `#cdf03a` highlight, Orders count, Units sold, Avg order). Top sellers bar chart (lime progress bars). Filter tabs (All / New / Confirmed / Shipped / Delivered). Order rows: product, customer, date, notes, total, advance-status pill button, delete button. Export CSV button. Clear orders button. Empty state. Data: reads orders from `localStorage dazz.orders.v2` → syncs to `/api/state` POST.
2. **Products** (`isProducts`): Product count overline. "Add product" CTA. Product grid (3-col → 2-col at ≤ 860 px → 1-col at ≤ 540 px). Each product card: image (tone-colored bg), status badge (active/inactive), name + price, type, Edit + toggle (show/hide) + delete buttons. Opens product editor modal.
3. **Design Center** (`isDesign`): Canvas-based cap preview (760×760 `<canvas>` element). Controls: Cap colour swatches, artwork upload (drag/drop + file picker), remove background toggle + strength slider, English text input, Arabic text input, text colour swatches, English font dropdown (Hanken Grotesk / Anton / Archivo Black / Bebas Neue / Pacifico), Arabic font dropdown (Noto Sans Arabic / Aref Ruqaa / Cairo / Reem Kufi / Tajawal), Transform panel (select tabs: artwork/text/all → size slider + rotate slider + reset), "Fit to cap curve" toggle + curve amount slider. "Add to catalog" + "Download" buttons. Data: design center renders product images to canvas, exports as data-URL, then pushes to product catalog.

**Product editor modal:** Image upload (drag/drop + file picker, tone-colored bg), name, type dropdown, price, active toggle. Inline form (0.85fr 1fr grid). Saves back to `localStorage` + syncs to API via `/api/state`.

**Fonts loaded in studio:** Anton (400), Archivo Black (400), Aref Ruqaa (700),
Bebas Neue (400), Cairo (700, 800), Hanken Grotesk (400–800), Noto Sans Arabic
(600, 700), Pacifico (400), Reem Kufi (700), Tajawal (700, 800).

**Studio-specific breakpoints:** 860px → single-col grids; 540px → KPIs 2-col, prod grid 1-col, tab labels hide.

---

### 2D. `studio/designer.html` — Standalone cap designer

**Route (Next.js):** `/studio/designer` (or kept separate, see note)

**Structure:** A standalone page (not part of the bundle system). Two-column layout
(`1fr 360px` → single-col at ≤ 820px). Left: canvas preview with drag/grab
interaction. Right: cap colour swatches, artwork upload (drag/drop), remove-bg
toggle + slider, English/Arabic text inputs + font dropdowns + colour swatches,
transform controls (size/rotate sliders), fit-to-curve toggle + slider, "Add to
catalog" + "Download" buttons. Top bar: brand mark + navigation links.

**Note:** `studio/designer.html` appears to be a stripped-down standalone version of
the Design Center tab in `studio/index.html`, sharing the same canvas logic and
controls. During migration, it can be extracted as a shared component or kept as a
standalone route.

---

## 3. Shared components to extract

| Component | Used in | Notes |
|---|---|---|
| **Header / Nav** (storefront) | `index.html` | Logo SVG + brand + desktop nav. Sticky, blur-backdrop. Becomes `<Header>` |
| **Footer** (storefront) | `index.html` | Logo (white) + links + copyright + Arabic text. Becomes `<Footer>` |
| **Hero Stage** | `index.html` | Floating blob + 3 floating product cards + orange shop tags. Becomes `<HeroStage>` |
| **Marquee** | `index.html` | Infinite horizontal scroller. Becomes `<Marquee>` |
| **Product Card (drop grid)** | `index.html` | Image + name/price overlay + "1 of 1" badge. Click → open order. Becomes `<ProductCard>` |
| **Product Card (hero, floating)** | `index.html` | Card with top bar, image, social icons / Shop Now bar. Becomes `<HeroProductCard>` or `<FloatingCard>` |
| **Order Modal** | `index.html` | Full checkout modal: preview + form + validation + mailto submit + success state. Becomes `<OrderModal>` |
| **Scope Pillars** | `index.html` | Two equal cards (AI content dark, Merchandise lime). Becomes `<ScopeOfWork>` |
| **Studio Header / Tab Bar** | `studio/index.html` | Logo + tab buttons. Becomes `<StudioHeader>` |
| **Sales & Orders view** | `studio/index.html` | KPI cards, top sellers, filter toolbar, order list. Becomes `<OrdersView>` |
| **Products grid** | `studio/index.html` | Product cards grid. Becomes `<ProductsView>` |
| **Product Editor Modal** | `studio/index.html` | Image upload + fields modal. Becomes `<ProductEditorModal>` |
| **Design Center** | `studio/index.html` | Canvas + controls. Becomes `<DesignCenter>` (canvas `<canvas>` + state management) |
| **Cap Designer** | `studio/designer.html` | Standalone canvas page. Can share `<DesignCenter>` component |
| **Login Card** | `login.html` | Simple form card. Becomes `<LoginCard>` |

---

## 4. Design system (no CSS custom properties — all inline)

### 4A. Color palette

**All values extracted from the original HTML. There are no CSS custom properties;
all styling is inline or in `<style>` blocks.**

| Token (suggested name) | Hex | Usage |
|---|---|---|
| `--dz-black` / primary | `#141414` | Body text, CTA buttons, marquee bg, header logo, dark cards |
| `--dz-lime` / accent | `#cdf03a` | Primary accent (lime): pillar-2 card bg, blob bg, CTA arrow color, studio accent, KPI revenue highlight, "generating" badge |
| `--dz-orange` | `#ff4e1e` | Section overlines, "1 of 1" badges, shop tags, hero tags |
| `--dz-bg` | `#e9e9e9` | Page background (storefront) |
| `--dz-bg-studio` | `#f4f3f0` | Page background (studio), form backgrounds |
| `--dz-surface` | `#fff` | Cards, product grid items, order modal |
| `--dz-surface-alt` | `#efeeec` | Card bg (inactive/placeholder), product grid tone, order preview bg |
| `--dz-muted` | `#4a4a4a` | Body copy in hero and scope sections |
| `--dz-muted-light` | `#9a9a9a` | Nav links, subtitles, labels, inactive text |
| `--dz-muted-dark` | `#6f6f6c` | Studio body copy, order-row secondary text |
| `--dz-border` | `#e7e6e2` | Studio card borders |
| `--dz-border-input` | `#e2e2e2` | Form input borders |
| `--dz-border-light` | `#e0dfdb` | Secondary button borders |
| `--dz-success` | `#16b85f` | Green badge dot, check icon |
| `--dz-error` | `#e0341c` | Delete hover, validation error (also `#ff6b6b` in login) |
| `--dz-error-login` | `#ff6b6b` | Login error text |
| `--dz-cyan` | `#5ad6da` | Marquee text accent |
| `--dz-blue` | `#2e5bff` | Habibi card tone |
| `--dz-navy` | `#1a3a8f` | "Now 今" product tone |
| `--dz-e9ff2e` | `#e9ff2e` | Login accent + "Dazz Dezign" brand mark accent (studio logo) |

### 4B. Typography

| Font | Weights | Role | Source |
|---|---|---|---|
| **Hanken Grotesk** | 400, 500, 600, 700, 800, 900 | Primary body font — all storefront + studio text | Google Fonts (`font-display: swap`) |
| **Noto Sans Arabic** | 600, 700 | Arabic text (storefront footer "صيف ٢٠٢٦", studio Arabic input) | Google Fonts |
| Anton | 400 | Studio font option (cap design) | Google Fonts — studio only |
| Archivo Black | 400 | Studio font option | Google Fonts — studio only |
| Aref Ruqaa | 700 | Studio Arabic font option | Google Fonts — studio only |
| Bebas Neue | 400 | Studio font option | Google Fonts — studio only |
| Cairo | 700, 800 | Studio Arabic font option | Google Fonts — studio only |
| Pacifico | 400 | Studio font option | Google Fonts — studio only |
| Reem Kufi | 700 | Studio Arabic font option | Google Fonts — studio only |
| Tajawal | 700, 800 | Studio Arabic font option | Google Fonts — studio only |

**Login page** uses system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI',
Roboto, Helvetica, Arial, sans-serif`) — NOT Hanken Grotesk.

**Type sizes (storefront):**
- Hero H1: `clamp(46px, 5.6vw, 78px)` — weight 800, tracking -0.035em
- Section H2: `clamp(32px, 4.2vw, 52px)` — weight 800, tracking -0.032em
- Pillar H3: `30px` — weight 800, tracking -0.025em
- Body copy: `16–17px`, weight 500, `line-height: 1.5`, color `#4a4a4a`
- Sub-item title: `16px`, weight 700
- Sub-item body: `13.5px`, weight 500, `line-height: 1.45`
- Nav links: `15px`, weight 600
- Section overline: `13px`, weight 700, letter-spacing `0.18em`, uppercase, color `#ff4e1e`
- Hero title tagline ("by Fido"): `13px`, weight 600, letter-spacing `0.2em`, uppercase, color `#9a9a9a`
- Footer brand: `26px`, weight 800
- Footer tagline: `11px`, weight 600, letter-spacing `0.22em`, uppercase
- "1 of 1" badge: `12px`, weight 700, orange pill

**Type sizes (studio):**
- Dashboard H1: `clamp(28px, 3.4vw, 40px)`, weight 800, tracking -0.03em
- KPI value: `30px`, weight 800, tracking -0.03em
- Card name: `15.5–16px`, weight 800
- Button label: `13–14.5px`, weight 700
- Overline: `12px`, weight 700, letter-spacing `0.18em`, uppercase, orange
- Input placeholder: `14–15px`, weight 500–600

### 4C. Breakpoints

**Storefront:**
| Breakpoint | Changes |
|---|---|
| `≤ 980px` | Product grid (`.dz-capgrid`) → 2 columns |
| `≤ 900px` | Hero grid → 1 column, gap 12px; hero stage scales to 0.82; nav links hidden; work grid → 1 column; hero padding tighter |
| `≤ 620px` | H1 → 46px; hero stage → 0.62 scale; product grid → 1 column; order grid → 1 column; order preview min-height 170px; form row → 1 column |

**Studio:**
| Breakpoint | Changes |
|---|---|
| `≤ 860px` | Design grid, KPIs, product grid, edit grid, order rows → single column |
| `≤ 540px` | KPIs → 2 columns; product grid → 1 column; tab labels hidden |

### 4D. Keyframe animations

| Animation name | Duration | Behavior | Usage |
|---|---|---|---|
| `dz-floatA` | 7 s infinite | rotate(-6deg) + translateY oscillation | Hero card A (No Bad Vibes) |
| `dz-floatC` | 8 s infinite | rotate(-7deg) + translateY oscillation | Hero card C (Habibi) |
| `dz-floatD` | 9 s infinite | rotate(-7deg) + translateY oscillation | Hero card D (Shark Tank) |
| `dz-blob` | 12 s infinite | border-radius morph + scale + rotate | Hero background blob |
| `dz-marquee` | 28 s linear infinite | translateX(0) → translateX(-50%) | Marquee strip |
| `dz-pop` | 0.28 s | opacity 0→1 + translateY(16px) + scale(0.97)→1 | Order modal appear |
| `dz-blink` | 1 s step-end infinite | opacity 1↔0 at 50% | "Generating" cursor blink |
| `dz-livepulse` | 1.8 s ease-out infinite | box-shadow expansion | "Generating" live indicator |
| `dz-orbpulse` | 7–9 s infinite | scale(1)↔scale(1.2) + opacity | Pillar card decorative orb |
| `dz-rise` | 0.7 s | opacity 0→1 + translateY(30px)→0 | `.dz-reveal` scroll/load entrance |
| `dz-pop` (studio) | 0.26 s | Same as storefront variant | Studio modals |
| `dz-rise` (studio) | 0.5 s | Same as storefront variant | `.dz-anim` entrance |

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` → forces `.dz-reveal` to
`opacity: 1 !important; animation: none !important`.

### 4E. Layout tokens

| Token | Value |
|---|---|
| Max-width (storefront) | `1240px` |
| Max-width (studio) | `1180px` |
| Horizontal padding (storefront) | `34px` |
| Horizontal padding (studio) | `26px` |
| Card border-radius (product grid) | `22px` |
| Card border-radius (hero floating) | `16px` |
| Card border-radius (pillars) | `26px` |
| Card radius (order modal) | `26px` |
| Card radius (studio cards) | `18–22px` |
| Pill radius (buttons/badges) | `999px` |
| Form input radius | `11px` |
| Form input padding | `11px 13px` |
| Form input border | `1.5px solid #e2e2e2` |
| Form focus state | `border-color: #141414; background: #fff` |
| Grid gap (product grid) | `18px` |
| Grid gap (hero) | `30px` |
| Section padding vertical | `80–96px` |

### 4F. Visual effects

- `backdrop-filter: blur(12px)` — storefront header (sticky, semi-transparent bg)
- `backdrop-filter: blur(14px)` — studio header
- `backdrop-filter: blur(6px)` — modal overlays
- `box-shadow: 0 34px 64px -22px rgba(0,0,0,0.34)` — hero floating cards
- `box-shadow: 0 40px 90px -30px rgba(0,0,0,0.55)` — modals
- `will-change: transform, opacity` — product grid cards (transition on hover)
- `object-fit: cover` — all product images
- Hero blob: `animation: dz-blob` with radial-gradient background `#cdf03a`
- "Generating" badge: `repeating-radial-gradient(circle, #141414 0 8px, #fff 8px 17px)` in one hero card placeholder

---

## 5. JavaScript-driven interactive behavior

### Storefront (`index.html`)

| Behavior | Trigger | Implementation |
|---|---|---|
| **Order modal open** | Click on any hero card, hero tag, hero "Shop Now" button, or product grid card | `openOrder(p)` → `setState({ open: true, sel: p })`, `document.body.style.overflow = 'hidden'` |
| **Order modal close** | Click overlay (outside modal) or "Done" button | `close()` → `setState({ open: false })`, restores `overflow` |
| **Quantity stepper** | Click –/+ buttons | `qtyStep(±1)` → `Math.max(1, qty ± 1)` |
| **Form binding** | Input/change events | `setF(key)` → `setState({ form: { ...form, [key]: value } })` |
| **Order submit (mailto:)** | Form submit | Validates name/phone/city/address → builds multiline plain-text body → `window.location.href = mailto:orders@dazzdezign.com?subject=...&body=...` → shows success state |
| **"Generating" word cycle** | `componentDidMount` | `setInterval` every 1.9 s rotating through `['reels ✦', 'campaigns', 'avatars', 'product films', 'brand worlds']` |
| **Scroll reveal** | Page load / scroll | `.dz-reveal` elements animate via `dz-rise` on mount (staggered via `:nth-child` delays) |

### Login (`login.html`)

| Behavior | Trigger | Implementation |
|---|---|---|
| **Login form submit** | Submit button | `fetch('/api/auth/login', { method:'POST', body: { user, pass } })` → 200: `window.location.replace('/studio/')` → error: displays message |

### Studio (`studio/index.html`)

| Behavior | Trigger | Implementation |
|---|---|---|
| **Tab switching** | Click tab buttons | `goOrders` / `goProducts` / `goDesign` → `setState` sets active tab + applies active tab style |
| **Order status advance** | Click status pill | Cycles `new → confirmed → shipped → delivered` |
| **Order delete** | Click trash icon | Removes order from `localStorage dazz.orders.v2`, syncs to `/api/state` |
| **Export CSV** | Click button | Converts orders to CSV string, triggers `download` |
| **Clear orders** | Click button | Clears order list after confirmation |
| **Product add/edit** | Click "Add product" or Edit | Opens `ProductEditorModal` |
| **Product toggle** (show/hide) | Click eye icon | Toggles `active` flag, syncs to API |
| **Product delete** | Click trash icon | Removes product, syncs to API |
| **Image upload** | File picker / drag-drop | Reads file → `FileReader.readAsDataURL` → sets product `img` as base64 data-URL |
| **Color/tone picker** | Click swatch | Sets product tone color |
| **Canvas design** (design center) | Canvas interaction | `<canvas>` element for live cap preview; drag to move artwork/text; file upload for artwork; text input with font/color; background removal toggle + tolerance; "fit to curve" arch deformation; size/rotate sliders |
| **Add to catalog** | Click button | Renders canvas → data-URL → pushes new product to `localStorage` + `/api/state` POST → regenerates public site |
| **Download PNG** | Click button | Canvas `toBlob()` → `URL.createObjectURL` → triggers download |
| **Product editor save** | Click save | Updates product in `localStorage`, syncs to `/api/state` POST |
| **Data persistence** | All writes | Every write calls `POST /api/state` with key `dazz.products.v2` or `dazz.orders.v2` → server persists to `data.json` and regenerates website |

### Designer (`studio/designer.html`)

Same canvas-based cap designer as the Design Center tab, but standalone. Shares the
same controls and canvas logic. Data is saved to `localStorage` + `/api/state` POST.

---

## 6. Cross-cutting concerns for migration

### Missing assets (gap)
Product images (`assets/collection/norm/*.png`, `assets/collection/tote-sandsea.png`)
are not present in the workspace. They exist only on the deployment server. During
Phase 1 development, placeholder images will need to be used. The migration should
reference images via `next/image` pointing at the same relative paths or a configurable
public path so production images can be dropped in later.

### Builder template syntax
The storefront and studio use `<x-dc>`, `<sc-if>`, `<sc-for>`, `{{ mustache
bindings }}`, `style-hover`, `style-focus` — all proprietary builder constructs. These
are translated to React components and state in the Next.js version. The HTML source is
the semantic truth; the template syntax is just the builder's templating language.

### Order submission is `mailto:`, not API
The storefront order modal builds a `mailto:` link — it opens the user's email client.
It does NOT POST to `/api/orders`. The `/api/orders` POST endpoint exists in the API
but is currently unused by the storefront. This is the existing behavior and must be
preserved exactly in Phase 1.

### Studio data bridge: localStorage ↔ API
The Studio dashboard reads/writes `localStorage` keys `dazz.products.v2` /
`dazz.orders.v2` and syncs them to `POST /api/state`. This bridge is the persistence
mechanism for the admin. During migration, this exact pattern should be preserved for
studio parity (or improved — but that's a Phase 2 decision).

### No CSS custom properties
The entire site uses inline styles and class-based CSS without a single CSS custom
property (`:root { --var: ... }`). The color palette, typography, and spacing values
listed in §4 above are extracted from the actual HTML and should be documented as
design tokens during the Next.js migration for maintainability, but the actual rendered
styles must match the existing values exactly.

### Nav links reference missing pages
The storefront nav links to `Dazz Dezign Shop.dc.html` (Stockists) — this file does
not exist in the workspace. The storefront is effectively a single-page landing site
with anchor links (`#work`, `#drop`). The "Stockists" link should be preserved as a
placeholder route or link, documented as not ported.

---

## 7. "Done" checklist for Phase 1

A page is "done" when:
- [ ] All sections render in Next.js with matching visual output
- [ ] CSS values (colors, fonts, sizes, spacing, border-radius, shadows) match exactly
- [ ] All keyframe animations are present and behave identically
- [ ] Responsive behavior matches at all breakpoints (980 / 900 / 620 storefront; 860 / 540 studio)
- [ ] Interactive JS behavior works: order modal open/close/submit, marquee, product grid iteration, form validation, mailto: submission, scroll reveal
- [ ] `prefers-reduced-motion` is respected
- [ ] Login page works with `/api/auth/login` (or mock)
- [ ] SEO metadata equivalent using Next.js Metadata API
- [ ] Product images referenced (placeholder or real) via `next/image`
