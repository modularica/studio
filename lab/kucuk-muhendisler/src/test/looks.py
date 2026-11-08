# Üç görünümün ekran görüntüleri: canlı kurulum, dönüşüm anı, canlı çalışma.
# Önce: node build.js --local /tmp/km-local.html
from playwright.sync_api import sync_playwright

URL = 'file:///tmp/km-local.html#hepsi'
OUT = '/tmp/km-shots'
errors = []

def place(page, idx):
    page.evaluate(f"""() => {{ const G = KM_GAME; G.loadLevel({idx}); G.S.parts = [];
        for (const p of G.S.level.sol[0].parts) G.addPlaced(Object.assign({{ id: G.S.nextId++ }}, {{ type: p.type, o: p.o, x: p.x, y: p.y }}));
        G.saveSetup(); G.refreshSide(); }}""")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    page = b.new_page(viewport={'width': 1366, 'height': 1024})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL); page.wait_for_timeout(700)
    # 1) Canlı: kurarken de gerçek nesneler (Büyük makine)
    page.evaluate("KM_GAME.setLook('canli')")
    place(page, 7); page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/20-canli-kurulum.png')
    # 2) Çizim → canlı: dönüşüm anı ve sonrası (Tetik)
    page.evaluate("KM_GAME.setLook('gecis')")
    place(page, 13); page.wait_for_timeout(200)
    page.click('#run'); page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/21-gecis-tarama.png')
    page.wait_for_timeout(2700)
    page.screenshot(path=f'{OUT}/22-gecis-canli.png')
    ok = False
    for _ in range(80):
        if page.evaluate("!document.getElementById('result').hidden"): ok = True; break
        page.wait_for_timeout(100)
    print('Tetik (çizim → canlı) çözüldü:', ok)
    b.close()
print('hatalar:', errors or 'yok')
