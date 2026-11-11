# İki telefondan oyun denemesi: iki tarayıcı, yerel oda sunucusu, hesap yerine taklit (Hesap).
# Oda kurma, menüdeki "Açık odalar"dan linksiz katılma, davet linki, iki telefonda aynı maç, süre biterse sayı, bağlantı kopunca yetişme,
# sayfa yeniden açılınca maçın kaldığı yerden sürmesi, maç sonu sonuç ekranı ve rövanş, saat modu (aynı süreler,
# sayıyı verme, süresi biten kaybeder), uzat/kısalt (iki telefonda aynı kelime ve haklar).
# Önce:  node lab/kelime-tenisi/src/build.js /tmp/kt/kt.html
#        cd fish/sunucu && npx wrangler dev --var AUTH_YOK:1 --port 8787 --ip 127.0.0.1
# Sonra: python3 lab/kelime-tenisi/src/test/online.py      (görüntüler /tmp/kt-shots/)
import os, random, shutil, subprocess, sys, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
ROOT, OUT, PORT = '/tmp/kt', '/tmp/kt-shots', 8773
os.makedirs(OUT, exist_ok=True)
os.makedirs(f'{ROOT}/hesap', exist_ok=True)
shutil.copy(f'{REPO}/hesap/oda.js', f'{ROOT}/hesap/oda.js')
html = open(f'{ROOT}/kt.html', encoding='utf-8').read()
open(f'{ROOT}/online.html', 'w', encoding='utf-8').write(html.replace('</head>', '<script src="/hesap/oda.js"></script>\n</head>', 1))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.6)
URL = f'http://127.0.0.1:{PORT}/online.html'
errors, fails = [], []
rnd = random.Random(11)

def check(cond, msg):
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: fails.append(msg)

# A signed-in Lab player, without Supabase. Sockets are kept so a test can drop the connection.
def hesap(pid, ad, renk):
    return f"""
      localStorage.setItem('kelime-tenisi.debug', '1');
      localStorage.setItem('kelime-tenisi.device', JSON.stringify({{ seenHow: true }}));
      localStorage.setItem('oda.sunucu', 'ws://127.0.0.1:8787');
      (() => {{ const profil = {{ id: '{pid}', name: '{ad}', color: '{renk}' }};
        window.Hesap = {{ profil, hazir: Promise.resolve({{ profil }}), anahtar: () => Promise.resolve('test-token-0123456789abcdef'),
          not() {{}}, skor() {{ return Promise.resolve(); }}, nasildi() {{}} }}; }})();
      (() => {{ const W = window.WebSocket; window.__ws = []; window.__wslog = [];
        window.WebSocket = function (u, p) {{ const s = p ? new W(u, p) : new W(u); window.__ws.push(s); s.addEventListener('message', e => {{ try {{ const m = JSON.parse(e.data); if (m.t !== 's') window.__wslog.push([m.t, m.durum || m.neden || '', m.tur || '', m.no || '', JSON.stringify(m.e || '')]); }} catch (_) {{}} }}); return s; }};
        window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, {{ OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 }}); }})();"""

STATE = """(() => { const G = __kt.G; if (!G || G.mode !== 'online') return null; const m = G.m;
  return { phase: m.phase, starter: m.starter, turn: m.point ? m.point.turn : -1, word: m.point ? m.point.word : null,
           shots: m.point ? m.point.shots.map(s => s.word) : [], points: m.points.slice(), target: m.target, busy: G.pointBusy,
           stage: G.stage, done: G.net.done, over: G.over, running: G.clock.running, owner: G.clock.owner,
           me: G.net.me.ad, opp: G.net.opp.ad, len: G.lex.len, lang: G.lex.lang }; })()"""
REPLY = """((smash) => { const G = __kt.G, m = G.m, lex = G.lex, used = m.point.used;
  const opts = lex.neighbours(m.point.word, used, true);
  if (!opts.length) return null;
  const left = x => lex.neighbours(x, new Set([...used, x])).length;
  let w = smash ? opts.slice().sort((a, b) => left(a) - left(b))[0] : null;
  if (!w) w = opts.find(x => left(x) > 0) || opts[0];
  return { w, at: lex.diff(m.point.word, w) }; })"""

def st(pg): return pg.evaluate(STATE)
def room(pg): return pg.locator('[data-oda]')   # the room's sheet (hesap/oda.js, shadow DOM)

def act(pg, miss=False, smash=0.0):
    """One move on this phone if it is its turn. Returns what it did."""
    s = st(pg)
    if not s or s['busy'] or s['over']: return None
    if s['phase'] == 'start' and s['starter'] == 0 and s['stage'] == 'start' and pg.is_visible('#panel0 .start-card'):
        pg.tap(f'#panel0 .start-card >> nth={rnd.randrange(3)}')
        return 'start'
    if s['phase'] == 'rally' and s['turn'] == 0 and s['stage'] == 'turn' and s['running']:
        if miss: return 'wait'
        r = pg.evaluate(REPLY + '(' + ('true' if rnd.random() < smash else 'false') + ')')
        if not r: return 'wait'
        try:
            pg.tap(f'#panel0 .tiles .tile >> nth={r["at"]}', timeout=3000)
            pg.tap(f'#panel0 .key[data-k="{r["w"][r["at"]]}"]', timeout=3000)
        except Exception as e:
            now = st(pg)
            if not now or now['phase'] != 'rally' or now['turn'] != 0 or now['word'] != s['word']:
                return None   # the clock ran out while tapping: the point went on without this word
            pg.screenshot(path=f'{OUT}/online-stuck.png')
            txt = pg.evaluate("(() => { const h = document.querySelector('[data-oda]'); return h ? h.shadowRoot.textContent.slice(-300) : ''; })()")
            raise RuntimeError(f'tap failed; state {st(pg)}; room: {txt}; log: {pg.evaluate("window.__wslog.slice(-12)")}') from e
        return 'shot'
    return None

def same(a, b):
    """Both phones see the same match (each from its own side)."""
    x, y = st(a), st(b)
    if not x or not y: return False, (x, y)
    ok = x['points'] == y['points'][::-1] and x['done'] == y['done'] and x['phase'] == y['phase']
    if ok and x['phase'] == 'rally': ok = x['word'] == y['word'] and x['shots'] == y['shots'] and x['turn'] == 1 - y['turn']
    return ok, (x, y)

def settle(a, b, secs=6):
    t0 = time.time()
    while time.time() - t0 < secs:
        ok, _ = same(a, b)
        if ok: return True
        time.sleep(0.15)
    return False

def play(a, b, until, max_s=120, miss_a=0.0, smash=0.0):
    """Both phones play until until(sa, sb) is true."""
    t0 = time.time()
    while time.time() - t0 < max_s:
        sa, sb = st(a), st(b)
        if until(sa, sb): return True
        act(a, miss=rnd.random() < miss_a, smash=smash)
        act(b, smash=smash)
        time.sleep(0.12)
    return False

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
    def phone(pid, ad, renk, url=URL):
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, locale='tr-TR')
        ctx.add_init_script(hesap(pid, ad, renk))
        pg = ctx.new_page()
        pg.on('console', lambda m: errors.append(f'{ad} console {m.type}: {m.text}') if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append(f'{ad} pageerror: {e}'))
        pg.goto(url)
        pg.wait_for_timeout(500)
        return ctx, pg

    print('Oda kurma, menüde açık odalar')
    ca, A = phone('11111111-1111-4111-8111-111111111111', 'Umut', '#2f6fd6')
    check(A.is_visible('#onlineBtn'), 'menüde "İki telefondan" düğmesi var')
    # Zeynep opens the game first, without a link
    cb, B = phone('22222222-2222-4222-8222-222222222222', 'Zeynep', '#d94f8a')
    B.wait_for_selector('#rooms:not([hidden])', timeout=8000)
    check('açık oda yok' in B.inner_text('#roomList'), 'menüde "Açık odalar": şu an açık oda yok')
    A.screenshot(path=f'{OUT}/online-menu.png')
    A.tap('#onlineBtn')
    room(A).get_by_role('button', name='Oda kur').tap()
    A.wait_for_function('__kt.oda && __kt.oda.id && __kt.oda.ben', timeout=8000)
    A.wait_for_timeout(400)
    start = room(A).get_by_role('button', name='Oyunu başlat')
    check(start.is_disabled(), 'tek başınayken "Oyunu başlat" kapalı')
    # the host picks 3 letters, fast
    room(A).get_by_role('button', name='3 harf').tap()
    room(A).get_by_role('button', name='Rahat').tap()
    oda_id = A.evaluate('__kt.oda.id')
    # the room shows up on Zeynep's menu by itself, with the host's settings
    B.wait_for_function("document.querySelector('#roomList').textContent.includes(\"Umut'un odası\") && document.querySelector('#roomList').textContent.includes('3 harf')", timeout=10000)
    check('rakip bekliyor' in B.inner_text('#roomList') and B.is_enabled(f'#roomList [data-room="{oda_id}"]'), 'Zeynep\'in menüsünde Umut\'un odası kendiliğinden çıktı: rakip bekliyor, 3 harf, Katıl')
    B.screenshot(path=f'{OUT}/online-rooms.png')
    B.tap(f'#roomList [data-room="{oda_id}"]')
    B.wait_for_function('__kt.oda && __kt.oda.ben', timeout=8000)
    check(B.evaluate('__kt.oda.id') == oda_id, 'Katıl ile linksiz odaya girdi')
    A.wait_for_function("() => { const h = document.querySelector('[data-oda]'); return h && h.shadowRoot.textContent.includes('Zeynep'); }", timeout=8000)
    A.screenshot(path=f'{OUT}/online-wait.png')
    check(not start.is_disabled(), 'Zeynep gelince "Oyunu başlat" açılıyor')
    start.tap()
    A.wait_for_function("__kt.G && __kt.G.mode === 'online'", timeout=8000)
    B.wait_for_function("__kt.G && __kt.G.mode === 'online'", timeout=8000)
    sa, sb = st(A), st(B)
    check(sa['me'] == 'Umut' and sa['opp'] == 'Zeynep' and sb['me'] == 'Zeynep' and sb['opp'] == 'Umut', 'iki telefonda adlar doğru')
    check(sa['len'] == 3 and sb['len'] == 3 and sa['lang'] == sb['lang'] == 'tr', 'kurucunun seçtiği kelime boyu iki telefonda da: 3 harf')
    check(sa['starter'] == 1 - sb['starter'], 'başlayan iki telefonda aynı kişi')
    for pg in (A, B): pg.evaluate('__kt.speed = 2')

    print('Aynı maç, iki telefon')
    check(play(A, B, lambda a, b: a and b and a['done'] >= 6 and a['phase'] == 'rally'), 'birkaç kelime gidip geldi')
    check(settle(A, B), 'iki telefon aynı durumda (kelime, zincir, sıra, sayılar)')
    A.screenshot(path=f'{OUT}/online-A.png'); B.screenshot(path=f'{OUT}/online-B.png')

    print('Süre bitince sayı')
    before = st(A)['points'][:]
    # A stops answering: its own clock runs out and B gets the point on both phones
    ok = play(A, B, lambda a, b: a and b and sum(a['points']) > sum(before) and b and sum(b['points']) == sum(a['points']), miss_a=1.0, max_s=60)
    check(ok and settle(A, B), 'süresi biten kaybediyor, sayı iki telefonda aynı: %s / %s' % (st(A)['points'], st(B)['points']))

    print('Bağlantı kopunca yetişme')
    # wait until it is A's turn in a rally, drop B's connection, A answers, B must catch up
    play(A, B, lambda a, b: a and b and a['phase'] == 'rally' and a['turn'] == 0 and a['stage'] == 'turn' and not a['busy'], max_s=40)
    B.evaluate('window.__ws.forEach(s => { if (s.readyState === 1 && /\\/oda\\//.test(s.url)) s.close(); })')
    act(A)
    check(settle(A, B, secs=10), 'koptuktan sonra Zeynep kaçırdığı kelimeyi aldı')

    print('Sayfa yeniden açılınca')
    play(A, B, lambda a, b: a and b and a['phase'] == 'rally' and a['done'] >= st(A)['done'] and b['turn'] == 0, max_s=30)
    B.reload(); B.wait_for_timeout(800)
    B.tap('#onlineBtn')
    room(B).get_by_role('button', name='Katıl').tap()
    B.wait_for_function("__kt.G && __kt.G.mode === 'online'", timeout=10000)
    check(settle(A, B, secs=10), 'yeniden açılan sayfa maça kaldığı yerden döndü')
    B.evaluate('__kt.speed = 2')

    print('Maç sonu ve rövanş')
    done = play(A, B, lambda a, b: a and b and a['over'] and b['over'], max_s=540, smash=0.8)
    check(done, 'maç iki telefonda da bitti: %s' % (st(A) or {}).get('points'))
    res = "(() => { const h = document.querySelector('[data-oda]'); return h ? h.shadowRoot.textContent : ''; })"
    A.wait_for_function(res + "().includes('Devam')", timeout=10000)
    B.wait_for_function(res + "().includes('Devam')", timeout=10000)
    ta, tb = A.evaluate(res + '()'), B.evaluate(res + '()')
    pa = st(A)['points']
    winner, loser = (ta, tb) if pa[0] > pa[1] else (tb, ta)
    check('Birinci oldun' in winner and 'kazandı' in loser, 'sonuç ekranı: kazanan ve kaybeden doğru')
    A.screenshot(path=f'{OUT}/online-end-A.png'); B.screenshot(path=f'{OUT}/online-end-B.png')
    room(A).get_by_role('button', name='Devam').tap()
    room(B).get_by_role('button', name='Devam').tap()
    room(A).get_by_role('button', name='Oyunu başlat').tap()
    A.wait_for_function("__kt.G && __kt.G.mode === 'online' && !__kt.G.over && __kt.G.net.done === 0", timeout=8000)
    B.wait_for_function("__kt.G && __kt.G.mode === 'online' && !__kt.G.over && __kt.G.net.done === 0", timeout=8000)
    check(st(A)['points'] == [0, 0] and st(B)['points'] == [0, 0], 'rövanş iki telefonda yeni maç açtı')
    print('Odadan çıkış')
    A.evaluate('__kt.toMenu()')
    A.wait_for_timeout(400)
    check(A.is_visible('#menu') and A.evaluate('__kt.S.len') == 4 and A.evaluate("__kt.S.pace") == 'normal', 'odadan çıkınca menü ve telefonun kendi ayarları geri geldi')
    B.evaluate('__kt.toMenu()')
    B.wait_for_timeout(400)

    print('Saat (maç boyu süre), iki telefon')
    A.tap('#onlineBtn')
    room(A).get_by_role('button', name='Oda kur').tap()
    A.wait_for_function('__kt.oda && __kt.oda.id && __kt.oda.ben', timeout=8000)
    A.wait_for_timeout(400)
    check(room(A).get_by_role('button', name='20 sn').count() == 0, 'odada "Herkesin süresi" yalnız Saat seçilince')
    room(A).get_by_role('button', name='Saat').tap()
    room(A).get_by_role('button', name='20 sn').tap()
    A.screenshot(path=f'{OUT}/online-clock-wait.png')
    oda_id = A.evaluate('__kt.oda.id')
    B.goto(URL + '?oda=' + oda_id); B.wait_for_timeout(500)
    B.wait_for_function('__kt.oda && __kt.oda.ben', timeout=8000)
    A.wait_for_function("() => { const h = document.querySelector('[data-oda]'); return h && h.shadowRoot.textContent.includes('Zeynep'); }", timeout=8000)
    room(A).get_by_role('button', name='Oyunu başlat').tap()
    for pg in (A, B):
        pg.wait_for_function("__kt.G && __kt.G.mode === 'online' && __kt.G.m.clockMode", timeout=8000)
        pg.evaluate('__kt.speed = 2')
    check(A.evaluate('__kt.G.m.bank') == 20 and B.evaluate('__kt.G.m.bank') == 20, 'iki telefonda da saat, 20 sn')
    banks = lambda pg: pg.evaluate('__kt.G.m.banks')
    check(play(A, B, lambda a, b: a and b and a['done'] >= 5 and a['phase'] == 'rally'), 'saatle birkaç kelime gidip geldi')
    check(settle(A, B) and banks(A) == banks(B)[::-1], 'iki telefonda süreler aynı: %s / %s' % (banks(A), banks(B)))
    A.screenshot(path=f'{OUT}/online-clock-A.png')
    def give(pg, other, n=1):
        got, t0 = 0, time.time()
        while got < n and time.time() - t0 < 60:
            s = st(pg)
            if s and s['phase'] == 'rally' and s['turn'] == 0 and s['stage'] == 'turn' and s['running'] and not s['busy']:
                pg.tap('#panel0 .give')
                got += 1
                pg.wait_for_timeout(300)
            else:
                act(pg); act(other)
            time.sleep(0.12)
        return got == n
    check(give(A, B) and settle(A, B), 'Umut sayıyı verdi')
    check(A.evaluate('__kt.G.m.stats.passes[0]') == 1 and B.evaluate('__kt.G.m.stats.passes[1]') == 1 and banks(A) == banks(B)[::-1],
          'Zeynep\'in telefonunda da: sayı Zeynep\'in, Umut\'un kalan süresi aynı')
    check(give(B, A, 3) and settle(A, B), 'Zeynep üç sayı verdi')
    print('  sayılar %s, süreler %s' % (st(A)['points'], banks(A)))
    # Umut stops answering: his clock runs out and he loses the match on both phones, whatever the score
    done = play(A, B, lambda a, b: a and b and a['over'] and b['over'], max_s=90, miss_a=1.0)
    pa = st(A)['points']
    check(done and A.evaluate('__kt.G.m.winner') == 1 and B.evaluate('__kt.G.m.winner') == 0, 'Umut\'un süresi bitti, iki telefonda da Zeynep kazandı (%s)' % pa)
    check(A.evaluate('__kt.G.m.banks[0]') == 0 and B.evaluate('__kt.G.m.history[__kt.G.m.history.length - 1].flag'), 'süre bitti iki telefonda da')
    A.wait_for_function(res + "().includes('Devam')", timeout=10000)
    B.wait_for_function(res + "().includes('Devam')", timeout=10000)
    check('Birinci oldun' in B.evaluate(res + '()') and 'kazandı' in A.evaluate(res + '()'),
          'oda sonucu maçı kazananı birinci gösteriyor' + (' (sayıda önde olan kaybetti)' if pa[0] > pa[1] else ''))
    A.screenshot(path=f'{OUT}/online-clock-end-A.png'); B.screenshot(path=f'{OUT}/online-clock-end-B.png')

    print('Uzat / kısalt, iki telefon')
    room(A).get_by_role('button', name='Devam').tap()
    room(B).get_by_role('button', name='Devam').tap()
    room(A).get_by_role('button', name='Rahat').tap()
    room(A).get_by_role('button', name='Maçta 2 hak').tap()
    room(A).get_by_role('button', name='Oyunu başlat').tap()
    for pg in (A, B):
        pg.wait_for_function("__kt.G && __kt.G.mode === 'online' && !__kt.G.over && __kt.G.m.resize === 2", timeout=8000)
        pg.evaluate('__kt.speed = 2')
    check(A.evaluate('__kt.G.lex.maxLen') == 5 and B.evaluate('__kt.G.lex.maxLen') == 5, 'iki telefonda da uzat/kısalt: maçta 2 hak')
    RES = """(() => { const G = __kt.G, m = G.m, w = m.point.word;
      for (const x of G.lex.resizes(w, m.point.used, true)) { const st = G.lex.step(w, x); if (st) return { x, at: st.at }; }
      return null; })()"""
    done_r, t0 = False, time.time()
    while not done_r and time.time() - t0 < 120:
        s_ = st(A)
        if s_ and s_['phase'] == 'rally' and s_['turn'] == 0 and s_['stage'] == 'turn' and s_['running'] and not s_['busy']:
            r = A.evaluate(RES)
            if r:
                A.evaluate(f"__kt.attempt(0, '{r['x']}', {r['at']})")
                done_r = r
                continue
        act(A); act(B)
        time.sleep(0.12)
    check(bool(done_r) and settle(A, B), 'Umut bir harf ekleyip/çıkarıp gönderdi: %s' % (done_r and done_r['x'].upper()))
    check(A.evaluate('__kt.G.m.rights') == B.evaluate('__kt.G.m.rights')[::-1] == [1, 2], 'iki telefonda da Umut\'un 1 hakkı kaldı')
    B.wait_for_function("document.querySelector('#panel1 .prz').textContent === '±1'", timeout=5000)
    check(True, 'Zeynep\'in ekranında Umut\'un yanında ±1')
    B.screenshot(path=f'{OUT}/online-resize-B.png')
    ca.close(); cb.close(); br.close()

srv.terminate()
for e in errors: print('  ! ' + e)
if errors: fails.append('console errors')
print('\n' + ('HEPSİ GEÇTİ' if not fails else 'KALANLAR: ' + '; '.join(fails)))
sys.exit(1 if fails else 0)
