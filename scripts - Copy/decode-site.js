// Decode the builder-bundled page source (index.html) into readable HTML.
// The bundle embeds the entire page markup as one giant JSON string; this
// extracts it and writes the unescaped HTML so it can be audited/inventoried.
const fs = require('fs');
const path = require('path');

const SITE_DIR = path.join(__dirname, '..', 'dazzdezign');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'decoded');

function decodeFile(name) {
  const raw = fs.readFileSync(path.join(SITE_DIR, name), 'utf8');
  const marker = '<x-dc>';
  const markerOff = raw.indexOf(marker);
  if (markerOff === -1) {
    console.log(name + ': no ' + marker + ' marker found — not a bundled page (skipping)');
    return null;
  }
  let open = markerOff - 1;
  while (open > 0 && raw[open] !== '"') open--;
  // walk forward, escape-aware, to the closing quote
  let i = open + 1;
  while (i < raw.length) {
    if (raw[i] === '\\') { i += 2; continue; }
    if (raw[i] === '"') break;
    i++;
  }
  const jsonStr = raw.slice(open, i + 1);
  const decoded = JSON.parse(jsonStr);
  const out = path.join(OUT_DIR, name.replace(/\.html$/, '.html'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, decoded, 'utf8');
  console.log(name + ': decoded ' + decoded.length + ' chars -> ' + out);
  return decoded;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Studio dashboard may use the same bundle pattern — try it for all site HTML.
for (const f of fs.readdirSync(SITE_DIR)) {
  if (f.endsWith('.html')) decodeFile(f);
}
for (const f of fs.readdirSync(path.join(SITE_DIR, 'studio'))) {
  if (f.endsWith('.html')) decodeFile(path.join('studio', f));
}
