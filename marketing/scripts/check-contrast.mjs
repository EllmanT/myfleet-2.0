// WCAG contrast check for the colour tokens in src/styles/global.css.
// Reads the :root block (light) and the prefers-color-scheme: dark block, then tests the pairs the page uses.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const vars = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const lightBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const darkBlock = css.match(/prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}/)[1];
const light = vars(lightBlock);
const dark = { ...light, ...vars(darkBlock) };

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum, label]. 4.5 for text, 3 for UI boundaries.
const pairs = [
  ['text', 'bg', 4.5, 'body on page'],
  ['text', 'surface', 4.5, 'body on surface'],
  ['text-2', 'bg', 4.5, 'secondary on page'],
  ['text-2', 'sunken', 4.5, 'secondary on sunken'],
  ['text-3', 'bg', 4.5, 'tertiary on page'],
  ['text-3', 'sunken', 4.5, 'tertiary on sunken'],
  ['text-3', 'surface', 4.5, 'tertiary on surface'],
  ['accent', 'bg', 4.5, 'accent text on page'],
  ['accent', 'surface', 4.5, 'accent text on surface'],
  ['accent', 'accent-subtle', 4.5, 'accent on accent-subtle (free-period pill)'],
  ['on-accent', 'accent-fill', 4.5, 'button text'],
  ['on-accent', 'accent-hover', 4.5, 'button text hover'],
  ['warning', 'warning-bg', 4.5, 'yellow flag / draft banner'],
  ['warning', 'bg', 4.5, 'warning border text on page'],
  ['flag', 'flag-bg', 4.5, 'orange flag'],
  ['paper-ink', 'paper', 4.5, 'logbook text'],
  ['band-text', 'band-bg', 4.5, 'final CTA band text'],
  ['band-btn-text', 'band-btn-bg', 4.5, 'final CTA band button'],
  ['border-strong', 'bg', 3, 'input / ghost-button border'],
  ['accent', 'bg', 3, 'focus ring'],
];

let fail = 0;
for (const [name, set] of [['LIGHT', light], ['DARK', dark]]) {
  console.log(`\n${name}`);
  for (const [fg, bg, min, label] of pairs) {
    if (!set[fg] || !set[bg]) { console.log(`  ?? missing token ${fg} or ${bg}`); fail++; continue; }
    const r = ratio(set[fg], set[bg]);
    const ok = r >= min;
    if (!ok) fail++;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)} (min ${min})  ${label}  [${fg} ${set[fg]} on ${bg} ${set[bg]}]`);
  }
}
console.log(fail ? `\n${fail} FAILED` : '\nAll pairs pass.');
process.exit(fail ? 1 : 0);
