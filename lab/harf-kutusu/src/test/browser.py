#!/usr/bin/env python3
"""Plays one round of a stand-alone build on a phone-sized page with a fake Lab account and a fake iPhone sensor.

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
        await page.locator("#rightBtn").click()
        check(await page.locator("#rightBtn").inner_text() == "Emin misiniz?", "ending early asks once")
        await page.locator("#rightBtn").click()
        check(await phase() == "ended", "round ended")
        check(await page.locator("#info [data-nasildi='el-sonu']").count() == 1, "'Nasıldı?' with the points at the end")
        notes = await page.evaluate("window.__notes || []")
        check(any("bitti" in n for n in notes), "Lab note on end")
        await page.screenshot(path=str(SHOTS / "2-ended.png"))

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

        check(not errors, f"no page errors {errors}")
        await b.close()
    print("\nall passed" if not fails else f"\n{len(fails)} failed")
    sys.exit(1 if fails else 0)


asyncio.run(main())
