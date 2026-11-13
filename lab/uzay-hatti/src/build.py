"""Build Uzay Hattı into lab/uzay-hatti/index.html.
python3 lab/uzay-hatti/src/build.py
Writes ../index.html (Lab page: share tags + account scripts) and ../uzay-hatti.html (stand-alone, not deployed)."""
import pathlib, sys
root = pathlib.Path(__file__).parent
srcdir = root
tpl = (srcdir / 'game.html').read_text()
econ = (srcdir / 'econ.js').read_text()
assert '/*@ECON@*/' in tpl
out = tpl.replace('/*@ECON@*/', econ)
standalone = root / 'standalone.html'
standalone.write_text(out)
print('built', standalone, len(out))
if True:
    desc = 'Uzay limanını yönet: yolcuları Ay, Mars ve ötesine taşı. Roketi yeşilde fırlat, bilet parası 2 katı!'
    head = f'''<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:title" content="Uzay Hattı">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://uzigames.com/lab/uzay-hatti/cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<script src="/hesap/supabase.js"></script>
<script src="/hesap/hesap.js" data-oyun="uzay-hatti" data-kayit="uzay-hatti-v1"></script>
'''
    anchor = '<title>Uzay Hattı</title>\n'
    assert anchor in out
    lab = out.replace(anchor, anchor + head)
    (root.parent / 'index.html').write_text(lab)
    print('built', root.parent / 'index.html', len(lab))
