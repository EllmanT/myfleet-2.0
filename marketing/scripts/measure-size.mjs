// Sizes of the production build (run `npm run build` first). Raw and gzip, grouped by file type.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const root = fileURLToPath(new URL('../dist', import.meta.url));
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(root);

const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';
const groups = {};
for (const f of files) {
  const buf = readFileSync(f);
  const ext = extname(f) || '(none)';
  const g = (groups[ext] ||= { n: 0, raw: 0, gz: 0, br: 0 });
  g.n++;
  g.raw += buf.length;
  g.gz += gzipSync(buf).length;
  g.br += brotliCompressSync(buf).length;
}
console.log('type      files        raw       gzip     brotli');
let t = { raw: 0, gz: 0, br: 0 };
for (const [ext, g] of Object.entries(groups)) {
  console.log(ext.padEnd(9), String(g.n).padStart(5), kb(g.raw), kb(g.gz), kb(g.br));
  t.raw += g.raw; t.gz += g.gz; t.br += g.br;
}
console.log('TOTAL'.padEnd(9), String(files.length).padStart(5), kb(t.raw), kb(t.gz), kb(t.br));

// First view = home HTML + the CSS it inlines + preloaded serif + Inter 400 and 500 (the fonts the first screen uses).
const html = readFileSync(join(root, 'index.html'));
const fonts = files.filter((f) => /instrument-serif-latin-400|inter-latin-(400|500)/.test(f) && f.endsWith('.woff2'));
const fv = gzipSync(html).length + fonts.reduce((a, f) => a + statSync(f).size, 0);
console.log(`\nFirst view (index.html gzip + 3 WOFF2 fonts): ${kb(fv)}  (budget 150 KB)`);
console.log(`Client JS files: ${files.filter((f) => f.endsWith('.js')).length}  (budget 30 KB gzip)`);
