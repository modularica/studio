# Inline scripts and fonts into one self-contained HTML file.
# python3 lab/kis-uykusu-oteli/src/build.py --lab          -> lab/kis-uykusu-oteli/index.html (the site)
# python3 lab/kis-uykusu-oteli/src/build.py <out>          -> a standalone copy without the account scripts
from pathlib import Path
import base64, sys
root = Path(__file__).parent
FONTS = root / 'fonts'
LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
faces = []
for fam, name, weights in [('fredoka', 'Fredoka', (500, 600, 700)), ('nunito', 'Nunito', (500, 700, 800))]:
    for w in weights:
        for sub, rng in [('latin-ext', LATIN_EXT), ('latin', LATIN)]:
            b64 = base64.b64encode((FONTS / f'{fam}-{sub}-{w}-normal.woff2').read_bytes()).decode()
            faces.append(f"@font-face{{font-family:'{name}';font-style:normal;font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{rng}}}")
parts = [(root / f).read_text() for f in ['data.js', 'sim.js', 'draw.js', 'audio.js', 'app.js']]
js = "'use strict';\n" + '\n'.join(parts)
html = (root / 'index.html').read_text()
for mark in ('/*JS*/', '/*FONTS*/', '<!--LAB_HEAD-->'):
    assert html.count(mark) == 1, mark
LAB_HEAD = """<meta name="description" content="Ormanın hayvanları kışı senin otelinde uyuyarak geçiriyor. Onları sıcak ve sessiz tut, baharda fındıkla ödesinler.">
<meta property="og:type" content="website">
<meta property="og:title" content="Kış Uykusu Oteli">
<meta property="og:description" content="Ormanın hayvanları kışı senin otelinde uyuyarak geçiriyor. Onları sıcak ve sessiz tut, baharda fındıkla ödesinler.">
<meta property="og:image" content="https://uzigames.com/lab/kis-uykusu-oteli/cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<script src="/hesap/supabase.js"></script>
<script src="/hesap/hesap.js" data-oyun="kis-uykusu-oteli" data-kayit="otel.save"></script>"""
lab = '--lab' in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith('--')]
out = Path(args[0]) if args else root.parent / 'index.html'
out.parent.mkdir(parents=True, exist_ok=True)
page = html.replace('/*FONTS*/', '\n'.join(faces)).replace('<!--LAB_HEAD-->', LAB_HEAD if lab else '').replace('/*JS*/', js)
out.write_text(page)
print(out, len(page) // 1024, 'KB', 'lab' if lab else 'standalone')
