# Tarayıcıda uçtan uca deneme: telefonda bota karşı, iPad'de (dik ve yatay) iki kişi, İngilizce, nasıl oynanır.
# Önce:  node lab/kelime-tenisi/src/build.js /tmp/kt/kt.html
# Sonra: python3 lab/kelime-tenisi/src/test/browser.py      (görüntüler /tmp/kt-shots/)
import os, random, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT, OUT, PORT = '/tmp/kt', '/tmp/kt-shots', 8772
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.6)
URL = f'http://127.0.0.1:{PORT}/kt.html'
errors, fails = [], []
rnd = random.Random(7)

def check(cond, msg):
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: fails.append(msg)

STATE = """(() => { const G = __kt.G; if (!G) return null; const m = G.m;
  return { phase: m.phase, server: m.server, turn: m.point ? m.point.turn : -1, word: m.point ? m.point.word : null,
           points: m.points.slice(), games: m.games.slice(), busy: G.pointBusy, mode: G.mode, shots: m.point ? m.point.shots.length : 0,
           left: G.clock.left, running: G.clock.running, bot: G.bots.map(b => !!b) }; })()"""

REPLY = """((smash) => { const G = __kt.G, m = G.m, lex = G.lex, used = m.point.used;
  const opts = lex.neighbours(m.point.word, used, true);
  if (!opts.length) return null;
  const left = w => lex.neighbours(w, new Set([...used, w])).length;
  let w = smash ? opts.find(x => left(x) === 0) : null;
  if (!w) w = opts.find(x => left(x) > 0) || opts[0];
  return { w, at: lex.diff(m.point.word, w) }; })"""

def st(pg): return pg.evaluate(STATE)

def tap(pg, sel, touch):
    if touch: pg.tap(sel)
    else: pg.click(sel)

def play_turn(pg, i, touch, smash=False):
    r = pg.evaluate(REPLY + f'({str(smash).lower()})')
    if not r: return False
    tap(pg, f'#panel{i} .tiles .tile >> nth={r["at"]}', touch)
    tap(pg, f'#panel{i} .key[data-k="{r["w"][r["at"]]}"]', touch)
    return True

def play_match(pg, touch, humans, max_s=240, miss_rate=0.18, smash_rate=0.3, tag=''):
    t0 = time.time(); acted = None
    shots = 0
    while time.time() - t0 < max_s:
        s = st(pg)
        if s is None: return False
        if s['phase'] == 'matchOver' and pg.is_visible('#endSheet'): return True
        key = (s['phase'], s['turn'], s['shots'], tuple(s['points']), tuple(s['games']))
        if not s['busy'] and key != acted:
            if s['phase'] == 'serve' and s['server'] in humans and pg.is_visible(f'#panel{s["server"]} .serve-card'):
                acted = key
                tap(pg, f'#panel{s["server"]} .serve-card >> nth={rnd.randrange(3)}', touch)
            elif s['phase'] == 'rally' and s['turn'] in humans and s['running']:
                acted = key
                if rnd.random() >= miss_rate:
                    if play_turn(pg, s['turn'], touch, smash=rnd.random() < smash_rate): shots += 1
        time.sleep(0.08)
    return False

def new_page(b, vp, touch, mobile, init=''):
    ctx = b.new_context(viewport=vp, device_scale_factor=2, has_touch=touch, is_mobile=mobile, locale='tr-TR')
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(f'console {m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.add_init_script("localStorage.setItem('kelime-tenisi.debug','1');" + init)
    pg.goto(URL)
    pg.wait_for_timeout(400)
    return ctx, pg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])

    print('Telefon · bota karşı')
    ctx, pg = new_page(b, {'width': 390, 'height': 844}, True, True)
    check(pg.is_visible('#howSheet'), 'ilk açılışta "Nasıl oynanır?" açılıyor')
    pg.wait_for_timeout(1000)
    pg.screenshot(path=f'{OUT}/how.png')
    pg.tap('#howOk')
    check(not pg.is_visible('#howSheet'), 'Anladım kapatıyor')
    pg.tap('.mode[data-mode=bot]')
    pg.tap('[data-set=level] .chip[data-v=kolay]')
    pg.screenshot(path=f'{OUT}/phone-menu.png')
    pg.tap('#startBtn')
    pg.wait_for_timeout(300)
    s = st(pg)
    check(s['mode'] == 'bot' and s['server'] == 0 and s['phase'] == 'serve', 'maç başladı, servis oyuncuda')
    check(pg.locator('#panel0 .serve-card').count() == 3, 'üç servis kelimesi')
    pg.tap('#panel0 .serve-card >> nth=0')
    pg.wait_for_function('__kt.G.m.phase === "rally" && !__kt.G.pointBusy && __kt.G.m.point.turn === 0', timeout=20000)
    pg.screenshot(path=f'{OUT}/phone-turn.png')
    w = st(pg)['word']
    # errors: unknown word and used word
    pg.tap('#panel0 .tiles .tile >> nth=0')
    bad = pg.evaluate("""(() => { const G = __kt.G, w = G.m.point.word; for (const c of G.lex.alpha) { const x = c + w.slice(1); if (x !== w && !G.lex.has(x)) return c; } return null; })()""")
    pg.tap(f'#panel0 .key[data-k="{bad}"]')
    pg.wait_for_timeout(120)
    check('sözlükte yok' in pg.inner_text('#panel0 .msg'), 'sözlükte olmayan kelime reddediliyor')
    check(st(pg)['word'] == w and st(pg)['turn'] == 0, 'hatalı denemede sıra değişmiyor')
    pg.screenshot(path=f'{OUT}/phone-error.png')
    # pause stops the clock
    left = st(pg)['left']
    pg.tap('#pauseBtn')
    pg.wait_for_timeout(700)
    check(pg.is_visible('#pauseSheet') and abs(st(pg)['left'] - left) < 0.15, 'mola saati durduruyor')
    pg.tap('#resumeBtn')
    # physical keyboard: type a whole word
    r = pg.evaluate(REPLY + '(false)')
    pg.keyboard.type(r['w'])
    pg.wait_for_timeout(200)
    s = st(pg)
    check(s['word'] == r['w'], 'klavyeden kelime yazılıyor: ' + r['w'].upper())
    pg.evaluate('__kt.speed = 4')
    done = play_match(pg, True, {0}, tag='phone')
    check(done, 'bota karşı maç bitti')
    pg.wait_for_timeout(400)
    pg.screenshot(path=f'{OUT}/phone-end.png')
    save = pg.evaluate("JSON.parse(localStorage.getItem('kelime-tenisi.v1'))")
    check(save and save['bot']['kolay']['w'] + save['bot']['kolay']['l'] == 1, 'sonuç kaydedildi (kelime-tenisi.v1)')
    check(save['longest'] >= 2 and len(save['longestWords']) == save['longest'], 'en uzun ralli kaydedildi')
    pg.tap('#againBtn')
    pg.wait_for_timeout(300)
    check(st(pg)['phase'] == 'serve' and st(pg)['points'] == [0, 0], 'rövanş yeni maç açıyor')
    pg.tap('#pauseBtn'); pg.tap('#quitBtn')
    check(pg.is_visible('#menu') and 'Bota karşı' in pg.inner_text('#record'), 'ana menüde rekor satırı')
    ctx.close()

    print('iPad dik · iki kişi')
    ctx, pg = new_page(b, {'width': 820, 'height': 1180}, True, False, "localStorage.setItem('kelime-tenisi.device', JSON.stringify({seenHow:true, mode:'duo', names:['Umut','Eşi']}))")
    pg.tap('#startBtn')
    pg.wait_for_function('__kt.G.m.phase === "serve" && document.querySelector(".serve-card")', timeout=8000)
    tr = pg.evaluate("getComputedStyle(document.getElementById('panel1')).transform")
    check(tr not in ('none', '') and tr.startswith('matrix(-1'), 'üst oyuncunun yarısı ters çevrili')
    pg.screenshot(path=f'{OUT}/ipad-serve.png')
    pg.evaluate('__kt.speed = 3')
    done = play_match(pg, True, {0, 1}, tag='ipad')
    check(done, 'iki kişilik maç bitti')
    pg.wait_for_timeout(500)
    check(pg.is_visible('#endMirror'), 'üstteki oyuncu için ters sonuç kartı')
    pg.screenshot(path=f'{OUT}/ipad-end.png')
    ctx.close()

    print('iPad yatay · iki kişi, uzun maç')
    ctx, pg = new_page(b, {'width': 1180, 'height': 820}, True, False, "localStorage.setItem('kelime-tenisi.device', JSON.stringify({seenHow:true, mode:'duo', format:2}))")
    pg.tap('#startBtn')
    pg.wait_for_function('__kt.G.m.phase === "serve" && document.querySelector(".serve-card")', timeout=8000)
    pg.evaluate('__kt.speed = 3')
    # lose a point on time and check the hint list does not cover the tiles
    s = st(pg)
    pg.tap(f'#panel{s["server"]} .serve-card >> nth=0')
    pg.wait_for_function('__kt.G.m.phase === "rally" && !__kt.G.pointBusy', timeout=8000)
    loser = st(pg)['turn']
    pg.evaluate('__kt.timeout()')
    pg.wait_for_function('__kt.G.m.phase === "pointOver"', timeout=8000)
    pg.wait_for_timeout(500)
    m, tl = pg.evaluate(f"""(() => {{ const p = document.getElementById('panel{loser}'); const a = p.querySelector('.msg').getBoundingClientRect(), b = p.querySelector('.tiles').getBoundingClientRect(); return [[a.top, a.bottom], [b.top, b.bottom]]; }})()""")
    check(m[1] <= tl[0] + 1 or tl[1] <= m[0] + 1, 'ipucu satırı harflerin üstüne binmiyor')
    keys_ok = pg.evaluate("""[...document.querySelectorAll('.key')].every(k => { const r = k.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })""")
    check(keys_ok, 'bütün tuşlar ekranda')
    pg.screenshot(path=f'{OUT}/ipadL-point.png')
    done = play_match(pg, True, {0, 1}, max_s=300, tag='ipadL')
    check(done, "3'te 2 maç bitti")
    games = st(pg)['games']
    check(max(games) == 2, 'oyunlar: %s' % games)
    pg.screenshot(path=f'{OUT}/ipadL-end.png')
    ctx.close()

    print('İngilizce · masaüstü')
    ctx, pg = new_page(b, {'width': 1280, 'height': 800}, False, False, "localStorage.setItem('kelime-tenisi.device', JSON.stringify({seenHow:true, mode:'bot', level:'zor'}))")
    pg.click('[data-lang=en]')
    check(pg.inner_text('h1') == 'Word Tennis', 'İngilizce başlık')
    pg.click('#startBtn')
    pg.wait_for_timeout(300)
    check(pg.locator('#panel0 .key').count() == 26, 'İngilizce klavye 26 harf')
    pg.click('#panel0 .serve-card >> nth=0')
    pg.wait_for_function('__kt.G.m.phase !== "serve" && !__kt.G.pointBusy', timeout=8000)
    pg.screenshot(path=f'{OUT}/desk-en.png')
    ctx.close()
    b.close()

srv.terminate()
for e in errors: print('  ! ' + e)
if errors: fails.append('console errors')
print('\n' + ('HEPSİ GEÇTİ' if not fails else 'KALANLAR: ' + '; '.join(fails)))
sys.exit(1 if fails else 0)
