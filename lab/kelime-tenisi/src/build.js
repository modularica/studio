// Kelime Düellosu (lab/kelime-tenisi): kaynakları tek HTML dosyasına derler (yazı tipi Nunito dosyaya gömülü, dış bağlantı yok).
// Fredoka değil: Fredoka'da ğ, ş, İ yok.
//   node lab/kelime-tenisi/src/build.js --lab      -> lab/kelime-tenisi/index.html (site: hesap satırları + paylaşım etiketleri)
//   node lab/kelime-tenisi/src/build.js <çıktı>    -> hesapsız tek başına kopya
const fs = require('fs');
const path = require('path');

const root = __dirname;
const args = process.argv.slice(2);
const lab = args.includes('--lab');
const outArg = args.find(a => !a.startsWith('--'));
const out = outArg ? path.resolve(outArg) : lab ? path.join(root, '..', 'index.html') : null;
if (!out) { console.error('Çıktı yolu ver ya da --lab kullan.'); process.exit(1); }

const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const faces = [];
for (const w of [500, 700, 800]) {
  for (const [sub, range] of [['latin-ext', LATIN_EXT], ['latin', LATIN]]) {
    const b64 = fs.readFileSync(path.join(root, 'fonts', `nunito-${sub}-${w}-normal.woff2`)).toString('base64');
    faces.push(`@font-face{font-family:'Nunito';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}`);
  }
}

const DESC = 'Gelen kelimenin tek harfini değiştir, geri gönder. Süresinde cevap veremeyen sayıyı kaybeder. İki kişi tek ekranda karşılıklı ya da bota karşı; Türkçe (ekli kelimeler de geçer) ve İngilizce.';
const LAB_HEAD = `<meta name="description" content="${DESC}">
<meta property="og:type" content="website">
<meta property="og:title" content="Kelime Düellosu">
<meta property="og:description" content="${DESC}">
<meta property="og:image" content="https://uzigames.com/lab/kelime-tenisi/cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="apple-touch-icon" href="/lab/kelime-tenisi/icon.png">
<meta name="robots" content="noindex">
<script src="/hesap/supabase.js"></script>
<script src="/hesap/hesap.js" data-oyun="kelime-tenisi" data-kayit="kelime-tenisi.v1"></script>`;

let html = read('index.html');
const parts = {
  '<!--LAB_HEAD-->': lab ? LAB_HEAD : '',
  '<!--ICON-->': lab ? '<link rel="icon" type="image/png" href="/lab/kelime-tenisi/icon.png">' : '<link rel="icon" href="data:,">',
  '/*FONTS*/': faces.join('\n'),
  '/*STYLE*/': read('style.css'),
  '/*WORDS*/': read('words.js'),
  '/*CORE*/': read('core.js'),
  '/*AUDIO*/': read('audio.js'),
  '/*APP*/': read('app.js'),
};
for (const [k, v] of Object.entries(parts)) {
  if (html.split(k).length !== 2) throw new Error('yer tutucu bir kez olmalı: ' + k);
  html = html.split(k).join(v);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, Math.round(Buffer.byteLength(html) / 1024) + ' KB', lab ? 'lab' : 'tek başına');
