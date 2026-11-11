# Tarayıcıda uçtan uca deneme: telefonda bota karşı, 3 harfte fiil kökü (GEL), iPad'de (dik ve yatay) iki kişi, dil (Türkçe açılış, İngilizce seçimi), nasıl oynanır.
# Önce:  node lab/kelime-tenisi/src/build.js /tmp/kt/kt.html
# Sonra: python3 lab/kelime-tenisi/src/test/browser.py      (görüntüler /tmp/kt-shots/)
import json, os, random, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT, OUT, PORT = '/tmp/kt', '/tmp/kt-shots', 8772
ROOTS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools', 'stats.json'), encoding='utf-8'))['tr-roots']
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
  return { phase: m.phase, starter: m.starter, turn: m.point ? m.point.turn : -1, word: m.point ? m.point.word : null,
           points: m.points.slice(), target: m.target, busy: G.pointBusy, mode: G.mode, shots: m.point ? m.point.shots.length : 0,
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
        key = (s['phase'], s['turn'], s['shots'], tuple(s['points']))
        if not s['busy'] and key != acted:
            if s['phase'] == 'start' and s['starter'] in humans and pg.is_visible(f'#panel{s["starter"]} .start-card'):
                acted = key
                tap(pg, f'#panel{s["starter"]} .start-card >> nth={rnd.randrange(3)}', touch)
            elif s['phase'] == 'rally' and s['turn'] in humans and s['running']:
                acted = key
                if rnd.random() >= miss_rate:
                    if play_turn(pg, s['turn'], touch, smash=rnd.random() < smash_rate): shots += 1
        time.sleep(0.08)
    return False

# Same random start words and bot moves on every run.
SEEDED = """(() => { let a = 7; Math.random = function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();"""

def new_page(b, vp, touch, mobile, init='', locale='tr-TR'):
    ctx = b.new_context(viewport=vp, device_scale_factor=2, has_touch=touch, is_mobile=mobile, locale=locale)
    ctx.add_init_script(SEEDED)
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
    check(s['mode'] == 'bot' and s['starter'] == 0 and s['phase'] == 'start', 'maç başladı, ilk kelimeyi oyuncu seçiyor')
    check(s['target'] == 5, 'kısa maç 5 sayı')
    check(pg.evaluate("(() => { const l = __kt.lexFor('tr', 4); return l.has('anla') && l.has('otur') && !l.has('evde') && !l.has('aldı') && !l.has('bana'); })()"),
          'fiil kökleri geçiyor (ANLA, OTUR), ekli haller geçmiyor (EVDE, ALDI, BANA)')
    check(pg.locator('#panel0 .start-card').count() == 3, 'üç başlangıç kelimesi')
    check(pg.locator('#board .net, #board .ball, .court').count() == 0, 'kort, file, top yok')
    pg.tap('#panel0 .start-card >> nth=0')
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
    # (ASCII letters only: Playwright types ç, ş, ı... as text input, without key events)
    w = pg.evaluate("""(() => { const G = __kt.G, m = G.m;
      return G.lex.neighbours(m.point.word, m.point.used).find(x => /^[a-z]+$/.test(x) && G.lex.neighbours(x, new Set([...m.point.used, x])).length) || null; })()""")
    if w:
        pg.keyboard.type(w)
        pg.wait_for_timeout(200)
        check(st(pg)['word'] == w, 'klavyeden kelime yazılıyor: ' + w.upper())
    else:
        print('  (klavye denemesi atlandı: harfleri hep ASCII olan dönüş yok)')
    pg.evaluate('__kt.speed = 4')
    done = play_match(pg, True, {0}, tag='phone')
    check(done, 'bota karşı maç bitti')
    pg.wait_for_timeout(400)
    pg.screenshot(path=f'{OUT}/phone-end.png')
    save = pg.evaluate("JSON.parse(localStorage.getItem('kelime-tenisi.v1'))")
    check(save and save['bot']['kolay']['w'] + save['bot']['kolay']['l'] == 1, 'sonuç kaydedildi (kelime-tenisi.v1)')
    check(save['longest'] >= 2 and len(save['longestWords']) == save['longest'], 'en uzun zincir kaydedildi')
    pg.tap('#againBtn')
    pg.wait_for_timeout(300)
    check(st(pg)['phase'] == 'start' and st(pg)['points'] == [0, 0], 'rövanş yeni maç açıyor')
    pg.tap('#pauseBtn'); pg.tap('#quitBtn')
    check(pg.is_visible('#menu') and 'Bota karşı' in pg.inner_text('#record'), 'ana menüde rekor satırı')
    ctx.close()

    print('Telefon · 3 harf, fiil kökü')
    # a device that saved the 11 Nov "inflected words count" setting
    ctx, pg = new_page(b, {'width': 390, 'height': 844}, True, True, "localStorage.setItem('kelime-tenisi.device', JSON.stringify({seenHow:true, mode:'bot', level:'kolay', len:3, ekli:true}))")
    check(pg.locator('[data-set=ekli]').count() == 0, 'menüde ekli kelime ayarı yok')
    pg.tap('#startBtn')
    pg.wait_for_function('__kt.G.m.phase === "start" && document.querySelector("#panel0 .start-card")', timeout=8000)
    check(not pg.evaluate("__kt.G.lex.has('eve') || __kt.G.lex.has('evi')"), 'eski ayarlı cihazda da EVE, EVİ geçmiyor')
    pg.evaluate('__kt.speed = 2')
    found = False
    for _ in range(120):
        s = st(pg)
        if s['phase'] == 'matchOver':
            break
        if not s['busy'] and s['phase'] == 'start' and s['starter'] == 0 and pg.is_visible('#panel0 .start-card'):
            pg.tap('#panel0 .start-card >> nth=0')
        elif not s['busy'] and s['phase'] == 'rally' and s['turn'] == 0 and s['running']:
            r = pg.evaluate("""(roots) => { const G = __kt.G, m = G.m;
              const w = G.lex.neighbours(m.point.word, m.point.used, true).find(x => roots.includes(x));
              return w ? { w, at: G.lex.diff(m.point.word, w) } : null; }""", ROOTS['3'].split())
            if r:
                pg.tap(f'#panel0 .tiles .tile >> nth={r["at"]}')
                pg.tap(f'#panel0 .key[data-k="{r["w"][r["at"]]}"]')
                pg.wait_for_timeout(150)
                check(st(pg)['word'] == r['w'], f'fiil kökü geçti: {st(pg)["word"].upper()}')
                pg.screenshot(path=f'{OUT}/phone-root.png')
                found = True
                break
            play_turn(pg, 0, True)
        pg.wait_for_timeout(200)
    check(found, 'fiil kökü denendi')
    ctx.close()

    print('iPad dik · iki kişi')
    ctx, pg = new_page(b, {'width': 820, 'height': 1180}, True, False, "localStorage.setItem('kelime-tenisi.device', JSON.stringify({seenHow:true, mode:'duo', names:['Umut','Eşi']}))")
    pg.tap('#startBtn')
    pg.wait_for_function('__kt.G.m.phase === "start" && document.querySelector(".start-card")', timeout=8000)
    tr = pg.evaluate("getComputedStyle(document.getElementById('panel1')).transform")
    check(tr not in ('none', '') and tr.startswith('matrix(-1'), 'üst oyuncunun yarısı ters çevrili')
    pg.screenshot(path=f'{OUT}/ipad-start.png')
    pg.evaluate('__kt.speed = 3')
    done = play_match(pg, True, {0, 1}, tag='ipad')
    check(done, 'iki kişilik maç bitti')
    pg.wait_for_timeout(500)
    check(pg.is_visible('#endMirror'), 'üstteki oyuncu için ters sonuç kartı')
    check(max(st(pg)['points']) == 5, 'kısa maç 5 sayıda bitti: %s' % st(pg)['points'])
    pg.screenshot(path=f'{OUT}/ipad-end.png')
    ctx.close()

    print('iPad yatay · iki kişi, uzun maç')
    ctx, pg = new_page(b, {'width': 1180, 'height': 820}, True, False, "localStorage.setItem('kelime-tenisi.device', JSON.stringify({seenHow:true, mode:'duo', format:2}))")
    pg.tap('#startBtn')
    pg.wait_for_function('__kt.G.m.phase === "start" && document.querySelector(".start-card")', timeout=8000)
    pg.evaluate('__kt.speed = 3')
    # lose a point on time and check the hint list does not cover the tiles
    s = st(pg)
    pg.tap(f'#panel{s["starter"]} .start-card >> nth=0')
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
    done = play_match(pg, True, {0, 1}, max_s=420, tag='ipadL')
    check(done, 'uzun maç bitti')
    pts = st(pg)['points']
    check(max(pts) == 9, 'uzun maç 9 sayıda bitti: %s' % pts)
    pg.screenshot(path=f'{OUT}/ipadL-end.png')
    ctx.close()

    print('Dil · İngilizce cihazda Türkçe açılış, sonra İngilizce')
    ctx, pg = new_page(b, {'width': 1280, 'height': 800}, False, False, locale='en-US')
    check(pg.evaluate('navigator.language') == 'en-US' and pg.inner_text('h1') == 'Kelime Düellosu', 'İngilizce cihazda ilk açılış Türkçe')
    check('Nasıl oynanır' in pg.inner_text('#howSheet h2'), '"Nasıl oynanır?" Türkçe')
    pg.click('#howOk')
    pg.reload(); pg.wait_for_timeout(300)
    check(pg.inner_text('h1') == 'Kelime Düellosu', 'yeniden açınca yine Türkçe')
    # a device that saved 'en' before this change (language came from navigator.language)
    pg.evaluate("localStorage.setItem('kelime-tenisi.device', JSON.stringify({seenHow:true, mode:'bot', level:'zor', lang:'en'}))")
    pg.reload(); pg.wait_for_timeout(300)
    check(pg.inner_text('h1') == 'Kelime Düellosu', "eskiden 'en' kaydetmiş cihaz Türkçe açılıyor")
    pg.click('[data-lang=en]')
    check(pg.inner_text('h1') == 'Word Duel', 'English seçilince İngilizce')
    pg.reload(); pg.wait_for_timeout(300)
    check(pg.inner_text('h1') == 'Word Duel', 'seçilen dil hatırlanıyor')
    pg.click('#startBtn')
    pg.wait_for_timeout(300)
    check(pg.locator('#panel0 .key').count() == 26, 'İngilizce klavye 26 harf')
    pg.click('#panel0 .start-card >> nth=0')
    pg.wait_for_function('__kt.G.m.phase !== "start" && !__kt.G.pointBusy', timeout=8000)
    pg.screenshot(path=f'{OUT}/desk-en.png')
    ctx.close()
    b.close()

srv.terminate()
for e in errors: print('  ! ' + e)
if errors: fails.append('console errors')
print('\n' + ('HEPSİ GEÇTİ' if not fails else 'KALANLAR: ' + '; '.join(fails)))
sys.exit(1 if fails else 0)
