# Kelime Düellosu paylaşım görseli (1200x630) ve ana ekran simgesi (180x180).
# Önce: node lab/kelime-tenisi/src/build.js /tmp/kt/kt.html
# Sonra: python3 lab/kelime-tenisi/src/tools/cover.py   -> lab/kelime-tenisi/cover.png, icon.png
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, '..', '..'))
PORT = 8773
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', '/tmp/kt'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.6)

def tiles(word, mark, color):
    return '<div class="tiles" style="--tw:74px;--pc:%s">%s</div>' % (color, ''.join(
        '<div class="tile%s">%s</div>' % (' new' if i == mark else '', c) for i, c in enumerate(word)))

ARROW = '<div style="color:#fffaf0;opacity:.5;font-size:28px;line-height:1">↓</div>'

COVER = """
<div style="position:fixed;inset:0;background:#f6f0e4;overflow:hidden;font-family:Nunito">
  <div style="position:absolute;left:66px;top:150px;width:600px;color:#1f2633">
    <div style="font-size:96px;font-weight:800;line-height:1;color:#b2552f">Kelime<br>Düellosu</div>
    <div style="font-size:36px;font-weight:500;margin-top:28px;color:#1f2633;line-height:1.25">Tek harfini değiştir,<br>geri gönder.</div>
    <div style="font-size:25px;font-weight:500;margin-top:26px;color:#6c707a">İki kişi tek ekranda · bota karşı</div>
  </div>
  <div style="position:absolute;left:720px;top:34px;width:420px;height:562px;border-radius:28px;background-color:#2b3344;background-image:radial-gradient(rgba(255,255,255,.08) 1.6px,transparent 1.8px);background-size:22px 22px"></div>
  <div style="position:absolute;left:720px;top:62px;width:420px;display:flex;flex-direction:column;gap:13px;align-items:center">
    %s%s%s%s%s%s%s
  </div>
</div>
""" % (tiles('KASA', -1, '#2563eb'), ARROW, tiles('KARA', 2, '#d63a78'), ARROW, tiles('KARE', 3, '#2563eb'), ARROW, tiles('KÜRE', 1, '#d63a78'))

ICON = """
<div style="position:fixed;inset:0;background-color:#2b3344;background-image:radial-gradient(rgba(255,255,255,.09) 1.4px,transparent 1.6px);background-size:16px 16px">
  <div class="tile" style="--tw:84px;position:absolute;left:22px;top:26px;font-size:58px;transform:rotate(-8deg)">A</div>
  <div class="tile" style="--tw:84px;position:absolute;right:20px;bottom:22px;font-size:58px;color:#d63a78;transform:rotate(7deg)">E</div>
</div>
"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
    for html, size, name in ((COVER, (1200, 630), 'cover.png'), (ICON, (180, 180), 'icon.png')):
        pg = b.new_page(viewport={'width': size[0], 'height': size[1]})
        pg.add_init_script("localStorage.setItem('kelime-tenisi.device', JSON.stringify({seenHow:true}))")
        pg.goto(f'http://127.0.0.1:{PORT}/kt.html')
        pg.evaluate('html => { document.getElementById("app").innerHTML = html; }', html)
        pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(DEST, name))
        print(os.path.join(DEST, name))
        pg.close()
    b.close()
srv.terminate()
