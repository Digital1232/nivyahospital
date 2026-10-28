// Read-only inventory. Run from the repository root: node scripts/audit-assets.js
// Conservative: references in any source (including CSS and maintenance scripts)
// retain a file. Dynamic references are listed for manual review.
const fs = require('node:fs');
const path = require('node:path');
function walk(dir = '.') {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
    if (e.name.startsWith('.') || e.name === 'node_modules') return [];
    const f = path.posix.join(dir, e.name);
    return e.isDirectory() ? walk(f) : [f];
  });
}
const files = walk();
const sources = files.filter(f => /\.(html|css|js|json|svg|md|txt|sql)$/i.test(f) && f !== 'scripts/audit-assets.js');
const texts = sources.map(f => ({file:f, text:fs.readFileSync(f,'utf8')
  .replace(/data:[^\s"'<>)]*/g, '')
  .replace(/(?:%[0-9a-f]{2})+/gi, value => { try { return decodeURIComponent(value); } catch { return value; } })
  .replace(/&amp;/g, '&')}));
const candidates = files.filter(f => /^(assets|admin)\//.test(f));
const unused = candidates.filter(f => {
  const name = path.posix.basename(f);
  return !texts.some(s => s.file !== f && s.text.includes(name));
});
const result = {
  totalAssets: candidates.length,
  unusedCount: unused.length,
  unusedBytes: unused.reduce((n,f)=>n+fs.statSync(f).size,0),
  unused: unused.map(f=>({file:f, bytes:fs.statSync(f).size})),
  dynamicReferences: texts.filter(s=>!s.file.includes('/plugins/') && !s.file.endsWith('.min.js')).flatMap(s=>s.text.split(/\r?\n/).flatMap((line,i)=> /assets\/|admin\//.test(line) && /\+|\$\{/.test(line) ? [{file:s.file,line:i+1,text:line.trim().slice(0,300)}] : []))
};
console.log(JSON.stringify(result,null,2));
