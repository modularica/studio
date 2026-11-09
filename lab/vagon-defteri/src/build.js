// Vagon Defteri: kaynakları tek HTML dosyasına derler.
//   node lab/vagon-defteri/src/build.js --lab      -> lab/vagon-defteri/index.html (site: hesap satırları + paylaşım etiketleri)
//   node lab/vagon-defteri/src/build.js <çıktı>    -> hesapsız tek başına kopya (dış bağlantı yok)
const fs = require('fs');
const path = require('path');

const root = __dirname;
const args = process.argv.slice(2);
const lab = args.includes('--lab');
const outArg = args.find(a => !a.startsWith('--'));
const out = outArg ? path.resolve(outArg) : lab ? path.join(root, '..', 'index.html') : null;
if (!out) { console.error('Çıktı yolu ver ya da --lab kullan.'); process.exit(1); }

const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const DESC = 'Trende telefonda çizmek için defter: parmağın kapatmayan uç, iki başparmakla trackpad, sarsıntıda kayan çizgiyi düzelten süzgeç, her durakta yeni sayfa.';
const LAB_HEAD = `<meta name="description" content="${DESC}">
<meta property="og:type" content="website">
<meta property="og:title" content="Vagon Defteri">
<meta property="og:description" content="${DESC}">
<meta property="og:image" content="https://uzigames.com/lab/vagon-defteri/cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="apple-touch-icon" href="/lab/vagon-defteri/icon.png">
<meta name="robots" content="noindex">
<script src="/hesap/supabase.js"></script>
<script src="/hesap/hesap.js" data-oyun="vagon-defteri"></script>`;

let html = read('index.html');
const parts = {
  '<!--LAB_HEAD-->': lab ? LAB_HEAD : '',
  '<!--ICON-->': lab ? '<link rel="icon" type="image/png" href="/lab/vagon-defteri/icon.png">' : '<link rel="icon" href="data:,">',
  '/*STYLE*/': read('style.css'),
  '/*CORE*/': read('core.js'),
  '/*APP*/': read('app.js'),
};
for (const [k, v] of Object.entries(parts)) {
  if (html.split(k).length !== 2) throw new Error('yer tutucu bir kez olmalı: ' + k);
  html = html.split(k).join(v);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + ' KB', lab ? 'lab' : 'tek başına');
