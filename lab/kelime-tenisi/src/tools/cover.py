# Paylaşım görseli (1200x630) ve ana ekran simgesi (180x180).
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

COVER = """
<div style="position:fixed;inset:0;background:#c4633a;overflow:hidden;font-family:Nunito">
  <div style="position:absolute;left:640px;top:-40px;width:700px;height:720px;border:6px solid rgba(255,246,232,.75)"></div>
  <div style="position:absolute;left:760px;top:-40px;width:460px;height:720px;border-left:6px solid rgba(255,246,232,.75);border-right:6px solid rgba(255,246,232,.75)"></div>
  <div style="position:absolute;left:600px;right:-20px;top:309px;height:12px;background:repeating-linear-gradient(90deg,rgba(31,38,51,.55) 0 3px,transparent 3px 10px),rgba(255,255,255,.2);border-top:5px solid #fff"></div>
  <div style="position:absolute;left:70px;top:150px;width:520px;color:#fff">
    <div style="font-size:92px;font-weight:800;line-height:1;text-shadow:0 5px 0 rgba(0,0,0,.18)">Kelime<br>Tenisi</div>
    <div style="font-size:34px;font-weight:500;margin-top:26px;color:#fff3e4;line-height:1.25">Tek harfini değiştir,<br>geri gönder.</div>
    <div style="font-size:24px;font-weight:500;margin-top:26px;color:#ffe2cf">İki kişi tek ekranda · bota karşı</div>
  </div>
  <div style="position:absolute;left:760px;top:58px;display:flex;flex-direction:column;gap:30px;align-items:center;width:460px">
    %s%s%s%s
  </div>
  <span class="ball" style="position:absolute;left:676px;top:272px;width:80px;height:80px"></span>
</div>
""" % (tiles('KASA', -1, '#2563eb'), tiles('KARA', 2, '#d63a78'), tiles('KARE', 3, '#2563eb'), tiles('KÜRE', 1, '#d63a78'))

ICON = """
<div style="position:fixed;inset:0;background:#c4633a;display:flex;align-items:center;justify-content:center">
  <div style="position:absolute;inset:14px;border:5px solid rgba(255,246,232,.7);border-radius:8px"></div>
  <div class="tile" style="--tw:96px;font-size:66px;transform:rotate(-6deg)">K</div>
  <span class="ball" style="position:absolute;right:16px;top:14px;width:52px;height:52px"></span>
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
