# Tarayıcıda uçtan uca deneme.
# 1–2. çizim: rehberi gerçek fareyle izler (bak, sürükle, çevir, Run). Sonra bütün çizimlerin bütün
# çözümleri: parçalar API ile kurulur, elle basışlar rehberin dondurmasıyla tam anında yapılır
# (böylece zamanlaması dar çözümler de oyunun kendi döngüsünde doğrulanır). En sonda iki çizim
# rehbersiz, gerçek zamanlı tuşla oynanır.
# Önce: node build.js --local /tmp/km-local.html  (ekran görüntüleri /tmp/km-shots/)
import json, os, sys, time
from playwright.sync_api import sync_playwright

URL = 'file:///tmp/km-local.html'
OUT = '/tmp/km-shots'
os.makedirs(OUT, exist_ok=True)
errors, fails = [], []

def cell_px(page, x, y):
    return page.evaluate("""([x, y]) => { const V = KM_GAME.view(); const r = document.getElementById('board').getBoundingClientRect();
        return [r.left + V.sx(x), r.top + V.sy(y)]; }""", [x, y])

def result_open(page):
    return page.evaluate("!document.getElementById('result').hidden")

def result_info(page):
    return page.evaluate("""() => ({ stamps: [...document.querySelectorAll('#result-stamps .goal')].map(li => (li.classList.contains('got') ? '✓ ' : '· ') + li.textContent),
        time: document.getElementById('st-time').textContent, press: document.getElementById('st-press').textContent })""")

def drag(page, sx, sy, tx, ty):
    page.mouse.move(sx, sy); page.mouse.down()
    for i in range(1, 16):
        page.mouse.move(sx + (tx - sx) * i / 15, sy + (ty - sy) * i / 15)
        page.wait_for_timeout(16)
    page.mouse.up()
    page.wait_for_timeout(150)

def mid(r):
    return [(r['left'] + r['right']) / 2, (r['top'] + r['bottom']) / 2]

def guide_view(page):
    return page.evaluate("""() => { const v = KM_GAME.G.view; if (!v) return null;
        const box = r => r && { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        return { key: v.key, say: v.say, from: box(v.from), to: box(v.to), tap: box(v.tap) }; }""")

def follow_guide(page, label, shots=False):
    """Rehberin dediğini fareyle yapar; Run'a basınca (ya da rehber bitince) döner."""
    seen = []
    for n in range(20):
        v = guide_view(page)
        if not v: return seen
        seen.append(v['key'])
        print(f'  {label} rehber: {v["say"]}')
        if shots: page.screenshot(path=f'{OUT}/{label}-{v["key"]}.png')
        k = v['key']
        if k.startswith('look') or k.startswith('rest'):
            page.click('#coach-next'); page.wait_for_timeout(200)
        elif k.startswith('place') or k.startswith('junk'):
            f, t = mid(v['from']), mid(v['to'])
            drag(page, f[0], f[1], t[0], t[1])
        elif k.startswith('turn') or k.startswith('link'):
            page.mouse.click(*mid(v['tap'])); page.wait_for_timeout(200)
        elif k.startswith('run'):
            page.click('#run'); page.wait_for_timeout(100)
            return seen
    fails.append(f'{label}: rehber bitmedi ({seen[-3:]})')
    return seen

def answer_freezes(page, label, timeout=25, shot=None):
    """Makine donunca söyleneni klavyeyle yapar. Sonuç: 'goal' ya da durma nedeni."""
    t0 = time.time(); held = set(); res = None; n = 0
    while time.time() - t0 < timeout:
        st = page.evaluate("""() => ({ res: !document.getElementById('result').hidden, mode: KM_GAME.S.mode, fail: KM_GAME.S.lastFail,
            fr: KM_GAME.G.freeze ? { act: KM_GAME.G.freeze.act, num: KM_GAME.G.freeze.rt.num } : null })""")
        if st['res']: res = 'goal'; break
        if st['mode'] == 'build': res = f'durdu ({st["fail"]})'; break
        if st['fr']:
            if shot and n == 0: page.screenshot(path=f'{OUT}/{shot}.png')
            n += 1
            key = str(st['fr']['num'])
            if st['fr']['act'] == 'press': page.keyboard.press(key)
            elif st['fr']['act'] == 'down': page.keyboard.down(key); held.add(key)
            else: page.keyboard.up(key); held.discard(key)
            page.wait_for_timeout(60)
        time.sleep(0.03)
    for k in held: page.keyboard.up(k)
    return res or 'süre doldu'

PLACE = """(parts) => { const G = KM_GAME; G.S.parts = []; const base = G.S.nextId - 1; G.S.nextId += parts.length;
    parts.forEach((p, i) => G.addPlaced(Object.assign({}, p, { id: base + i + 1, link: typeof p.link === 'number' ? base + p.link : (p.link == null ? null : p.link) })));
    G.saveSetup(); G.refreshSide(); }"""
# Rehberi verilen çözüme kurar: Run'a basınca çözümün basış anlarında makine donar.
ARM = """(k) => { const K = KM_GAME, sol = K.S.level.sol[k];
    Object.assign(K.G, { on: true, sol, steps: [{ run: true }], i: 0, idx: sol.parts.map((p, j) => j), full: true, news: [], again: false }); }"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1366, 'height': 1024}, device_scale_factor=1)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(800)
    IDS = page.evaluate('KM_LEVELS.map(l => l.id)')
    page.screenshot(path=f'{OUT}/1-build.png')

    # 1. ve 2. çizim: rehberle, gerçek fareyle
    for n, lid in enumerate(['ilk-rampa', 'rampa']):
        assert page.evaluate("KM_GAME.S.level.id") == lid, page.evaluate("KM_GAME.S.level.id")
        seen = follow_guide(page, f'L{n + 1}', shots=(n == 0))
        res = answer_freezes(page, lid)
        print(f'L{n + 1} {lid}:', res, result_info(page) if res == 'goal' else '')
        if res != 'goal': fails.append(f'{lid} rehberli: {res}')
        if lid == 'rampa' and not any(k.startswith('turn') for k in seen): fails.append('rampa: çevirme adımı çıkmadı')
        page.screenshot(path=f'{OUT}/{n + 2}-result.png')
        page.click('#btn-next'); page.wait_for_timeout(250)

    # Rehberli piston: makine donar, düğmeye fareyle basılır
    page.evaluate(f"KM_GAME.loadLevel({IDS.index('piston')})"); page.wait_for_timeout(250)
    follow_guide(page, 'piston')
    t0 = time.time()
    while time.time() - t0 < 8 and not page.evaluate("!!KM_GAME.G.freeze"): time.sleep(0.03)
    page.screenshot(path=f'{OUT}/4-piston-freeze.png')
    bx = page.evaluate("(() => { const r = KM_GAME.G.freeze.rt.btn.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    page.mouse.click(*bx)
    t0 = time.time()
    while time.time() - t0 < 8 and not result_open(page): time.sleep(0.05)
    print('piston rehberli (fareyle):', result_open(page))
    if not result_open(page): fails.append('piston: rehberli fare basışı tutmadı')
    page.click('#btn-retry'); page.wait_for_timeout(200)

    # Bütün çizimler, bütün çözümler
    total = 0
    for i, lid in enumerate(IDS):
        page.evaluate(f"KM_GAME.loadLevel({i})"); page.wait_for_timeout(120)
        nsol = page.evaluate("KM_GAME.S.level.sol.length")
        for k in range(nsol):
            parts = page.evaluate(f"KM_GAME.S.level.sol[{k}].parts.map(p => ({{type: p.type, o: p.o, x: p.x, y: p.y, link: p.link}}))")
            page.evaluate(PLACE, parts)
            page.evaluate(ARM, k)
            page.click('#run')
            res = answer_freezes(page, lid)
            total += 1
            name = page.evaluate(f"KM_GAME.S.level.sol[{k}].name")
            print(f'{i + 1:2} {lid} "{name}":', res)
            if res != 'goal': fails.append(f'{lid} "{name}": {res}')
            if result_open(page): page.click('#btn-retry'); page.wait_for_timeout(150)
            elif page.evaluate("KM_GAME.S.mode") == 'run': page.click('#run'); page.wait_for_timeout(150)
    print('çözüm sayısı:', total)

    # Rehbersiz, gerçek zamanlı: piston (dinlenince bas) ve pervane (tut-bırak)
    for lid, keys in [('piston', [(3.0, '1', 0)]), ('pervane', [(0.5, '1', 0.62)])]:
        page.evaluate(f"KM_GAME.loadLevel({IDS.index(lid)})"); page.wait_for_timeout(200)
        page.evaluate("KM_GAME.G.on = false"); page.evaluate(PLACE, [])
        page.click('#run')
        for (t, key, hold) in keys:
            page.wait_for_timeout(int(t * 1000))
            if hold: page.keyboard.down(key); page.wait_for_timeout(int(hold * 1000)); page.keyboard.up(key)
            else: page.keyboard.press(key)
        t0 = time.time()
        while time.time() - t0 < 10 and not result_open(page): time.sleep(0.05)
        print(f'{lid} gerçek zamanlı:', result_open(page))
        if not result_open(page): fails.append(f'{lid}: gerçek zamanlı oynanmadı')
        else: page.click('#btn-retry'); page.wait_for_timeout(200)

    # Görüntüler: kurulu tahtalar, çalışırken balon ve dişliler, çok toplu sayaç
    def show(lid, k, name, run_ms=0):
        page.evaluate(f"KM_GAME.loadLevel({IDS.index(lid)})"); page.wait_for_timeout(200)
        page.evaluate("KM_GAME.G.on = false")
        parts = page.evaluate(f"KM_GAME.S.level.sol[{k}].parts.map(p => ({{type: p.type, o: p.o, x: p.x, y: p.y, link: p.link}}))")
        page.evaluate(PLACE, parts); page.wait_for_timeout(150)
        if run_ms:
            page.click('#run'); page.wait_for_timeout(run_ms)
        page.screenshot(path=f'{OUT}/{name}.png')
        if run_ms and page.evaluate("KM_GAME.S.mode") == 'run': page.click('#run'); page.wait_for_timeout(150)
        if result_open(page): page.click('#btn-retry'); page.wait_for_timeout(150)
    for lid in ['zikzak', 'kopru', 'havada-yay', 'ilk-bant', 'bant', 'buyuk-makine', 'kule', 'hava-akimi']:
        show(lid, 0, f'n1-{lid}')
    show('teleferik', 1, 'd4-tele-run', 1500)
    show('degirmen', 1, 'd5-degirmen-run', 4200)
    page.evaluate(f"KM_GAME.loadLevel({IDS.index('domino')})"); page.wait_for_timeout(150)
    page.evaluate("KM_GAME.G.on = false"); page.evaluate(PLACE, [])
    page.click('#run'); page.wait_for_timeout(1500)
    print('çalışırken sayaç:', page.evaluate("document.getElementById('press-count').textContent"))
    page.click('#run'); page.wait_for_timeout(200)

    # Bölüm seçimi
    page.click('#btn-levels'); page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/6-levels.png')
    page.keyboard.press('Escape')
    b.close()

print('hatalar:', errors if errors else 'yok')
print('sorunlar:', fails if fails else 'yok')
sys.exit(1 if errors or fails else 0)
