# Tarayıcıda uçtan uca deneme (telefon ekranı, gerçek dokunma olayları).
# Önce: node build.js /tmp/vd/vd.html   Sonra: python3 test/browser.py   (görüntüler /tmp/vd-shots/)
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = '/tmp/vd'
OUT = '/tmp/vd-shots'
PORT = 8765
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.6)
URL = f'http://127.0.0.1:{PORT}/vd.html'
errors, fails = [], []

def check(cond, msg):
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: fails.append(msg)

def V(page, js):
    return page.evaluate(js)

class Touch:
    def __init__(self, page):
        self.c = page.context.new_cdp_session(page)
        self.page = page
        self.pts = {}
    def send(self, kind):
        tp = [{'x': x, 'y': y, 'id': i, 'radiusX': 6, 'radiusY': 6} for i, (x, y) in self.pts.items()]
        self.c.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': tp})
    def down(self, i, x, y):
        self.pts[i] = (x, y); self.send('touchStart')
    def move(self, i, x, y):
        self.pts[i] = (x, y); self.send('touchMove')
    def up(self, i):
        del self.pts[i]
        tp = [{'x': x, 'y': y, 'id': j} for j, (x, y) in self.pts.items()]
        self.c.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': tp})
    def line(self, i, x0, y0, x1, y1, n=24, dt=0.012, lift=True):
        self.down(i, x0, y0)
        for k in range(1, n + 1):
            u = k / n
            self.move(i, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u)
            time.sleep(dt)
        if lift: self.up(i)

def stage_xy(page):
    r = page.evaluate("(() => { const r = document.getElementById('stage').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    return r

def strokes(page): return V(page, 'window.__vagon.page.strokes.length')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_function('window.__vagon && window.__vagon.ready')
    page.screenshot(path=f'{OUT}/00-intro.png')
    page.click('#intro-go')
    T = Touch(page)
    sx, sy, sw, sh = stage_xy(page)
    cx, cy = sx + sw / 2, sy + sh / 2

    print('Parmak')
    page.click('#modes button[data-mode=finger]')
    T.line(0, cx - 120, cy - 150, cx + 100, cy - 60)
    page.wait_for_timeout(100)
    check(strokes(page) == 1, 'tek parmakla çizgi')
    # iki parmakla dokun: geri al
    T.down(0, cx - 40, cy); T.down(1, cx + 40, cy); time.sleep(0.05); T.up(1); T.up(0)
    page.wait_for_timeout(100)
    check(strokes(page) == 0, 'iki parmakla dokununca geri alındı')
    T.down(0, cx - 40, cy); T.down(1, cx + 40, cy); T.down(2, cx, cy + 40); time.sleep(0.05); T.up(2); T.up(1); T.up(0)
    page.wait_for_timeout(100)
    check(strokes(page) == 1, 'üç parmakla dokununca yinelendi')
    s0 = V(page, 'window.__vagon.view.s')
    T.down(0, cx - 30, cy); T.down(1, cx + 30, cy)
    for k in range(1, 15): T.move(0, cx - 30 - k * 6, cy); T.move(1, cx + 30 + k * 6, cy); time.sleep(0.01)
    T.up(1); T.up(0)
    page.wait_for_timeout(250)
    s1 = V(page, 'window.__vagon.view.s')
    check(s1 > s0 * 2 and strokes(page) == 1, f'iki parmakla yaklaşıldı ({s0:.3f} → {s1:.3f}), çizgi eklenmedi')
    page.screenshot(path=f'{OUT}/01-zoomed.png')
    page.click('#z-fit'); page.wait_for_timeout(100)

    print('Uç')
    page.click('#modes button[data-mode=nib]')
    n0 = strokes(page)
    T.line(0, cx - 100, cy + 40, cx + 60, cy + 120, n=10, dt=0.01)   # beklemeden kaydır: çizmez
    page.wait_for_timeout(100)
    check(strokes(page) == n0, 'beklemeden kaydırınca çizmez (ucu yerine getirme)')
    fx, fy = cx - 100, cy + 200
    T.down(0, fx, fy); time.sleep(0.12)
    page.screenshot(path=f'{OUT}/02-nib-aim.png')
    time.sleep(0.3)
    for k in range(1, 20): T.move(0, fx + k * 9, fy - k * 3); time.sleep(0.012)
    page.screenshot(path=f'{OUT}/03-nib-draw.png')
    T.up(0); page.wait_for_timeout(100)
    check(strokes(page) == n0 + 1, 'bekleyince halka doldu, çizdi')
    first = V(page, 'window.__vagon.C.decode(window.__vagon.page.strokes.at(-1).p)[0]')
    want = V(page, f'window.__vagon.toPage({fx - sx - 24}, {fy - sy - 62})')
    check(abs(first['x'] - want['x']) < 6 and abs(first['y'] - want['y']) < 6, f'çizgi parmağın değil ucun yerinden başladı ({first["x"]:.0f},{first["y"]:.0f} ≈ {want["x"]:.0f},{want["y"]:.0f})')
    # iki kez dokun, ikincide sürükle
    T.down(0, cx, cy + 260); time.sleep(0.04); T.up(0); time.sleep(0.08)
    T.line(0, cx, cy + 260, cx + 120, cy + 230, n=12, dt=0.01)
    page.wait_for_timeout(100)
    check(strokes(page) == n0 + 2, 'iki kez dokun-sürükle hemen çizdi')

    print('Trackpad')
    page.click('#modes button[data-mode=pad]')
    n0 = strokes(page)
    c0 = V(page, '({...window.__vagon.cursor})')
    T.line(0, cx - 100, cy + 200, cx + 50, cy + 200, n=15)
    page.wait_for_timeout(80)
    c1 = V(page, '({...window.__vagon.cursor})')
    s = V(page, 'window.__vagon.view.s'); g = V(page, 'window.__vagon.S.gain')
    check(strokes(page) == n0, 'tek parmak imleci sürdü, çizmedi')
    check(abs((c1['x'] - c0['x']) - 150 * g / s) < 3, f'imleç parmak × hassasiyet kadar gitti ({c1["x"] - c0["x"]:.0f} ≈ {150 * g / s:.0f} birim)')
    T.down(0, cx - 100, cy + 220); T.down(1, cx + 120, cy + 300)
    for k in range(1, 20): T.move(0, cx - 100 + k * 6, cy + 220 - k * 8); time.sleep(0.012)
    page.screenshot(path=f'{OUT}/04-pad-draw.png')
    T.up(1); T.up(0); page.wait_for_timeout(100)
    check(strokes(page) == n0 + 1, 'ikinci parmak basılıyken çizdi')
    T.down(0, cx, cy + 100); time.sleep(0.04); T.up(0); time.sleep(0.08)
    T.line(0, cx, cy + 100, cx - 80, cy + 160, n=12)
    page.wait_for_timeout(100)
    check(strokes(page) == n0 + 2, 'tek elle iki kez dokun-sürükle çizdi')
    page.click('#z-in'); page.wait_for_timeout(80)
    T.line(0, cx, cy, cx + 300, cy, n=20)    # imleç kenara gidince sayfa kayar
    page.wait_for_timeout(80)
    cs = V(page, 'window.__vagon.toScreen(window.__vagon.cursor.x, window.__vagon.cursor.y)')
    check(0 <= cs['x'] <= sw and 0 <= cs['y'] <= sh, 'yakınken imleç ekranda kalıyor (sayfa kaydı)')
    page.click('#z-fit')

    print('Sarsıntı süzgeci (yapay ivme + yapay dokunma, aynı saatle)')
    page.click('#modes button[data-mode=finger]')
    n0 = strokes(page)
    res = page.evaluate("""async () => {
      const V = window.__vagon, board = document.getElementById('board'), r = board.getBoundingClientRect();
      const sleep = ms => new Promise(f => setTimeout(f, ms));
      let k = 0;
      const calm = () => { const s = performance.now() / 1000; return [0.25*Math.sin(2*Math.PI*13*s), 0.25*Math.sin(2*Math.PI*17*s+2), 0.15*Math.sin(2*Math.PI*11*s)]; };
      for (let i = 0; i < 90; i++) { const a = calm(); V.feedMotion(performance.now(), a[0], a[1], a[2]); await sleep(8); }
      const y0 = r.top + r.height * 0.75, x0 = r.left + 40;
      const fire = (type, x, y) => board.dispatchEvent(new PointerEvent(type, { pointerId: 77, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true }));
      fire('pointerdown', x0, y0);
      let jStart = null;
      for (let i = 1; i <= 60; i++) {
        const t = performance.now();
        // 25. adımda tren sarsılır; parmak 20 ms sonra 25 px kayar, 170 ms içinde döner
        if (i === 25) jStart = t;
        let a = calm();
        if (jStart && t - jStart < 80) { const u = (t - jStart) / 80, pk = 5 * Math.sin(Math.PI * u); a = [a[0] + pk*0.8, a[1] + pk*0.6, a[2] + pk*0.3]; }
        V.feedMotion(t, a[0], a[1], a[2]);
        let dy = 0;
        if (jStart && t - jStart > 20 && t - jStart < 190) dy = 25 * Math.sin(Math.PI * (t - jStart - 20) / 170);
        fire('pointermove', x0 + i * 5, y0 + dy);
        await sleep(12);
      }
      fire('pointerup', x0 + 300, y0);
      await sleep(50);
      const st = V.page.strokes.at(-1), pts = V.C.decode(st.p), yp = V.toPage(0, y0 - r.top).y;
      return { j: st.j || 0, dev: Math.max(...pts.map(p => Math.abs(p.y - yp))), flashes: V.flashes.length, wins: V.meter.windows.length,
               toast: [...document.querySelectorAll('.toast .tx')].map(e => e.textContent), s: V.view.s };
    }""")
    page.wait_for_timeout(60)
    page.screenshot(path=f'{OUT}/05-jolt-fixed.png')
    check(V(page, 'window.__vagon.sensorOn'), 'yapay sensör açıldı')
    check(res['wins'] >= 1, f'sarsıntı penceresi açıldı ({res["wins"]})')
    check(res['j'] == 1, f'çizgide bir düzeltme var (j={res["j"]})')
    check(res['dev'] * res['s'] < 3, f'düzeltilmiş çizgi düz: en çok {res["dev"] * res["s"]:.1f} px sapma (ham: 25 px)')
    check(res['flashes'] >= 1 and any('Sarsıntı' in t for t in res['toast']), 'sarı iz ve "Sarsıntı düzeltildi" bildirimi')
    page.click('.toast.jolt button')
    page.wait_for_timeout(80)
    raw_dev = page.evaluate("""() => { const V = window.__vagon, r = document.getElementById('board').getBoundingClientRect();
      const st = V.page.strokes.at(-1), pts = V.C.decode(st.p), yp = V.toPage(0, r.height * 0.75).y;
      return Math.max(...pts.map(p => Math.abs(p.y - yp))) * V.view.s; }""")
    check(raw_dev > 18, f'"Geri al" ham çizgiyi geri getirdi ({raw_dev:.0f} px sapma)')
    V(page, 'window.__vagon.undo()')
    j_after = V(page, 'window.__vagon.page.strokes.at(-1).j || 0')
    check(j_after == 1 and strokes(page) == n0 + 1, 'geri al: düzeltilmiş çizgi geri geldi')

    print('Yolculuk ve duraklar')
    page.click('#trip-chip'); page.wait_for_timeout(100)
    page.select_option('#trip-from', '24')     # Göztepe
    page.click('#trip-dir button[data-dir="1"]')
    page.screenshot(path=f'{OUT}/06-trip-setup.png')
    page.click('#t-start'); page.wait_for_timeout(200)
    t_chip = page.text_content('#trip-t')
    npg = V(page, 'window.__vagon.pages.length')
    check(t_chip == 'Göztepe → Feneryolu', f'başlık: {t_chip}')
    check(V(page, 'window.__vagon.page.title') == 'Göztepe → Feneryolu' and npg == 2, f'çizgili sayfa kaldı, yeni sayfa açıldı ({npg} sayfa)')
    T.line(0, cx - 100, cy, cx + 100, cy + 50); page.wait_for_timeout(80)
    V(page, "window.__vagon.stopEvent('stop', performance.now())")
    page.wait_for_timeout(80)
    check(page.text_content('#trip-t') == 'Feneryolu', 'tren durdu: Feneryolu')
    check(V(page, 'window.__vagon.pages.length') == 2, 'durakta sayfa çevrilmedi (bitirmek için zaman)')
    V(page, "window.__vagon.stopEvent('go', performance.now())")
    page.wait_for_timeout(450)
    check(V(page, 'window.__vagon.page.title') == 'Feneryolu → Söğütlüçeşme' and V(page, 'window.__vagon.pages.length') == 3, 'tren kalktı: yeni sayfa Feneryolu → Söğütlüçeşme')
    page.screenshot(path=f'{OUT}/07-new-page.png')
    page.click('.toast.station button'); page.wait_for_timeout(450)
    check(V(page, 'window.__vagon.page.title') == 'Göztepe → Feneryolu' and V(page, 'window.__vagon.pages.length') == 2, '"Geri al" önceki sayfaya döndü')
    check(page.text_content('#trip-t') == 'Göztepe → Feneryolu', '"Geri al" yolculuğu da geri aldı (tünelde sinyal duruşu sanılan durak)')
    # elle: sonraki durak
    page.click('#trip-chip'); page.wait_for_timeout(80)
    nxt = page.text_content('#t-next')
    page.screenshot(path=f'{OUT}/08-trip-sheet.png')
    page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/08-trip-sheet.png')
    page.click('#t-next'); page.wait_for_timeout(450)
    check(V(page, 'window.__vagon.page.title') == 'Feneryolu → Söğütlüçeşme', f'elle sonraki durak ({nxt}) → {V(page, "window.__vagon.page.title")}')
    # elle geçtikten hemen sonra gelen otomatik "durdu" yok sayılır
    t_before = V(page, 'window.__vagon.page.title')
    V(page, "window.__vagon.stopEvent('stop', performance.now())")
    check(page.text_content('#trip-t') == t_before, 'elle geçtikten sonraki ilk otomatik duruş yok sayıldı')

    print('Silgi')
    n0 = strokes(page)
    T.line(0, cx - 100, cy + 150, cx + 100, cy + 150); page.wait_for_timeout(60)
    page.click('#b-eraser')
    T.line(0, cx, cy + 100, cx, cy + 200); page.wait_for_timeout(60)
    check(strokes(page) == n0, 'silgi çizgiyi sildi')
    V(page, 'window.__vagon.undo()')
    check(strokes(page) == n0 + 1, 'silme geri alındı')
    page.click('#b-pen')

    print('Kalem')
    page.click('#b-pen'); page.wait_for_timeout(80)
    page.screenshot(path=f'{OUT}/09-pen-sheet.png')
    page.click('#pen-colors .sw:nth-child(3)'); page.click('#pen-brushes button:nth-child(3)')
    page.mouse.click(195, 100)   # pencereyi kapat
    page.wait_for_timeout(80)
    T.line(0, cx - 120, cy - 100, cx + 120, cy - 40)
    st = V(page, 'window.__vagon.page.strokes.at(-1)')
    check(st['c'] == 2 and st['b'] == 2, 'kırmızı keçeli')

    print('Kayıt ve defter')
    page.wait_for_timeout(700)
    page.click('#b-book'); page.wait_for_timeout(600)
    cards = page.locator('.pg').count()
    check(cards == V(page, 'window.__vagon.pages.length'), f'defterde {cards} sayfa')
    info = page.text_content('#rec-info')
    check('çizgi' in info and not page.is_disabled('#rec-share'), 'kayıt hazır: ' + info[:60])
    page.screenshot(path=f'{OUT}/10-book.png')
    page.locator('.pg').first.click(); page.wait_for_timeout(500)
    check(V(page, "!!document.getElementById('sheet-page') && !document.getElementById('sheet-page').hidden"), 'sayfa menüsü açıldı')
    page.screenshot(path=f'{OUT}/11-page-menu.png')
    with page.expect_download() as dl:
        page.click('#pm-svg')
    svg_path = dl.value.path()
    svg = open(svg_path).read()
    check(svg.startswith('<svg') and '<path' in svg, 'SVG indirildi (' + dl.value.suggested_filename + ')')
    page.click('#pm-open'); page.wait_for_timeout(100)
    with page.expect_download() as dl2:
        page.click('#b-book'); page.wait_for_timeout(700); page.click('#rec-share')
    rec = json.load(open(dl2.value.path()))
    kinds = {}
    for r in rec['records']: kinds[r['k']] = kinds.get(r['k'], 0) + 1
    check(kinds.get('stroke', 0) >= 3 and kinds.get('station', 0) >= 2 and kinds.get('trip', 0) == 1, 'kayıt dosyası: ' + json.dumps(kinds))
    jr = [r for r in rec['records'] if r['k'] == 'stroke' and r['wins']]
    check(len(jr) >= 1 and len(jr[0]['mot']) > 20, f'sarsıntılı çizginin ivme verisi kayıtta ({len(jr[0]["mot"]) if jr else 0} örnek)')
    page.click('#book-x')

    print('Ayarlar ve kalıcılık')
    page.click('#b-set'); page.wait_for_timeout(100)
    page.screenshot(path=f'{OUT}/12-settings.png', full_page=False)
    page.click('[data-set=smooth] button[data-v="3"]')
    page.mouse.click(195, 60)
    total = sum(V(page, 'window.__vagon.pages.map(p => p.strokes.length)'))
    page.wait_for_timeout(600)
    page.reload(); page.wait_for_function('window.__vagon && window.__vagon.ready')
    page.wait_for_timeout(300)
    total2 = sum(V(page, 'window.__vagon.pages.map(p => p.strokes.length)'))
    check(total2 == total and V(page, 'window.__vagon.S.smooth') == 3, f'yenilenince çizgiler ({total2}) ve ayar kaldı')
    check(V(page, 'window.__vagon.trip && window.__vagon.trip.line') == 'marmaray', 'yolculuk sürüyor')
    check(not V(page, 'window.__vagon.dbMem()'), 'IndexedDB kullanılıyor')
    page.screenshot(path=f'{OUT}/13-reload.png')

    print('Yatay telefon')
    page.set_viewport_size({'width': 844, 'height': 390})
    page.wait_for_timeout(300)
    page.click('#modes button[data-mode=pad]')
    page.screenshot(path=f'{OUT}/14-landscape.png')
    check(V(page, 'window.__vagon.view.s') > 0.1, 'yatayda sayfa sığdı')

    print('iPad')
    page.set_viewport_size({'width': 820, 'height': 1180})
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/15-ipad.png')

    b.close()
srv.terminate()
print()
if errors: print('Konsol hataları:', errors)
print('KALDI: ' + '; '.join(fails) if fails else 'Hepsi geçti.')
sys.exit(1 if fails or errors else 0)
