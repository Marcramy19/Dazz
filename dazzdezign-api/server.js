// Dazz Dezign backend — tiny zero-dependency API + JSON store.
// Bridges the Studio dashboard (localStorage keys dazz.products.v2 / dazz.orders.v2)
// to server-side persistence, and exposes products/orders to the public website.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { regenerate } = require('./regen');

// ---- Auth (signed-cookie sessions for the Studio sign-in page) ----
const AUTH_FILE = path.join(__dirname, 'auth.json');
const SESSION_COOKIE = 'dazz_sess';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
function loadAuth() { return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')); }
function verifyPass(pass, auth) {
  const h = crypto.scryptSync(String(pass || ''), Buffer.from(auth.salt, 'hex'), 64);
  const want = Buffer.from(auth.hash, 'hex');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}
function makeToken(auth) {
  const exp = Date.now() + SESSION_TTL_MS;
  const sig = crypto.createHmac('sha256', auth.secret).update(String(exp)).digest('hex');
  return exp + '.' + sig;
}
function verifyToken(token, auth) {
  if (!token || token.indexOf('.') === -1) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = crypto.createHmac('sha256', auth.secret).update(String(exp)).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(want, 'hex')); }
  catch (e) { return false; }
}
function getCookie(req, name) {
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; *)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function isAuthed(req) {
  try { return verifyToken(getCookie(req, SESSION_COOKIE), loadAuth()); } catch (e) { return false; }
}

// ---- Customer Auth (signed-cookie sessions, separate cookie) ----
const CUSTOMER_COOKIE = 'dazz_cust';
const CUSTOMER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
function hashPass(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(pass || ''), Buffer.from(salt, 'hex'), 64);
  return { salt, hash: h.toString('hex') };
}
function verifyCustomerPass(pass, customer) {
  const h = crypto.scryptSync(String(pass || ''), Buffer.from(customer.salt, 'hex'), 64);
  const want = Buffer.from(customer.hash, 'hex');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}
function makeCustomerToken() {
  const exp = Date.now() + CUSTOMER_TTL_MS;
  const sig = crypto.createHmac('sha256', loadAuth().secret).update(String(exp)).digest('hex');
  return exp + '.' + sig;
}
function verifyCustomerToken(token) {
  if (!token || token.indexOf('.') === -1) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = crypto.createHmac('sha256', loadAuth().secret).update(String(exp)).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(want, 'hex')); }
  catch (e) { return false; }
}
function getCustomerId(req) {
  const token = getCookie(req, CUSTOMER_COOKIE);
  if (!token || token.indexOf('.') === -1) return null;
  const [exp, sig] = token.split('.');
  if (Number(exp) < Date.now()) return null;
  // We'll store customer session mapping in data.json
  const d = load();
  const session = d.customer_sessions && d.customer_sessions[exp + '.' + sig];
  return session ? session.customer_id : null;
}
function isCustomerAuthed(req) {
  return !!getCustomerId(req);
}

// Rebuild the public website from the catalog. Never let a failure here break
// the API response or crash the server.
function safeRegen(products) {
  try { const r = regenerate(products); console.log('[regen] website rebuilt:', JSON.stringify(r)); }
  catch (e) { console.error('[regen] FAILED (website left unchanged):', e.message); }
}

const PORT = 3008;
const HOST = '127.0.0.1';
const DATA_FILE = path.join(__dirname, 'data.json');

const PKEY = 'dazz.products.v2';
const OKEY = 'dazz.orders.v2';

const UPLOAD_DIR = '/opt/dazzdezign/uploads';

// Persist any data: image on a product to a real file under /uploads and swap
// the product's img to that URL, so the catalog/website stay lightweight.
function persistProductImages(products) {
  if (!Array.isArray(products)) return products;
  return products.map(p => {
    if (!p || typeof p.img !== 'string' || !p.img.startsWith('data:')) return p;
    const m = p.img.match(/^data:image\/(png|jpeg|jpg|webp);base64,([\s\S]+)$/);
    if (!m) return p;
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const id = (p.id || ('p-' + Date.now())).replace(/[^a-z0-9_-]/gi, '');
    const fname = id + '-' + (load.__seq = (load.__seq || 0) + 1) + '.' + ext;
    try {
      fs.writeFileSync(require('path').join(UPLOAD_DIR, fname), Buffer.from(m[2], 'base64'));
      return Object.assign({}, p, { img: '/uploads/' + fname });
    } catch (e) { console.error('[upload] failed to save image:', e.message); return p; }
  });
}

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return { products: null, orders: [] }; }
}
function save(d) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function send(res, code, body, type) {
  const data = type === 'json' ? JSON.stringify(body) : body;
  res.writeHead(code, {
    'Content-Type': type === 'json' ? 'application/json' : 'text/plain',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 25 * 1024 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { resolve(null); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];
  if (req.method === 'OPTIONS') return send(res, 204, '', 'text');

  // Health
  if (url === '/api/health') return send(res, 200, { ok: true }, 'json');

  // ---- Auth endpoints ----
  // Sign in: validate credentials, set a signed session cookie
  if (url === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    let auth; try { auth = loadAuth(); } catch (e) { return send(res, 500, { ok: false }, 'json'); }
    const okUser = body && String(body.user || '').trim() === auth.user;
    if (okUser && verifyPass(body.pass, auth)) {
      const token = makeToken(auth);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
      });
      return res.end(JSON.stringify({ ok: true }));
    }
    return send(res, 401, { ok: false, error: 'Invalid username or password' }, 'json');
  }
  // Used by nginx auth_request to gate /studio and the write API
  if (url === '/api/auth/check') {
    return isAuthed(req) ? send(res, 200, { ok: true }, 'json') : send(res, 401, { ok: false }, 'json');
  }
  // Sign out: clear the cookie
  if (url === '/api/auth/logout') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  // ---- Customer Auth endpoints ----
  // Customer register
  if (url === '/api/auth/register' && req.method === 'POST') {
    const body = await readBody(req);
    const { name, email, phone, dial, password } = body || {};
    if (!email || !password) return send(res, 400, { ok: false, error: 'Email and password required' }, 'json');
    const d = load();
    d.customers = Array.isArray(d.customers) ? d.customers : [];
    if (d.customers.some(c => c.email === email)) return send(res, 409, { ok: false, error: 'Email already registered' }, 'json');
    const creds = hashPass(password);
    const customer = {
      id: 'c-' + Date.now(),
      name: name || '',
      email,
      phone: phone || '',
      dial: dial || '+20',
      salt: creds.salt,
      hash: creds.hash,
      created_at: Date.now(),
      wishlist: [],
      cart: []
    };
    d.customers.push(customer);
    const token = makeCustomerToken();
    d.customer_sessions = d.customer_sessions || {};
    d.customer_sessions[token] = { customer_id: customer.id, created: Date.now() };
    save(d);
    res.writeHead(201, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': `${CUSTOMER_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CUSTOMER_TTL_MS / 1000}`,
    });
    return res.end(JSON.stringify({ ok: true, customer: { id: customer.id, name: customer.name, email: customer.email } }));
  }
  // Customer login
  if (url === '/api/auth/customer-login' && req.method === 'POST') {
    const body = await readBody(req);
    const { email, password } = body || {};
    if (!email || !password) return send(res, 400, { ok: false, error: 'Email and password required' }, 'json');
    const d = load();
    const customer = (d.customers || []).find(c => c.email === email);
    if (!customer || !verifyCustomerPass(password, customer)) return send(res, 401, { ok: false, error: 'Invalid email or password' }, 'json');
    const token = makeCustomerToken();
    // Store session mapping
    d.customer_sessions = d.customer_sessions || {};
    d.customer_sessions[token] = { customer_id: customer.id, created: Date.now() };
    save(d);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': `${CUSTOMER_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CUSTOMER_TTL_MS / 1000}`,
    });
    return res.end(JSON.stringify({ ok: true, customer: { id: customer.id, name: customer.name, email: customer.email } }));
  }
  // Customer logout
  if (url === '/api/auth/customer-logout') {
    const token = getCookie(req, CUSTOMER_COOKIE);
    if (token) {
      const d = load();
      if (d.customer_sessions) delete d.customer_sessions[token];
      save(d);
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `${CUSTOMER_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    });
    return res.end(JSON.stringify({ ok: true }));
  }
  // Customer check (for protected routes)
  if (url === '/api/auth/customer-check') {
    const customerId = getCustomerId(req);
    return customerId ? send(res, 200, { ok: true, customer_id: customerId }, 'json') : send(res, 401, { ok: false }, 'json');
  }
  // Customer profile
  if (url === '/api/auth/customer-profile' && req.method === 'GET') {
    const customerId = getCustomerId(req);
    if (!customerId) return send(res, 401, { ok: false, error: 'Not authenticated' }, 'json');
    const d = load();
    const customer = (d.customers || []).find(c => c.id === customerId);
    if (!customer) return send(res, 404, { ok: false, error: 'Customer not found' }, 'json');
    const { salt, hash, ...safe } = customer;
    return send(res, 200, { ok: true, customer: safe }, 'json');
  }

  // Full state (used by the dashboard bridge to seed localStorage on load)
  if (url === '/api/state' && req.method === 'GET') {
    const d = load();
    return send(res, 200, { products: d.products, orders: d.orders || [] }, 'json');
  }

  // Dashboard pushes a localStorage key here on every write
  if (url === '/api/state' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || typeof body.key !== 'string') return send(res, 400, { error: 'bad body' }, 'json');
    const d = load();
    let regenNeeded = false;
    if (body.key === PKEY) { d.products = persistProductImages(body.value); regenNeeded = true; }
    else if (body.key === OKEY) d.orders = body.value;
    else return send(res, 200, { ok: true, ignored: body.key }, 'json'); // ignore unknown keys
    save(d);
    if (regenNeeded) safeRegen(d.products); // rebuild public website on catalog changes
    return send(res, 200, { ok: true }, 'json');
  }

  // Public website reads the catalog here.
  // Supports ?active=true, ?q=, ?type=, ?min=, ?max=, ?sort= (price-asc|price-desc|name|rating|newest)
  if (url === '/api/products' && req.method === 'GET') {
    const d = load();
    let products = Array.isArray(d.products) ? d.products.slice() : [];
    const qs = new URL(req.url, 'http://localhost').searchParams;
    const q = (qs.get('q') || '').trim().toLowerCase();
    const type = (qs.get('type') || '').trim().toLowerCase();
    const minRaw = qs.get('min');
    const maxRaw = qs.get('max');
    const min = minRaw !== null && minRaw !== '' ? Number(minRaw) : NaN;
    const max = maxRaw !== null && maxRaw !== '' ? Number(maxRaw) : NaN;
    if (qs.get('active') === 'true') products = products.filter(p => p && p.active !== false);
    if (q) products = products.filter(p => String(p.name || '').toLowerCase().includes(q) || String(p.type || '').toLowerCase().includes(q));
    if (type) products = products.filter(p => String(p.type || '').toLowerCase() === type);
    if (!Number.isNaN(min)) products = products.filter(p => Number(p.price) >= min);
    if (!Number.isNaN(max)) products = products.filter(p => Number(p.price) <= max);
    const enrich = (p) => {
      const revs = (d.reviews || []).filter(r => r.product_id === p.id);
      return Object.assign({}, p, {
        rating: revs.length ? Math.round((revs.reduce((s, r) => s + r.rating, 0) / revs.length) * 10) / 10 : null,
        review_count: revs.length,
      });
    };
    products = products.map(enrich);
    const sort = qs.get('sort') || '';
    if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
    else if (sort === 'name') products.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    else if (sort === 'rating') products.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.review_count || 0) - (a.review_count || 0));
    else if (sort === 'newest') products.sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
    return send(res, 200, products, 'json');
  }

  // Studio / storefront product create (used by the Products tab and Design Center)
  if (url === '/api/products' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !String(body.name || '').trim()) return send(res, 400, { ok: false, error: 'name required' }, 'json');
    const d = load();
    d.products = Array.isArray(d.products) ? d.products : [];
    const base = String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'product';
    const id = 'p-' + base + (d.products.some(p => p.id === 'p-' + base) ? '-' + Date.now().toString(36) : '');
    const product = {
      id,
      name: String(body.name).trim(),
      type: String(body.type || 'trucker cap').trim(),
      img: String(body.img || ''),
      tone: String(body.tone || '#efeeec'),
      price: Number(body.price) || 0,
      active: body.active === undefined ? true : !!body.active,
      added_at: Date.now(),
    };
    d.products.push(product);
    d.products = persistProductImages(d.products);
    save(d);
    safeRegen(d.products);
    return send(res, 200, { ok: true, product: d.products[d.products.length - 1] }, 'json');
  }

  // Website checkout can append a real order here.
  // Accepts either the legacy single-product shape OR cart-based:
  //   { items: [{ product_id, qty }], name, dial, phone, city, address, notes }
  // Logged-in customers get their order linked (customer_id) and cart cleared.
  if (url === '/api/orders' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body) return send(res, 400, { error: 'bad body' }, 'json');
    const d = load();
    d.orders = Array.isArray(d.orders) ? d.orders : [];
    const customerId = getCustomerId(req);
    const now = Date.now();
    let order;
    if (Array.isArray(body.items) && body.items.length) {
      const lines = body.items.map((it) => {
        const p = (d.products || []).find(x => x && x.id === it.product_id);
        const unit = p ? Number(p.price) || 0 : Number(it.price) || 0;
        const qty = Math.max(1, Math.floor(Number(it.qty)) || 1);
        return {
          product_id: it.product_id,
          name: (p && p.name) || it.name || 'Item',
          type: (p && p.type) || it.type || '',
          unit,
          qty,
          total: unit * qty,
        };
      });
      const total = lines.reduce((s, l) => s + l.total, 0);
      order = {
        id: 'o-' + now,
        ts: now,
        status: 'new',
        items: lines,
        product: lines.length > 1 ? lines[0].name + ' +' + (lines.length - 1) : lines[0].name,
        type: lines[0].type,
        unit: lines[0].unit,
        qty: lines.reduce((s, l) => s + l.qty, 0),
        total,
        name: String(body.name || '').trim(),
        dial: String(body.dial || '+20').trim(),
        phone: String(body.phone || '').trim(),
        city: String(body.city || '').trim(),
        address: String(body.address || '').trim(),
        notes: String(body.notes || '').trim(),
      };
      if (customerId) {
        order.customer_id = customerId;
        const cIdx = (d.customers || []).findIndex(c => c.id === customerId);
        if (cIdx >= 0) d.customers[cIdx].cart = [];
      }
    } else {
      order = Object.assign({ id: 'o-' + now, ts: now }, body);
      if (customerId) order.customer_id = customerId;
    }
    d.orders.unshift(order);
    save(d);
    return send(res, 200, { ok: true, order }, 'json');
  }
  if (url === '/api/orders' && req.method === 'GET') {
    const d = load();
    return send(res, 200, d.orders || [], 'json');
  }

  // ---- Customer Cart endpoints ----
  if (url === '/api/cart' && req.method === 'GET') {
    const customerId = getCustomerId(req);
    if (!customerId) return send(res, 401, { ok: false, error: 'Not authenticated' }, 'json');
    const d = load();
    const customer = (d.customers || []).find(c => c.id === customerId);
    if (!customer) return send(res, 404, { ok: false, error: 'Customer not found' }, 'json');
    return send(res, 200, { ok: true, cart: customer.cart || [] }, 'json');
  }
  if (url === '/api/cart' && req.method === 'POST') {
    const customerId = getCustomerId(req);
    if (!customerId) return send(res, 401, { ok: false, error: 'Not authenticated' }, 'json');
    const body = await readBody(req);
    const { product_id, qty } = body || {};
    if (!product_id) return send(res, 400, { ok: false, error: 'product_id required' }, 'json');
    const d = load();
    const customerIdx = d.customers.findIndex(c => c.id === customerId);
    if (customerIdx === -1) return send(res, 404, { ok: false, error: 'Customer not found' }, 'json');
    const cart = d.customers[customerIdx].cart || [];
    const existing = cart.find(item => item.product_id === product_id);
    if (existing) {
      existing.qty = qty || existing.qty + 1;
    } else {
      cart.push({ product_id, qty: qty || 1, added_at: Date.now() });
    }
    d.customers[customerIdx].cart = cart;
    save(d);
    return send(res, 200, { ok: true, cart }, 'json');
  }
  if (url === '/api/cart' && req.method === 'DELETE') {
    const customerId = getCustomerId(req);
    if (!customerId) return send(res, 401, { ok: false, error: 'Not authenticated' }, 'json');
    const body = await readBody(req);
    const { product_id } = body || {};
    if (!product_id) return send(res, 400, { ok: false, error: 'product_id required' }, 'json');
    const d = load();
    const customerIdx = d.customers.findIndex(c => c.id === customerId);
    if (customerIdx === -1) return send(res, 404, { ok: false, error: 'Customer not found' }, 'json');
    d.customers[customerIdx].cart = (d.customers[customerIdx].cart || []).filter(item => item.product_id !== product_id);
    save(d);
    return send(res, 200, { ok: true, cart: d.customers[customerIdx].cart }, 'json');
  }

  // ---- Customer Wishlist endpoints ----
  if (url === '/api/wishlist' && req.method === 'GET') {
    const customerId = getCustomerId(req);
    if (!customerId) return send(res, 401, { ok: false, error: 'Not authenticated' }, 'json');
    const d = load();
    const customer = (d.customers || []).find(c => c.id === customerId);
    if (!customer) return send(res, 404, { ok: false, error: 'Customer not found' }, 'json');
    return send(res, 200, { ok: true, wishlist: customer.wishlist || [] }, 'json');
  }
  if (url === '/api/wishlist' && req.method === 'POST') {
    const customerId = getCustomerId(req);
    if (!customerId) return send(res, 401, { ok: false, error: 'Not authenticated' }, 'json');
    const body = await readBody(req);
    const { product_id } = body || {};
    if (!product_id) return send(res, 400, { ok: false, error: 'product_id required' }, 'json');
    const d = load();
    const customerIdx = d.customers.findIndex(c => c.id === customerId);
    if (customerIdx === -1) return send(res, 404, { ok: false, error: 'Customer not found' }, 'json');
    const wishlist = d.customers[customerIdx].wishlist || [];
    if (!wishlist.includes(product_id)) wishlist.push(product_id);
    d.customers[customerIdx].wishlist = wishlist;
    save(d);
    return send(res, 200, { ok: true, wishlist }, 'json');
  }
  if (url === '/api/wishlist' && req.method === 'DELETE') {
    const customerId = getCustomerId(req);
    if (!customerId) return send(res, 401, { ok: false, error: 'Not authenticated' }, 'json');
    const body = await readBody(req);
    const { product_id } = body || {};
    if (!product_id) return send(res, 400, { ok: false, error: 'product_id required' }, 'json');
    const d = load();
    const customerIdx = d.customers.findIndex(c => c.id === customerId);
    if (customerIdx === -1) return send(res, 404, { ok: false, error: 'Customer not found' }, 'json');
    d.customers[customerIdx].wishlist = (d.customers[customerIdx].wishlist || []).filter(id => id !== product_id);
    save(d);
    return send(res, 200, { ok: true, wishlist: d.customers[customerIdx].wishlist }, 'json');
  }

  // ---- Customer Orders (my orders) ----
  if (url === '/api/my-orders' && req.method === 'GET') {
    const customerId = getCustomerId(req);
    if (!customerId) return send(res, 401, { ok: false, error: 'Not authenticated' }, 'json');
    const d = load();
    const orders = (d.orders || []).filter(o => o.customer_id === customerId).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return send(res, 200, { ok: true, orders }, 'json');
  }

  // ---- Product detail / create / update / delete ----
  const prodMatch = url.match(/^\/api\/products\/([^/]+)$/);
  const reviewMatch = url.match(/^\/api\/products\/([^/]+)\/reviews$/);
  if (prodMatch) {
    const id = decodeURIComponent(prodMatch[1]);
    const d = load();
    const idx = (d.products || []).findIndex(p => p && p.id === id);
    if (req.method === 'GET') {
      if (idx === -1) return send(res, 404, { ok: false, error: 'Product not found' }, 'json');
      const revs = (d.reviews || []).filter(r => r.product_id === id);
      const rating = revs.length ? Math.round((revs.reduce((s, r) => s + r.rating, 0) / revs.length) * 10) / 10 : null;
      return send(res, 200, { ok: true, product: Object.assign({}, d.products[idx], { rating, review_count: revs.length }) }, 'json');
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      if (!body) return send(res, 400, { ok: false, error: 'bad body' }, 'json');
      if (idx === -1) return send(res, 404, { ok: false, error: 'Product not found' }, 'json');
      d.products[idx] = persistProductImages([Object.assign({}, d.products[idx], body)])[0];
      save(d);
      safeRegen(d.products);
      return send(res, 200, { ok: true, product: d.products[idx] }, 'json');
    }
    if (req.method === 'DELETE') {
      if (idx === -1) return send(res, 404, { ok: false, error: 'Product not found' }, 'json');
      d.products.splice(idx, 1);
      save(d);
      safeRegen(d.products);
      return send(res, 200, { ok: true }, 'json');
    }
  }

  // ---- Ratings & reviews ----
  if (reviewMatch) {
    const id = decodeURIComponent(reviewMatch[1]);
    const d = load();
    const product = (d.products || []).find(p => p && p.id === id);
    if (!product) return send(res, 404, { ok: false, error: 'Product not found' }, 'json');
    if (req.method === 'GET') {
      const revs = (d.reviews || []).filter(r => r.product_id === id).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return send(res, 200, { ok: true, reviews: revs.map(r => ({ id: r.id, product_id: r.product_id, customer_name: r.customer_name, rating: r.rating, text: r.text, ts: r.ts })) }, 'json');
    }
    if (req.method === 'POST') {
      const customerId = getCustomerId(req);
      if (!customerId) return send(res, 401, { ok: false, error: 'Sign in to leave a review' }, 'json');
      const body = await readBody(req);
      const rating = Math.round(Number(body && body.rating));
      if (!rating || rating < 1 || rating > 5) return send(res, 400, { ok: false, error: 'rating must be 1-5' }, 'json');
      const customer = (d.customers || []).find(c => c.id === customerId);
      if (!customer) return send(res, 404, { ok: false, error: 'Customer not found' }, 'json');
      d.reviews = Array.isArray(d.reviews) ? d.reviews : [];
      let review = d.reviews.find(r => r.product_id === id && r.customer_id === customerId);
      if (review) {
        review.rating = rating;
        review.text = String(body.text || '').slice(0, 1000);
        review.ts = Date.now();
      } else {
        review = {
          id: 'r-' + Date.now(),
          product_id: id,
          customer_id: customerId,
          customer_name: customer.name || customer.email,
          rating,
          text: String(body.text || '').slice(0, 1000),
          ts: Date.now(),
        };
        d.reviews.push(review);
      }
      save(d);
      return send(res, 200, { ok: true, review: { id: review.id, product_id: review.product_id, customer_name: review.customer_name, rating: review.rating, text: review.text, ts: review.ts } }, 'json');
    }
  }

  // ---- General feedback / contact form ----
  if (url === '/api/feedback' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !String(body.message || '').trim()) return send(res, 400, { ok: false, error: 'message required' }, 'json');
    const d = load();
    d.feedback = Array.isArray(d.feedback) ? d.feedback : [];
    d.feedback.unshift({
      id: 'f-' + Date.now(),
      ts: Date.now(),
      name: String(body.name || ''),
      email: String(body.email || ''),
      subject: String(body.subject || 'General'),
      message: String(body.message).slice(0, 2000),
    });
    save(d);
    return send(res, 200, { ok: true }, 'json');
  }

  send(res, 404, { error: 'not found' }, 'json');
});

server.listen(PORT, HOST, () => console.log(`Dazz API listening on http://${HOST}:${PORT}`));
