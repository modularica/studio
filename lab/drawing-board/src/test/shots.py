# Çizimlerin ekran görüntüleri: masaüstü, telefon (yatay ve dikey), sürükleme anı, çalışma anı, bölüm kartları.
# Önce: node build.js --local /tmp/km-local.html  (görüntüler /tmp/km-shots/)
import os
from playwright.sync_api import sync_playwright

URL = 'file:///tmp/km-local.html'
OUT = '/tmp/km-shots'
os.makedirs(OUT, exist_ok=True)
errors = []

def place(page, lid, sol=True):
    # Çizim kimlikle bulunur; rehber kapatılır ki görüntüde balon çıkmasın.
    page.evaluate(f"""() => {{ const G = KM_GAME; G.loadLevel(KM_LEVELS.findIndex(l => l.id === '{lid}')); G.G.on = false; G.S.parts = [];
        const sols = G.S.level.sol || [];
        if ({'true' if sol else 'false'} && sols.length) for (const p of sols[sols.length - 1].parts) G.addPlaced(Object.assign({{ id: G.S.nextId++ }}, {{ type: p.type, o: p.o, x: p.x, y: p.y, link: p.link == null ? null : p.link }}));
        G.saveSetup(); G.refreshSide(); }}""")

def cell_px(page, x, y):
    return page.evaluate("""([x, y]) => { const V = KM_GAME.view(); const r = document.getElementById('board').getBoundingClientRect();
        return [r.left + V.sx(x), r.top + V.sy(y)]; }""", [x, y])

def open_page(b, w, h, dpr=1):
    page = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=dpr)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL); page.wait_for_timeout(700)
    return page

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = open_page(b, 1366, 1024)
    for name in ['yay', 'piston', 'pervane', 'buyuk-makine', 'domino', 'kapi', 'kapak', 'miknatis', 'bayraklar', 'uc-top', 'istasyon']:
        place(page, name); page.wait_for_timeout(250)
        page.screenshot(path=f'{OUT}/30-{name}.png')
    # Sürükleme anı: listedeki ilk parçayı tahtaya taşı, bırakmadan çek.
    place(page, 'buyuk-makine', sol=False); page.wait_for_timeout(200)
    row = page.locator('.bom-row').first.bounding_box()
    sx, sy = row['x'] + row['width'] / 2, row['y'] + row['height'] / 2
    tx, ty = cell_px(page, 2, 4)
    page.mouse.move(sx, sy); page.mouse.down()
    for i in range(1, 13):
        page.mouse.move(sx + (tx - sx) * i / 12, sy + (ty - sy) * i / 12); page.wait_for_timeout(16)
    page.wait_for_timeout(150)
    page.screenshot(path=f'{OUT}/31-surukle.png')
    page.mouse.up()
    # Çalışma anı ve başarısız deneme izi
    place(page, 'domino'); page.wait_for_timeout(150)
    page.click('#run'); page.wait_for_timeout(2300)
    page.screenshot(path=f'{OUT}/32-iki-top-calisiyor.png')
    page.click('#run'); page.wait_for_timeout(150)
    place(page, 'ilk-rampa', sol=False); page.wait_for_timeout(150)
    page.click('#run'); page.wait_for_timeout(6500)
    page.screenshot(path=f'{OUT}/33-basarisiz-iz.png')
    page.click('#btn-levels'); page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/34-bolumler.png')
    page.close()
    for (w, h, dpr, name) in [(844, 390, 3, 'telefon-yatay'), (390, 844, 3, 'telefon-dikey'), (1180, 820, 2, 'ipad')]:
        page = open_page(b, w, h, dpr)
        place(page, 'buyuk-makine'); page.wait_for_timeout(250)
        page.screenshot(path=f'{OUT}/35-{name}.png')
        page.close()
    b.close()
print('hatalar:', errors or 'yok')
