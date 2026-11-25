// Makes assets/fonts/iconsax-site.ttf: the Iconsax icon font cut down to the icons this website uses
// (the full font is 1.3 MB; the cut-down one is a few KB), and points assets/css/iconsax.css at it.
// Run it again after adding a new "isax-..." icon to a page:   node scripts/iconsax-subset.js
// The full font, assets/fonts/iconsax92de.ttf, stays as the source; iconsax.css keeps the full icon list.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const FULL_FONT = 'assets/fonts/iconsax92de.ttf', OUT_FONT = 'assets/fonts/iconsax-site.ttf', CSS = 'assets/css/iconsax.css';
const NOTE = '/* The icon font holds only the icons this website uses. After adding a new isax-... icon, run: node scripts/iconsax-subset.js */\n';
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// CSS string escapes ("\e901", "\31b ", or the character itself) -> code points.
const cssString = (s) => { const out = []; s.replace(/\\([0-9a-fA-F]{1,6}) ?|\\([\s\S])|([\s\S])/gu, (m, hex, esc, ch) => { out.push(hex ? parseInt(hex, 16) : (esc || ch).codePointAt(0)); return ''; }); return out; };

// 1. Icon name -> code points (multi-colour icons have several ".pathN" parts).
const css = read(CSS);
const icons = new Map();
for (const m of css.matchAll(/\.isax-([a-z0-9-]+)(?: \.path\d+)?:before \{content: "((?:[^"\\]|\\.)*)";/g)) {
	if (!icons.has(m[1])) icons.set(m[1], []);
	icons.get(m[1]).push(...cssString(m[2]));
}

// 2. Icons the pages and their scripts use, plus icons drawn straight from site CSS rules.
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))
	.concat(fs.readdirSync(path.join(ROOT, 'assets/js')).filter((f) => f.endsWith('.js')).map((f) => 'assets/js/' + f));
const used = new Set(), unknown = new Set(), wanted = new Set();
for (const f of files) for (const m of read(f).matchAll(/\bisax-([a-z0-9-]*[a-z0-9])/g)) (icons.has(m[1]) ? used : unknown).add(m[1]);
for (const name of used) icons.get(name).forEach((cp) => wanted.add(cp));
for (const f of fs.readdirSync(path.join(ROOT, 'assets/css')).filter((f) => f.endsWith('.css') && f !== 'iconsax.css')) {
	for (const block of read('assets/css/' + f).split('}')) {
		if (!/iconsax|\.isax/.test(block)) continue;
		for (const m of block.matchAll(/content:\s*"((?:[^"\\]|\\.)*)"/g)) cssString(m[1]).forEach((cp) => wanted.add(cp));
	}
}

// 3. Read the full font.
const font = fs.readFileSync(path.join(ROOT, FULL_FONT));
const T = {};
for (let i = 0; i < font.readUInt16BE(4); i++) { const o = 12 + i * 16; T[font.toString('latin1', o, o + 4)] = { off: font.readUInt32BE(o + 8), len: font.readUInt32BE(o + 12) }; }
const table = (tag) => Buffer.from(font.subarray(T[tag].off, T[tag].off + T[tag].len));
const cmap = new Map();
{
	const c = T.cmap.off; let sub = -1;
	for (let i = 0; i < font.readUInt16BE(c + 2); i++) if (font.readUInt16BE(c + 4 + i * 8) === 3 && font.readUInt16BE(c + 6 + i * 8) === 1) sub = c + font.readUInt32BE(c + 8 + i * 8);
	if (sub < 0 || font.readUInt16BE(sub) !== 4) throw new Error('Expected a Windows Unicode (format 4) cmap');
	const n = font.readUInt16BE(sub + 6) / 2, ends = sub + 14, starts = ends + n * 2 + 2, deltas = starts + n * 2, ranges = deltas + n * 2;
	for (let s = 0; s < n; s++) {
		const end = font.readUInt16BE(ends + s * 2), start = font.readUInt16BE(starts + s * 2), delta = font.readUInt16BE(deltas + s * 2), ro = font.readUInt16BE(ranges + s * 2);
		for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
			let g = ro ? font.readUInt16BE(ranges + s * 2 + ro + (cp - start) * 2) : cp;
			if (ro && !g) continue;
			g = (g + delta) & 0xffff;
			if (g) cmap.set(cp, g);
		}
	}
}
const codepoints = [...wanted].filter((cp) => cmap.has(cp)).sort((a, b) => a - b);
const oldIds = [0, ...new Set(codepoints.map((cp) => cmap.get(cp)))]; // glyph 0 (.notdef) stays first
const newId = new Map(oldIds.map((g, i) => [g, i]));

// 4. Glyph outlines and metrics for the kept glyphs.
const head = table('head'), longLoca = head.readInt16BE(50) === 1;
const locaAt = (g) => longLoca ? font.readUInt32BE(T.loca.off + g * 4) : font.readUInt16BE(T.loca.off + g * 2) * 2;
const numHM = font.readUInt16BE(T.hhea.off + 34);
const glyfParts = [], loca = Buffer.alloc((oldIds.length + 1) * 4), hmtx = Buffer.alloc(oldIds.length * 4);
let pos = 0;
oldIds.forEach((g, i) => {
	const data = font.subarray(T.glyf.off + locaAt(g), T.glyf.off + locaAt(g + 1));
	if (data.length && data.readInt16BE(0) < 0) throw new Error('Composite glyph ' + g + ' is not supported');
	const pad = (4 - data.length % 4) % 4;
	glyfParts.push(data, Buffer.alloc(pad));
	loca.writeUInt32BE(pos, i * 4); pos += data.length + pad;
	const m = Math.min(g, numHM - 1);
	hmtx.writeUInt16BE(font.readUInt16BE(T.hmtx.off + m * 4), i * 4);
	hmtx.writeInt16BE(g < numHM ? font.readInt16BE(T.hmtx.off + g * 4 + 2) : font.readInt16BE(T.hmtx.off + numHM * 4 + (g - numHM) * 2), i * 4 + 2);
});
loca.writeUInt32BE(pos, oldIds.length * 4);

// 5. The other tables.
head.writeUInt32BE(0, 8); head.writeInt16BE(1, 50); // checksum is set at the end; long loca offsets
const hhea = table('hhea'); hhea.writeUInt16BE(oldIds.length, 34);
const maxp = table('maxp'); maxp.writeUInt16BE(oldIds.length, 4);
const os2 = table('OS/2'); os2.writeUInt16BE(codepoints[0], 64); os2.writeUInt16BE(codepoints[codepoints.length - 1], 66);
const post = Buffer.from(table('post').subarray(0, 32)); post.writeUInt32BE(0x00030000, 0); // no glyph names
const segs = [];
for (const cp of codepoints) {
	const g = newId.get(cmap.get(cp)), last = segs[segs.length - 1];
	if (last && cp === last.end + 1 && g === last.g + (cp - last.start)) last.end = cp; else segs.push({ start: cp, end: cp, g });
}
segs.push({ start: 0xffff, end: 0xffff, g: 0 });
const n = segs.length, es = Math.floor(Math.log2(n)), sub = Buffer.alloc(16 + n * 8);
sub.writeUInt16BE(4, 0); sub.writeUInt16BE(sub.length, 2); sub.writeUInt16BE(n * 2, 6);
sub.writeUInt16BE(2 << es, 8); sub.writeUInt16BE(es, 10); sub.writeUInt16BE(n * 2 - (2 << es), 12);
segs.forEach((s, i) => {
	sub.writeUInt16BE(s.end, 14 + i * 2);
	sub.writeUInt16BE(s.start, 16 + n * 2 + i * 2);
	sub.writeUInt16BE(s.start === 0xffff ? 1 : (s.g - s.start + 0x10000) & 0xffff, 16 + n * 4 + i * 2);
});
const cmapOut = Buffer.concat([Buffer.from([0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 20, 0, 3, 0, 1, 0, 0, 0, 20]), sub]);
const out = { 'OS/2': os2, cmap: cmapOut, glyf: Buffer.concat(glyfParts), head, hhea, hmtx, loca, maxp, name: table('name'), post };
if (T.gasp) out.gasp = table('gasp');
// GDEF here only says "every glyph is a plain glyph" (keeps the icon at U+0610 from being treated as an accent mark).
if (T.GDEF) {
	const g = table('GDEF'), cd = g.readUInt16BE(4);
	const allBase = cd && g.readUInt16BE(cd) === 2 && g.readUInt16BE(cd + 2) === 1 && g.readUInt16BE(cd + 4) === 1
		&& g.readUInt16BE(cd + 6) === font.readUInt16BE(T.maxp.off + 4) - 1 && g.readUInt16BE(cd + 8) === 1;
	if (allBase) { g.writeUInt16BE(oldIds.length - 1, cd + 6); out.GDEF = g; }
}

// 6. Write the font file.
const sum = (b) => { let s = 0; for (let i = 0; i < b.length; i += 4) s = (s + (b[i] << 24 | (b[i + 1] || 0) << 16 | (b[i + 2] || 0) << 8 | (b[i + 3] || 0))) >>> 0; return s; };
const tags = Object.keys(out).sort(), es2 = Math.floor(Math.log2(tags.length));
const dir = Buffer.alloc(12 + tags.length * 16);
dir.writeUInt32BE(0x00010000, 0); dir.writeUInt16BE(tags.length, 4); dir.writeUInt16BE(16 << es2, 6); dir.writeUInt16BE(es2, 8); dir.writeUInt16BE(tags.length * 16 - (16 << es2), 10);
const body = []; let offset = dir.length, headAt = 0;
tags.forEach((tag, i) => {
	const t = out[tag], r = 12 + i * 16;
	dir.write(tag, r, 4, 'latin1'); dir.writeUInt32BE(sum(t), r + 4); dir.writeUInt32BE(offset, r + 8); dir.writeUInt32BE(t.length, r + 12);
	if (tag === 'head') headAt = offset;
	body.push(t, Buffer.alloc((4 - t.length % 4) % 4)); offset += t.length + (4 - t.length % 4) % 4;
});
const result = Buffer.concat([dir, ...body]);
result.writeUInt32BE((0xB1B0AFBA - sum(result)) >>> 0, headAt + 8);
fs.writeFileSync(path.join(ROOT, OUT_FONT), result);

// 7. Point iconsax.css at it (a new ?v= whenever the icons change).
const v = crypto.createHash('sha1').update(result).digest('hex').slice(0, 10);
let newCss = css.replace(/src: url\('\.\.\/fonts\/[^']+'\) format\('truetype'\);/, `src: url('../fonts/iconsax-site.ttf?v=${v}') format('truetype');`);
if (!newCss.startsWith(NOTE)) newCss = NOTE + newCss;
if (!newCss.includes('iconsax-site.ttf?v=' + v)) throw new Error('Could not find the @font-face src in ' + CSS);
fs.writeFileSync(path.join(ROOT, CSS), newCss);

console.log(`${used.size} icons used (${codepoints.length} glyphs): ${[...used].sort().join(', ')}`);
if (unknown.size) console.log('Not in iconsax.css (shown as nothing): ' + [...unknown].join(', '));
const missing = [...wanted].filter((cp) => !cmap.has(cp));
if (missing.length) console.log('Code points the font does not have: ' + missing.map((c) => 'U+' + c.toString(16)).join(', '));
console.log(`${OUT_FONT}: ${(result.length / 1024).toFixed(1)} KB (full font ${(font.length / 1024).toFixed(0)} KB), css ?v=${v}`);
