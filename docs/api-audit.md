# API Audit — `dazzdezign-api`

> Audited 2026-08-12. Per `Project plan.md` §4 Step 1: inspect the actual code before
> writing any backend-integration code. Nothing below is assumed — everything was read
> from the files on disk.

## 1. What it is at a glance

`dazzdezign-api` is a **tiny, zero-dependency Node.js HTTP server** that acts as a
bridge between the Studio dashboard (which currently keeps its state in browser
`localStorage`) and server-side persistence, and exposes the product catalog / orders
to the public website. It also **regenerates the static website** (`index.html`) from a
template whenever the catalog changes.

| Concern | Finding |
|---|---|
| Language / runtime | Node.js, CommonJS (`require`). **No TypeScript.** |
| Framework | **None** — raw `http.createServer`. No Express, no Fastify. |
| Dependencies | **Zero** — uses only built-ins: `http`, `fs`, `path`, `crypto`. No `package.json`, no `node_modules`, no lockfile. |
| Database | **None.** Flat-file JSON store. |
| Persistence | `data.json` (products + orders) and `auth.json` (credentials/secret), read/written atomically (write `.tmp` then `renameSync`). |
| Server | `127.0.0.1:3008`. Meant to sit behind nginx (see auth model). |
| TLS | None — assumed handled by nginx. |
| CORS | Wide open: `Access-Control-Allow-Origin: *`, methods `GET, POST, OPTIONS`, headers `Content-Type`. |
| Deployed layout assumption | Hard-coded Linux paths: `UPLOAD_DIR = '/opt/dazzdezign/uploads'` and regen output `OUT = '/opt/dazzdezign/index.html'`. **These paths do not exist on this Windows machine.** |

## 2. Files

| File | Role |
|---|---|
| `server.js` | The whole HTTP API (~190 lines). |
| `data.json` | JSON store: `{ products: Product[], orders: Order[] }`. |
| `auth.json` | Single-user credentials: `{ user, salt, hash, secret }`. |
| `regen.js` | Builds the public website from `website.template.html` by injecting the active catalog into a `__DAZZ_CAPS__` marker inside the page's JS. Has an atomic-write CLI (`node regen.js`). |
| `website.template.html` | 8.9 MB template of the storefront, containing the `__DAZZ_CAPS__` marker. |

## 3. Auth strategy (already in place)

**Signed-cookie sessions, single static user. No per-user accounts.**

- Credentials live in `auth.json` (user `dazz`). The password is stored as an
  **scrypt** hash (`verifyPass` → `crypto.scryptSync` + `timingSafeEqual`).
- Login (`POST /api/auth/login`) validates the username/password, then issues a
  token of the form `<expiry_ms>.<HMAC-SHA256(secret, expiry)>` and sets it in an
  `HttpOnly; Secure; SameSite=Lax` cookie named `dazz_sess`, **7-day TTL**.
- `GET /api/auth/check` returns 200/401 depending on whether the cookie is valid.
  Its documented purpose is **nginx `auth_request`** gating for `/studio` and the
  write API — i.e. **the server itself does not enforce auth on writes**; the
  deployment is expected to.
- `POST /api/auth/logout` clears the cookie.
- Session secret lives in `auth.json` (`secret` field).

**Implications for the migration:**
- There is exactly one admin user, no registration, no roles, no JWT, no refresh
  tokens, no password-reset flow, no per-user profile.
- Phase-2 requirements like "register/login for customers", "protected customer
  pages", "password reset" do **not** exist in the API and would need to be built
  (documented there at build time, per the plan).

## 4. Existing routes/endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| any | `OPTIONS` | — | CORS preflight → 204 |
| GET | `/api/health` | none | Health check → `{ ok: true }` |
| POST | `/api/auth/login` | none (credential check) | Validate `{ user, pass }` → sets `dazz_sess` cookie or 401 |
| GET | `/api/auth/check` | cookie | 200/401 session probe (nginx `auth_request`) |
| POST | `/api/auth/logout` | cookie | Clear `dazz_sess` |
| GET | `/api/state` | none | Full state `{ products, orders }` — seeds the Studio dashboard on load |
| POST | `/api/state` | **none enforced server-side** | Dashboard bridge: body `{ key, value }` where key ∈ `dazz.products.v2` \| `dazz.orders.v2`. Persists to `data.json`; regenerates the website when products change. Unknown keys are ignored (200). |
| GET | `/api/products` | none | Public catalog → `Product[]` (raw array, no envelope) |
| POST | `/api/orders` | none | Append an order (see Order shape below) → `{ ok, order }` |
| GET | `/api/orders` | none | List all orders (raw array) — **publicly readable** |
| — | anything else | — | 404 `{ error: 'not found' }` |

Body limit: 25 MB (`readBody` destroys the socket beyond that). Responses are
`Cache-Control: no-store`.

## 5. Data model (read from `data.json`)

### Product
```jsonc
{
  "id": "p-nobadvibes",
  "name": "No Bad Vibes",
  "type": "trucker cap",        // free-form string; values seen: "trucker cap", "classic cap", "beach tote"
  "img": "assets/collection/norm/2627D20C.png",  // relative path (or /uploads/<file> after persistProductImages)
  "tone": "#e9ff2e",            // accent color used by the site for this product
  "price": 650,                 // integer EGP
  "active": true                // inactive products are hidden from the website by regen.js
  // optional: priceLabel (custom label, else "EGP <price>")
}
```
**There is no inventory/stock count, no size/color attribute array, no category field
beyond `type`, no ratings, no reviews, no per-product description, no wishlist flag.**

### Order
```jsonc
{
  "id": "o-<millis>",
  "ts": 1782791487587,          // ms epoch
  "status": "new",              // free-form; values seen: new | confirmed | shipped | delivered
  "product": "Shark Tank",      // product name (denormalized, not id)
  "type": "trucker cap",
  "unit": 640,
  "qty": 1,
  "name": "Karim S.",
  "dial": "+20",                // country dial code
  "phone": "122 999 3030",
  "city": "Alexandria",
  "address": "Smouha",
  "notes": "",
  "total": 640
}
```
Checkout is **phone-based** (name + dial + phone + city + address + notes). There is
**no email field, no payment field**, no cart line items beyond the single
product/qty pair. No per-order user association.

## 6. Website regeneration (`regen.js`)

- The storefront's product list lives in a JS array `caps = [...]` inside the page.
  `regen.js` reads `website.template.html`, substitutes `__DAZZ_CAPS__` with
  freshly-built array code for all `active` products, validates (eval with a stubbed
  `this.r()`, length check, DOCTYPE + marker checks, ±5 MB size guard), and atomically
  writes the result.
- CLI usage: `node regen.js` (reads `data.json`, writes the site).
- **Path caveat:** both the upload dir and the regen output path point at `/opt/...`
  (Linux deployment). On this Windows box, regen/upload as configured would fail or
  write to a non-existent location — the existing `dazzdezign/index.html` was produced
  on the deployment machine, not here.

## 7. Implications for Phase 1 (migration) and Phase 2 (e-commerce)

- **Phase 1 (this task):** the public storefront is the thing to port. It reads
  `caps` from the injected array in the page source — products are effectively
  hard-coded into the HTML bundle. During the Next.js migration, the catalog should be
  sourced the same way the current site gets it (from `dazzdezign-api`, or a local
  mirror of `data.json`), **not** re-invented.
- **Phase 2 gaps** (to be built later, against this API or new endpoints, documented
  in `docs/api-audit.md` as they are added): customer accounts/registration, product
  search/filter/sort endpoints, ratings & reviews, wishlist, cart persistence, and any
  checkout fields beyond the current phone-based shape.

## 8. Quick-reference notes for the migration

- Start command: `node server.js` (listens on `127.0.0.1:3008`).
- Node v24.19.0 / npm 11.17.0 available in this environment.
- No tests exist for the API.
