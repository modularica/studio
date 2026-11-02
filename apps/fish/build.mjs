// Builds www/ for the iOS app from the web game in lab/fish/.
// The game stays the single source: fix things there, then run `npm run sync`.
// The app version is the solo game without the Lab account system: no login gate,
// no leaderboard, no rooms (the game hides those itself when window.Hesap is missing).
// Fonts are bundled so the app works with no internet.
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const src = join(here, '../../lab/fish/index.html');
const out = join(here, 'www');

let html = readFileSync(src, 'utf8');

// Every edit must match exactly once, so a change in lab/fish/index.html can't silently break the app.
function edit(pattern, replacement, what) {
  const hits = html.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'));
  if (!hits || hits.length !== 1) {
    throw new Error(`build: expected exactly one match for ${what}, found ${hits ? hits.length : 0}`);
  }
  html = html.replace(pattern, replacement);
}

edit(/[ \t]*<script src="\/hesap\/supabase\.js"><\/script>\n/, '', 'supabase.js script');
edit(/[ \t]*<script src="\/hesap\/hesap\.js"[^>]*><\/script>\n/, '', 'hesap.js script');
edit(/[ \t]*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n/, '', 'fonts.googleapis preconnect');
edit(/[ \t]*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n/, '', 'fonts.gstatic preconnect');
edit(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2[^"]*">/, '<link rel="stylesheet" href="fonts/fonts.css">', 'Google Fonts stylesheet');
html = html.replace(/[ \t]*<meta name="robots"[^>]*>\n/, '');
// "Nasıldı?" buttons talk to the Lab account system, which the app doesn't have.
edit(/<\/head>/, '<style>[data-nasildi]{display:none!important}</style>\n</head>', '</head>');

if (/https?:\/\/(?!www\.w3\.org)/.test(html.replace(/<meta property="og:[^>]*>/g, '').replace(/wss:\/\/[^'"]+/g, ''))) {
  console.warn('build: warning, the game still references an outside address; check that it works offline.');
}

// Fonts: the weights the game asks Google for, latin + latin-ext only, woff2 only.
const FONTS = [
  ['@fontsource/bagel-fat-one', ['400']],
  ['@fontsource/figtree', ['500', '600', '700', '800']],
];
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts/files'), { recursive: true });
let css = '';
for (const [pkg, weights] of FONTS) {
  const pkgDir = dirname(require.resolve(`${pkg}/package.json`));
  for (const w of weights) {
    const blocks = readFileSync(join(pkgDir, `${w}.css`), 'utf8').match(/\/\*[^*]*\*\/\s*@font-face\s*{[^}]*}/g) || [];
    for (const block of blocks) {
      if (!/\/\* [\w-]+-(latin|latin-ext)-/.test(block)) continue;
      const file = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)[1];
      copyFileSync(join(pkgDir, 'files', file), join(out, 'fonts/files', file));
      css += block.replace(/,\s*url\([^)]+\.woff\)\s*format\('woff'\)/, '') + '\n';
    }
  }
}
if (!css) throw new Error('build: no fonts were copied');
writeFileSync(join(out, 'fonts/fonts.css'), css);
writeFileSync(join(out, 'index.html'), html);
console.log('build: www/ ready (' + Math.round(html.length / 1024) + ' KB game, fonts bundled)');
