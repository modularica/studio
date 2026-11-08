// Drawing Board: kaynakları tek HTML dosyasına derler.
//   node lab/drawing-board/src/build.js --lab           -> lab/drawing-board/index.html (site: hesap satırları + paylaşım etiketleri)
//   node lab/drawing-board/src/build.js <çıktı>         -> hesapsız tek başına kopya (Planck jsDelivr'dan, fontlar Google Fonts'tan)
//   node lab/drawing-board/src/build.js --local <çıktı> -> her şey dosyanın içinde, internetsiz (önce: npm install)
const fs = require('fs');
const path = require('path');

const root = __dirname;
const args = process.argv.slice(2);
const lab = args.includes('--lab');
const local = args.includes('--local');
const outArg = args.find(a => !a.startsWith('--'));
const out = outArg ? path.resolve(outArg) : lab ? path.join(root, '..', 'index.html') : null;
if (!out) { console.error('Çıktı yolu ver ya da --lab kullan.'); process.exit(1); }

const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const PLANCK = '1.5.1';

const DESC = 'Build the machine that gets the ball into the cup: ramps, springs, belts, pistons, fans, gates and magnets. While it runs, the orange devices are in your hands; add sensors and it runs by itself.';
const LAB_HEAD = `<meta name="description" content="${DESC}">
<meta property="og:type" content="website">
<meta property="og:title" content="Drawing Board">
<meta property="og:description" content="${DESC}">
<meta property="og:image" content="https://uzigames.com/lab/drawing-board/cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<script src="/hesap/supabase.js"></script>
<script src="/hesap/hesap.js" data-oyun="drawing-board" data-kayit="drawing-board.v1 drawing-board.workshop"></script>`;

function inlineFonts() {
  const faces = [];
  const pick = (pkg, weight) => {
    const dir = path.join(root, 'node_modules', '@fontsource', pkg);
    const cssText = fs.readFileSync(path.join(dir, `${weight}.css`), 'utf8');
    for (const block of cssText.split('@font-face').slice(1)) {
      if (!/latin(-ext)?-\d+-normal\.woff2/.test(block) || /vietnamese|cyrillic|greek/.test(block)) continue;
      const m = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/);
      const data = fs.readFileSync(path.join(dir, 'files', m[1])).toString('base64');
      faces.push('@font-face' + block.replace(/src:[^;]+;/, `src: url(data:font/woff2;base64,${data}) format('woff2');`).trim());
    }
  };
  pick('big-shoulders-stencil', 800);
  for (const w of [500, 600, 700]) pick('barlow-semi-condensed', w);
  return `<style>\n${faces.join('\n')}\n</style>`;
}

const fonts = local
  ? inlineFonts()
  : '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=Big+Shoulders+Stencil:wght@800&display=swap">';
const libs = local
  ? `<script>\n${fs.readFileSync(path.join(root, 'node_modules', 'planck', 'dist', 'planck.min.js'), 'utf8')}\n</script>`
  : `<script src="https://cdn.jsdelivr.net/npm/planck@${PLANCK}/dist/planck.min.js"></script>`;

let html = read('index.html');
const parts = {
  '<!--LAB_HEAD-->': lab ? LAB_HEAD : '',
  '<!--FONTS-->': fonts,
  '/*STYLE*/': read('style.css'),
  '<!--LIBS-->': libs,
  '/*SIM*/': read('sim.js'),
  '/*LEVELS*/': read('levels.js'),
  '/*AUDIO*/': read('audio.js'),
  '/*GAME*/': read('game.js'),
};
for (const [k, v] of Object.entries(parts)) {
  if (html.split(k).length !== 2) throw new Error('yer tutucu bir kez olmalı: ' + k);
  html = html.split(k).join(v);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + ' KB', lab ? 'lab' : local ? 'yerel' : 'tek başına');
