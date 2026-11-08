# Tarayıcıda uçtan uca deneme: gerçek sürükle-bırak ile 1. bölüm, API ile diğerleri.
# Önce: node build.js --local /tmp/km-local.html  (ekran görüntüleri /tmp/km-shots/)
import json, sys, time
from playwright.sync_api import sync_playwright

URL = 'file:///tmp/km-local.html'
OUT = '/tmp/km-shots'
errors = []

def cell_px(page, x, y):
    return page.evaluate("""([x, y]) => { const V = KM_GAME.view(); const r = document.getElementById('board').getBoundingClientRect();
        return [r.left + V.sx(x), r.top + V.sy(y)]; }""", [x, y])

def wait_result(page, timeout=15):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if page.evaluate("!document.getElementById('result').hidden"):
            return True
        time.sleep(0.1)
    return False

def result_info(page):
    return page.evaluate("""() => ({ stamps: [...document.querySelectorAll('#result-stamps .goal')].map(li => (li.classList.contains('got') ? '✓ ' : '· ') + li.textContent),
        time: document.getElementById('st-time').textContent, press: document.getElementById('st-press').textContent })""")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1366, 'height': 1024}, device_scale_factor=1)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(800)
    page.screenshot(path=f'{OUT}/1-build.png')

    # 1. bölüm: listeden rampayı sürükle, dokunarak döndür, çalıştır
    row = page.locator('.bom-row').first.bounding_box()
    sx, sy = row['x'] + row['width'] / 2, row['y'] + row['height'] / 2
    tx, ty = cell_px(page, 7, 5.5)
    page.mouse.move(sx, sy); page.mouse.down()
    for i in range(1, 16):
        page.mouse.move(sx + (tx - sx) * i / 15, sy + (ty - sy) * i / 15)
        page.wait_for_timeout(16)
    page.mouse.up()
    page.wait_for_timeout(100)
    parts = page.evaluate("KM_GAME.S.parts.map(p => p.type + ':' + p.o + '@' + p.x + ',' + p.y)")
    print('L1 yerleşim:', parts)
    page.mouse.click(tx, ty)
    page.wait_for_timeout(100)
    print('L1 döndürme sonrası:', page.evaluate("KM_GAME.S.parts.map(p => p.o)"))
    page.click('#run')
    page.wait_for_timeout(1700)
    page.screenshot(path=f'{OUT}/2-running.png')
    ok = wait_result(page)
    print('L1 sonuç:', ok, result_info(page) if ok else page.evaluate("KM_GAME.S.mode"))
    page.screenshot(path=f'{OUT}/3-result.png')
    page.click('#btn-next')
    page.wait_for_timeout(200)

    # 2. bölüm: yay (API ile)
    def place_and_run(parts, keys=None, label=''):
        page.evaluate("""(parts) => { const G = KM_GAME; G.S.parts = []; for (const p of parts) G.addPlaced(Object.assign({ id: G.S.nextId++ }, p)); G.saveSetup(); G.refreshSide(); }""", parts)
        page.click('#run')
        for (t, k, hold) in (keys or []):
            page.wait_for_timeout(int(t * 1000))
            if hold:
                page.keyboard.down(k); page.wait_for_timeout(int(hold * 1000)); page.keyboard.up(k)
            else:
                page.keyboard.press(k)
        ok = wait_result(page)
        print(label, 'sonuç:', ok, result_info(page) if ok else page.evaluate("[KM_GAME.S.mode, KM_GAME.S.lastFail]"))
        return ok

    print('bölüm:', page.evaluate("KM_GAME.S.level.id"))
    place_and_run([{'type': 'spring', 'o': 'u', 'x': 5, 'y': 0}], label='L2')
    page.click('#btn-next'); page.wait_for_timeout(200)
    print('bölüm:', page.evaluate("KM_GAME.S.level.id"))
    place_and_run([{'type': 'ramp', 'o': 'dl', 'x': 7, 'y': 4}], keys=[(2.6, '1', 0)], label='L3')
    page.click('#btn-next'); page.wait_for_timeout(200)
    print('bölüm:', page.evaluate("KM_GAME.S.level.id"))
    page.screenshot(path=f'{OUT}/4-fan-build.png')
    place_and_run([], keys=[(0.4, '1', 0.62)], label='L4')
    page.click('#btn-next'); page.wait_for_timeout(200)
    print('bölüm:', page.evaluate("KM_GAME.S.level.id"))
    place_and_run([], keys=[(2.62, '1', 0)], label='L5 elle')
    page.click('#btn-retry'); page.wait_for_timeout(200)
    place_and_run([{'type': 'sensor', 'o': '-', 'x': 6, 'y': 2}], label='L5 sensör')
    page.click('#btn-retry'); page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/5-sensor-build.png')
    page.evaluate("KM_GAME.loadLevel(5)"); page.wait_for_timeout(200)
    print('bölüm:', page.evaluate("KM_GAME.S.level.id"))
    place_and_run([{'type': 'sensor', 'o': '-', 'x': 3, 'y': 4}], label='L6 sensör')
    page.click('#btn-retry'); page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/9-hizli.png')
    page.click('#run'); page.wait_for_timeout(100)
    page.click('#btn-next') if page.evaluate("!document.getElementById('result').hidden") else None
    page.evaluate("KM_GAME.loadLevel(6)"); page.wait_for_timeout(200)
    print('bölüm:', page.evaluate("KM_GAME.S.level.id"))
    place_and_run([{'type': 'sensor', 'o': '-', 'x': 12, 'y': 4}], keys=[(2.1, '1', 0)], label='L7 elle+sensör')
    page.click('#btn-retry'); page.wait_for_timeout(200)
    place_and_run([{'type': 'sensor', 'o': '-', 'x': 5, 'y': 2}, {'type': 'sensor', 'o': '-', 'x': 12, 'y': 4}], label='L7 iki sensör')
    page.click('#btn-next'); page.wait_for_timeout(200)
    print('bölüm:', page.evaluate("KM_GAME.S.level.id"))
    links = page.evaluate("""() => { const G = KM_GAME; G.S.parts = []; for (const p of [{type:'ramp',o:'dr',x:1,y:3},{type:'sensor',o:'-',x:4,y:1},{type:'sensor',o:'-',x:8,y:5}]) G.addPlaced(Object.assign({ id: G.S.nextId++ }, p)); return G.S.parts.map(p => p.type + '→' + p.link); }""")
    print('L8 otomatik bağlantılar:', links)
    place_and_run([{'type': 'ramp', 'o': 'dr', 'x': 1, 'y': 3}, {'type': 'sensor', 'o': '-', 'x': 4, 'y': 1}, {'type': 'sensor', 'o': '-', 'x': 8, 'y': 5}], label='L8 tam otomatik')
    page.click('#btn-retry'); page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/10-buyuk.png')
    # 9–14: kayıtlı ilk çözüm (girdisiz) ile
    for i in range(8, 14):
        page.evaluate(f"KM_GAME.loadLevel({i})"); page.wait_for_timeout(150)
        lid = page.evaluate("KM_GAME.S.level.id")
        parts = page.evaluate("KM_GAME.S.level.sol[0].parts.map(p => ({type: p.type, o: p.o, x: p.x, y: p.y}))")
        place_and_run(parts, label=f'L{i + 1} {lid}')
        page.click('#btn-retry'); page.wait_for_timeout(250)
        if lid in ('domino', 'tetik'):
            page.screenshot(path=f'{OUT}/11-{lid}.png')
    # Defter 2: kapı ve mıknatıs (15–20)
    page.evaluate("KM_GAME.loadLevel(14)"); page.wait_for_timeout(150)
    print('bölüm:', page.evaluate("KM_GAME.S.level.id"))
    place_and_run([], keys=[(4.0, '1', 0)], label='L15 kapı elle')
    page.click('#btn-retry'); page.wait_for_timeout(200)
    page.evaluate("KM_GAME.loadLevel(16)"); page.wait_for_timeout(150)
    place_and_run([], keys=[(0.5, '1', 5.5)], label='L17 mıknatıs basılı tut')
    page.click('#btn-retry'); page.wait_for_timeout(200)
    for i in range(15, 20):
        page.evaluate(f"KM_GAME.loadLevel({i})"); page.wait_for_timeout(150)
        lid = page.evaluate("KM_GAME.S.level.id")
        parts = page.evaluate("KM_GAME.S.level.sol[0].parts.map(p => ({type: p.type, o: p.o, x: p.x, y: p.y, link: p.link}))")
        place_and_run(parts, label=f'L{i + 1} {lid}')
        page.click('#btn-retry'); page.wait_for_timeout(250)
    # çoklu topta çalışırken kova sayacı
    page.evaluate("KM_GAME.loadLevel(12)"); page.wait_for_timeout(150)
    page.click('#run'); page.wait_for_timeout(2600)
    print('çalışırken sayaç:', page.evaluate("document.getElementById('press-count').textContent"))
    page.screenshot(path=f'{OUT}/12-iki-top-run.png')
    page.click('#run'); page.wait_for_timeout(200)

    # Bölüm seçimi
    page.click('#btn-levels'); page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/6-levels.png')
    page.keyboard.press('Escape')

    b.close()

print('hatalar:', errors if errors else 'yok')
