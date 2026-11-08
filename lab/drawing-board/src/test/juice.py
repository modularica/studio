# Oyun hissi denemesi: kutlama, ONAY damgası, "New part unlocked!", NEW etiketleri, bölüm kartı rozetleri.
# Önce: node build.js --local /tmp/km-local.html  (görüntüler /tmp/km-shots/4x-*.png)
import json, os, time
from playwright.sync_api import sync_playwright

URL = 'file:///tmp/km-local.html'
OUT = '/tmp/km-shots'
os.makedirs(OUT, exist_ok=True)
errors, fails = [], []

LEVEL_IDS = None

def open_page(b, w, h, dpr=1, solved=0):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL); page.wait_for_timeout(400)
    if solved:
        page.evaluate("""(n) => { const progress = {}; KM_LEVELS.slice(0, n).forEach(L => { progress[L.id] = { solved: true, badges: { solve: true } }; });
            localStorage.setItem('drawing-board.v1', JSON.stringify({ progress, setups: {}, li: n })); }""", solved)
        page.reload(); page.wait_for_timeout(500)
    return page

def put(page, idx, parts=None):
    page.evaluate("""([idx, parts]) => { const G = KM_GAME; if (G.S.li !== idx) G.loadLevel(idx); G.S.parts = [];
        const sols = G.S.level.sol || [];
        const list = parts || (sols.length ? sols[0].parts : []);
        for (const p of list) G.addPlaced(Object.assign({ id: G.S.nextId++ }, { type: p.type, o: p.o, x: p.x, y: p.y, link: p.link == null ? null : p.link }));
        G.saveSetup(); G.refreshSide(); }""", [idx, parts])

def wait_for(page, js, timeout=15):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if page.evaluate(js):
            return True
        time.sleep(0.03)
    return False

def solve(page, idx, label, parts=None, keys=None, shots=()):
    put(page, idx, parts)
    page.click('#run')
    t0 = time.time()
    for (t, k) in (keys or []):
        page.wait_for_timeout(int(max(0, t - (time.time() - t0)) * 1000)); page.keyboard.press(k)
    if not wait_for(page, "KM_GAME.S.goalAt != null || !document.getElementById('result').hidden"):
        fails.append(f'{label}: kovaya girmedi'); return False
    for (ms, name) in shots:
        if ms < 0:
            page.wait_for_timeout(-ms); page.screenshot(path=f'{OUT}/{name}.png')
    if not wait_for(page, "!document.getElementById('result').hidden"):
        fails.append(f'{label}: sonuç açılmadı'); return False
    t1 = time.time()
    for (ms, name) in shots:
        if ms >= 0:
            page.wait_for_timeout(int(max(0, ms / 1000 - (time.time() - t1)) * 1000)); page.screenshot(path=f'{OUT}/{name}.png')
    info = page.evaluate("""() => ({ title: document.getElementById('result-title').textContent,
        unlock: document.getElementById('result-unlock').hidden ? null : document.getElementById('result-unlock').textContent.replace(/\\s+/g, ' ').trim(),
        stamps: [...document.querySelectorAll('#result-stamps .goal')].map(li => li.className) })""")
    print(label, json.dumps(info, ensure_ascii=False))
    return info

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    # Masaüstü: sıfırdan 1. ve 2. çizim
    page = open_page(b, 1366, 1024)
    page.mouse.click(5, 5)   # ilk dokunuş: ses açılır
    info = solve(page, 0, 'L1', parts=[{'type': 'ramp', 'o': 'dl', 'x': 6, 'y': 5}],
                 shots=[(-330, '40-kutlama-tahtada'), (480, '41-sonuc-damga'), (2700, '42-sonuc-yeni-parca')])
    if info and (not info['unlock'] or 'Spring' not in info['unlock']): fails.append('L1: Spring açılmadı')
    audio = page.evaluate("({ playing: KM_AUDIO.state.playing, mode: KM_AUDIO.state.want, song: KM_AUDIO.state.song.id })")
    print('müzik:', audio)
    page.click('#btn-next'); page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/43-yeni-parca-listede.png')
    if not page.locator('.bom-row.is-new').count(): fails.append('L2: listede New yok')
    info = solve(page, 1, 'L2', parts=[{'type': 'spring', 'o': 'u', 'x': 5, 'y': 0}])
    if info and (not info['unlock'] or 'Piston' not in info['unlock']): fails.append('L2: Piston açılmadı')
    page.click('#btn-next'); page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/44-yeni-parca-tahtada.png')
    page.click('#btn-levels'); page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/45-bolumler-yeni.png')
    chips = page.evaluate("[...document.querySelectorAll('.new-chip')].map(e => e.textContent)")
    print('kart rozetleri:', chips)
    page.click('#levels-close')
    print('müzik:', page.evaluate("({ playing: KM_AUDIO.state.playing, mode: KM_AUDIO.state.want, song: KM_AUDIO.state.song.id, next: KM_AUDIO.state.next && KM_AUDIO.state.next.id })"))
    # Tekrar çözüm: yeni damga yoksa başlık değişir, yenilik çıkmaz.
    page.context.close()

    page = open_page(b, 1366, 1024, solved=10)
    info = solve(page, 10, 'L11 → çelik bilye', shots=[(2800, '46-celik-bilye')])
    if info and (not info['unlock'] or 'Steel ball' not in info['unlock']): fails.append('L11: çelik bilye açılmadı')
    page.context.close()
    page = open_page(b, 1366, 1024, solved=13)
    info = solve(page, 13, 'L14 → defter 2', shots=[(3000, '47-defter-2')])
    if info and (not info['unlock'] or 'Notebook 2' not in info['unlock']): fails.append('L14: defter 2 açılmadı')
    page.context.close()
    page = open_page(b, 1366, 1024, solved=14)
    info = solve(page, 14, 'L15 → bayraklı kova', parts=[], keys=[(4.0, '1')], shots=[(2800, '48-bayrakli-kova')])
    if info and (not info['unlock'] or 'Flag cups' not in info['unlock']): fails.append('L15: bayraklı kova açılmadı')
    # Aynı çizimi yeniden çöz: yenilik çıkmamalı
    page.click('#btn-retry'); page.wait_for_timeout(200)
    info = solve(page, 14, 'L15 tekrar', parts=[], keys=[(4.0, '1')])
    if info and info['unlock']: fails.append('L15 tekrar: yenilik yine çıktı')
    page.context.close()

    # Telefon: dikey ve yatay sonuç kartı
    for (w, h, name) in [(390, 844, '49-telefon-dikey'), (844, 390, '50-telefon-yatay')]:
        page = open_page(b, w, h, 3)
        page.screenshot(path=f'{OUT}/{name}-antet.png')
        solve(page, 0, name, parts=[{'type': 'ramp', 'o': 'dl', 'x': 6, 'y': 5}], shots=[(2800, f'{name}-sonuc')])
        page.context.close()
    b.close()
print('hatalar:', errors or 'yok')
print('sorunlar:', fails or 'yok')
