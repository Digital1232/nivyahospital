// Read-only local dependency check for every public page and stylesheet.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const queue = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const seen = new Set();
const missing = new Set();
const hashes = {};
while (queue.length) {
  const file = queue.shift();
  if (seen.has(file)) continue;
  seen.add(file);
  const bytes = fs.readFileSync(path.join(root,file));
  hashes[file] = crypto.createHash('sha256').update(bytes).digest('hex');
  if (!/\.(html|css|js|json|svg)$/i.test(file)) continue;
  const text = bytes.toString('utf8').replace(/<!--[\s\S]*?-->/g, '');
  const refs = [];
  if (/\.html$/i.test(file)) {
    for (const m of text.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)) refs.push(m[1]);
  }
  if (/\.(css|html)$/i.test(file)) {
    for (const m of text.matchAll(/\burl\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) refs.push(m[1]);
  }
  // Include explicit asset strings in inline JS, JSON catalogs and query parameters.
  for (const m of text.matchAll(/(?:assets\/)[\w./% -]+\.(?:png|jpe?g|svg|webp|gif|ico|mp4|json|js|css|woff2?|ttf|eot)\b/gi)) refs.push('/'+m[0]);
  for (let ref of refs) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
    ref = ref.split(/[?#]/)[0];
    if (!ref) continue;
    try { ref = decodeURIComponent(ref); } catch { continue; }
    const target = path.posix.normalize(ref.startsWith('/') ? ref.slice(1) : path.posix.join(path.posix.dirname(file), ref));
    if (target.startsWith('..')) continue;
    const abs = path.join(root,target);
    if (!fs.existsSync(abs)) missing.add(`${file} -> ${target}`);
    else if (fs.statSync(abs).isFile()) queue.push(target);
  }
}
console.log(JSON.stringify({pages:fs.readdirSync(root).filter(f=>f.endsWith('.html')).length, checked:seen.size, missing:[...missing].sort(), hashes},null,2));
