#!/usr/bin/env python3
"""Plays a round of a stand-alone build on a phone-sized page with a fake Lab account and a fake iPhone sensor:
permission, shaking, lid, clock, pause, "Nasıldı?", ending early, the word list (checked against a plain solver),
the old mixed-letters setting coming back upright, bad boards rolled again.

    python3 lab/harf-kutusu/src/build.py /tmp/hk.html
    python3 lab/harf-kutusu/src/test/browser.py /tmp/hk.html     (screenshots in /tmp/hk-shots/)
"""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

PAGE = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/hk.html").resolve()
SHOTS = pathlib.Path("/tmp/hk-shots")
SHOTS.mkdir(exist_ok=True)

FAKE = """
try { localStorage.setItem('harf-kutusu.debug', '1'); } catch (e) {}
window.Hesap = { nasildi(o) { window.__nas = (window.__nas || []).concat([o]); },
                 not(s) { (window.__notes = window.__notes || []).push(s); } };
document.addEventListener('click', (e) => { const b = e.target.closest('[data-nasildi]');
  if (b) window.Hesap.nasildi({ yer: b.dataset.nasildi }); });
if (window.DeviceMotionEvent) DeviceMotionEvent.requestPermission = () => Promise.resolve('granted');
window.__shake = (ms) => new Promise((done) => {
  let t = 0, s = 1;
  const id = setInterval(() => {
    s = -s; window.dispatchEvent(new DeviceMotionEvent('devicemotion',
      { accelerationIncludingGravity: { x: 14 * s, y: -12 * s, z: 9.8 + 8 * s }, interval: 16 }));
    if ((t += 30) >= ms) { clearInterval(id); done(); }
  }, 30);
});
"""

SPELLS = """(w) => {
  const d = [...document.querySelectorAll('.die')], n = Math.round(Math.sqrt(d.length));
  const order = d.map((c, i) => [c.querySelector('.ord'), i]).filter((x) => x[0])
    .sort((a, b) => +a[0].textContent - +b[0].textContent).map((x) => x[1]);
  const spelled = order.map((i) => d[i].querySelector('b').textContent).join('');
  const touching = order.every((i, k) => k === 0 || (Math.abs(Math.floor(i / n) - Math.floor(order[k - 1] / n)) <= 1
    && Math.abs(i % n - order[k - 1] % n) <= 1));
  return spelled === w && touching && new Set(order).size === order.length;
}"""

WORDS = (pathlib.Path(__file__).resolve().parents[1] / "words.txt").read_text(encoding="utf-8").split("\n")
VALID = {w.rstrip(".") for w in WORDS}
PREFIX = {w[:i] for w in VALID for i in range(1, len(w) + 1)}


def solve(letters, n, minlen=3):
    found = set()

    def dfs(i, s, used):
        s += letters[i]
        if s not in PREFIX:
            return
        if len(s) >= minlen and s in VALID:
            found.add(s)
        r, c = divmod(i, n)
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                rr, cc = r + dr, c + dc
                j = rr * n + cc
                if (dr or dc) and 0 <= rr < n and 0 <= cc < n and j not in used:
                    dfs(j, s, used | {j})

    for i in range(n * n):
        dfs(i, "", {i})
    return found


fails = []


def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 760}, device_scale_factor=2)
        await ctx.add_init_script(FAKE)
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(PAGE.as_uri())
        await page.wait_for_timeout(400)
        phase = lambda: page.locator("#app").get_attribute("data-phase")

        check(await page.locator("#motionBtn").count() == 1, "iPhone: 'Sallayarak oyna' offered")
        await page.screenshot(path=str(SHOTS / "1-idle.png"))
        await page.locator("#motionBtn").click()
        await page.evaluate("window.dispatchEvent(new DeviceMotionEvent('devicemotion', {accelerationIncludingGravity: {x: 0, y: 0, z: 9.8}, interval: 16}))")
        await page.wait_for_timeout(100)
        check("telefonu sallasın" in await page.locator("#info").inner_text(), "after permission the hint says to shake the phone")

        await page.evaluate("window.__shake(700)")
        check(await phase() == "shaking", "shaking the phone shakes the dice")
        await page.wait_for_timeout(1300)
        check(await phase() == "countdown", "stopping settles the dice under the lid")
        check(await page.locator("#lid").get_attribute("class") == "lid", "lid covers the board during the countdown")
        await page.wait_for_timeout(3300)
        check(await phase() == "playing", "lid opens and the clock runs")
        notes = await page.evaluate("window.__notes || []")
        check(any("1. el başladı" in n for n in notes), f"Lab note on start: {notes}")

        await page.evaluate("window.__shake(700)")
        check(await phase() == "playing", "shaking during a round does nothing")

        await page.locator("#mainBtn").click()
        check(await phase() == "paused", "Durdur pauses")
        check(await page.locator("#lidNasil").is_visible(), "'Nasıldı?' on the pause lid")
        await page.locator("#lidNasil").click()
        nas = await page.evaluate("window.__nas || []")
        check(len(nas) == 1 and nas[0]["yer"] == "mola", f"'Nasıldı?' opens with yer=mola: {nas}")
        await page.locator("#mainBtn").click()
        check(await phase() == "playing", "Devam et resumes")
        check(await page.locator("#rightBtn").inner_text() == "Bitir", "Bitir during the round")
        await page.locator("#rightBtn").click()
        check(await page.locator("#rightBtn").inner_text() == "Emin misiniz?", "ending early asks once")
        await page.locator("#rightBtn").click()
        check(await phase() == "ended", "round ended early")
        check(await page.locator("#info [data-nasildi='el-sonu']").count() == 1, "'Nasıldı?' at the end")
        notes = await page.evaluate("window.__notes || []")
        check(any("bitti" in n and "erken" in n for n in notes), "Lab note on early end")

        # Words on the board
        btn = page.locator("#wordsBtn")
        check(await btn.count() == 1, "end of round offers the word list")
        n_known = int(await btn.locator("b").inner_text())
        await btn.click()
        check(await page.locator("#words").is_visible(), "word list opens over the bottom panel")
        chips = page.locator("#wordsList .wchip")
        check(await chips.count() == n_known, f"list shows the {n_known} known words")
        if n_known:
            first = chips.first
            w = await first.inner_text()
            await first.click()
            check(await page.locator(".die.hl").count() == len(w), f"tapping {w} lights {len(w)} dice")
            ok = await page.evaluate(SPELLS, w)
            check(ok, "lit dice spell the word along touching dice")
            check(await page.locator("#farNote").inner_text() == w, "the word shows on the far strip too")
            await page.screenshot(path=str(SHOTS / "2-words.png"))
            await first.click()
            check(await page.locator(".die.hl").count() == 0, "tapping again clears it")
        if await page.locator("#rareBtn").is_visible():
            await page.locator("#rareBtn").click()
            check(await chips.count() > n_known, "rare words can be shown too")
        await page.locator("#wordsClose").click()
        check(not await page.locator("#words").is_visible() and await page.locator(".die.hl").count() == 0,
              "closing the list clears the board")

        # The page finds exactly the words a plain solver finds (fixed 5x5 board)
        letters = list("KALEMATİŞEROKUYÇANDIRSÜTGE")[:25]
        await page.evaluate("""(l) => localStorage.setItem('harf-kutusu.v1', JSON.stringify({S: {rotV: 2},
            G: {phase: 'ended', round: 2, total: 180000, left: 0, endAt: 0,
                board: {size: 5, letters: l, rot: Array(25).fill(0), tilt: Array(25).fill(0)}}}))""", letters)
        await page.reload()
        await page.wait_for_timeout(300)
        await page.locator("#wordsBtn").click()
        if await page.locator("#rareBtn").is_visible():
            await page.locator("#rareBtn").click()
        got = set(await page.locator("#wordsList .wchip").all_inner_texts())
        want = solve(letters, 5)
        check(got == want, f"5x5 solver matches: page {len(got)}, reference {len(want)}, diff {sorted(got ^ want)[:8]}")
        await page.screenshot(path=str(SHOTS / "3-words-5x5.png"))
        await page.locator("#wordsClose").click()

        # A device that played the first (mixed letters) version comes back upright.
        await page.evaluate("""localStorage.setItem('harf-kutusu.v1', JSON.stringify({S: {rot: 'mix'}, G: null}))""")
        await page.reload()
        await page.wait_for_timeout(300)
        rots = await page.evaluate("[...document.querySelectorAll('.die')].map(d => d.style.getPropertyValue('--rot'))")
        check(all(r in ("0deg", "") for r in rots), "a device saved with mixed letters comes back upright")
        await page.locator("#rightBtn").click()
        await page.wait_for_timeout(300)
        check(await page.locator("#rotFlat").get_attribute("aria-pressed") == "true", "settings show Düz")
        await page.locator("#rotMix").click()
        await page.locator("#setClose").click()
        await page.wait_for_timeout(300)
        await page.reload()
        await page.wait_for_timeout(300)
        rots = await page.evaluate("[...document.querySelectorAll('.die')].map(d => d.style.getPropertyValue('--rot'))")
        check(any(r not in ("0deg", "") for r in rots), "choosing Karışık again is kept after reload")

        # Bad boards are rolled again (13 Nov: a one-vowel board came up)
        stats = await page.evaluate("""() => {
          const out = {};
          for (const [n, N] of [[4, 300], [5, 60]]) {
            const t0 = performance.now(); let bad = 0, minV = 99, minK = 999;
            for (let i = 0; i < N; i++) {
              const b = __hk.rollGood(n);
              const v = b.letters.filter((c) => 'AEIİOÖUÜ'.includes(c)).length;
              const k = __hk.solveBoard(b, 3).filter((x) => x.known).length;
              minV = Math.min(minV, v); minK = Math.min(minK, k);
              if (v < __hk.GOOD[n].vowels || k < __hk.GOOD[n].words) bad++;
            }
            out[n] = { bad, minV, minK, ms: Math.round((performance.now() - t0) / N) };
          }
          return out;
        }""")
        check(stats["4"]["bad"] == 0 and stats["5"]["bad"] == 0, f"every rolled board has enough vowels and words: {stats}")
        check(not errors, f"no page errors {errors}")
        await b.close()
    print("\nall passed" if not fails else f"\n{len(fails)} failed")
    sys.exit(1 if fails else 0)


asyncio.run(main())
