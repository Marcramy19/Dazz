// Regenerate the public website (index.html) from a template, injecting the
// current catalog into the website's `caps = [...]` array. The website source
// is stored as an escaped double-quoted string, so after building the JS array
// code we escape it for that context. Validates before writing; atomic write.
const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(__dirname, 'website.template.html');
const OUT = '/opt/dazzdezign/index.html';
const MARKER = '__DAZZ_CAPS__';

// Build the JS array code (Level 1 — real JS, single line, no newlines).
function buildCapsCode(products) {
  const list = (Array.isArray(products) ? products : []).filter(p => p && p.active !== false);
  const entries = list.map(p => {
    const name = String(p.name == null ? '' : p.name);
    const type = String(p.type == null ? '' : p.type);
    const img = String(p.img == null ? '' : p.img);
    const tone = String(p.tone == null ? '#141414' : p.tone);
    const priceLabel = (p.priceLabel != null && String(p.priceLabel).trim())
      ? String(p.priceLabel)
      : ('EGP ' + (p.price == null ? '' : p.price));
    return '{ name: ' + JSON.stringify(name)
      + ', type: ' + JSON.stringify(type)
      + ', img: this.r(' + JSON.stringify(img) + ')'
      + ', tone: ' + JSON.stringify(tone)
      + ', priceLabel: ' + JSON.stringify(priceLabel) + ' }';
  });
  return '[' + entries.join(', ') + ']';
}

// Validate the Level-1 JS array code by evaluating it with a stubbed this.r().
function validateCapsCode(code, expectLen) {
  // eslint-disable-next-line no-new-func
  const fn = new Function('r', 'return (' + code.replace(/this\.r/g, 'r') + ');');
  const arr = fn((x) => x);
  if (!Array.isArray(arr)) throw new Error('caps did not eval to an array');
  if (typeof expectLen === 'number' && arr.length !== expectLen) {
    throw new Error('caps length mismatch: got ' + arr.length + ' expected ' + expectLen);
  }
  return arr;
}

// Escape Level-1 code for embedding in the website's double-quoted source string.
function escapeForSource(code) {
  return code.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function regenerate(products) {
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');
  if (!tpl.includes(MARKER)) throw new Error('template missing marker');

  const active = (Array.isArray(products) ? products : []).filter(p => p && p.active !== false);
  const code = buildCapsCode(products);
  validateCapsCode(code, active.length); // throws if invalid

  const sourceText = escapeForSource(code);
  const html = tpl.replace(MARKER, sourceText);

  // Safety checks before touching the live file
  if (!/^<!DOCTYPE html>/i.test(html.trim())) throw new Error('output missing DOCTYPE');
  if (html.includes(MARKER)) throw new Error('marker not replaced');
  if (Math.abs(html.length - tpl.length) > 5 * 1024 * 1024) throw new Error('output size sanity check failed');

  const tmp = OUT + '.regen.tmp';
  fs.writeFileSync(tmp, html);
  fs.renameSync(tmp, OUT);
  return { ok: true, products: active.length, bytes: html.length };
}

module.exports = { regenerate, buildCapsCode, validateCapsCode };

// CLI: `node regen.js`  -> regenerate from current data.json
if (require.main === module) {
  let data = { products: null };
  try { data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')); } catch (e) {}
  const r = regenerate(data.products || []);
  console.log('regenerated:', JSON.stringify(r));
}
